import io
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from app.core.database import get_database
from app.core.security import require_role
from app.services.cloudinary_service import upload_image_bytes

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ML_MODELS_DIR = BACKEND_DIR / "app" / "ml_models"
CLASS_NAMES_PATH = ML_MODELS_DIR / "class_names.json"
MODEL_METRICS_PATH = ML_MODELS_DIR / "model_metrics.json"

UPLOADS_DIR = BACKEND_DIR / "uploads"
IMAGES_DIR = UPLOADS_DIR / "images"
HEATMAPS_DIR = UPLOADS_DIR / "heatmaps"

DEFAULT_CLASS_NAMES: list[str] = [
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/jpg", "image/png"}
VALID_CROPS = ("tomato", "potato", "pepper")
DISCLAIMER_TEXT = (
    "This is an AI suggestion. Consult an Agricultural Officer for important decisions."
)

router = APIRouter(tags=["Disease Prediction"])

_cached_class_names: list[str] = []
_cached_model_metrics: dict[str, Any] = {}


def load_class_names() -> list[str]:
    """Load class names from class_names.json without importing TensorFlow."""
    global _cached_class_names
    if not _cached_class_names:
        try:
            if CLASS_NAMES_PATH.exists():
                with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
                    _cached_class_names = json.load(f)
            else:
                print(
                    f"[WARN] {CLASS_NAMES_PATH} not found; using built-in 15 class names."
                )
                _cached_class_names = list(DEFAULT_CLASS_NAMES)
        except Exception as exc:
            print(f"[WARN] Could not read class_names.json ({exc}); using built-in list.")
            _cached_class_names = list(DEFAULT_CLASS_NAMES)
    return _cached_class_names


def load_model_metrics() -> dict[str, Any]:
    """Load model metrics from model_metrics.json without importing TensorFlow."""
    global _cached_model_metrics
    if not _cached_model_metrics:
        try:
            if MODEL_METRICS_PATH.exists():
                with open(MODEL_METRICS_PATH, "r", encoding="utf-8") as f:
                    _cached_model_metrics = json.load(f)
        except Exception as exc:
            print(f"[WARN] Could not read model_metrics.json ({exc}).")
            _cached_model_metrics = {}
    return _cached_model_metrics


def serialize_diagnosis(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "district": doc["district"],
        "image_url": doc["image_url"],
        "heatmap_url": doc["heatmap_url"],
        "crop": doc.get("crop"),
        "crop_match_score": doc.get("crop_match_score"),
        "warning": doc.get("warning"),
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


def _normalize_crop(crop: Optional[str]) -> Optional[str]:
    if crop is None or not crop.strip():
        return None
    normalized = crop.strip().lower()
    if normalized not in VALID_CROPS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid crop. Allowed values are: tomato, potato, pepper.",
        )
    return normalized


async def _validate_image_upload(
    upload: UploadFile, label: str = "Uploaded"
) -> tuple[bytes, str, str]:
    """
    Validate image extension, MIME type, 5MB limit, and Pillow integrity in memory.
    Returns (image_bytes, safe_filename, mime_type) without writing to local disk.
    """
    original_filename = upload.filename or ""
    ext = Path(original_filename).suffix.lower()
    content_type = (upload.content_type or "").lower()

    if ext not in ALLOWED_EXTENSIONS and content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {label.lower()} file type. Only JPG, JPEG, and PNG images are allowed.",
        )

    image_bytes = await upload.read()
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} file is empty.",
        )
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} file size exceeds the 5MB limit.",
        )

    try:
        from PIL import Image, UnidentifiedImageError

        with Image.open(io.BytesIO(image_bytes)) as img:
            img_format = (img.format or "").upper()
            if img_format not in ("JPEG", "JPG", "PNG"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid {label.lower()} image format. Only JPG, JPEG, and PNG images are allowed.",
                )
            img.verify()
    except HTTPException:
        raise
    except (ImportError, ModuleNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Image validation library (Pillow) is unavailable: {exc}",
        )
    except (UnidentifiedImageError, Exception):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} file is not a valid image.",
        )

    save_ext = (
        ext
        if ext in ALLOWED_EXTENSIONS
        else (".png" if "png" in content_type else ".jpg")
    )
    mime = "image/png" if save_ext == ".png" else "image/jpeg"
    filename = f"{uuid.uuid4().hex}{save_ext}"
    return image_bytes, filename, mime


async def _save_diagnosis_and_build_response(
    *,
    current_user: dict[str, Any],
    image_url: str,
    heatmap_url: str,
    normalized_crop: Optional[str],
    predicted_class: str,
    confidence_pct: float,
    top3: list[dict[str, Any]],
    crop_match_score: Optional[float],
) -> dict[str, Any]:
    """
    Shared post-prediction workflow used by both POST /api/scans/record and POST /api/predict:
    - Computes auto vs pending_review status and crop mismatch warnings
    - Saves the diagnosis document to MongoDB
    - Fetches the matching treatment document
    - Returns the unified diagnosis response payload
    """
    warning: Optional[str] = None
    if normalized_crop is not None and crop_match_score is not None:
        diagnosis_status = (
            "pending_review"
            if (confidence_pct < 70.0 or crop_match_score < 50.0)
            else "auto"
        )
        if crop_match_score < 30.0:
            warning = f"This photo may not be a {normalized_crop} leaf"
    else:
        diagnosis_status = "pending_review" if confidence_pct < 70.0 else "auto"

    db = get_database()
    diagnosis_doc = {
        "user_id": current_user["id"],
        "district": current_user["district"],
        "image_url": image_url,
        "heatmap_url": heatmap_url,
        "crop": normalized_crop,
        "crop_match_score": crop_match_score,
        "warning": warning,
        "predicted_class": predicted_class,
        "confidence": round(float(confidence_pct), 2),
        "top3": top3,
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

    treatment_doc = await db["treatments"].find_one(
        {"disease_key": predicted_class}
    )

    return {
        "diagnosis": serialize_diagnosis(diagnosis_doc),
        "treatment": serialize_treatment(treatment_doc),
        "crop_match_score": crop_match_score,
        "warning": warning,
        "disclaimer": DISCLAIMER_TEXT,
    }


@router.post(
    "/api/predict",
    status_code=status.HTTP_201_CREATED,
    summary="Legacy server-side leaf diagnosis route (lazily loads ML model if available)",
)
async def predict_disease(
    file: UploadFile = File(..., description="Leaf photo (JPG, JPEG, or PNG up to 5MB)"),
    crop: Optional[str] = Form(
        default=None,
        description='Optional crop filter: "tomato" | "potato" | "pepper"',
    ),
    current_user: dict = Depends(require_role("farmer")),
) -> dict[str, Any]:
    normalized_crop = _normalize_crop(crop)
    image_bytes, image_filename, image_mime = await _validate_image_upload(
        file, label="Uploaded"
    )

    import tempfile

    try:
        from app.services.gradcam import generate_and_save_gradcam
        from app.services.ml_service import get_model, predict

        model = get_model()
        prediction = predict(image_bytes, crop=normalized_crop)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            heatmap_filename = generate_and_save_gradcam(
                image_bytes=image_bytes,
                model=model,
                heatmaps_dir=tmp_path,
                last_conv_layer_name="Conv_1",
                pred_index=int(prediction["predicted_index"]),
            )
            heatmap_bytes = (tmp_path / heatmap_filename).read_bytes()
    except (ImportError, ModuleNotFoundError, FileNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Server-side ML model is unavailable on this deployment. "
                f"Leaf disease prediction runs in the browser with TensorFlow.js. ({exc})"
            ),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"ML prediction service is unavailable: {exc}",
        )

    image_url = await upload_image_bytes(
        image_bytes,
        filename=image_filename,
        content_type=image_mime,
        folder="agrolens/images",
    )
    heatmap_url = await upload_image_bytes(
        heatmap_bytes,
        filename=heatmap_filename,
        content_type="image/jpeg",
        folder="agrolens/heatmaps",
    )

    return await _save_diagnosis_and_build_response(
        current_user=current_user,
        image_url=image_url,
        heatmap_url=heatmap_url,
        normalized_crop=normalized_crop,
        predicted_class=prediction["predicted_class"],
        confidence_pct=float(prediction["confidence"]),
        top3=prediction["top3"],
        crop_match_score=prediction.get("crop_match_score"),
    )


@router.post(
    "/api/scans/record",
    status_code=status.HTTP_201_CREATED,
    summary="Record a browser-computed leaf scan and Grad-CAM image via Cloudinary (Farmer only)",
)
async def record_browser_scan(
    file: UploadFile = File(..., description="Compressed leaf photo (JPG, JPEG, or PNG up to 5MB)"),
    heatmap: UploadFile = File(..., description="Browser-generated Grad-CAM heatmap image (JPG, JPEG, or PNG up to 5MB)"),
    className: str = Form(..., description="Predicted PlantVillage disease class name"),
    confidence: float = Form(..., description="Prediction confidence between 0 and 1 (or 0 and 100)"),
    top3: str = Form(default="[]", description="JSON array of top 3 predictions"),
    crop: Optional[str] = Form(default=None, description='Optional crop filter: "tomato" | "potato" | "pepper"'),
    cropMatchScore: Optional[float] = Form(default=None, description="Optional crop match score (0-100 or 0-1)"),
    current_user: dict = Depends(require_role("farmer")),
) -> dict[str, Any]:
    normalized_crop = _normalize_crop(crop)
    known_classes = load_class_names()

    cleaned_class_name = (className or "").strip()
    if cleaned_class_name not in known_classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid className '{cleaned_class_name}'. Must be one of the known model classes.",
        )

    if confidence < 0.0 or confidence > 100.0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid confidence value.",
        )
    confidence_pct = (
        round(float(confidence) * 100.0, 2)
        if confidence <= 1.0
        else round(float(confidence), 2)
    )

    try:
        parsed_top3 = json.loads(top3) if top3 else []
        if not isinstance(parsed_top3, list):
            raise ValueError("top3 must be a list")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid top3 format. Expected a JSON list of predictions.",
        )

    normalized_top3: list[dict[str, Any]] = []
    for item in parsed_top3[:3]:
        if not isinstance(item, dict):
            continue
        item_cls = str(item.get("class_name") or item.get("className") or "").strip()
        if item_cls not in known_classes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid class '{item_cls}' in top3.",
            )
        raw_conf = float(item.get("confidence", 0.0))
        item_conf_pct = (
            round(raw_conf * 100.0, 2) if raw_conf <= 1.0 else round(raw_conf, 2)
        )
        normalized_top3.append(
            {
                "class_name": item_cls,
                "confidence": item_conf_pct,
            }
        )

    if not normalized_top3:
        normalized_top3 = [
            {
                "class_name": cleaned_class_name,
                "confidence": confidence_pct,
            }
        ]

    normalized_crop_match: Optional[float] = None
    if cropMatchScore is not None:
        raw_cms = float(cropMatchScore)
        normalized_crop_match = (
            round(raw_cms * 100.0, 2)
            if 0.0 <= raw_cms <= 1.0
            else round(max(0.0, min(100.0, raw_cms)), 2)
        )
    elif normalized_crop is not None:
        normalized_crop_match = 100.0

    image_bytes, image_filename, image_mime = await _validate_image_upload(
        file, label="Leaf image"
    )
    heatmap_bytes, heatmap_filename, heatmap_mime = await _validate_image_upload(
        heatmap, label="Grad-CAM heatmap"
    )

    image_url = await upload_image_bytes(
        image_bytes,
        filename=image_filename,
        content_type=image_mime,
        folder="agrolens/images",
    )
    heatmap_url = await upload_image_bytes(
        heatmap_bytes,
        filename=heatmap_filename,
        content_type=heatmap_mime,
        folder="agrolens/heatmaps",
    )

    return await _save_diagnosis_and_build_response(
        current_user=current_user,
        image_url=image_url,
        heatmap_url=heatmap_url,
        normalized_crop=normalized_crop,
        predicted_class=cleaned_class_name,
        confidence_pct=confidence_pct,
        top3=normalized_top3,
        crop_match_score=normalized_crop_match,
    )


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
        "class_names": load_class_names(),
        "metrics": load_model_metrics(),
    }
