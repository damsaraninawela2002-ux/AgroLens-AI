const PROD_API = "https://agrolens-ai.onrender.com";
const LOCAL_API = "http://127.0.0.1:8000";
const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocalHost = host === "localhost" || host === "127.0.0.1";

export const API_URL = isLocalHost
  ? (import.meta.env.VITE_API_URL || LOCAL_API).replace(/\/+$/, "")
  : PROD_API;

export const INFERENCE_MODE = import.meta.env.VITE_INFERENCE_MODE || "browser";
console.info("[AgroLens] API_URL =", API_URL, "| host =", host);
