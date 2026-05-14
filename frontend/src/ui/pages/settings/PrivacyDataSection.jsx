import { useState, useEffect } from "react"
import {
  Download, Eye, Shield, Cookie, ScrollText,
  Search, Filter, Loader2, ChevronDown, AlertTriangle,
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"

const COOKIE_PREFS = [
  { key: "essential", label: "Essential cookies", desc: "Required for the application to function. Cannot be disabled.", locked: true, default: true },
  { key: "analytics", label: "Analytics cookies", desc: "Help us understand how you use the product to improve your experience.", locked: false, default: false },
  { key: "marketing", label: "Marketing cookies", desc: "Used to personalize product updates and communications.", locked: false, default: false },
  { key: "preferences", label: "Preference cookies", desc: "Remember your settings and preferences across sessions.", locked: false, default: true },
]

const COOKIE_KEY = "quicktims.cookie_prefs"

function loadCookiePrefs() {
  try { return JSON.parse(localStorage.getItem(COOKIE_KEY) || "{}") } catch { return {} }
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <div
      className={`stToggle ${checked ? "on" : ""} ${disabled ? "" : ""}`}
      onClick={() => !disabled && onChange(!checked)}
      style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}
    >
      <div className="stToggleKnob" />
    </div>
  )
}

export default function PrivacyDataSection({ showToast, SectionHeader }) {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  const [exporting, setExporting] = useState(false)
  const [exportRequested, setExportRequested] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [cookiePrefs, setCookiePrefs] = useState(() => {
    const saved = loadCookiePrefs()
    return COOKIE_PREFS.reduce((acc, c) => ({ ...acc, [c.key]: saved[c.key] ?? c.default }), {})
  })
  const [cookieSaving, setCookieSaving] = useState(false)

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

  const handleExport = async () => {
    setExporting(true)
    try {
      await apiRequest("/settings/data/export/", { method: "POST" })
      setExportRequested(true)
      showToast("Data export requested. You'll receive an email within 24 hours.")
    } catch (err) {
      showToast(err?.body?.message || "Failed to request export.", "error")
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) { showToast("Username does not match.", "error"); return }
    setDeleting(true)
    try {
      const password = prompt("Enter your password to confirm account deletion:")
      if (!password) { setDeleting(false); return }
      await apiRequest("/settings/data/delete-account/", { method: "POST", json: { password } })
      showToast("Account scheduled for deletion. You'll be signed out shortly.")
      setTimeout(() => window.location.href = "/login", 3000)
    } catch (err) {
      showToast(err?.body?.message || "Failed to delete account.", "error")
    } finally {
      setDeleting(false)
    }
  }

  const handleSaveCookies = () => {
    setCookieSaving(true)
    localStorage.setItem(COOKIE_KEY, JSON.stringify(cookiePrefs))
    setTimeout(() => { setCookieSaving(false); showToast("Cookie preferences saved.") }, 500)
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

      {/* Data Export */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Download size={15} style={{ color: "#1A56DB" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Export your data (GDPR)</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, margin: 0, maxWidth: 460 }}>
              Download a complete archive of your personal data including profile, time logs, leave records, and activity history. Delivered by email within 24 hours.
            </p>
          </div>
          <button
            className={exportRequested ? "stGhostBtn" : "stPrimaryBtn"}
            onClick={handleExport}
            disabled={exporting || exportRequested}
          >
            {exporting ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Download size={13} />}
            {exportRequested ? "Export requested" : "Request data export"}
          </button>
        </div>
        {exportRequested && (
          <div style={{ marginTop: 14, padding: 12, background: "#ECFDF5", borderRadius: 8, fontSize: 12, color: "#059669", border: "1px solid #A7F3D0" }}>
            ✓ Export requested. Check your email ({user?.email}) within 24 hours for a download link.
          </div>
        )}
      </div>

      {/* Cookie Preferences */}
      <div className="stCard">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <Cookie size={15} style={{ color: "#D97706" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>Cookie preferences</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {COOKIE_PREFS.map(cookie => (
            <div key={cookie.key} className="stToggleRow">
              <div style={{ flex: 1 }}>
                <div className="stToggleLabel" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {cookie.label}
                  {cookie.locked && <span style={{ fontSize: 10, background: "var(--bg2)", color: "var(--muted)", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>Required</span>}
                </div>
                <div className="stToggleDesc">{cookie.desc}</div>
              </div>
              <Toggle
                checked={cookiePrefs[cookie.key] ?? cookie.default}
                disabled={cookie.locked}
                onChange={val => setCookiePrefs(prev => ({ ...prev, [cookie.key]: val }))}
              />
            </div>
          ))}
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn" onClick={handleSaveCookies} disabled={cookieSaving}>
            {cookieSaving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : null}
            Save cookie preferences
          </button>
        </div>
      </div>

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
