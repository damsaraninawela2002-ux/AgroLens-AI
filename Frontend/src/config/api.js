const PROD_API = "https://agrolens-ai.onrender.com";
const envUrl = (import.meta.env.VITE_API_URL || "").trim();
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
export const API_URL = (envUrl || (isLocalHost ? "http://127.0.0.1:8000" : PROD_API)).replace(/\/+$/, "");
export const INFERENCE_MODE = import.meta.env.VITE_INFERENCE_MODE || "browser";
console.info("[AgroLens] API_URL =", API_URL);
