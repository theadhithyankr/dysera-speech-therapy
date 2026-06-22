// Minimal auth helpers — only the JWT token is kept in localStorage.
// User profile is managed by UserContext (fetched from /api/auth/me).

export function getToken() {
  return localStorage.getItem("token") || ""
}

// Base URL for all API calls.
// Set VITE_API_URL in your deployment env (e.g. https://your-backend.railway.app).
// Leave empty for local dev — Vite's proxy handles /api/* → localhost:8000.
export const API_BASE = import.meta.env.VITE_API_URL ?? ""
