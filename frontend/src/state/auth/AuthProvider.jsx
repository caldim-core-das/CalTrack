import { useCallback, useEffect, useMemo, useState } from "react"

import { apiRequest } from "../../api/client.js"
import { AuthContext } from "./AuthContext.js"
import { getJwtRole, getJwtUsername } from "./jwt.js"
import { getTokens, setTokens } from "./tokens.js"

/* ─── Demo / offline login ──────────────────────────────────────────────
   When the backend is unreachable we synthesize a minimal JWT-shaped token
   so the app can still work with mock data.
   The payload is NOT verified – it's purely for offline demo.
─────────────────────────────────────────────────────────────────────── */
function b64(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

function makeDemoToken(username, role) {
  const header  = b64({ alg: "HS256", typ: "JWT" })
  const payload = b64({
    username,
    role,
    exp: Math.floor(Date.now() / 1000) + 86400 * 365  // 1 year
  })
  return `${header}.${payload}.demo-signature`
}

// Credentials accepted in offline demo mode
const DEMO_USERS = {
  admin:    { password: "admin",    role: "admin" },
  employee: { password: "employee", role: "employee" },
  // Accept any username with password "demo"
}

export function AuthProvider({ children }) {
  const [isReady, setIsReady] = useState(false)
  const [user, setUser]       = useState(null)

  const refreshMe = useCallback(async () => {
    const tokens = getTokens()
    if (!tokens?.access) { setUser(null); return }

    const username = getJwtUsername(tokens.access)
    const role     = getJwtRole(tokens.access)
    if (username && role) { setUser({ username, role }); return }

    try {
      const me = await apiRequest("/auth/me/")
      if (me?.username && me?.role) setUser({ username: me.username, role: me.role })
      else setUser(null)
    } catch {
      setUser(null)
    }
  }, [])

  const login = useCallback(
    async (username, password) => {
      try {
        // Try the real backend first
        const data = await apiRequest("/auth/login/", {
          method: "POST",
          json: { username, password }
        })
        setTokens({ access: data.access, refresh: data.refresh })
        await refreshMe()
      } catch (err) {
        // If backend is down, allow demo credentials
        const known = DEMO_USERS[username.toLowerCase()]
        const isDemo =
          (known && known.password === password) ||
          password === "demo"

        if (!isDemo) {
          // Re-throw so the login form shows the real error
          throw err
        }

        const role  = known?.role ?? "employee"
        const token = makeDemoToken(username, role)
        setTokens({ access: token, refresh: token })
        setUser({ username, role })
      }
    },
    [refreshMe]
  )

  const register = useCallback(
    async (payload) => {
      const data = await apiRequest("/auth/register/", {
        method: "POST",
        json: payload
      })
      setTokens({ access: data.access, refresh: data.refresh })
      await refreshMe()
    },
    [refreshMe]
  )

  const loginWithGoogle = useCallback(
    async (accessToken) => {
      const data = await apiRequest("/auth/google/", {
        method: "POST",
        json: { access_token: accessToken }
      })
      setTokens({ access: data.access, refresh: data.refresh })
      await refreshMe()
    },
    [refreshMe]
  )

  const logout = useCallback(() => {
    setTokens(null)
    setUser(null)
  }, [])

  useEffect(() => {
    refreshMe().finally(() => setIsReady(true))
  }, [refreshMe])

  const value = useMemo(
    () => ({ isReady, user, login, register, loginWithGoogle, logout, refreshMe }),
    [isReady, user, login, register, loginWithGoogle, logout, refreshMe]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
