/**
 * AuthProvider.jsx
 * Central authentication state for the application.
 *
 * Tokens are httpOnly cookies — this file never sees them.
 * Auth state is derived solely from the /auth/me/ endpoint:
 *   - If it returns a user   → authenticated
 *   - If it returns null/401 → not authenticated, redirect to /login
 */
import { useCallback, useEffect, useMemo, useState } from "react"

import {
  apiLogin,
  apiFetchMe,
  apiRegister,
  apiGoogleLogin,
  apiCustomerGoogleLogin,
  apiLogout,
  extractAuthError,
} from "../../api/authService.js"
import { AuthContext } from "./AuthContext.js"

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser]       = useState(null)

  // ── Rehydrate user state from /auth/me/ ───────────────────────────────────
  // The browser sends the httpOnly cookie automatically — we just need to
  // check whether the server accepts it.

  const refreshMe = useCallback(async () => {
    let me;
    try {
      me = await apiFetchMe()
      console.log("DEBUG: apiFetchMe raw response:", JSON.stringify(me))
    } catch (e) {
      console.error("DEBUG: apiFetchMe exception:", e)
    }

    if (me?.username && me?.role) {
      const u = {
        username:  me.username,
        email:     me.email      ?? "",
        firstName: me.first_name ?? "",
        lastName:  me.last_name  ?? "",
        role:      me.role,
        companyId: me.company,
        companyPermissions: me.company_permissions ?? null,
        bio:       me.bio        ?? "",
        phone:     me.phone      ?? "",
        timezone:  me.timezone   ?? "UTC",
        language:  me.language   ?? "en",
        avatar_url:me.avatar_url ?? null,
        two_fa_enabled: me.two_fa_enabled ?? false,
        employee_roles: me.employee_roles ?? [],
        companyCountry: me.company_country ?? me.companyCountry ?? "IN",
        company_country: me.company_country ?? me.companyCountry ?? "IN",
        companyRegion: me.company_region ?? me.company_country ?? me.companyCountry ?? "IN",
        primaryCountry: me.primaryCountry ?? me.company_country ?? me.companyCountry ?? "IN",
        companyCurrency: me.company_currency ?? ((me.company_country || me.companyCountry || "IN") === "IN" ? "INR" : "USD"),
        companyCurrencySymbol: me.company_currency_symbol ?? ((me.company_country || me.companyCountry || "IN") === "IN" ? "₹" : "$"),
      }
      setUser(u)
      if (me.company_name) {
        localStorage.setItem("quicktims.orgName", me.company_name)
        window.dispatchEvent(new CustomEvent("quicktims:orgName"))
      }
      return u
    } else {
      console.log("DEBUG: refreshMe check failed — username:", me?.username, "role:", me?.role, "company:", me?.company)
      // Not authenticated (cookies missing, expired, or server rejected them)
      setUser(null)
      return null
    }
  }, [])

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (identifier, password) => {
      await apiLogin(identifier, password)   // server sets cookies
      return await refreshMe()                      // fetch user from /auth/me/
    },
    [refreshMe]
  )

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(
    async (payload) => {
      await apiRegister(payload)   // server sets cookies
      return await refreshMe()
    },
    [refreshMe]
  )

  // ── Google OAuth (Employee / Staff) ───────────────────────────────────────
  const loginWithGoogle = useCallback(
    async (googleAccessToken) => {
      await apiGoogleLogin(googleAccessToken)   // server sets cookies
      return await refreshMe()
    },
    [refreshMe]
  )

  // ── Customer Google OAuth ─────────────────────────────────────────────────
  const loginWithCustomerGoogle = useCallback(
    async (googleAccessToken) => {
      await apiCustomerGoogleLogin(googleAccessToken)   // server sets cookies
      return await refreshMe()
    },
    [refreshMe]
  )

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Mark offline before clearing cookies
    try {
      const { apiRequest } = await import("../../api/client.js")
      await apiRequest("/employees/set-presence/", {
        method: "POST",
        json: { is_online: false },
      })
    } catch (_) {}
    await apiLogout()                                   // server clears cookies
    localStorage.removeItem("quicktims.orgName")
    localStorage.removeItem("caltrack_activation_dossier")
    setUser(null)
  }, [])

  // ── Bootstrap on mount ────────────────────────────────────────────────────
  useEffect(() => {
    // Hard fallback: if refreshMe takes more than 6 s (e.g. Django CORS stall),
    // force isReady=true so the app renders the login page instead of a blank screen.
    const fallbackTimer = setTimeout(() => {
      setIsReady(true)
    }, 6000)

    refreshMe()
      .then((u) => {
        console.log("DEBUG: refreshMe resolved with:", u)
        // ── Set employee presence ONLINE as soon as we know who is logged in ──
        if (u) {
          import("../../api/client.js").then(({ apiRequest }) => {
            apiRequest("/employees/set-presence/", {
              method: "POST",
              json: { is_online: true, availability: "available" },
            }).catch(() => {}) // silent — non-critical
          })
        }
      })
      .catch((e) => console.error("DEBUG: refreshMe rejected with:", e))
      .catch(() => {})
      .finally(() => {
        clearTimeout(fallbackTimer)
        setIsReady(true)
      })

    return () => clearTimeout(fallbackTimer)
  }, [refreshMe])

  // ── Mark offline when the tab/browser closes ─────────────────────────────
  useEffect(() => {
    const handleUnload = () => {
      if (!user) return
      // Use sendBeacon for guaranteed delivery on page close
      const url = "/api/employees/set-presence/"
      const blob = new Blob([JSON.stringify({ is_online: false })], { type: "application/json" })
      try { navigator.sendBeacon(url, blob) } catch (_) {}
    }
    window.addEventListener("beforeunload", handleUnload)
    return () => window.removeEventListener("beforeunload", handleUnload)
  }, [user])

  // ── Session expiry event (fired by API client on unrecoverable 401) ───────
  useEffect(() => {
    const handle = async () => {
      await apiLogout()
      localStorage.removeItem("quicktims.orgName")
      localStorage.removeItem("caltrack_activation_dossier")
      setUser(null)
    }
    window.addEventListener("quicktims:session-expired", handle)
    return () => window.removeEventListener("quicktims:session-expired", handle)
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────
  const value = useMemo(
    () => ({ isReady, user, login, register, loginWithGoogle, loginWithCustomerGoogle, logout, refreshMe }),
    [isReady, user, login, register, loginWithGoogle, loginWithCustomerGoogle, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
