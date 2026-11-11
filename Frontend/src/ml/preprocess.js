import * as tf from "@tensorflow/tfjs";

export const MODEL_INPUT_WIDTH = 224;
export const MODEL_INPUT_HEIGHT = 224;

/**
 * Load a File or Blob into an HTMLImageElement.
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image file"));
    };
    img.src = url;
  });
}

/**
 * Resize and compress a leaf photo in the browser before running the model or uploading.
 * Longest side is capped at `maxSide` (default 1024px) and encoded as JPEG at `quality` (~0.8).
 *
 * @param {File} file
 * @param {number} [maxSide=1024]
 * @param {number} [quality=0.8]
 * @returns {Promise<{ file: File, blob: Blob, imageElement: HTMLImageElement, width: number, height: number }>}
 */
export async function compressImageForScan(file, maxSide = 1024, quality = 0.8) {
  const img = await loadImageElement(file);
  const origW = img.naturalWidth || img.width || 224;
  const origH = img.naturalHeight || img.height || 224;

  let targetW = origW;
  let targetH = origH;
  const longest = Math.max(origW, origH);
  if (longest > maxSide) {
    const scale = maxSide / longest;
    targetW = Math.max(1, Math.round(origW * scale));
    targetH = Math.max(1, Math.round(origH * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas compression failed"))),
      "image/jpeg",
      quality
    );
  });

  const baseName = (file.name || "leaf").replace(/\.[^.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
  });
  const compressedImg = await loadImageElement(compressedFile);

  return {
    file: compressedFile,
    blob,
    imageElement: compressedImg,
    width: targetW,
    height: targetH,
  };
}

/**
 * Resize an HTMLImageElement / HTMLCanvasElement to 224x224 RGB and apply exact
 * MobileNetV2 preprocess_input scaling: (pixel / 127.5) - 1.0 -> [-1, 1].
 * Matches Backend/app/services/ml_service.py (`preprocess_image_bytes`).
 *
 * Caller is responsible for disposing the returned Tensor4D.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imageSource
 * @returns {tf.Tensor4D} shape [1, 224, 224, 3], float32 in [-1, 1]
 */
export function preprocessLeafImage(imageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_INPUT_WIDTH;
  canvas.height = MODEL_INPUT_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imageSource, 0, 0, MODEL_INPUT_WIDTH, MODEL_INPUT_HEIGHT);

  return tf.tidy(() => {
    const rgbTensor = tf.browser.fromPixels(canvas, 3).toFloat();
    const normalized = rgbTensor.div(127.5).sub(1.0);
    return normalized.expandDims(0);
  });
}
