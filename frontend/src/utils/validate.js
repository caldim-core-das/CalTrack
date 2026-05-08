/**
 * validate.js
 * Pure validation helpers for auth forms.
 * Each function returns null (valid) or an error string (invalid).
 */

export function validateUsername(value) {
  const v = (value || "").trim()
  if (!v) return "Username is required."
  if (v.length < 3) return "Username must be at least 3 characters."
  if (v.length > 150) return "Username is too long."
  if (!/^[a-zA-Z0-9@.+\-_]+$/.test(v))
    return "Username may only contain letters, numbers, and @.+-_ characters."
  return null
}

export function validateEmail(value) {
  const v = (value || "").trim()
  if (!v) return null // email is optional in some flows
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Enter a valid email address."
  return null
}

export function validatePassword(value) {
  if (!value) return "Password is required."
  if (value.length < 6) return "Password must be at least 6 characters."
  return null
}

export function validateRequired(value, label = "This field") {
  const v = (value || "").trim()
  if (!v) return `${label} is required.`
  return null
}

export function validateOrganizationName(value) {
  const v = (value || "").trim()
  if (!v) return "Organization name is required."
  if (v.length < 2) return "Organization name must be at least 2 characters."
  if (v.length > 200) return "Organization name is too long."
  return null
}

export function validateFullName(value) {
  const v = (value || "").trim()
  if (!v) return "Full name is required."
  if (v.split(" ").filter(Boolean).length < 1) return "Enter your full name."
  return null
}

/**
 * Validate the full login form.
 * Returns the first error string, or null if all valid.
 */
export function validateLoginForm({ identifier, password }) {
  if (!identifier?.trim()) return "Username or email is required."
  if (!password) return "Password is required."
  return null
}

/**
 * Validate registration step 1.
 */
export function validateRegStep1({ fullName, username, password, email }) {
  const nameErr = validateFullName(fullName)
  if (nameErr) return nameErr
  const usernameErr = validateUsername(username)
  if (usernameErr) return usernameErr
  const emailErr = validateEmail(email)
  if (emailErr) return emailErr
  const passErr = validatePassword(password)
  if (passErr) return passErr
  return null
}

/**
 * Validate registration step 2 (org name).
 */
export function validateRegStep2({ organizationName }) {
  return validateOrganizationName(organizationName)
}
