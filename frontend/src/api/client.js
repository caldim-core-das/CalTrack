/**
 * client.js
 * Central API fetch wrapper.
 *
 * Tokens are stored as httpOnly cookies — JavaScript never touches them.
 * Every request uses credentials: "include" so the browser sends them
 * automatically.  On a 401 the client attempts a silent token refresh
 * (POST /auth/refresh/ — server rotates the access cookie).  If that
 * also fails the user is signed out via the session-expired event.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD
    ? `${window.location.origin}/Caltrack/api`
    : `${window.location.protocol}//${window.location.hostname}:8000/api`
)


// Track offline state so the banner can be shown once
let _offline = false
export function isOffline() { return _offline }

// Deduplicate concurrent GET requests
const _pendingRequests = new Map()

async function safeJson(res) {
  const text = await res.text()
  if (!text) return null
  try { return JSON.parse(text) }
  catch { return text }
}

/** Ask the server to rotate the access cookie using the refresh cookie. */
async function _silentRefresh() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: "POST",
      credentials: "include",
    })
    return res.ok
  } catch {
    return false
  }
}

export async function apiRequest(path, init = {}, attemptRefresh = true) {
  const method = (init.method || "GET").toUpperCase()
  const cacheKey = method === "GET" ? path + JSON.stringify(init.params || "") : null

  if (cacheKey && _pendingRequests.has(cacheKey)) {
    return _pendingRequests.get(cacheKey)
  }

  const requestPromise = (async () => {
    try {
      return await _executeRequest(path, init, attemptRefresh)
    } finally {
      if (cacheKey) _pendingRequests.delete(cacheKey)
    }
  })()

  if (cacheKey) _pendingRequests.set(cacheKey, requestPromise)
  return requestPromise
}

async function _executeRequest(path, init = {}, attemptRefresh = true) {
  const method = (init.method || "GET").toUpperCase()
  const headers = new Headers(init.headers ?? {})
  let body = init.body

  if (init.json !== undefined) {
    body = JSON.stringify(init.json)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  } else if (body && typeof body === "object" && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    body = JSON.stringify(body)
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json")
    }
  } else if (body instanceof FormData) {
    headers.delete("Content-Type")
  } else if (["POST", "PUT", "PATCH"].includes(method) && !headers.has("Content-Type") && !(body instanceof FormData) && !(body instanceof Blob)) {
    headers.set("Content-Type", "application/json")
  }

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",               // always send auth cookies
      cache: "no-store",                    // prevent aggressive browser caching
      headers,
      body,
    })

    // 401 — try a silent token refresh then replay the original request once
    if (res.status === 401 && attemptRefresh) {
      const refreshed = await _silentRefresh()
      if (refreshed) {
        return _executeRequest(path, init, false)   // replay, no second refresh
      }
      // Refresh also failed — force logout
      window.dispatchEvent(new CustomEvent("quicktims:session-expired"))
      throw { status: 401, body: { detail: "Session expired. Please log in again." } }
    }

    if (!res.ok) {
      throw { status: res.status, body: await safeJson(res) }
    }

    _offline = false
    return safeJson(res)

  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err
    _offline = true
    throw err
  }
}

export function unwrapResults(value) {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") {
    if (Array.isArray(value.data)) return value.data
    if (Array.isArray(value.results)) return value.results
  }
  return []
}
