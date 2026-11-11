import api from "./api";

/**
 * Upload a leaf image to POST /api/predict (server-side inference).
 * Field name: "file" (JPG, JPEG, PNG up to 5MB), optional "crop".
 * Returns { diagnosis, treatment, disclaimer }.
 */
export async function uploadLeafForPrediction(file, crop = null) {
  const formData = new FormData();
  formData.append("file", file);
  if (crop) {
    formData.append("crop", crop);
  }

  const response = await api.post("/api/predict", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

/**
 * Record a browser-computed leaf diagnosis and Grad-CAM image via POST /api/scans/record.
 * Returns { diagnosis, treatment, crop_match_score, warning, disclaimer }.
 */
export async function recordBrowserScan({
  file,
  heatmap,
  crop,
  className,
  confidence,
  top3,
  cropMatchScore,
}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("heatmap", heatmap);
  formData.append("className", className);
  formData.append("confidence", String(confidence));
  formData.append("top3", JSON.stringify(top3 || []));
  if (crop) {
    formData.append("crop", crop);
  }
  if (cropMatchScore !== undefined && cropMatchScore !== null) {
    formData.append("cropMatchScore", String(cropMatchScore));
  }

  const response = await api.post("/api/scans/record", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

/**
 * Fetch logged-in farmer's diagnosis history from GET /api/predict/history.
 * Returns array of diagnosis objects (newest first).
 */
export async function getFarmerHistory() {
  const response = await api.get("/api/predict/history");
  return response.data;
}

/**
 * Fetch a single diagnosis and its treatment by ID from GET /api/predict/{id}.
 * Returns { diagnosis, treatment, disclaimer }.
 */
export async function getDiagnosisById(id) {
  const response = await api.get(`/api/predict/${id}`);
  return response.data;
}

/**
 * Fetch public ML model classes and evaluation metrics from GET /api/model/info.
 */
export async function getModelInfo() {
  const response = await api.get("/api/model/info");
  return response.data;
}
