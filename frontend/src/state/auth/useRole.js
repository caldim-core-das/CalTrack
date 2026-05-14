import { useAuth } from "./useAuth.js"

/**
 * useRole — centralized role helpers for the frontend.
 *
 * Roles that exist in the system:
 *   "admin"    – org owner, full access
 *   "manager"  – like admin, full access
 *   "employee" – restricted to own data only
 *   "kiosk"    – hardware kiosk (read-only presence)
 *
 * Usage:
 *   const { isAdmin, isEmployee, role } = useRole()
 */
export function useRole() {
  const { user } = useAuth()
  const role = user?.role ?? null
  const isAdmin    = role === "admin" || role === "manager"
  const isEmployee = !isAdmin && !!user
  return { isAdmin, isEmployee, role }
}
