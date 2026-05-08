/**
 * tokens.js
 * Single source of truth for JWT token persistence.
 * Tokens are stored in localStorage under a namespaced key.
 */

const STORAGE_KEY = "quicktims.tokens"

export function getTokens() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setTokens(tokens) {
  if (!tokens) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

/** Alias for setTokens(null) — explicit intent is clearer at call sites. */
export function clearTokens() {
  localStorage.removeItem(STORAGE_KEY)
}
