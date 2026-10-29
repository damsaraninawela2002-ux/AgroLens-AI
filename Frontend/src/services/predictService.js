import api from "./api";

/**
 * Upload a leaf image to POST /api/predict.
 * Field name: "file" (JPG, JPEG, PNG up to 5MB).
 * Returns { diagnosis, treatment, disclaimer }.
 */
export async function uploadLeafForPrediction(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/predict", formData, {
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
