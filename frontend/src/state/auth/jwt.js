function decodeBase64Url(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  )
  return JSON.parse(json)
}

export function decodeJwtPayload(token) {
  const parts = token.split(".")
  if (parts.length !== 3) return null
  try {
    return decodeBase64Url(parts[1])
  } catch {
    return null
  }
}

export function getJwtRole(token) {
  const payload = decodeJwtPayload(token)
  const role = payload?.role
  if (role === "admin" || role === "employee") return role
  return null
}

export function getJwtUsername(token) {
  const payload = decodeJwtPayload(token)
  const username = payload?.username
  if (typeof username === "string") return username
  return null
}

export function isJwtExpired(token, skewSeconds = 10) {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp
  if (typeof exp !== "number") return true
  const nowSeconds = Math.floor(Date.now() / 1000)
  return exp <= nowSeconds + skewSeconds
}

