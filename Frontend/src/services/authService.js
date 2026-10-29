import api from "./api";

/**
 * Register a new Farmer or Agricultural Officer.
 * Matches Backend POST /api/auth/register (UserRegister JSON schema).
 */
export async function registerUser({
  full_name,
  email,
  password,
  role,
  district,
  preferred_language,
}) {
  const response = await api.post("/api/auth/register", {
    full_name,
    email,
    password,
    role,
    district,
    preferred_language,
  });
  return response.data;
}

/**
 * Authenticate user with email & password.
 * Matches Backend POST /api/auth/login (UserLogin JSON schema -> TokenResponse).
 */
export async function loginUser({ email, password }) {
  const response = await api.post("/api/auth/login", {
    email,
    password,
  });
  return response.data;
}

/**
 * Restore or refresh the access token using the HttpOnly refresh_token cookie.
 * Matches Backend POST /api/auth/refresh.
 */
export async function refreshSession() {
  const response = await api.post("/api/auth/refresh");
  return response.data;
}

/**
 * Revoke the current session and clear the refresh_token cookie.
 * Matches Backend POST /api/auth/logout.
 */
export async function logoutUser() {
  const response = await api.post("/api/auth/logout");
  return response.data;
}

/**
 * Fetch the currently authenticated user's profile.
 * Matches Backend GET /api/auth/me (-> UserResponse).
 */
export async function fetchCurrentUser() {
  const response = await api.get("/api/auth/me");
  return response.data;
}

/**
 * Upload a leaf image for disease prediction & Grad-CAM.
 * Matches Backend POST /api/predict (multipart/form-data field name: "file").
 */
export async function predictLeafDisease(file) {
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
 * Fetch farmer's diagnosis history.
 * Matches Backend GET /api/predict/history.
 */
export async function fetchPredictionHistory() {
  const response = await api.get("/api/predict/history");
  return response.data;
}
