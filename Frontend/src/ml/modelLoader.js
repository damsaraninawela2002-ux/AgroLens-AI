import * as tf from "@tensorflow/tfjs";

export const MODEL_VERSION = "1.0.0";
export const IDB_MODEL_URL = "indexeddb://agrolens-model";
export const HTTP_MODEL_URL = "/model/model.json";
export const CLASSES_URL = "/model/classes.json";
const VERSION_STORAGE_KEY = "agrolens_tfjs_model_version";

let modelInstance = null;
let classesData = null;
let loadingPromise = null;
let backendInitialized = false;

/**
 * Check whether the current version of the model is already cached in IndexedDB.
 */
export function isModelCached() {
  try {
    return localStorage.getItem(VERSION_STORAGE_KEY) === MODEL_VERSION;
  } catch {
    return false;
  }
}

/**
 * Initialize TensorFlow.js backend: prefer WebGL, fall back to CPU.
 */
export async function initTfBackend() {
  if (backendInitialized) {
    return tf.getBackend();
  }
  try {
    const ok = await tf.setBackend("webgl");
    if (!ok) {
      await tf.setBackend("cpu");
    }
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  backendInitialized = true;
  return tf.getBackend();
}

/**
 * Load class names and crop prefix mappings from /model/classes.json.
 */
export async function loadClassesMetadata() {
  if (classesData) {
    return classesData;
  }
  const response = await fetch(CLASSES_URL);
  if (!response.ok) {
    throw new Error(`Failed to load class metadata (${response.status})`);
  }
  classesData = await response.json();
  return classesData;
}

/**
 * Load the AgroLens TensorFlow.js Layers model once and reuse it.
 * Caches the model in IndexedDB (indexeddb://agrolens-model) keyed by MODEL_VERSION.
 *
 * @param {object} [options]
 * @param {(info: { isFirstLoad: boolean, fraction: number }) => void} [options.onProgress]
 * @returns {Promise<{ model: tf.LayersModel, metadata: object, backend: string }>}
 */
export async function loadAgroLensModel({ onProgress } = {}) {
  const backend = await initTfBackend();
  const metadata = await loadClassesMetadata();

  if (modelInstance) {
    onProgress?.({ isFirstLoad: false, fraction: 1 });
    return { model: modelInstance, metadata, backend };
  }

  if (loadingPromise) {
    const model = await loadingPromise;
    return { model, metadata, backend };
  }

  loadingPromise = (async () => {
    const cachedVersionMatches = isModelCached();

    if (cachedVersionMatches) {
      try {
        onProgress?.({ isFirstLoad: false, fraction: 0.3 });
        const cachedModel = await tf.loadLayersModel(IDB_MODEL_URL);
        modelInstance = cachedModel;
        onProgress?.({ isFirstLoad: false, fraction: 1 });
        return cachedModel;
      } catch {
        // IndexedDB load failed or was cleared; fall through to network download
      }
    }

    onProgress?.({ isFirstLoad: true, fraction: 0.05 });
    const downloadedModel = await tf.loadLayersModel(HTTP_MODEL_URL, {
      onProgress: (fraction) => {
        onProgress?.({
          isFirstLoad: true,
          fraction: Math.min(0.95, Math.max(0.05, Number(fraction) || 0)),
        });
      },
    });

    try {
      await downloadedModel.save(IDB_MODEL_URL);
      localStorage.setItem(VERSION_STORAGE_KEY, MODEL_VERSION);
    } catch {
      // Saving to IndexedDB may fail in private browsing or low storage; non-fatal
    }

    modelInstance = downloadedModel;
    onProgress?.({ isFirstLoad: true, fraction: 1 });
    return downloadedModel;
  })();

  try {
    const model = await loadingPromise;
    return { model, metadata, backend };
  } finally {
    loadingPromise = null;
  }
}
