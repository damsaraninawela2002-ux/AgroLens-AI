import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from app.core.database import get_database
from app.core.security import require_role
from app.services.gradcam import generate_and_save_gradcam
from app.services.ml_service import (
    get_class_names,
    get_model,
    get_model_metrics,
    predict,
)

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads"
IMAGES_DIR = UPLOADS_DIR / "images"
HEATMAPS_DIR = UPLOADS_DIR / "heatmaps"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
HEATMAPS_DIR.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
DISCLAIMER_TEXT = (
    "This is an AI suggestion. Consult an Agricultural Officer for important decisions."
)

router = APIRouter(tags=["Disease Prediction"])


def serialize_diagnosis(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "district": doc["district"],
        "image_url": doc["image_url"],
        "heatmap_url": doc["heatmap_url"],
        "predicted_class": doc["predicted_class"],
        "confidence": doc["confidence"],
        "top3": doc["top3"],
        "status": doc["status"],
        "officer_label": doc.get("officer_label"),
        "officer_notes": doc.get("officer_notes"),
        "reviewed_by": doc.get("reviewed_by"),
        "reviewed_by_name": doc.get("reviewed_by_name"),
        "reviewed_at": doc.get("reviewed_at"),
        "created_at": doc["created_at"],
    }


def _as_str(val: Any) -> str:
    if isinstance(val, list):
        return "\n".join(str(x) for x in val)
    return str(val or "")


def serialize_treatment(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if doc is None:
        return None
    return {
        "id": str(doc["_id"]),
        "disease_key": doc["disease_key"],
        "crop": doc["crop"],
        "disease_name_en": doc["disease_name_en"],
        "disease_name_si": doc["disease_name_si"],
        "is_healthy": bool(doc["is_healthy"]),
        "symptoms_en": _as_str(doc.get("symptoms_en")),
        "symptoms_si": _as_str(doc.get("symptoms_si")),
        "treatment_en": _as_str(doc.get("treatment_en")),
        "treatment_si": _as_str(doc.get("treatment_si")),
        "prevention_en": _as_str(doc.get("prevention_en")),
        "prevention_si": _as_str(doc.get("prevention_si")),
        "is_verified": bool(doc.get("is_verified", False)),
        "source": doc.get("source"),
        "verified_by": doc.get("verified_by"),
        "verified_at": doc.get("verified_at"),
        "updated_at": doc.get("updated_at"),
    }


@router.post(
    "/api/predict",
    status_code=status.HTTP_201_CREATED,
    summary="Upload a crop leaf image for AI disease diagnosis and Grad-CAM heatmap (Farmer only)",
)
async def predict_disease(
    file: UploadFile = File(..., description="Leaf photo (JPG, JPEG, or PNG up to 5MB)"),
    current_user: dict = Depends(require_role("farmer")),
) -> dict[str, Any]:
    # 1. Validate filename extension and content type
    original_filename = file.filename or ""
    ext = Path(original_filename).suffix.lower()
    content_type = (file.content_type or "").lower()

    if ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPG, JPEG, and PNG images are allowed.",
        )

    # 2. Read file bytes and enforce 5MB limit
    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 5MB limit.",
        )

    # 3. Verify image integrity with Pillow
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img_format = (img.format or "").upper()
            if img_format not in ("JPEG", "JPG", "PNG"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid image format. Only JPG, JPEG, and PNG images are allowed.",
                )
            img.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, Exception):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is not a valid image.",
        )

    # 4. Save uploaded image to Backend/uploads/images/
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    save_ext = ext if ext in ALLOWED_EXTENSIONS else (".png" if "png" in content_type else ".jpg")
    image_filename = f"{uuid.uuid4().hex}{save_ext}"
    image_path = IMAGES_DIR / image_filename
    image_path.write_bytes(image_bytes)

    # 5. Run model prediction and Grad-CAM generation
    prediction = predict(image_bytes)
    model = get_model()
    heatmap_filename = generate_and_save_gradcam(
        image_bytes=image_bytes,
        model=model,
        heatmaps_dir=HEATMAPS_DIR,
        last_conv_layer_name="Conv_1",
        pred_index=prediction["predicted_index"],
    )

    confidence = prediction["confidence"]
    diagnosis_status = "pending_review" if confidence < 70.0 else "auto"

    # 6. Save diagnosis document in MongoDB "diagnoses" collection
    db = get_database()
    diagnosis_doc = {
        "user_id": current_user["id"],
        "district": current_user["district"],
        "image_url": f"/uploads/images/{image_filename}",
        "heatmap_url": f"/uploads/heatmaps/{heatmap_filename}",
        "predicted_class": prediction["predicted_class"],
        "confidence": confidence,
        "top3": prediction["top3"],
        "status": diagnosis_status,
        "officer_label": None,
        "officer_notes": None,
        "reviewed_by": None,
        "reviewed_by_name": None,
        "reviewed_at": None,
        "created_at": datetime.now(timezone.utc),
    }

    insert_result = await db["diagnoses"].insert_one(diagnosis_doc)
    diagnosis_doc["_id"] = insert_result.inserted_id

    # 7. Look up treatment for predicted class
    treatment_doc = await db["treatments"].find_one(
        {"disease_key": prediction["predicted_class"]}
    )

    return {
        "diagnosis": serialize_diagnosis(diagnosis_doc),
        "treatment": serialize_treatment(treatment_doc),
        "disclaimer": DISCLAIMER_TEXT,
    }


@router.get(
    "/api/predict/history",
    status_code=status.HTTP_200_OK,
    summary="Get the logged-in farmer's diagnosis history (newest first)",
)
async def get_prediction_history(
    current_user: dict = Depends(require_role("farmer")),
) -> list[dict[str, Any]]:
    db = get_database()
    cursor = (
        db["diagnoses"]
        .find({"user_id": current_user["id"]})
        .sort("created_at", -1)
    )
    docs = await cursor.to_list(length=200)
    return [serialize_diagnosis(doc) for doc in docs]


@router.get(
    "/api/predict/{diagnosis_id}",
    status_code=status.HTTP_200_OK,
    summary="Get a single diagnosis by ID (farmer can access only their own diagnosis)",
)
async def get_prediction_by_id(
    diagnosis_id: str,
    current_user: dict = Depends(require_role("farmer")),
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

    if doc.get("user_id") != current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only view your own diagnoses",
        )

    effective_disease_key = doc.get("officer_label") or doc["predicted_class"]
    treatment_doc = await db["treatments"].find_one(
        {"disease_key": effective_disease_key}
    )

    return {
        "diagnosis": serialize_diagnosis(doc),
        "treatment": serialize_treatment(treatment_doc),
        "disclaimer": DISCLAIMER_TEXT,
    }


@router.get(
    "/api/model/info",
    status_code=status.HTTP_200_OK,
    summary="Get ML model class names and evaluation metrics (Public)",
)
async def get_model_info() -> dict[str, Any]:
    return {
        "class_names": get_class_names(),
        "metrics": get_model_metrics(),
    }
