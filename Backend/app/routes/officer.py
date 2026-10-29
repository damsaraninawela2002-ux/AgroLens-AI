import math
import re
from datetime import datetime, timezone
from typing import Any, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from app.core.database import get_database
from app.core.security import require_role
from app.routes.predict import serialize_diagnosis, serialize_treatment
from app.services.ml_service import get_class_names

router = APIRouter(prefix="/api/officer", tags=["Agricultural Officer Review"])


class OfficerReviewRequest(BaseModel):
    action: Literal["confirm", "correct"] = Field(
        ...,
        description="Review action: 'confirm' if the AI prediction is accurate, or 'correct' to supply the true disease class.",
    )
    corrected_label: Optional[str] = Field(
        default=None,
        description="Required when action is 'correct'. Must match one of the class names in class_names.json.",
    )
    notes: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional agronomic notes or recommendations from the officer (max 500 characters).",
    )


def format_fallback_disease_name(class_key: str) -> str:
    return class_key.replace("___", " — ").replace("_", " ")


async def enrich_diagnoses_with_farmer_names(
    db: Any, docs: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Attach farmer_name to a list of serialized diagnosis documents."""
    if not docs:
        return []

    user_ids = list({doc.get("user_id") for doc in docs if doc.get("user_id")})
    object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]

    user_map: dict[str, str] = {}
    if object_ids:
        user_cursor = db["users"].find(
            {"_id": {"$in": object_ids}},
            {"full_name": 1},
        )
        user_docs = await user_cursor.to_list(length=len(object_ids))
        for u in user_docs:
            user_map[str(u["_id"])] = u.get("full_name", "Unknown Farmer")

    enriched: list[dict[str, Any]] = []
    for doc in docs:
        item = serialize_diagnosis(doc)
        item["farmer_name"] = user_map.get(doc.get("user_id", ""), "Unknown Farmer")
        enriched.append(item)

    return enriched


@router.get(
    "/pending",
    status_code=status.HTTP_200_OK,
    summary="Get diagnoses with status 'pending_review' (oldest first, defaults to officer's district)",
)
async def get_pending_diagnoses(
    district: Optional[str] = Query(
        default=None,
        description="Filter by district name, or pass 'all' for all districts. Defaults to the officer's own district.",
    ),
    crop: Optional[str] = Query(
        default=None,
        description="Optional crop prefix filter (e.g. Tomato, Potato, Pepper).",
    ),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(require_role("officer", "admin")),
) -> dict[str, Any]:
    db = get_database()
    query: dict[str, Any] = {"status": "pending_review"}

    if district is None or not district.strip():
        query["district"] = current_user["district"]
    elif district.strip().lower() != "all":
        query["district"] = district.strip()

    if crop and crop.strip():
        escaped_crop = re.escape(crop.strip())
        query["predicted_class"] = {"$regex": f"^{escaped_crop}", "$options": "i"}

    total = await db["diagnoses"].count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db["diagnoses"]
        .find(query)
        .sort("created_at", 1)  # Oldest first
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    items = await enrich_diagnoses_with_farmer_names(db, docs)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.get(
    "/reviewed",
    status_code=status.HTTP_200_OK,
    summary="Get diagnoses reviewed by the logged-in officer (newest first, paginated)",
)
async def get_reviewed_diagnoses(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    current_user: dict = Depends(require_role("officer", "admin")),
) -> dict[str, Any]:
    db = get_database()
    query: dict[str, Any] = {"reviewed_by": current_user["id"]}

    total = await db["diagnoses"].count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db["diagnoses"]
        .find(query)
        .sort("reviewed_at", -1)  # Newest first
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    items = await enrich_diagnoses_with_farmer_names(db, docs)

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.get(
    "/diagnoses/{diagnosis_id}",
    status_code=status.HTTP_200_OK,
    summary="Get full details of a single diagnosis for officer inspection",
)
async def get_officer_diagnosis_detail(
    diagnosis_id: str,
    current_user: dict = Depends(require_role("officer", "admin")),
) -> dict[str, Any]:
    if not ObjectId.is_valid(diagnosis_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    db = get_database()
    doc = await db["diagnoses"].find_one({"_id": ObjectId(diagnosis_id)})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    enriched_list = await enrich_diagnoses_with_farmer_names(db, [doc])
    diagnosis_data = enriched_list[0]

    effective_disease_key = doc.get("officer_label") or doc["predicted_class"]
    treatment_doc = await db["treatments"].find_one(
        {"disease_key": effective_disease_key}
    )

    return {
        "diagnosis": diagnosis_data,
        "treatment": serialize_treatment(treatment_doc),
    }


@router.put(
    "/review/{diagnosis_id}",
    status_code=status.HTTP_200_OK,
    summary="Confirm or correct a diagnosis and notify the farmer",
)
async def review_diagnosis(
    diagnosis_id: str,
    payload: OfficerReviewRequest,
    current_user: dict = Depends(require_role("officer", "admin")),
) -> dict[str, Any]:
    if not ObjectId.is_valid(diagnosis_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    db = get_database()
    doc = await db["diagnoses"].find_one({"_id": ObjectId(diagnosis_id)})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Diagnosis not found",
        )

    current_status = doc.get("status")
    if current_status not in ("pending_review", "auto"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Diagnosis has already been reviewed (current status: '{current_status}'). "
                "Only diagnoses with status 'pending_review' or 'auto' can be reviewed."
            ),
        )

    valid_classes = get_class_names()

    if payload.action == "confirm":
        new_status = "confirmed"
        officer_label = doc["predicted_class"]
    else:
        if not payload.corrected_label or not payload.corrected_label.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="corrected_label is required when action is 'correct'.",
            )
        corrected_label = payload.corrected_label.strip()
        if corrected_label not in valid_classes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid corrected_label '{corrected_label}'. "
                    "Must be one of the valid class names in class_names.json."
                ),
            )
        new_status = "corrected"
        officer_label = corrected_label

    cleaned_notes = (
        payload.notes.strip()
        if payload.notes and payload.notes.strip()
        else None
    )
    reviewed_at = datetime.now(timezone.utc)
    officer_name = current_user["full_name"]

    update_fields = {
        "status": new_status,
        "officer_label": officer_label,
        "officer_notes": cleaned_notes,
        "reviewed_by": current_user["id"],
        "reviewed_by_name": officer_name,
        "reviewed_at": reviewed_at,
    }

    await db["diagnoses"].update_one(
        {"_id": ObjectId(diagnosis_id)},
        {"$set": update_fields},
    )
    doc.update(update_fields)

    # Look up bilingual disease names from treatments collection for notification messages
    treatment_doc = await db["treatments"].find_one({"disease_key": officer_label})
    fallback_name = format_fallback_disease_name(officer_label)
    disease_name_en = (
        treatment_doc.get("disease_name_en", fallback_name)
        if treatment_doc
        else fallback_name
    )
    disease_name_si = (
        treatment_doc.get("disease_name_si", fallback_name)
        if treatment_doc
        else fallback_name
    )

    if payload.action == "confirm":
        notif_type = "review_confirmed"
        title_en = "Leaf Diagnosis Confirmed by Agricultural Officer"
        title_si = "කෘෂිකර්ම නිලධාරියා විසින් රෝග විනිශ්චය තහවුරු කරන ලදී"
        message_en = (
            f"Agricultural Officer {officer_name} confirmed your leaf scan diagnosis "
            f"as {disease_name_en}."
        )
        message_si = (
            f"කෘෂිකර්ම නිලධාරී {officer_name} විසින් ඔබගේ පත්‍ර පරීක්ෂාව "
            f"'{disease_name_si}' ලෙස තහවුරු කරන ලදී."
        )
    else:
        notif_type = "review_corrected"
        title_en = "Leaf Diagnosis Corrected by Agricultural Officer"
        title_si = "කෘෂිකර්ම නිලධාරියා විසින් රෝග විනිශ්චය නිවැරදි කරන ලදී"
        message_en = (
            f"Agricultural Officer {officer_name} reviewed your leaf scan and updated "
            f"the diagnosis to {disease_name_en} ({officer_label})."
        )
        message_si = (
            f"කෘෂිකර්ම නිලධාරී {officer_name} විසින් ඔබගේ පත්‍ර පරීක්ෂාව පරීක්ෂා කර "
            f"නිවැරදි රෝගය '{disease_name_si}' ({disease_name_en}) ලෙස යාවත්කාලීන කරන ලදී."
        )

    notification_doc = {
        "user_id": doc["user_id"],
        "type": notif_type,
        "title_en": title_en,
        "title_si": title_si,
        "message_en": message_en,
        "message_si": message_si,
        "diagnosis_id": str(doc["_id"]),
        "is_read": False,
        "created_at": reviewed_at,
    }
    await db["notifications"].insert_one(notification_doc)

    # Save feedback record in "training_feedback" collection for model retraining
    feedback_doc = {
        "diagnosis_id": str(doc["_id"]),
        "image_url": doc["image_url"],
        "model_label": doc["predicted_class"],
        "true_label": officer_label,
        "confidence": doc["confidence"],
        "reviewed_at": reviewed_at,
    }
    await db["training_feedback"].insert_one(feedback_doc)

    enriched_list = await enrich_diagnoses_with_farmer_names(db, [doc])
    return {
        "diagnosis": enriched_list[0],
        "treatment": serialize_treatment(treatment_doc),
    }


@router.get(
    "/stats",
    status_code=status.HTTP_200_OK,
    summary="Get review statistics for the logged-in Agricultural Officer",
)
async def get_officer_stats(
    current_user: dict = Depends(require_role("officer", "admin")),
) -> dict[str, Any]:
    db = get_database()
    officer_id = current_user["id"]
    officer_district = current_user["district"]

    now = datetime.now(timezone.utc)
    start_of_today = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        tzinfo=timezone.utc,
    )

    pending_count = await db["diagnoses"].count_documents(
        {"status": "pending_review", "district": officer_district}
    )
    reviewed_today = await db["diagnoses"].count_documents(
        {"reviewed_by": officer_id, "reviewed_at": {"$gte": start_of_today}}
    )
    total_reviewed = await db["diagnoses"].count_documents(
        {"reviewed_by": officer_id}
    )
    confirmed_count = await db["diagnoses"].count_documents(
        {"reviewed_by": officer_id, "status": "confirmed"}
    )
    corrected_count = await db["diagnoses"].count_documents(
        {"reviewed_by": officer_id, "status": "corrected"}
    )

    return {
        "district": officer_district,
        "pending_count": pending_count,
        "reviewed_today": reviewed_today,
        "total_reviewed": total_reviewed,
        "confirmed_count": confirmed_count,
        "corrected_count": corrected_count,
    }


@router.get(
    "/classes",
    status_code=status.HTTP_200_OK,
    summary="Get list of valid disease class names for the officer correction dropdown",
)
async def get_officer_classes(
    current_user: dict = Depends(require_role("officer", "admin")),
) -> list[str]:
    return get_class_names()
