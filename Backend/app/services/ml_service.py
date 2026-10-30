import io
import json
from pathlib import Path
from typing import Any, Optional
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

ML_MODELS_DIR = Path(__file__).resolve().parent.parent / "ml_models"
MODEL_PATH = ML_MODELS_DIR / "agrolens_model.keras"
CLASS_NAMES_PATH = ML_MODELS_DIR / "class_names.json"
MODEL_METRICS_PATH = ML_MODELS_DIR / "model_metrics.json"

IMG_SIZE = (224, 224)

CROP_PREFIXES: dict[str, str] = {
    "tomato": "Tomato",
    "potato": "Potato",
    "pepper": "Pepper,_bell",
}


class MLModelManager:
    model: Optional[tf.keras.Model] = None
    class_names: list[str] = []
    model_metrics: dict[str, Any] = {}


ml_manager = MLModelManager()


def load_ml_artifacts() -> None:
    """Load the Keras model, class names, and metrics once at application startup."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(f"Class names file not found at {CLASS_NAMES_PATH}")

    ml_manager.model = tf.keras.models.load_model(str(MODEL_PATH))

    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        ml_manager.class_names = json.load(f)

    if MODEL_METRICS_PATH.exists():
        with open(MODEL_METRICS_PATH, "r", encoding="utf-8") as f:
            ml_manager.model_metrics = json.load(f)
    else:
        ml_manager.model_metrics = {}

    print(
        f"[OK] Loaded ML model '{MODEL_PATH.name}' with {len(ml_manager.class_names)} classes."
    )


def get_model() -> tf.keras.Model:
    if ml_manager.model is None:
        load_ml_artifacts()
    assert ml_manager.model is not None
    return ml_manager.model


def get_class_names() -> list[str]:
    if not ml_manager.class_names:
        load_ml_artifacts()
    return ml_manager.class_names


def get_model_metrics() -> dict[str, Any]:
    if not ml_manager.model_metrics and MODEL_METRICS_PATH.exists():
        with open(MODEL_METRICS_PATH, "r", encoding="utf-8") as f:
            ml_manager.model_metrics = json.load(f)
    return ml_manager.model_metrics


def preprocess_image_bytes(image_bytes: bytes) -> tuple[np.ndarray, np.ndarray]:
    """
    Convert raw image bytes into:
    - orig_rgb: (224, 224, 3) float32 array in [0, 255]
    - preprocessed_batch: (1, 224, 224, 3) float32 array scaled with MobileNetV2 preprocess_input
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        rgb_img = img.convert("RGB").resize(IMG_SIZE)
        orig_rgb = np.array(rgb_img, dtype=np.float32)

    input_batch = np.expand_dims(orig_rgb.copy(), axis=0)
    preprocessed_batch = preprocess_input(input_batch)
    return orig_rgb, preprocessed_batch


def predict(image_bytes: bytes, crop: Optional[str] = None) -> dict[str, Any]:
    """
    Run disease classification on raw image bytes.
    If `crop` ("tomato" | "potato" | "pepper") is given, restrict candidate classes
    to that crop, renormalise their softmax probabilities, and compute `crop_match_score`
    as the sum of the original probabilities of that crop's classes (0-100).
    Returns:
      - predicted_class: str
      - confidence: float (0-100, 2 decimals)
      - top3: list of {"class_name": str, "confidence": float}
      - predicted_index: int (index in full class_names list for Grad-CAM)
      - crop: Optional[str]
      - crop_match_score: Optional[float]
    """
    model = get_model()
    class_names = get_class_names()

    _, preprocessed_batch = preprocess_image_bytes(image_bytes)
    preds = model(preprocessed_batch, training=False)
    if isinstance(preds, (list, tuple)):
        preds = preds[0]
    probs = preds.numpy()[0]

    crop_key = crop.strip().lower() if isinstance(crop, str) and crop.strip() else None
    if crop_key is not None:
        if crop_key not in CROP_PREFIXES:
            raise ValueError(
                f"Unsupported crop '{crop}'. Allowed values: tomato, potato, pepper."
            )
        prefix = CROP_PREFIXES[crop_key]
        crop_indices = [
            idx for idx, name in enumerate(class_names) if name.startswith(prefix)
        ]
        if not crop_indices:
            raise ValueError(f"No model classes found for crop '{crop_key}'.")

        crop_probs_raw = probs[crop_indices]
        crop_prob_sum = float(np.sum(crop_probs_raw))
        crop_match_score = round(float(np.clip(crop_prob_sum * 100.0, 0.0, 100.0)), 2)

        if crop_prob_sum > 0.0:
            renorm_probs = crop_probs_raw / crop_prob_sum
        else:
            renorm_probs = np.ones_like(crop_probs_raw) / len(crop_indices)

        sorted_local_indices = np.argsort(renorm_probs)[::-1][:3]
        top3 = [
            {
                "class_name": class_names[int(crop_indices[int(local_idx)])],
                "confidence": round(float(renorm_probs[int(local_idx)]) * 100.0, 2),
            }
            for local_idx in sorted_local_indices
        ]
        top_idx = int(crop_indices[int(sorted_local_indices[0])])

        return {
            "predicted_class": top3[0]["class_name"],
            "confidence": top3[0]["confidence"],
            "top3": top3,
            "predicted_index": top_idx,
            "crop": crop_key,
            "crop_match_score": crop_match_score,
        }

    top3_indices = np.argsort(probs)[::-1][:3]
    top3 = [
        {
            "class_name": class_names[int(idx)],
            "confidence": round(float(probs[int(idx)]) * 100.0, 2),
        }
        for idx in top3_indices
    ]

    top_idx = int(top3_indices[0])
    return {
        "predicted_class": top3[0]["class_name"],
        "confidence": top3[0]["confidence"],
        "top3": top3,
        "predicted_index": top_idx,
        "crop": None,
        "crop_match_score": None,
    }
