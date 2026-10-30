from collections import Counter, defaultdict
import csv
from datetime import datetime, timedelta, timezone
import io
import math
from pathlib import Path
import re
from typing import Any, Literal, Optional
from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import StreamingResponse
from pymongo.errors import DuplicateKeyError
from app.core.config import settings
from app.core.database import get_database
from app.core.security import (
    hash_password,
    require_role,
    revoke_token_in_memory,
    serialize_user,
    validate_password_policy,
)
from app.models.admin import (
    AdminAnalyticsOverviewResponse,
    AdminAuditLogListResponse,
    AdminDiagnosisDetailResponse,
    AdminDiagnosisItem,
    AdminDiagnosisListResponse,
    AdminDiseaseAnalyticsResponse,
    AdminDistrictAnalyticsResponse,
    AdminModelInfoResponse,
    AdminPasswordReset,
    AdminScansOverTimeResponse,
    AdminTreatmentCreate,
    AdminTreatmentListResponse,
    AdminTreatmentUpdate,
    AdminTreatmentVerifyRequest,
    AdminUserCreate,
    AdminUserDetailResponse,
    AdminUserListResponse,
    AdminUserUpdate,
    AuditLogItem,
    ConfirmedVsCorrectedStats,
    CorrectedClassStatItem,
    DailyScanPoint,
    DiseaseCountItem,
    DistrictScanCountItem,
    TreatmentResponse,
    UsersByRoleStats,
)
from app.models.user import UserResponse
from app.routes.predict import BACKEND_DIR, serialize_diagnosis, serialize_treatment
from app.services.ml_service import get_class_names, get_model_metrics

router = APIRouter(prefix="/api/admin", tags=["Admin Portal"])


# ============================================================================
# HELPERS: AUDIT LOGGING, TREATMENT VERIFICATION CHECK, FILE CLEANUP
# ============================================================================


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract client IP address from proxy headers or client socket host."""
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def write_audit_log(
    db: Any,
    admin_user: dict[str, Any],
    action: str,
    target_type: str,
    target_id: str,
    details: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Insert an immutable audit log record for an admin mutation (never logs secrets)."""
    log_doc = {
        "admin_id": admin_user["id"],
        "admin_name": admin_user["full_name"],
        "action": action,
        "target_type": target_type,
        "target_id": str(target_id),
        "details": details or {},
        "ip_address": ip_address,
        "created_at": datetime.now(timezone.utc),
    }
    await db["audit_logs"].insert_one(log_doc)


def serialize_audit_log(doc: dict[str, Any]) -> AuditLogItem:
    return AuditLogItem(
        id=str(doc["_id"]),
        admin_id=doc["admin_id"],
        admin_name=doc["admin_name"],
        action=doc["action"],
        target_type=doc["target_type"],
        target_id=doc["target_id"],
        details=doc.get("details") or {},
        ip_address=doc.get("ip_address"),
        created_at=doc["created_at"],
    )


def find_unverified_placeholders(doc: dict[str, Any]) -> list[str]:
    """Return field names that still contain 'TO BE VERIFIED' (case-insensitive)."""
    check_fields = (
        "disease_name_en",
        "disease_name_si",
        "symptoms_en",
        "symptoms_si",
        "treatment_en",
        "treatment_si",
        "prevention_en",
        "prevention_si",
        "source",
    )
    flagged: list[str] = []
    for field in check_fields:
        val = doc.get(field)
        if isinstance(val, str):
            if "to be verified" in val.lower():
                flagged.append(field)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, str) and "to be verified" in item.lower():
                    flagged.append(field)
                    break
    return flagged


def delete_upload_file_safely(relative_url: Optional[str]) -> bool:
    """Delete an image or heatmap file under Backend/uploads/ if it exists."""
    if not relative_url or not isinstance(relative_url, str):
        return False
    cleaned = relative_url.strip().lstrip("/")
    if not cleaned.startswith("uploads/"):
        return False
    uploads_root = (BACKEND_DIR / "uploads").resolve()
    target_path = (BACKEND_DIR / cleaned).resolve()
    try:
        target_path.relative_to(uploads_root)
    except ValueError:
        return False
    if target_path.is_file():
        try:
            target_path.unlink()
            return True
        except OSError:
            return False
    return False


async def enrich_admin_diagnoses(
    db: Any, docs: list[dict[str, Any]]
) -> list[AdminDiagnosisItem]:
    """Attach farmer_name and farmer_email to diagnosis documents."""
    if not docs:
        return []

    user_ids = list({doc.get("user_id") for doc in docs if doc.get("user_id")})
    object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]

    user_map: dict[str, dict[str, str]] = {}
    if object_ids:
        cursor = db["users"].find(
            {"_id": {"$in": object_ids}},
            {"full_name": 1, "email": 1},
        )
        user_docs = await cursor.to_list(length=len(object_ids))
        for u in user_docs:
            user_map[str(u["_id"])] = {
                "full_name": u.get("full_name", "Unknown Farmer"),
                "email": u.get("email"),
            }

    items: list[AdminDiagnosisItem] = []
    for doc in docs:
        base = serialize_diagnosis(doc)
        farmer_info = user_map.get(doc.get("user_id", ""), {})
        base["farmer_name"] = farmer_info.get("full_name", "Unknown Farmer")
        base["farmer_email"] = farmer_info.get("email")
        items.append(AdminDiagnosisItem(**base))

    return items


# ============================================================================
# 1. USERS CRUD & OFFICER APPROVAL
# ============================================================================


@router.get(
    "/users",
    response_model=AdminUserListResponse,
    status_code=status.HTTP_200_OK,
    summary="List users with pagination, search, filters, and sorting",
)
async def list_users(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(
        default=None, description="Search by full_name or email"
    ),
    role: Optional[Literal["farmer", "officer", "admin"]] = Query(
        default=None, description="Filter by user role"
    ),
    district: Optional[str] = Query(default=None, description="Filter by district"),
    is_active: Optional[bool] = Query(
        default=None, description="Filter by active status"
    ),
    is_approved: Optional[bool] = Query(
        default=None, description="Filter by approval status"
    ),
    sort: Literal["newest", "oldest", "name"] = Query(
        default="newest", description="Sort order: 'newest', 'oldest', or 'name'"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> AdminUserListResponse:
    db = get_database()
    query: dict[str, Any] = {}

    if search and search.strip():
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"full_name": {"$regex": escaped, "$options": "i"}},
            {"email": {"$regex": escaped, "$options": "i"}},
        ]

    if role:
        query["role"] = role

    if district and district.strip() and district.strip().lower() != "all":
        query["district"] = district.strip()

    if is_active is not None:
        if is_active:
            query["is_active"] = {"$ne": False}
        else:
            query["is_active"] = False

    if is_approved is not None:
        query["is_approved"] = is_approved

    sort_spec: list[tuple[str, int]]
    if sort == "oldest":
        sort_spec = [("created_at", 1)]
    elif sort == "name":
        sort_spec = [("full_name", 1)]
    else:
        sort_spec = [("created_at", -1)]

    total = await db["users"].count_documents(query)
    skip = (page - 1) * limit

    cursor = db["users"].find(query).sort(sort_spec).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)

    return AdminUserListResponse(
        items=[UserResponse(**serialize_user(doc)) for doc in docs],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


@router.get(
    "/users/{user_id}",
    response_model=AdminUserDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single user's profile along with scan count and review count",
)
async def get_user_detail(
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> AdminUserDetailResponse:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    uid_str = str(user_doc["_id"])
    scan_count = await db["diagnoses"].count_documents({"user_id": uid_str})
    review_count = await db["diagnoses"].count_documents({"reviewed_by": uid_str})

    serialized = serialize_user(user_doc)
    serialized["deleted_at"] = user_doc.get("deleted_at")
    serialized["scan_count"] = scan_count
    serialized["review_count"] = review_count
    return AdminUserDetailResponse(**serialized)


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Farmer, Officer, or Admin account",
)
async def create_user_by_admin(
    request: Request,
    payload: AdminUserCreate,
    current_user: dict = Depends(require_role("admin")),
) -> UserResponse:
    db = get_database()
    existing = await db["users"].find_one({"email": payload.email})
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    now = datetime.now(timezone.utc)
    if payload.is_approved is not None:
        is_approved = payload.is_approved
    else:
        # Accounts created directly by an admin default to approved unless specified false
        is_approved = True

    approved_by = current_user["id"] if (payload.role == "officer" and is_approved) else None
    approved_at = now if (payload.role == "officer" and is_approved) else None

    user_doc = {
        "full_name": payload.full_name,
        "email": payload.email,
        "hashed_password": hash_password(payload.password),
        "role": payload.role,
        "district": payload.district,
        "preferred_language": payload.preferred_language,
        "is_active": payload.is_active,
        "is_approved": is_approved,
        "approved_by": approved_by,
        "approved_at": approved_at,
        "failed_login_count": 0,
        "failed_login_attempts": 0,
        "first_failed_login_at": None,
        "locked_until": None,
        "updated_at": now,
        "created_at": now,
    }

    try:
        result = await db["users"].insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    user_doc["_id"] = result.inserted_id
    created_id = str(result.inserted_id)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.create",
        target_type="user",
        target_id=created_id,
        details={
            "email": payload.email,
            "full_name": payload.full_name,
            "role": payload.role,
            "district": payload.district,
            "is_active": payload.is_active,
            "is_approved": is_approved,
        },
        ip_address=get_client_ip(request),
    )

    return UserResponse(**serialize_user(user_doc))


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a user's details, role, district, language, or active status",
)
async def update_user_by_admin(
    request: Request,
    user_id: str,
    payload: AdminUserUpdate,
    current_user: dict = Depends(require_role("admin")),
) -> UserResponse:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    is_self = str(user_doc["_id"]) == current_user["id"]
    if is_self:
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own admin account",
            )
        if payload.role is not None and payload.role != user_doc["role"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change the role of your own admin account",
            )

    # Protect the last active admin
    was_active_admin = (
        user_doc.get("role") == "admin" and user_doc.get("is_active", True) is True
    )
    will_lose_admin = (payload.is_active is False) or (
        payload.role is not None and payload.role != "admin"
    )
    if was_active_admin and will_lose_admin:
        active_admin_count = await db["users"].count_documents(
            {"role": "admin", "is_active": {"$ne": False}}
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate or demote the last active admin",
            )

    now = datetime.now(timezone.utc)
    update_fields: dict[str, Any] = {"updated_at": now}
    changed_details: dict[str, Any] = {}

    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name
        changed_details["full_name"] = payload.full_name
    if payload.role is not None:
        update_fields["role"] = payload.role
        changed_details["role"] = payload.role
        if payload.role in ("farmer", "admin"):
            update_fields["is_approved"] = True
    if payload.district is not None:
        update_fields["district"] = payload.district
        changed_details["district"] = payload.district
    if payload.preferred_language is not None:
        update_fields["preferred_language"] = payload.preferred_language
        changed_details["preferred_language"] = payload.preferred_language
    if payload.is_active is not None:
        update_fields["is_active"] = payload.is_active
        changed_details["is_active"] = payload.is_active
        if payload.is_active:
            update_fields["deleted_at"] = None

    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
    )
    user_doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.update",
        target_type="user",
        target_id=user_id,
        details=changed_details,
        ip_address=get_client_ip(request),
    )

    return UserResponse(**serialize_user(user_doc))


@router.put(
    "/users/{user_id}/approve",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve an Agricultural Officer account",
)
async def approve_officer(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> UserResponse:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user_doc.get("role") != "officer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Agricultural Officer accounts can be approved",
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "is_approved": True,
        "is_active": True,
        "approved_by": current_user["id"],
        "approved_at": now,
        "updated_at": now,
    }
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
    )
    user_doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.approve",
        target_type="user",
        target_id=user_id,
        details={
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
            "district": user_doc["district"],
        },
        ip_address=get_client_ip(request),
    )

    return UserResponse(**serialize_user(user_doc))


@router.put(
    "/users/{user_id}/reject",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject or revoke approval for an Agricultural Officer account",
)
async def reject_officer(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> UserResponse:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user_doc.get("role") != "officer":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only Agricultural Officer accounts can be rejected",
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "is_approved": False,
        "approved_by": None,
        "approved_at": None,
        "updated_at": now,
    }
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
    )
    user_doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.reject",
        target_type="user",
        target_id=user_id,
        details={
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
            "district": user_doc["district"],
        },
        ip_address=get_client_ip(request),
    )

    return UserResponse(**serialize_user(user_doc))


@router.put(
    "/users/{user_id}/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Admin reset of a user's password",
)
async def reset_user_password(
    request: Request,
    user_id: str,
    payload: AdminPasswordReset,
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, str]:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    try:
        validate_password_policy(payload.new_password, email=user_doc.get("email"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "hashed_password": hash_password(payload.new_password),
                "failed_login_count": 0,
                "failed_login_attempts": 0,
                "first_failed_login_at": None,
                "locked_until": None,
                "updated_at": now,
            }
        },
    )

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.reset_password",
        target_type="user",
        target_id=user_id,
        details={"email": user_doc["email"]},
        ip_address=get_client_ip(request),
    )

    return {"message": "Password has been reset successfully"}


@router.put(
    "/users/{user_id}/unlock",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Unlock a brute-force locked user account and reset failed login count",
)
async def unlock_user_account(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> UserResponse:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "failed_login_count": 0,
        "failed_login_attempts": 0,
        "first_failed_login_at": None,
        "locked_until": None,
        "updated_at": now,
    }
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields},
    )
    user_doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.unlock",
        target_type="user",
        target_id=user_id,
        details={
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
        },
        ip_address=get_client_ip(request),
    )

    return UserResponse(**serialize_user(user_doc))


@router.delete(
    "/users/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a user account (sets is_active=False and deleted_at)",
)
async def delete_user_by_admin(
    request: Request,
    user_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> Response:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    db = get_database()
    user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
    if user_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if str(user_doc["_id"]) == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account",
        )

    if user_doc.get("role") == "admin" and user_doc.get("is_active", True) is True:
        active_admin_count = await db["users"].count_documents(
            {"role": "admin", "is_active": {"$ne": False}}
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last active admin",
            )

    now = datetime.now(timezone.utc)
    await db["users"].update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "is_active": False,
                "deleted_at": now,
                "updated_at": now,
            }
        },
    )

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="user.delete",
        target_type="user",
        target_id=user_id,
        details={
            "email": user_doc["email"],
            "full_name": user_doc["full_name"],
            "role": user_doc["role"],
        },
        ip_address=get_client_ip(request),
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 2. TREATMENTS CRUD & VERIFICATION
# ============================================================================


@router.get(
    "/treatments",
    response_model=AdminTreatmentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all treatments with optional search, crop, and verification filters",
)
async def list_treatments(
    search: Optional[str] = Query(
        default=None,
        description="Search by disease_key, English name, or Sinhala name",
    ),
    crop: Optional[str] = Query(default=None, description="Filter by crop name"),
    is_verified: Optional[bool] = Query(
        default=None, description="Filter by verification status"
    ),
    verified: Optional[bool] = Query(
        default=None, description="Alias for is_verified filter"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> AdminTreatmentListResponse:
    db = get_database()
    query: dict[str, Any] = {}

    if search and search.strip():
        escaped = re.escape(search.strip())
        query["$or"] = [
            {"disease_key": {"$regex": escaped, "$options": "i"}},
            {"disease_name_en": {"$regex": escaped, "$options": "i"}},
            {"disease_name_si": {"$regex": escaped, "$options": "i"}},
        ]

    if crop and crop.strip() and crop.strip().lower() != "all":
        escaped_crop = re.escape(crop.strip())
        query["crop"] = {"$regex": escaped_crop, "$options": "i"}

    verified_filter = is_verified if is_verified is not None else verified
    if verified_filter is not None:
        if verified_filter:
            query["is_verified"] = True
        else:
            query["is_verified"] = {"$ne": True}

    cursor = db["treatments"].find(query).sort("disease_key", 1)
    docs = await cursor.to_list(length=200)
    items = [TreatmentResponse(**serialize_treatment(doc)) for doc in docs]

    return AdminTreatmentListResponse(items=items, total=len(items))


@router.get(
    "/treatments/{treatment_id}",
    response_model=TreatmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get a single treatment by ID (or disease_key)",
)
async def get_treatment_by_id(
    treatment_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> TreatmentResponse:
    db = get_database()
    doc = None
    if ObjectId.is_valid(treatment_id):
        doc = await db["treatments"].find_one({"_id": ObjectId(treatment_id)})
    if doc is None:
        doc = await db["treatments"].find_one({"disease_key": treatment_id})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )
    return TreatmentResponse(**serialize_treatment(doc))


@router.post(
    "/treatments",
    response_model=TreatmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new treatment entry (disease_key must be in class_names.json and unique)",
)
async def create_treatment(
    request: Request,
    payload: AdminTreatmentCreate,
    current_user: dict = Depends(require_role("admin")),
) -> TreatmentResponse:
    valid_classes = get_class_names()
    disease_key = payload.disease_key.strip()
    if disease_key not in valid_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid disease_key '{disease_key}'. "
                "Must be one of the class names in class_names.json."
            ),
        )

    db = get_database()
    existing = await db["treatments"].find_one({"disease_key": disease_key})
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Treatment for disease_key '{disease_key}' already exists",
        )

    now = datetime.now(timezone.utc)
    doc: dict[str, Any] = {
        "disease_key": disease_key,
        "crop": payload.crop.strip(),
        "disease_name_en": payload.disease_name_en.strip(),
        "disease_name_si": payload.disease_name_si.strip(),
        "is_healthy": payload.is_healthy,
        "symptoms_en": payload.symptoms_en,
        "symptoms_si": payload.symptoms_si,
        "treatment_en": payload.treatment_en,
        "treatment_si": payload.treatment_si,
        "prevention_en": payload.prevention_en,
        "prevention_si": payload.prevention_si,
        "source": payload.source.strip() if payload.source else None,
        "is_verified": False,
        "verified_by": None,
        "verified_at": None,
        "updated_at": now,
    }

    if payload.is_verified:
        flagged = find_unverified_placeholders(doc)
        if flagged:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot mark treatment as verified while fields still contain "
                    f"'TO BE VERIFIED': {', '.join(flagged)}"
                ),
            )
        doc["is_verified"] = True
        doc["verified_by"] = current_user["id"]
        doc["verified_at"] = now

    try:
        result = await db["treatments"].insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Treatment for disease_key '{disease_key}' already exists",
        )

    doc["_id"] = result.inserted_id
    created_id = str(result.inserted_id)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="treatment.create",
        target_type="treatment",
        target_id=created_id,
        details={
            "disease_key": disease_key,
            "crop": doc["crop"],
            "is_verified": doc["is_verified"],
        },
        ip_address=get_client_ip(request),
    )

    return TreatmentResponse(**serialize_treatment(doc))


@router.put(
    "/treatments/{treatment_id}",
    response_model=TreatmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing treatment entry",
)
async def update_treatment(
    request: Request,
    treatment_id: str,
    payload: AdminTreatmentUpdate,
    current_user: dict = Depends(require_role("admin")),
) -> TreatmentResponse:
    if not ObjectId.is_valid(treatment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    db = get_database()
    doc = await db["treatments"].find_one({"_id": ObjectId(treatment_id)})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    update_fields: dict[str, Any] = {}
    if payload.disease_key is not None:
        new_key = payload.disease_key.strip()
        valid_classes = get_class_names()
        if new_key not in valid_classes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid disease_key '{new_key}'. "
                    "Must be one of the class names in class_names.json."
                ),
            )
        if new_key != doc["disease_key"]:
            dup = await db["treatments"].find_one({"disease_key": new_key})
            if dup is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Treatment for disease_key '{new_key}' already exists",
                )
        update_fields["disease_key"] = new_key

    for str_field in ("crop", "disease_name_en", "disease_name_si", "source"):
        val = getattr(payload, str_field)
        if val is not None:
            update_fields[str_field] = val.strip()

    if payload.is_healthy is not None:
        update_fields["is_healthy"] = payload.is_healthy

    for list_field in (
        "symptoms_en",
        "symptoms_si",
        "treatment_en",
        "treatment_si",
        "prevention_en",
        "prevention_si",
    ):
        val = getattr(payload, list_field)
        if val is not None:
            update_fields[list_field] = val

    now = datetime.now(timezone.utc)
    merged = {**doc, **update_fields}
    flagged = find_unverified_placeholders(merged)

    if payload.is_verified is True:
        if flagged:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Cannot mark treatment as verified while fields still contain "
                    f"'TO BE VERIFIED': {', '.join(flagged)}"
                ),
            )
        update_fields["is_verified"] = True
        update_fields["verified_by"] = current_user["id"]
        update_fields["verified_at"] = now
    elif payload.is_verified is False or flagged:
        update_fields["is_verified"] = False
        update_fields["verified_by"] = None
        update_fields["verified_at"] = None

    update_fields["updated_at"] = now

    await db["treatments"].update_one(
        {"_id": ObjectId(treatment_id)},
        {"$set": update_fields},
    )
    doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="treatment.update",
        target_type="treatment",
        target_id=treatment_id,
        details={
            "disease_key": doc["disease_key"],
            "updated_fields": [k for k in update_fields.keys() if k != "updated_at"],
            "is_verified": doc.get("is_verified", False),
        },
        ip_address=get_client_ip(request),
    )

    return TreatmentResponse(**serialize_treatment(doc))


@router.put(
    "/treatments/{treatment_id}/verify",
    response_model=TreatmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark a treatment as verified (fails if any field still contains 'TO BE VERIFIED')",
)
async def verify_treatment(
    request: Request,
    treatment_id: str,
    payload: Optional[AdminTreatmentVerifyRequest] = Body(default=None),
    current_user: dict = Depends(require_role("admin")),
) -> TreatmentResponse:
    if not ObjectId.is_valid(treatment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    db = get_database()
    doc = await db["treatments"].find_one({"_id": ObjectId(treatment_id)})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    source_value = (
        payload.source.strip()
        if payload and payload.source and payload.source.strip()
        else (doc.get("source") or "Department of Agriculture, Sri Lanka")
    )
    candidate_doc = {**doc, "source": source_value}
    flagged = find_unverified_placeholders(candidate_doc)
    if flagged:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Treatment cannot be verified because the following field(s) still contain "
                f"'TO BE VERIFIED': {', '.join(flagged)}"
            ),
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "is_verified": True,
        "source": source_value,
        "verified_by": current_user["id"],
        "verified_at": now,
        "updated_at": now,
    }

    await db["treatments"].update_one(
        {"_id": ObjectId(treatment_id)},
        {"$set": update_fields},
    )
    doc.update(update_fields)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="treatment.verify",
        target_type="treatment",
        target_id=treatment_id,
        details={
            "disease_key": doc["disease_key"],
            "source": source_value,
        },
        ip_address=get_client_ip(request),
    )

    return TreatmentResponse(**serialize_treatment(doc))


@router.delete(
    "/treatments/{treatment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a treatment entry",
)
async def delete_treatment(
    request: Request,
    treatment_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> Response:
    if not ObjectId.is_valid(treatment_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    db = get_database()
    doc = await db["treatments"].find_one({"_id": ObjectId(treatment_id)})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Treatment not found",
        )

    await db["treatments"].delete_one({"_id": ObjectId(treatment_id)})

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="treatment.delete",
        target_type="treatment",
        target_id=treatment_id,
        details={"disease_key": doc["disease_key"], "crop": doc.get("crop")},
        ip_address=get_client_ip(request),
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 3. DIAGNOSES MANAGEMENT
# ============================================================================


@router.get(
    "/diagnoses",
    response_model=AdminDiagnosisListResponse,
    status_code=status.HTTP_200_OK,
    summary="List all diagnoses with pagination, filters, date range, and farmer name search",
)
async def list_diagnoses(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    status_filter: Optional[
        Literal["auto", "pending_review", "confirmed", "corrected"]
    ] = Query(default=None, alias="status", description="Filter by diagnosis status"),
    district: Optional[str] = Query(default=None, description="Filter by district"),
    crop: Optional[str] = Query(
        default=None, description="Filter by crop prefix (Tomato, Potato, Pepper)"
    ),
    predicted_class: Optional[str] = Query(
        default=None, description="Filter by exact predicted_class"
    ),
    class_filter: Optional[str] = Query(
        default=None,
        alias="class",
        description="Filter by exact class (alias for predicted_class)",
    ),
    date_from: Optional[datetime] = Query(
        default=None, description="Start date/time (ISO 8601)"
    ),
    date_to: Optional[datetime] = Query(
        default=None, description="End date/time (ISO 8601)"
    ),
    search: Optional[str] = Query(
        default=None, description="Search by farmer name or email"
    ),
    farmer_name: Optional[str] = Query(
        default=None, description="Search by farmer name (alias for search)"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> AdminDiagnosisListResponse:
    db = get_database()
    query: dict[str, Any] = {}

    if status_filter:
        query["status"] = status_filter

    if district and district.strip() and district.strip().lower() != "all":
        query["district"] = district.strip()

    target_class = (predicted_class or class_filter or "").strip()
    if target_class:
        query["predicted_class"] = target_class
    elif crop and crop.strip() and crop.strip().lower() != "all":
        escaped_crop = re.escape(crop.strip())
        query["predicted_class"] = {"$regex": f"^{escaped_crop}", "$options": "i"}

    if date_from is not None or date_to is not None:
        date_range: dict[str, Any] = {}
        if date_from is not None:
            if date_from.tzinfo is None:
                date_from = date_from.replace(tzinfo=timezone.utc)
            date_range["$gte"] = date_from
        if date_to is not None:
            if date_to.tzinfo is None:
                date_to = date_to.replace(tzinfo=timezone.utc)
            date_range["$lte"] = date_to
        query["created_at"] = date_range

    farmer_query_str = (search or farmer_name or "").strip()
    if farmer_query_str:
        escaped_search = re.escape(farmer_query_str)
        matching_users = await (
            db["users"]
            .find(
                {
                    "$or": [
                        {"full_name": {"$regex": escaped_search, "$options": "i"}},
                        {"email": {"$regex": escaped_search, "$options": "i"}},
                    ]
                },
                {"_id": 1},
            )
            .to_list(length=500)
        )
        matching_ids = [str(u["_id"]) for u in matching_users]
        query["user_id"] = {"$in": matching_ids}

    total = await db["diagnoses"].count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db["diagnoses"]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    items = await enrich_admin_diagnoses(db, docs)

    return AdminDiagnosisListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


@router.get(
    "/diagnoses/{diagnosis_id}",
    response_model=AdminDiagnosisDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get full details of a single diagnosis",
)
async def get_admin_diagnosis_detail(
    diagnosis_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> AdminDiagnosisDetailResponse:
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

    items = await enrich_admin_diagnoses(db, [doc])
    effective_key = doc.get("officer_label") or doc["predicted_class"]
    treatment_doc = await db["treatments"].find_one({"disease_key": effective_key})

    return AdminDiagnosisDetailResponse(
        diagnosis=items[0],
        treatment=(
            TreatmentResponse(**serialize_treatment(treatment_doc))
            if treatment_doc
            else None
        ),
    )


@router.delete(
    "/diagnoses/{diagnosis_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a diagnosis along with its image/heatmap files and related notifications",
)
async def delete_diagnosis(
    request: Request,
    diagnosis_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> Response:
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

    image_deleted = delete_upload_file_safely(doc.get("image_url"))
    heatmap_deleted = delete_upload_file_safely(doc.get("heatmap_url"))

    notif_res = await db["notifications"].delete_many({"diagnosis_id": diagnosis_id})
    await db["training_feedback"].delete_many({"diagnosis_id": diagnosis_id})
    await db["diagnoses"].delete_one({"_id": ObjectId(diagnosis_id)})

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="diagnosis.delete",
        target_type="diagnosis",
        target_id=diagnosis_id,
        details={
            "user_id": doc.get("user_id"),
            "district": doc.get("district"),
            "predicted_class": doc.get("predicted_class"),
            "image_file_deleted": image_deleted,
            "heatmap_file_deleted": heatmap_deleted,
            "notifications_deleted": notif_res.deleted_count,
        },
        ip_address=get_client_ip(request),
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 4. ANALYTICS ENDPOINTS
# ============================================================================


class AdminOverviewWithAIResponse(AdminAnalyticsOverviewResponse):
    ai_messages_today: int = 0


_SINHALA_CHAR_RE = re.compile(r"[\u0D80-\u0DFF]")
_ASSISTANT_HEALTH_CACHE: dict[str, Any] = {
    "data": None,
    "checked_at": None,
}


@router.get(
    "/analytics/overview",
    response_model=AdminOverviewWithAIResponse,
    status_code=status.HTTP_200_OK,
    summary="High-level system analytics overview for Admin Dashboard",
)
async def get_analytics_overview(
    current_user: dict = Depends(require_role("admin")),
) -> AdminOverviewWithAIResponse:
    db = get_database()

    now = datetime.now(timezone.utc)
    start_of_today = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        tzinfo=timezone.utc,
    )

    farmer_count = await db["users"].count_documents({"role": "farmer"})
    officer_count = await db["users"].count_documents({"role": "officer"})
    admin_count = await db["users"].count_documents({"role": "admin"})
    total_users = farmer_count + officer_count + admin_count

    pending_officer_approvals = await db["users"].count_documents(
        {"role": "officer", "is_approved": False, "is_active": {"$ne": False}}
    )

    total_scans = await db["diagnoses"].count_documents({})
    scans_today = await db["diagnoses"].count_documents(
        {"created_at": {"$gte": start_of_today}}
    )
    pending_reviews = await db["diagnoses"].count_documents(
        {"status": "pending_review"}
    )
    confirmed_count = await db["diagnoses"].count_documents({"status": "confirmed"})
    corrected_count = await db["diagnoses"].count_documents({"status": "corrected"})
    unverified_treatments_count = await db["treatments"].count_documents(
        {"is_verified": {"$ne": True}}
    )

    msg_today_agg = (
        await db["conversations"]
        .aggregate(
            [
                {"$unwind": "$messages"},
                {"$match": {"messages.created_at": {"$gte": start_of_today}}},
                {"$count": "count"},
            ]
        )
        .to_list(length=1)
    )
    ai_messages_today = int(msg_today_agg[0]["count"]) if msg_today_agg else 0

    return AdminOverviewWithAIResponse(
        users_by_role=UsersByRoleStats(
            farmer=farmer_count,
            officer=officer_count,
            admin=admin_count,
            total=total_users,
        ),
        pending_officer_approvals=pending_officer_approvals,
        total_scans=total_scans,
        scans_today=scans_today,
        pending_reviews=pending_reviews,
        confirmed_vs_corrected=ConfirmedVsCorrectedStats(
            confirmed=confirmed_count,
            corrected=corrected_count,
            total_reviewed=confirmed_count + corrected_count,
        ),
        unverified_treatments_count=unverified_treatments_count,
        ai_messages_today=ai_messages_today,
    )


@router.get(
    "/analytics/scans-over-time",
    response_model=AdminScansOverTimeResponse,
    status_code=status.HTTP_200_OK,
    summary="Daily scan counts over the last N days",
)
async def get_scans_over_time(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to look back"),
    current_user: dict = Depends(require_role("admin")),
) -> AdminScansOverTimeResponse:
    db = get_database()
    now = datetime.now(timezone.utc)
    today_start = datetime(
        year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc
    )
    start_date = today_start - timedelta(days=days - 1)

    pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$created_at",
                    }
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    agg_docs = await db["diagnoses"].aggregate(pipeline).to_list(length=days + 5)
    counts_by_day = {doc["_id"]: int(doc["count"]) for doc in agg_docs}

    series: list[DailyScanPoint] = []
    total_in_period = 0
    for offset in range(days):
        day_dt = start_date + timedelta(days=offset)
        day_str = day_dt.strftime("%Y-%m-%d")
        c = counts_by_day.get(day_str, 0)
        total_in_period += c
        series.append(DailyScanPoint(date=day_str, count=c))

    return AdminScansOverTimeResponse(
        days=days,
        total_in_period=total_in_period,
        series=series,
    )


@router.get(
    "/analytics/diseases",
    response_model=AdminDiseaseAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan counts per predicted class and per final (officer-verified) class",
)
async def get_disease_analytics(
    current_user: dict = Depends(require_role("admin")),
) -> AdminDiseaseAnalyticsResponse:
    db = get_database()
    docs = await (
        db["diagnoses"]
        .find({}, {"predicted_class": 1, "officer_label": 1})
        .to_list(length=10000)
    )

    predicted_counts: Counter[str] = Counter()
    final_counts: Counter[str] = Counter()

    for doc in docs:
        pred_cls = doc.get("predicted_class")
        if pred_cls:
            predicted_counts[pred_cls] += 1
        final_cls = doc.get("officer_label") or pred_cls
        if final_cls:
            final_counts[final_cls] += 1

    all_keys = set(predicted_counts.keys()) | set(final_counts.keys())
    items = [
        DiseaseCountItem(
            disease_key=key,
            predicted_count=predicted_counts.get(key, 0),
            final_count=final_counts.get(key, 0),
        )
        for key in all_keys
    ]
    items.sort(key=lambda x: (x.final_count, x.predicted_count), reverse=True)

    return AdminDiseaseAnalyticsResponse(items=items)


@router.get(
    "/analytics/districts",
    response_model=AdminDistrictAnalyticsResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan counts per Sri Lankan district",
)
async def get_district_analytics(
    current_user: dict = Depends(require_role("admin")),
) -> AdminDistrictAnalyticsResponse:
    db = get_database()
    pipeline = [
        {
            "$group": {
                "_id": "$district",
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"count": -1, "_id": 1}},
    ]
    agg_docs = await db["diagnoses"].aggregate(pipeline).to_list(length=100)
    items = [
        DistrictScanCountItem(
            district=doc["_id"] or "Unknown",
            count=int(doc["count"]),
        )
        for doc in agg_docs
    ]
    return AdminDistrictAnalyticsResponse(items=items)


@router.get(
    "/analytics/assistant",
    status_code=status.HTTP_200_OK,
    summary="Aggregated AI Assistant usage and error analytics (never returns message content)",
)
async def get_assistant_analytics(
    days: int = Query(
        default=30, ge=1, le=365, description="Number of days to look back"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, Any]:
    db = get_database()
    now = datetime.now(timezone.utc)
    start_of_today = datetime(
        year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc
    )
    start_date = start_of_today - timedelta(days=days - 1)

    conv_cursor = db["conversations"].find(
        {},
        {
            "user_id": 1,
            "diagnosis_id": 1,
            "messages.role": 1,
            "messages.content": 1,
            "messages.language": 1,
            "messages.created_at": 1,
            "created_at": 1,
            "updated_at": 1,
        },
    )
    conv_docs = await conv_cursor.to_list(length=20000)

    total_conversations = len(conv_docs)
    scan_linked_conversations = 0
    general_conversations = 0
    total_messages = 0
    messages_today = 0
    active_users_today_set: set[str] = set()
    sinhala_messages = 0
    english_messages = 0
    counts_by_day: Counter[str] = Counter()

    for doc in conv_docs:
        uid = str(doc.get("user_id") or "")
        diag_id = doc.get("diagnosis_id")
        if diag_id and str(diag_id).strip():
            scan_linked_conversations += 1
        else:
            general_conversations += 1

        msgs = doc.get("messages") or []
        for m in msgs:
            if not isinstance(m, dict):
                continue
            total_messages += 1

            # Determine Sinhala vs English without exposing message text
            lang_field = m.get("language")
            content_str = str(m.get("content") or "")
            if lang_field == "si" or _SINHALA_CHAR_RE.search(content_str):
                sinhala_messages += 1
            else:
                english_messages += 1

            msg_dt = m.get("created_at") or doc.get("created_at")
            if isinstance(msg_dt, datetime):
                if msg_dt.tzinfo is None:
                    msg_dt = msg_dt.replace(tzinfo=timezone.utc)
                if msg_dt >= start_of_today:
                    messages_today += 1
                    if uid:
                        active_users_today_set.add(uid)
                if msg_dt >= start_date:
                    day_key = msg_dt.strftime("%Y-%m-%d")
                    counts_by_day[day_key] += 1

    messages_per_day: list[dict[str, Any]] = []
    for offset in range(days):
        day_dt = start_date + timedelta(days=offset)
        day_str = day_dt.strftime("%Y-%m-%d")
        messages_per_day.append(
            {"date": day_str, "count": int(counts_by_day.get(day_str, 0))}
        )

    # Aggregate Gemini errors by type from chat_errors collection
    error_pipeline = [
        {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
    ]
    error_agg = await db["chat_errors"].aggregate(error_pipeline).to_list(length=50)
    errors_by_type: dict[str, int] = {
        "quota": 0,
        "network": 0,
        "config": 0,
        "other": 0,
    }
    for row in error_agg:
        err_key = str(row.get("_id") or "other").lower()
        if err_key not in errors_by_type:
            err_key = "other"
        errors_by_type[err_key] += int(row.get("count", 0))

    total_errors = sum(errors_by_type.values())

    return {
        "days": days,
        "total_conversations": total_conversations,
        "total_messages": total_messages,
        "messages_today": messages_today,
        "active_users_today": len(active_users_today_set),
        "messages_per_day": messages_per_day,
        "language_counts": {
            "si": sinhala_messages,
            "en": english_messages,
            "sinhala": sinhala_messages,
            "english": english_messages,
        },
        "sinhala_messages": sinhala_messages,
        "english_messages": english_messages,
        "conversations_by_type": {
            "scan_linked": scan_linked_conversations,
            "general": general_conversations,
        },
        "scan_linked_conversations": scan_linked_conversations,
        "general_conversations": general_conversations,
        "errors_by_type": errors_by_type,
        "total_errors": total_errors,
    }


@router.get(
    "/assistant/health",
    status_code=status.HTTP_200_OK,
    summary="Check Gemini AI Assistant health (cached for 60 seconds)",
)
async def get_assistant_health(
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cached_data = _ASSISTANT_HEALTH_CACHE.get("data")
    cached_at = _ASSISTANT_HEALTH_CACHE.get("checked_at")

    if (
        cached_data is not None
        and isinstance(cached_at, datetime)
        and (now - cached_at).total_seconds() < 60
    ):
        return cached_data

    model_name = (
        (getattr(settings, "GEMINI_MODEL", None) or "gemini-2.5-flash").strip()
        or "gemini-2.5-flash"
    )
    api_key = (getattr(settings, "GEMINI_API_KEY", None) or "").strip()

    status_val: Literal["online", "error"] = "error"
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            response = await client.aio.models.generate_content(
                model=model_name,
                contents="ok",
                config=types.GenerateContentConfig(max_output_tokens=4),
            )
            if response is not None:
                status_val = "online"
        except Exception:
            status_val = "error"

    result = {
        "status": status_val,
        "model": model_name,
        "checked_at": now,
    }
    _ASSISTANT_HEALTH_CACHE["data"] = result
    _ASSISTANT_HEALTH_CACHE["checked_at"] = now
    return result


# ============================================================================
# 5. MODEL METRICS & TRAINING FEEDBACK EXPORT
# ============================================================================


@router.get(
    "/model",
    response_model=AdminModelInfoResponse,
    status_code=status.HTTP_200_OK,
    summary="Get ML model metrics, class names, officer agreement rate, and most corrected classes",
)
async def get_admin_model_info(
    current_user: dict = Depends(require_role("admin")),
) -> AdminModelInfoResponse:
    db = get_database()
    class_names = get_class_names()
    metrics = get_model_metrics()

    confirmed_count = await db["diagnoses"].count_documents({"status": "confirmed"})
    corrected_count = await db["diagnoses"].count_documents({"status": "corrected"})
    total_reviewed = confirmed_count + corrected_count

    agreement_rate = (
        round((confirmed_count / total_reviewed) * 100.0, 2)
        if total_reviewed > 0
        else None
    )

    corrected_docs = await (
        db["diagnoses"]
        .find(
            {"status": "corrected"},
            {"predicted_class": 1, "officer_label": 1},
        )
        .to_list(length=5000)
    )

    correction_totals: Counter[str] = Counter()
    true_label_map: dict[str, Counter[str]] = defaultdict(Counter)

    for doc in corrected_docs:
        pred = doc.get("predicted_class")
        true_lbl = doc.get("officer_label")
        if pred:
            correction_totals[pred] += 1
            if true_lbl:
                true_label_map[pred][true_lbl] += 1

    most_corrected: list[CorrectedClassStatItem] = []
    for pred_cls, count in correction_totals.most_common(10):
        most_common_true = (
            true_label_map[pred_cls].most_common(1)[0][0]
            if true_label_map[pred_cls]
            else None
        )
        most_corrected.append(
            CorrectedClassStatItem(
                predicted_class=pred_cls,
                corrected_count=count,
                most_common_true_label=most_common_true,
            )
        )

    return AdminModelInfoResponse(
        class_names=class_names,
        num_classes=len(class_names),
        metrics=metrics,
        total_reviewed=total_reviewed,
        confirmed_count=confirmed_count,
        corrected_count=corrected_count,
        officer_agreement_rate=agreement_rate,
        most_corrected_classes=most_corrected,
    )


@router.get(
    "/model/feedback/export",
    status_code=status.HTTP_200_OK,
    summary="Download training_feedback collection as a CSV file",
)
async def export_training_feedback_csv(
    current_user: dict = Depends(require_role("admin")),
) -> StreamingResponse:
    db = get_database()
    cursor = db["training_feedback"].find({}).sort("reviewed_at", -1)
    docs = await cursor.to_list(length=50000)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "feedback_id",
            "diagnosis_id",
            "image_url",
            "model_label",
            "true_label",
            "confidence",
            "reviewed_at",
        ]
    )
    for doc in docs:
        reviewed_at = doc.get("reviewed_at")
        reviewed_str = (
            reviewed_at.isoformat()
            if isinstance(reviewed_at, datetime)
            else str(reviewed_at or "")
        )
        writer.writerow(
            [
                str(doc.get("_id", "")),
                doc.get("diagnosis_id", ""),
                doc.get("image_url", ""),
                doc.get("model_label", ""),
                doc.get("true_label", ""),
                doc.get("confidence", ""),
                reviewed_str,
            ]
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="training_feedback.csv"'
        },
    )


# ============================================================================
# 6. AUDIT LOGS
# ============================================================================


@router.get(
    "/audit-logs",
    response_model=AdminAuditLogListResponse,
    status_code=status.HTTP_200_OK,
    summary="List admin audit logs with pagination and optional action filter",
)
async def list_audit_logs(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    action: Optional[str] = Query(
        default=None,
        description="Filter by action (e.g. 'user.update', 'treatment.verify', 'diagnosis.delete')",
    ),
    target_type: Optional[str] = Query(
        default=None, description="Optional filter by target_type ('user', 'treatment', 'diagnosis')"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> AdminAuditLogListResponse:
    db = get_database()
    query: dict[str, Any] = {}

    if action and action.strip():
        query["action"] = action.strip()

    if target_type and target_type.strip():
        query["target_type"] = target_type.strip()

    total = await db["audit_logs"].count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db["audit_logs"]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    return AdminAuditLogListResponse(
        items=[serialize_audit_log(doc) for doc in docs],
        total=total,
        page=page,
        limit=limit,
        pages=math.ceil(total / limit) if total > 0 else 1,
    )


# ============================================================================
# 7. SECURITY & SESSION MONITORING (/api/admin/security/*)
# ============================================================================


@router.get(
    "/security/login-events",
    status_code=status.HTTP_200_OK,
    summary="List login events with pagination and optional success and email filters",
)
async def list_login_events(
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    success: Optional[bool] = Query(
        default=None, description="Filter by login success (true/false)"
    ),
    email: Optional[str] = Query(
        default=None, description="Filter by email address"
    ),
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, Any]:
    db = get_database()
    query: dict[str, Any] = {}

    if success is not None:
        query["success"] = bool(success)

    if email and email.strip():
        escaped_email = re.escape(email.strip())
        query["email"] = {"$regex": escaped_email, "$options": "i"}

    total = await db["login_events"].count_documents(query)
    skip = (page - 1) * limit

    cursor = (
        db["login_events"]
        .find(query)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    items = [
        {
            "id": str(doc["_id"]),
            "user_id": doc.get("user_id"),
            "email": doc.get("email", ""),
            "success": bool(doc.get("success", False)),
            "reason": doc.get("reason", ""),
            "ip_address": doc.get("ip_address") or "",
            "user_agent": doc.get("user_agent") or "",
            "created_at": doc.get("created_at"),
        }
        for doc in docs
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total > 0 else 1,
    }


@router.get(
    "/security/sessions",
    status_code=status.HTTP_200_OK,
    summary="List active (not revoked, not expired) sessions with user details",
)
async def list_active_sessions(
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, Any]:
    db = get_database()
    now = datetime.now(timezone.utc)

    query: dict[str, Any] = {
        "revoked": {"$ne": True},
        "is_active": {"$ne": False},
        "$or": [
            {"expires_at": {"$gt": now}},
            {"expires_at": None},
        ],
    }

    cursor = db["sessions"].find(query).sort("created_at", -1)
    docs = await cursor.to_list(length=500)

    user_ids = list({doc.get("user_id") for doc in docs if doc.get("user_id")})
    object_ids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]

    user_map: dict[str, dict[str, str]] = {}
    if object_ids:
        u_cursor = db["users"].find(
            {"_id": {"$in": object_ids}},
            {"full_name": 1, "email": 1, "role": 1},
        )
        u_docs = await u_cursor.to_list(length=len(object_ids))
        for u in u_docs:
            user_map[str(u["_id"])] = {
                "full_name": u.get("full_name", "Unknown User"),
                "email": u.get("email", ""),
                "role": u.get("role", ""),
            }

    items = []
    for doc in docs:
        uid = str(doc.get("user_id") or "")
        u_info = user_map.get(uid, {})
        htid = str(doc.get("hashed_token_id") or doc["_id"])
        ip_val = doc.get("ip_address") or doc.get("ip") or ""
        items.append(
            {
                "id": htid,
                "hashed_token_id": htid,
                "user_id": uid,
                "user_name": u_info.get("full_name", "Unknown User"),
                "full_name": u_info.get("full_name", "Unknown User"),
                "email": u_info.get("email", ""),
                "role": u_info.get("role", ""),
                "ip": ip_val,
                "ip_address": ip_val,
                "user_agent": doc.get("user_agent") or "",
                "created_at": doc.get("created_at"),
                "expires_at": doc.get("expires_at"),
            }
        )

    return {
        "items": items,
        "total": len(items),
    }


@router.delete(
    "/security/sessions/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Revoke an active session (force logout)",
)
async def revoke_security_session(
    request: Request,
    session_id: str,
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, str]:
    db = get_database()
    now = datetime.now(timezone.utc)

    session_doc = await db["sessions"].find_one({"hashed_token_id": session_id})
    if session_doc is None and ObjectId.is_valid(session_id):
        session_doc = await db["sessions"].find_one({"_id": ObjectId(session_id)})

    if session_doc is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    canonical_htid = str(session_doc.get("hashed_token_id") or session_doc["_id"])
    await db["sessions"].update_one(
        {"hashed_token_id": session_doc.get("hashed_token_id")}
        if session_doc.get("hashed_token_id")
        else {"_id": session_doc["_id"]},
        {
            "$set": {
                "revoked": True,
                "is_active": False,
                "revoked_at": now,
            }
        },
    )

    revoke_token_in_memory(session_doc.get("refresh_token"), canonical_htid)

    await write_audit_log(
        db=db,
        admin_user=current_user,
        action="session.revoke",
        target_type="session",
        target_id=canonical_htid,
        details={
            "user_id": session_doc.get("user_id"),
            "hashed_token_id": canonical_htid,
            "ip_address": session_doc.get("ip_address"),
        },
        ip_address=get_client_ip(request),
    )

    return {"message": "Session revoked successfully", "id": canonical_htid}


@router.get(
    "/security/locked-accounts",
    status_code=status.HTTP_200_OK,
    summary="List user accounts whose locked_until is in the future",
)
async def list_locked_accounts(
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, Any]:
    db = get_database()
    now = datetime.now(timezone.utc)

    cursor = (
        db["users"]
        .find({"locked_until": {"$gt": now}})
        .sort("locked_until", -1)
    )
    docs = await cursor.to_list(length=500)
    items = [UserResponse(**serialize_user(doc)) for doc in docs]

    return {
        "items": items,
        "total": len(items),
    }


@router.get(
    "/security/summary",
    status_code=status.HTTP_200_OK,
    summary="Security summary: failed logins today, active sessions, and locked accounts",
)
async def get_security_summary(
    current_user: dict = Depends(require_role("admin")),
) -> dict[str, int]:
    db = get_database()
    now = datetime.now(timezone.utc)
    start_of_today = datetime(
        year=now.year,
        month=now.month,
        day=now.day,
        tzinfo=timezone.utc,
    )

    failed_logins_today = await db["login_events"].count_documents(
        {"success": False, "created_at": {"$gte": start_of_today}}
    )
    active_sessions = await db["sessions"].count_documents(
        {
            "revoked": {"$ne": True},
            "is_active": {"$ne": False},
            "$or": [
                {"expires_at": {"$gt": now}},
                {"expires_at": None},
            ],
        }
    )
    locked_accounts = await db["users"].count_documents(
        {"locked_until": {"$gt": now}}
    )

    return {
        "failed_logins_today": failed_logins_today,
        "active_sessions": active_sessions,
        "locked_accounts": locked_accounts,
    }
