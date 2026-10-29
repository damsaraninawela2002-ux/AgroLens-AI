import api from "./api";

// ============================================================================
// USERS & OFFICER APPROVALS
// ============================================================================

export async function getAdminUsers(params = {}) {
  const response = await api.get("/api/admin/users", { params });
  return response.data;
}

export async function getAdminUserById(userId) {
  const response = await api.get(`/api/admin/users/${userId}`);
  return response.data;
}

export async function createAdminUser(payload) {
  const response = await api.post("/api/admin/users", payload);
  return response.data;
}

export async function updateAdminUser(userId, payload) {
  const response = await api.put(`/api/admin/users/${userId}`, payload);
  return response.data;
}

export async function approveOfficerUser(userId) {
  const response = await api.put(`/api/admin/users/${userId}/approve`);
  return response.data;
}

export async function rejectOfficerUser(userId) {
  const response = await api.put(`/api/admin/users/${userId}/reject`);
  return response.data;
}

export async function resetAdminUserPassword(userId, newPassword) {
  const response = await api.put(`/api/admin/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return response.data;
}

export async function deleteAdminUser(userId) {
  await api.delete(`/api/admin/users/${userId}`);
}

// ============================================================================
// TREATMENTS
// ============================================================================

export async function getAdminTreatments(params = {}) {
  const response = await api.get("/api/admin/treatments", { params });
  return response.data;
}

export async function getAdminTreatmentById(treatmentId) {
  const response = await api.get(`/api/admin/treatments/${treatmentId}`);
  return response.data;
}

export async function createAdminTreatment(payload) {
  const response = await api.post("/api/admin/treatments", payload);
  return response.data;
}

export async function updateAdminTreatment(treatmentId, payload) {
  const response = await api.put(`/api/admin/treatments/${treatmentId}`, payload);
  return response.data;
}

export async function verifyAdminTreatment(treatmentId, source) {
  const response = await api.put(`/api/admin/treatments/${treatmentId}/verify`, {
    source,
  });
  return response.data;
}

export async function deleteAdminTreatment(treatmentId) {
  await api.delete(`/api/admin/treatments/${treatmentId}`);
}

// ============================================================================
// DIAGNOSES
// ============================================================================

export async function getAdminDiagnoses(params = {}) {
  const response = await api.get("/api/admin/diagnoses", { params });
  return response.data;
}

export async function getAdminDiagnosisById(diagnosisId) {
  const response = await api.get(`/api/admin/diagnoses/${diagnosisId}`);
  return response.data;
}

export async function deleteAdminDiagnosis(diagnosisId) {
  await api.delete(`/api/admin/diagnoses/${diagnosisId}`);
}

// ============================================================================
// ANALYTICS
// ============================================================================

export async function getAdminAnalyticsOverview() {
  const response = await api.get("/api/admin/analytics/overview");
  return response.data;
}

export async function getAdminScansOverTime(days = 30) {
  const response = await api.get("/api/admin/analytics/scans-over-time", {
    params: { days },
  });
  return response.data;
}

export async function getAdminDiseaseAnalytics() {
  const response = await api.get("/api/admin/analytics/diseases");
  return response.data;
}

export async function getAdminDistrictAnalytics() {
  const response = await api.get("/api/admin/analytics/districts");
  return response.data;
}

// ============================================================================
// MODEL PERFORMANCE & CSV FEEDBACK EXPORT
// ============================================================================

export async function getAdminModelInfo() {
  const response = await api.get("/api/admin/model");
  return response.data;
}

export async function exportModelFeedbackCsv() {
  const response = await api.get("/api/admin/model/feedback/export", {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "training_feedback.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function getAdminAuditLogs(params = {}) {
  const response = await api.get("/api/admin/audit-logs", { params });
  return response.data;
}

/**
 * Notify DashboardLayout to refresh sidebar badge counts (pending approvals & unverified treatments).
 */
export function notifyAdminCountsUpdated() {
  window.dispatchEvent(new CustomEvent("agrolens:admin-counts-updated"));
}
