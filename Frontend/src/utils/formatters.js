import { API_BASE_URL } from "../services/api";
import { DISEASE_LABELS } from "./constants";

export { SRI_LANKAN_DISTRICTS } from "./constants";

/**
 * Build a full image URL from a backend relative path (e.g. "/uploads/images/xyz.jpg").
 */
export function getImageUrl(path) {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  const cleanBase = API_BASE_URL.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Extract a human-readable error message from an Axios / FastAPI error response.
 */
export function extractErrorMessage(
  error,
  fallback = "Something went wrong. Please try again."
) {
  if (!error) return fallback;

  const data = error?.response?.data;
  if (data) {
    if (typeof data.detail === "string") {
      return data.detail;
    }
    if (Array.isArray(data.detail) && data.detail.length > 0) {
      const first = data.detail[0];
      if (first?.msg) {
        return first.msg.replace(/^Value error,\s*/i, "");
      }
    }
    if (typeof data.message === "string") {
      return data.message;
    }
  }

  if (typeof error.message === "string" && error.message !== "Network Error") {
    return error.message;
  }

  if (error.message === "Network Error") {
    return "Cannot reach the AgroLens AI server. Please ensure the backend is running on http://localhost:8000.";
  }

  return fallback;
}

/**
 * Format PlantVillage disease class keys into clean display labels in English or Sinhala.
 * e.g. "Tomato___Late_blight" -> "Tomato – Late Blight" (or Sinhala equivalent).
 */
export function formatDiseaseKey(diseaseKey = "", lang = "en") {
  if (!diseaseKey) return "";
  const entry = DISEASE_LABELS[diseaseKey];
  if (entry) {
    return lang === "si" ? entry.si : entry.en;
  }

  const parts = diseaseKey.split("___");
  const crop = (parts[0] || "").replace(/,_/g, " ").replace(/_/g, " ").trim();
  const condition = (parts[1] || "")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return condition ? `${crop} – ${condition}` : crop;
}

/**
 * Format shorter disease label for chart axes.
 */
export function formatShortDiseaseKey(diseaseKey = "", lang = "en") {
  if (!diseaseKey) return "";
  const entry = DISEASE_LABELS[diseaseKey];
  if (entry) {
    return lang === "si" ? entry.shortSi : entry.shortEn;
  }
  return formatDiseaseKey(diseaseKey, lang);
}

/**
 * Get localized crop name from disease key.
 */
export function getCropFromDiseaseKey(diseaseKey = "", lang = "en") {
  if (!diseaseKey) return "";
  const entry = DISEASE_LABELS[diseaseKey];
  if (entry) {
    return lang === "si" ? entry.cropSi : entry.cropEn;
  }
  const parts = diseaseKey.split("___");
  return (parts[0] || "").replace(/,_/g, " ").replace(/_/g, " ").trim();
}

/**
 * Determine whether a predicted class key represents a healthy leaf.
 */
export function isHealthyDiseaseKey(diseaseKey = "") {
  if (!diseaseKey) return false;
  const entry = DISEASE_LABELS[diseaseKey];
  if (entry !== undefined) return entry.isHealthy;
  return diseaseKey.toLowerCase().includes("healthy");
}

/**
 * Check if treatment text is still marked with the "TO BE VERIFIED" placeholder.
 */
export function isToBeVerified(text = "") {
  if (!text) return true;
  return text.toUpperCase().includes("TO BE VERIFIED");
}

/**
 * Format confidence score percentage to 1 or 2 decimal places.
 */
export function formatConfidence(value, decimals = 1) {
  const num = Number(value);
  if (Number.isNaN(num)) return "0%";
  return `${num.toFixed(decimals)}%`;
}

/**
 * Return color tokens based on confidence score:
 * >= 85 -> green, 70-85 -> amber, < 70 -> red
 */
export function getConfidenceTone(confidence) {
  const num = Number(confidence) || 0;
  if (num >= 85) {
    return {
      color: "#16a34a",
      bgClass: "bg-emerald-50",
      textClass: "text-[#166534]",
      borderClass: "border-emerald-200",
      barClass: "bg-[#16a34a]",
      badgeVariant: "success",
    };
  }
  if (num >= 70) {
    return {
      color: "#f59e0b",
      bgClass: "bg-amber-50",
      textClass: "text-amber-800",
      borderClass: "border-amber-200",
      barClass: "bg-[#f59e0b]",
      badgeVariant: "warning",
    };
  }
  return {
    color: "#dc2626",
    bgClass: "bg-red-50",
    textClass: "text-[#dc2626]",
    borderClass: "border-red-200",
    barClass: "bg-[#dc2626]",
    badgeVariant: "danger",
  };
}

/**
 * Format ISO date string into readable date.
 */
export function formatDate(dateInput, lang = "en") {
  if (!dateInput) return "";
  try {
    const date = new Date(dateInput);
    const locale = lang === "si" ? "si-LK" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format ISO date string into readable date + time.
 */
export function formatDateTime(dateInput, lang = "en") {
  if (!dateInput) return "";
  try {
    const date = new Date(dateInput);
    const locale = lang === "si" ? "si-LK" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return String(dateInput);
  }
}

/**
 * Format an ISO timestamp into a relative "time ago" string (e.g. "2 hours ago") in English or Sinhala.
 */
export function formatTimeAgo(dateInput, lang = "en") {
  if (!dateInput) return "";
  try {
    const raw =
      typeof dateInput === "string" &&
      !dateInput.endsWith("Z") &&
      !dateInput.includes("+")
        ? `${dateInput}Z`
        : dateInput;
    const date = new Date(raw);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.max(0, Math.floor(diffMs / 1000));

    if (diffSec < 60) {
      return lang === "si" ? "දැන්" : "Just now";
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      if (lang === "si") return `මිනිත්තු ${diffMin} කට පෙර`;
      return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      if (lang === "si") return `පැය ${diffHours} කට පෙර`;
      return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) {
      if (lang === "si") return `දින ${diffDays} කට පෙර`;
      return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    }
    return formatDate(dateInput, lang);
  } catch {
    return formatDate(dateInput, lang);
  }
}

