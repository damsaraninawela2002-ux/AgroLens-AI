import * as tf from "@tensorflow/tfjs";
import { loadAgroLensModel } from "./modelLoader";
import { preprocessLeafImage } from "./preprocess";

let cachedConvSubModel = null;
let cachedModelRef = null;

/**
 * Build or reuse a sub-model that outputs the activation of `Conv_1`.
 */
function getConvSubModel(model, lastConvLayerName = "Conv_1") {
  if (cachedConvSubModel && cachedModelRef === model) {
    return cachedConvSubModel;
  }
  const convLayer = model.getLayer(lastConvLayerName);
  cachedConvSubModel = tf.model({
    inputs: model.inputs,
    outputs: convLayer.output,
  });
  cachedModelRef = model;
  return cachedConvSubModel;
}

/**
 * Exact OpenCV COLORMAP_JET RGB lookup table for a value v in [0, 255].
 * Matches cv2.applyColorMap(..., cv2.COLORMAP_JET) converted from BGR to RGB.
 */
function jetColorMapRgb(v) {
  const x = Math.min(1, Math.max(0, v / 255));
  const r = Math.round(
    255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 3)))
  );
  const g = Math.round(
    255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 2)))
  );
  const b = Math.round(
    255 * Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 1)))
  );
  return [r, g, b];
}

/**
 * Generate a Grad-CAM heatmap overlay on a canvas using the last convolutional layer (`Conv_1`)
 * and `tf.grad`, matching Backend/app/services/gradcam.py.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {number} predIndex - Class index in full 15-class list
 * @param {object} [options]
 * @param {string} [options.lastConvLayerName="Conv_1"]
 * @param {number} [options.alpha=0.4]
 * @returns {Promise<{ dataUrl: string, blob: Blob, file: File }>}
 */
export async function generateGradCamInBrowser(
  imageSource,
  predIndex,
  { lastConvLayerName = "Conv_1", alpha = 0.4 } = {}
) {
  const { model } = await loadAgroLensModel();
  const convSubModel = getConvSubModel(model, lastConvLayerName);

  // Locate classifier head layers after Conv_1
  const layerNames = model.layers.map((l) => l.name);
  const convIdx = layerNames.indexOf(lastConvLayerName);
  if (convIdx === -1) {
    throw new Error(`Layer '${lastConvLayerName}' not found in model`);
  }
  const tailLayers = model.layers.slice(convIdx + 1);

  const inputTensor = preprocessLeafImage(imageSource);

  let heatmapValues;
  let gridH = 7;
  let gridW = 7;

  try {
    const heatmapTensor = tf.tidy(() => {
      const convOutput = convSubModel.predict(inputTensor);

      // Differentiate target class probability with respect to Conv_1 activations
      const classScoreFn = (convAct) => {
        let x = convAct;
        for (const layer of tailLayers) {
          x = layer.apply(x, { training: false });
        }
        // Gather the target class probability column: shape [1]
        return x.gather([predIndex], 1).squeeze();
      };

      const gradFn = tf.grad(classScoreFn);
      const grads = gradFn(convOutput);

      // Global average pooling over batch and spatial dimensions [0, 1, 2] -> [1280]
      const pooledGrads = tf.mean(grads, [0, 1, 2]);

      // Weight conv channels by pooled gradients: [7, 7, 1280] @ [1280, 1] -> [7, 7]
      const convMap = convOutput.squeeze([0]);
      const weighted = tf
        .matMul(
          convMap.reshape([convMap.shape[0] * convMap.shape[1], convMap.shape[2]]),
          pooledGrads.expandDims(1)
        )
        .reshape([convMap.shape[0], convMap.shape[1]]);

      const reluMap = tf.maximum(weighted, 0);
      const maxVal = tf.max(reluMap).add(1e-8);
      return reluMap.div(maxVal);
    });

    gridH = heatmapTensor.shape[0];
    gridW = heatmapTensor.shape[1];
    heatmapValues = Array.from(await heatmapTensor.data());
    heatmapTensor.dispose();
  } finally {
    inputTensor.dispose();
  }

  // Render original image and blend bilinearly-upsampled Jet colormap on canvas
  const width = imageSource.naturalWidth || imageSource.width || 224;
  const height = imageSource.naturalHeight || imageSource.height || 224;

  // Put the 7x7 heatmap onto a small canvas and let 2D canvas bilinear smoothing upsample it
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = gridW;
  smallCanvas.height = gridH;
  const smallCtx = smallCanvas.getContext("2d");
  const smallImgData = smallCtx.createImageData(gridW, gridH);
  for (let i = 0; i < gridW * gridH; i += 1) {
    const val = Math.round(Math.min(1, Math.max(0, heatmapValues[i] || 0)) * 255);
    smallImgData.data[i * 4] = val;
    smallImgData.data[i * 4 + 1] = val;
    smallImgData.data[i * 4 + 2] = val;
    smallImgData.data[i * 4 + 3] = 255;
  }
  smallCtx.putImageData(smallImgData, 0, 0);

  const heatCanvas = document.createElement("canvas");
  heatCanvas.width = width;
  heatCanvas.height = height;
  const heatCtx = heatCanvas.getContext("2d");
  heatCtx.imageSmoothingEnabled = true;
  heatCtx.imageSmoothingQuality = "high";
  heatCtx.drawImage(smallCanvas, 0, 0, width, height);
  const upsampledScalar = heatCtx.getImageData(0, 0, width, height).data;

  // Draw original image and blend pixel-by-pixel with Jet colormap
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d");
  outCtx.drawImage(imageSource, 0, 0, width, height);
  const imgData = outCtx.getImageData(0, 0, width, height);
  const pixels = imgData.data;
  const origWeight = 1.0 - alpha;

  for (let p = 0; p < pixels.length; p += 4) {
    const heatVal = upsampledScalar[p];
    const [jr, jg, jb] = jetColorMapRgb(heatVal);
    pixels[p] = Math.round(pixels[p] * origWeight + jr * alpha);
    pixels[p + 1] = Math.round(pixels[p + 1] * origWeight + jg * alpha);
    pixels[p + 2] = Math.round(pixels[p + 2] * origWeight + jb * alpha);
  }
  outCtx.putImageData(imgData, 0, 0);

  const dataUrl = outCanvas.toDataURL("image/jpeg", 0.92);
  const blob = await new Promise((resolve, reject) => {
    outCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode Grad-CAM JPEG"))),
      "image/jpeg",
      0.92
    );
  });
  const file = new File([blob], "gradcam.jpg", { type: "image/jpeg" });

  return { dataUrl, blob, file };
}
