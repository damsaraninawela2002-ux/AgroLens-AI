import io
import uuid
from pathlib import Path
from typing import Optional
import cv2
import numpy as np
from PIL import Image
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

IMG_SIZE = (224, 224)


def _build_grad_model(
    model: tf.keras.Model, last_conv_layer_name: str = "Conv_1"
) -> tuple[tf.keras.Model, Optional[list[tf.keras.layers.Layer]]]:
    """
    Build a Grad-CAM model capable of extracting the output of `last_conv_layer_name`
    whether `Conv_1` is a top-level layer (functional model) or nested inside a
    MobileNetV2 sub-model.
    """
    top_layer_names = [layer.name for layer in model.layers]
    if last_conv_layer_name in top_layer_names:
        grad_model = tf.keras.models.Model(
            inputs=model.inputs,
            outputs=[
                model.get_layer(last_conv_layer_name).output,
                model.output,
            ],
        )
        return grad_model, None

    # Fallback if MobileNetV2 was saved as a nested sub-model
    for idx, layer in enumerate(model.layers):
        if hasattr(layer, "layers"):
            sub_names = [sl.name for sl in layer.layers]
            if last_conv_layer_name in sub_names:
                sub_grad_model = tf.keras.models.Model(
                    inputs=layer.inputs,
                    outputs=[
                        layer.get_layer(last_conv_layer_name).output,
                        layer.output,
                    ],
                )
                classifier_layers = model.layers[idx + 1 :]
                return sub_grad_model, classifier_layers

    raise ValueError(
        f"Layer '{last_conv_layer_name}' was not found in top-level or nested layers of the model."
    )


def make_gradcam_heatmap(
    img_array: np.ndarray,
    model: tf.keras.Model,
    last_conv_layer_name: str = "Conv_1",
    pred_index: Optional[int] = None,
) -> np.ndarray:
    """
    Compute a normalized 2D Grad-CAM heatmap in [0, 1] for a preprocessed
    (1, 224, 224, 3) input tensor.
    """
    grad_model, classifier_layers = _build_grad_model(model, last_conv_layer_name)
    img_tensor = tf.cast(img_array, tf.float32)

    with tf.GradientTape() as tape:
        if classifier_layers is None:
            last_conv_layer_output, preds = grad_model(img_tensor, training=False)
            if isinstance(preds, (list, tuple)):
                preds = preds[0]
        else:
            last_conv_layer_output, base_out = grad_model(img_tensor, training=False)
            tape.watch(last_conv_layer_output)
            x = base_out
            for clf_layer in classifier_layers:
                x = clf_layer(x, training=False)
            preds = x

        if pred_index is None:
            pred_index = int(tf.argmax(preds[0]))
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    conv_output = last_conv_layer_output[0]
    heatmap = conv_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
    return heatmap.numpy()


def overlay_gradcam_on_image(
    original_rgb: np.ndarray, heatmap: np.ndarray, alpha: float = 0.4
) -> np.ndarray:
    """Overlay a 2D Grad-CAM heatmap onto an RGB image array (uint8 [0, 255])."""
    img_uint8 = np.uint8(np.clip(original_rgb, 0, 255))
    heatmap_resized = cv2.resize(heatmap, (img_uint8.shape[1], img_uint8.shape[0]))
    heatmap_uint8 = np.uint8(255 * heatmap_resized)
    jet_heatmap = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
    jet_heatmap_rgb = cv2.cvtColor(jet_heatmap, cv2.COLOR_BGR2RGB)

    superimposed_rgb = cv2.addWeighted(
        img_uint8, 1.0 - alpha, jet_heatmap_rgb, alpha, 0
    )
    return superimposed_rgb


def generate_and_save_gradcam(
    image_bytes: bytes,
    model: tf.keras.Model,
    heatmaps_dir: Path,
    last_conv_layer_name: str = "Conv_1",
    pred_index: Optional[int] = None,
) -> str:
    """
    Generate a Grad-CAM overlay image from raw image bytes and save it as a JPG
    in `heatmaps_dir`. Returns the generated filename.
    """
    heatmaps_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(io.BytesIO(image_bytes)) as pil_img:
        rgb_full = np.array(pil_img.convert("RGB"))
        rgb_224 = np.array(pil_img.convert("RGB").resize(IMG_SIZE), dtype=np.float32)

    preprocessed_batch = preprocess_input(np.expand_dims(rgb_224, axis=0))
    heatmap = make_gradcam_heatmap(
        preprocessed_batch,
        model=model,
        last_conv_layer_name=last_conv_layer_name,
        pred_index=pred_index,
    )

    overlay_rgb = overlay_gradcam_on_image(rgb_full, heatmap, alpha=0.4)
    overlay_bgr = cv2.cvtColor(overlay_rgb, cv2.COLOR_RGB2BGR)

    heatmap_filename = f"{uuid.uuid4().hex}.jpg"
    heatmap_path = heatmaps_dir / heatmap_filename
    cv2.imwrite(str(heatmap_path), overlay_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])

    return heatmap_filename
