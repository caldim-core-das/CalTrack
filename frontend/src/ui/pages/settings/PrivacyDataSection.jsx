import { useState, useEffect } from "react"
import {
  Download, Eye, Shield, Cookie, ScrollText,
  Search, Filter, Loader2, ChevronDown, AlertTriangle,
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"


export default function PrivacyDataSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)


  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [auditSearch, setAuditSearch] = useState("")

  useEffect(() => {
    if (isAdmin) {
      import("../../../api/client.js").then(({ apiRequest }) => {
        apiRequest("/compliance/audit-log/")
          .then(res => setAuditLog(res?.results || res?.data || []))
          .catch(() => { })
          .finally(() => setAuditLoading(false))
      })
    } else {
      setAuditLoading(false)
    }
  }, [isAdmin])

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) { showToast("Username does not match.", "error"); return }
    setDeleting(true)
    try {
      const password = prompt("Enter your password to confirm account deletion:")
      if (!password) { setDeleting(false); return }
      await apiRequest("/settings/data/delete-account/", { method: "POST", json: { password } })
      showToast("Account scheduled for deletion. You'll be signed out shortly.")
      setTimeout(() => window.location.href = import.meta.env.BASE_URL || "/", 3000)
    } catch (err) {
      showToast(err?.body?.message || "Failed to delete account.", "error")
    } finally {
      setDeleting(false)
    }
  }


  const filteredAudit = auditLog.filter(entry => {
    if (!auditSearch) return true
    const q = auditSearch.toLowerCase()
    return (
      (entry.action || "").toLowerCase().includes(q) ||
      (entry.user || "").toLowerCase().includes(q) ||
      (entry.resource || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="stPanel">
      <SectionHeader title="Privacy & Data" subtitle="Control your data, export records, and manage cookie preferences." />


      {/* Audit Log (Admin only) */}
      {isAdmin && (
        <div className="stCard">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ScrollText size={15} style={{ color: "#7C3AED" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Audit log</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }} />
                <input
                  className="stInput"
                  style={{ paddingLeft: 28, width: 200, padding: "6px 8px 6px 28px" }}
                  placeholder="Search actions..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {auditLoading ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
              <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
            </div>
          ) : filteredAudit.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32, color: "var(--muted)", fontSize: 13 }}>
              {auditSearch ? "No entries match your search." : "No audit log entries yet."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--stroke)" }}>
                    {["Timestamp", "User", "Action", "Resource", "IP"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--muted)", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.slice(0, 50).map((entry, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--stroke)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--muted)", whiteSpace: "nowrap" }}>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "—"}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--fg)" }}>{entry.user || entry.performed_by || "—"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", background: "var(--bg2)", padding: "2px 8px", borderRadius: 4, color: "var(--fg2)" }}>{entry.action || entry.event_type || "—"}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "var(--muted)" }}>{entry.resource || entry.object_repr || "—"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--subtle)", fontFamily: "monospace", fontSize: 11 }}>{entry.ip_address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Account Deletion */}
      <div className="stCard" style={{ border: "1px solid rgba(220,38,38,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={15} style={{ color: "#DC2626" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>Delete my account</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, marginBottom: 16 }}>
          Permanently delete your account and all associated data. This action cannot be undone. Your work data will remain in the workspace but your personal account will be removed.
        </p>
        {!showDeleteConfirm ? (
          <button
            className="stDangerBtn"
            style={{ fontSize: 13, padding: "8px 16px" }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete my account
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>
              Type your username <strong>{user?.username}</strong> to confirm:
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                className="stInput"
                placeholder={user?.username}
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                style={{ maxWidth: 240, borderColor: "rgba(220,38,38,.4)" }}
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirm !== user?.username}
                style={{
                  padding: "9px 16px", background: "#DC2626", color: "#fff", border: "none",
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                  opacity: deleteConfirm !== user?.username ? 0.5 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {deleting && <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />}
                Delete permanently
              </button>
              <button className="stGhostBtn" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm("") }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
