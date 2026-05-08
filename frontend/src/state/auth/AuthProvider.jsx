/**
 * AuthProvider.jsx
 * Central authentication state for the application.
 *
 * Responsibilities:
 *  - Rehydrate auth state on page load (via /auth/me/)
 *  - Expose login / register / loginWithGoogle / logout actions
 *  - Listen for session-expired events dispatched by the API client
 *  - Ensure no stale tokens survive across sessions
 */
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  apiLogin,
  apiFetchMe,
  apiRegister,
  apiGoogleLogin,
  extractAuthError,
} from "../../api/authService.js"
import { AuthContext } from "./AuthContext.js"
import { getJwtCompanyId, getJwtRole, getJwtUsername } from "./jwt.js"
import { getTokens, setTokens, clearTokens } from "./tokens.js"

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser]       = useState(null)

  // ── Rehydrate user from /auth/me/ ─────────────────────────────────────────

  const refreshMe = useCallback(async () => {
    const tokens = getTokens()
    if (!tokens?.access) {
      setUser(null)
      return
    }

    const me = await apiFetchMe()

    if (me?.username && me?.role) {
      if (!me.company) {
        // User exists but has no company — force them to re-register/onboard
        clearTokens()
        setUser(null)
        return
      }
      setUser({
        username:  me.username,
        email:     me.email    ?? "",
        firstName: me.first_name ?? "",
        lastName:  me.last_name  ?? "",
        role:      me.role,
        companyId: me.company,
      })
      // Persist org name so AppShell topbar shows it immediately
      if (me.company_name) {
        localStorage.setItem("quicktims.orgName", me.company_name)
        window.dispatchEvent(new CustomEvent("quicktims:orgName"))
      }
      return
    }

    // Fallback: parse claims directly from the token (works offline too)
    const username  = getJwtUsername(tokens.access)
    const role      = getJwtRole(tokens.access)
    const companyId = getJwtCompanyId(tokens.access)

    if (username && role && companyId) {
      setUser({ username, email: "", firstName: "", lastName: "", role, companyId })
    } else {
      // Token is present but invalid/incomplete — log out cleanly
      clearTokens()
      setUser(null)
    }
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────

  const login = useCallback(
    async (identifier, password) => {
      const data = await apiLogin(identifier, password)
      setTokens({ access: data.access, refresh: data.refresh })
      await refreshMe()
    },
    [refreshMe]
  )

  // ── Register ──────────────────────────────────────────────────────────────

  const register = useCallback(
    async (payload) => {
      const data = await apiRegister(payload)
      setTokens({ access: data.access, refresh: data.refresh })
      await refreshMe()
    },
    [refreshMe]
  )

  // ── Google OAuth ──────────────────────────────────────────────────────────

  const loginWithGoogle = useCallback(
    async (googleAccessToken) => {
      const data = await apiGoogleLogin(googleAccessToken)
      setTokens({ access: data.access, refresh: data.refresh })
      await refreshMe()
    },
    [refreshMe]
  )

  // ── Logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearTokens()
    localStorage.removeItem("quicktims.orgName")
    setUser(null)
  }, [])

  // ── Bootstrap on mount ────────────────────────────────────────────────────

  useEffect(() => {
    refreshMe().finally(() => setIsReady(true))
  }, [refreshMe])

  // ── Session expiry event (fired by API client on 401) ─────────────────────

  useEffect(() => {
    const handle = () => {
      clearTokens()
      setUser(null)
    }
    window.addEventListener("quicktims:session-expired", handle)
    return () => window.removeEventListener("quicktims:session-expired", handle)
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({ isReady, user, login, register, loginWithGoogle, logout, refreshMe }),
    [isReady, user, login, register, loginWithGoogle, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
