/**
 * authService.js
 * Centralized authentication API calls.
 * All auth logic goes through here — nothing calls /auth/* directly elsewhere.
 */
import { API_BASE_URL } from "./client.js"
import { getTokens, setTokens, clearTokens } from "../state/auth/tokens.js"
import { isJwtExpired } from "../state/auth/jwt.js"

// ── Generic fetch with auth header ──────────────────────────────────────────

async function fetchJSON(path, options = {}) {
  const url = `${API_BASE_URL}${path}`
  const headers = new Headers(options.headers ?? {})

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const tokens = getTokens()
  if (tokens?.access) headers.set("Authorization", `Bearer ${tokens.access}`)

  const res = await fetch(url, { ...options, headers })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { data = text || null }

  if (!res.ok) {
    // Normalize error into a consistent shape
    throw { status: res.status, body: data }
  }
  return data
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

/**
 * Login with username (or email) + password.
 * Returns { access, refresh }.
 */
export async function apiLogin(identifier, password) {
  // The backend accepts either `username` or `email` in the same field
  const isEmail = identifier.includes("@")
  const payload = isEmail
    ? { username: "", email: identifier, password }
    : { username: identifier, password }

  return fetchJSON("/auth/login/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/**
 * Refresh the access token using the stored refresh token.
 * Returns new tokens or null on failure.
 */
export async function apiRefreshToken() {
  const tokens = getTokens()
  if (!tokens?.refresh) return null
  try {
    const data = await fetchJSON("/auth/refresh/", {
      method: "POST",
      body: JSON.stringify({ refresh: tokens.refresh }),
    })
    if (!data?.access) return null
    const next = { ...tokens, access: data.access }
    setTokens(next)
    return next
  } catch {
    return null
  }
}

/**
 * Fetch current authenticated user profile.
 * Returns user object or null.
 */
export async function apiFetchMe() {
  const tokens = getTokens()
  if (!tokens?.access) return null

  // Proactively refresh if expired
  if (isJwtExpired(tokens.access)) {
    const next = await apiRefreshToken()
    if (!next) {
      clearTokens()
      return null
    }
  }

  try {
    return await fetchJSON("/auth/me/")
  } catch {
    return null
  }
}

/**
 * Register a new organization + admin user.
 * Returns { access, refresh, user }.
 */
export async function apiRegister(payload) {
  return fetchJSON("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/**
 * Google OAuth login.
 * Returns { access, refresh }.
 */
export async function apiGoogleLogin(googleAccessToken) {
  return fetchJSON("/auth/google/", {
    method: "POST",
    body: JSON.stringify({ access_token: googleAccessToken }),
  })
}

// ── Error normalization ───────────────────────────────────────────────────────

/**
 * Extracts a human-readable message from a thrown API error.
 * Works with Django REST Framework's various error shapes:
 *   { detail: "..." }
 *   { field: ["error"] }
 *   "plain string"
 *   500 HTML response (server error)
 */
export function extractAuthError(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  const body = err?.body

  if (!body) {
    if (err instanceof TypeError) return "Cannot connect to server. Check your network."
    return fallback
  }

  if (typeof body === "string") {
    // Django 500 returns HTML — don't show it
    if (body.trim().startsWith("<")) return "Server error. Please try again shortly."
    return body
  }

  if (typeof body === "object") {
    if (typeof body.detail === "string") return body.detail
    // Field-level errors: { username: ["This field is required."] }
    const first = Object.values(body)[0]
    if (Array.isArray(first) && first.length > 0) return first[0]
    if (typeof first === "string") return first
  }

  return fallback
}
