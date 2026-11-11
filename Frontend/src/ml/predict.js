import * as tf from "@tensorflow/tfjs";
import { loadAgroLensModel } from "./modelLoader";
import { preprocessLeafImage } from "./preprocess";

const DEFAULT_CROP_PREFIXES = {
  tomato: "Tomato",
  potato: "Potato",
  pepper: "Pepper,_bell",
};

/**
 * Run browser inference on an image element and apply exact crop-aware filtering
 * matching Backend/app/services/ml_service.py (`predict`).
 *
 * @param {HTMLImageElement|HTMLCanvasElement} imageSource
 * @param {string} [crop] - "tomato" | "potato" | "pepper"
 * @param {object} [options]
 * @param {(info: { isFirstLoad: boolean, fraction: number }) => void} [options.onModelProgress]
 * @returns {Promise<{
 *   className: string,
 *   confidence: number,
 *   confidencePercent: number,
 *   top3: Array<{ class_name: string, confidence: number }>,
 *   predictedIndex: number,
 *   crop: string | null,
 *   cropMatchScore: number | null
 * }>}
 */
export async function predictLeafInBrowser(
  imageSource,
  crop = null,
  { onModelProgress } = {}
) {
  const { model, metadata } = await loadAgroLensModel({
    onProgress: onModelProgress,
  });

  const classNames = metadata?.class_names || [];
  const cropPrefixes = metadata?.crop_prefixes || DEFAULT_CROP_PREFIXES;

  const inputTensor = preprocessLeafImage(imageSource);
  let probsArray;
  try {
    const predTensor = tf.tidy(() => {
      const out = model.predict(inputTensor);
      return Array.isArray(out) ? out[0] : out;
    });
    const rawData = await predTensor.data();
    probsArray = Array.from(rawData);
    predTensor.dispose();
  } finally {
    inputTensor.dispose();
  }

  const cropKey =
    typeof crop === "string" && crop.trim() ? crop.trim().toLowerCase() : null;

  if (cropKey) {
    const prefix = cropPrefixes[cropKey];
    if (!prefix) {
      throw new Error(
        `Unsupported crop '${crop}'. Allowed values: tomato, potato, pepper.`
      );
    }

    const cropIndices = [];
    for (let i = 0; i < classNames.length; i += 1) {
      if (classNames[i].startsWith(prefix)) {
        cropIndices.push(i);
      }
    }

    if (cropIndices.length === 0) {
      throw new Error(`No model classes found for crop '${cropKey}'.`);
    }

    const cropProbsRaw = cropIndices.map((idx) => probsArray[idx] || 0);
    const cropProbSum = cropProbsRaw.reduce((acc, v) => acc + v, 0);
    const cropMatchScore = Number(
      Math.min(100, Math.max(0, cropProbSum * 100)).toFixed(2)
    );

    const renormProbs =
      cropProbSum > 0
        ? cropProbsRaw.map((p) => p / cropProbSum)
        : cropProbsRaw.map(() => 1 / cropIndices.length);

    const rankedLocal = renormProbs
      .map((prob, localIdx) => ({ prob, localIdx }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 3);

    const top3 = rankedLocal.map(({ prob, localIdx }) => ({
      class_name: classNames[cropIndices[localIdx]],
      confidence: Number((prob * 100).toFixed(2)),
    }));

    const topGlobalIndex = cropIndices[rankedLocal[0].localIdx];
    const topProb0to1 = Number(rankedLocal[0].prob.toFixed(6));

    return {
      className: top3[0].class_name,
      confidence: topProb0to1,
      confidencePercent: top3[0].confidence,
      top3,
      predictedIndex: topGlobalIndex,
      crop: cropKey,
      cropMatchScore,
    };
  }

  const rankedAll = probsArray
    .map((prob, idx) => ({ prob, idx }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 3);

  const top3 = rankedAll.map(({ prob, idx }) => ({
    class_name: classNames[idx],
    confidence: Number((prob * 100).toFixed(2)),
  }));

  return {
    className: top3[0].class_name,
    confidence: Number(rankedAll[0].prob.toFixed(6)),
    confidencePercent: top3[0].confidence,
    top3,
    predictedIndex: rankedAll[0].idx,
    crop: null,
    cropMatchScore: null,
  };
}
