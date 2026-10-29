import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

let inMemoryAccessToken = null;
let refreshPromise = null;

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAccessToken(token) {
  inMemoryAccessToken = token || null;
}

export const getStoredToken = getAccessToken;
export const setStoredToken = setAccessToken;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const pathname = window.location.pathname || "";
  const target = pathname.startsWith("/admin") ? "/admin/login" : "/login";
  if (pathname !== target) {
    window.location.assign(target);
  }
}

// Request interceptor: attach in-memory JWT Bearer token if present
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401, attempt /api/auth/refresh once and retry request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
    const requestUrl = originalRequest?.url || "";

    const isAuthEndpoint =
      requestUrl.includes("/api/auth/login") ||
      requestUrl.includes("/api/auth/register") ||
      requestUrl.includes("/api/auth/refresh") ||
      requestUrl.includes("/api/auth/logout");

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${API_BASE_URL}/api/auth/refresh`,
              {},
              { withCredentials: true }
            )
            .then((res) => res.data)
            .finally(() => {
              refreshPromise = null;
            });
        }

        const refreshData = await refreshPromise;
        const newToken = refreshData?.access_token;
        if (!newToken) {
          throw new Error("No access token returned from refresh");
        }

        setAccessToken(newToken);
        window.dispatchEvent(
          new CustomEvent("agrolens:token-refreshed", { detail: refreshData })
        );

        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent("agrolens:unauthorized"));
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
