import api from "./api";

/**
 * Fetch pending review diagnoses (oldest first).
 * @param {Object} params - { district, crop, page, limit }
 */
export async function getPendingDiagnoses(params = {}) {
  const query = {};
  if (params.district) query.district = params.district;
  if (params.crop) query.crop = params.crop;
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await api.get("/api/officer/pending", { params: query });
  return response.data;
}

/**
 * Fetch diagnoses reviewed by the logged-in officer (newest first).
 * @param {Object} params - { page, limit }
 */
export async function getReviewedDiagnoses(params = {}) {
  const query = {};
  if (params.page) query.page = params.page;
  if (params.limit) query.limit = params.limit;

  const response = await api.get("/api/officer/reviewed", { params: query });
  return response.data;
}

/**
 * Fetch full details of a single diagnosis for officer review.
 * @param {string} id - Diagnosis ID
 */
export async function getOfficerDiagnosisById(id) {
  const response = await api.get(`/api/officer/diagnoses/${id}`);
  return response.data;
}

/**
 * Submit an officer review (confirm or correct).
 * @param {string} id - Diagnosis ID
 * @param {Object} payload - { action: "confirm" | "correct", corrected_label?: string, notes?: string }
 */
export async function submitOfficerReview(id, payload) {
  const response = await api.put(`/api/officer/review/${id}`, payload);
  return response.data;
}

/**
 * Fetch review statistics for the logged-in officer.
 */
export async function getOfficerStats() {
  const response = await api.get("/api/officer/stats");
  return response.data;
}

/**
 * Fetch list of valid disease class names for the correction dropdown.
 */
export async function getOfficerClasses() {
  const response = await api.get("/api/officer/classes");
  return response.data;
}
