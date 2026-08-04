import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { fireSparkleFromEl } from "../sparkle.js"
import { CalendarDays, Clock, CheckCircle2, XCircle, AlertTriangle, Plus, X, RefreshCw, ChevronRight, Loader2 } from "lucide-react"

// Custom hook to detect if dark mode is active
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"))

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

const LEAVE_TYPES = [
  { label: "🏖 Vacation", value: "vacation", color: "#0ea5e9", desc: "Annual leave / time off" },
  { label: "🤒 Sick Leave", value: "sick", color: "#ef4444", desc: "Medical or health-related" },
  { label: "💼 Unpaid Leave", value: "unpaid", color: "#f59e0b", desc: "Leave without pay" },
]

const STATUS_CONFIG = {
  pending:        { bg: "#fef3c7", color: "#d97706", border: "#fde68a", icon: "⏳", label: "Pending" },
  approved:       { bg: "#d1fae5", color: "#059669", border: "#6ee7b7", icon: "✅", label: "Approved" },
  rejected:       { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5", icon: "❌", label: "Rejected" },
  cancelled:      { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1", icon: "🚫", label: "Cancelled" },
  rework:         { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", icon: "🔄", label: "Needs Rework" },
  pending_cancel: { bg: "#faf5ff", color: "#7c3aed", border: "#ddd6fe", icon: "⏸️", label: "Cancel Pending" },
}

function StatusBadge({ status }) {
  const isDark = useDarkMode()
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  const bg = isDark ? (
    status === "pending" ? "rgba(217,119,6,0.15)" :
    status === "approved" ? "rgba(5,150,105,0.15)" :
    status === "rejected" ? "rgba(220,38,38,0.15)" :
    status === "cancelled" ? "rgba(100,116,139,0.15)" :
    status === "rework" ? "rgba(194,65,12,0.15)" :
    "rgba(124,58,237,0.15)"
  ) : cfg.bg

  const color = isDark ? (
    status === "pending" ? "#fbbf24" :
    status === "approved" ? "#34d399" :
    status === "rejected" ? "#f87171" :
    status === "cancelled" ? "#94a3b8" :
    status === "rework" ? "#fb923c" :
    "#c084fc"
  ) : cfg.color

  const border = isDark ? (
    status === "pending" ? "rgba(217,119,6,0.3)" :
    status === "approved" ? "rgba(5,150,105,0.3)" :
    status === "rejected" ? "rgba(220,38,38,0.3)" :
    status === "cancelled" ? "rgba(100,116,139,0.3)" :
    status === "rework" ? "rgba(194,65,12,0.3)" :
    "rgba(124,58,237,0.3)"
  ) : cfg.border

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800,
      background: bg, color: color, border: `1.5px solid ${border}`,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      <span style={{ fontSize: 12 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

function LeaveTypeTag({ type }) {
  const t = LEAVE_TYPES.find(l => l.value === type)
  if (!t) return <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{type}</span>
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 12, fontWeight: 800, color: t.color,
      background: `${t.color}14`, padding: "2px 10px", borderRadius: 12,
      border: `1px solid ${t.color}25`,
    }}>
      {t.label}
    </span>
  )
}

function daysBetween(start, end) {
  if (!start || !end) return 0
  const d1 = new Date(start + "T00:00:00")
  const d2 = new Date(end + "T00:00:00")
  if (isNaN(d1) || isNaN(d2) || d2 < d1) return 0
  return Math.round((d2 - d1) / 86400000) + 1
}

function formatDate(dateStr) {
  if (!dateStr) return "—"
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}

export function LeavesPage() {
  const isDark = useDarkMode()
  const { user } = useAuth()
  const isAdmin = user?.role === "admin" || user?.role === "manager"

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)
  const submitBtnRef = useRef(null)

  // Filters, search, sorting
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("newest")

  // New request form
  const [showForm, setShowForm] = useState(false)
  const [leaveType, setLeaveType] = useState("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Edit modal
  const [editingItem, setEditingItem] = useState(null)
  const [editLeaveType, setEditLeaveType] = useState("vacation")
  const [editStartDate, setEditStartDate] = useState("")
  const [editEndDate, setEditEndDate] = useState("")
  const [editReason, setEditReason] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Cancel modal
  const [cancelTarget, setCancelTarget] = useState(null)

  const pendingCount = useMemo(() => items.filter(i => i.status === "pending" || i.status === "pending_cancel").length, [items])
  const approvedCount = useMemo(() => items.filter(i => i.status === "approved").length, [items])
  const totalDaysOff = useMemo(() => items.filter(i => i.status === "approved").reduce((s, i) => s + daysBetween(i.start_date, i.end_date), 0), [items])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest("/leaves/")
      setItems(unwrapResults(res))
    } catch (err) {
      setError(err?.body?.detail || "Failed to load leave requests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    if (startDate && endDate && endDate < startDate) {
      setError("End date cannot be earlier than start date.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await apiRequest("/leaves/", {
        method: "POST",
        json: { leave_type: leaveType, start_date: startDate, end_date: endDate, reason }
      })
      setStartDate("")
      setEndDate("")
      setReason("")
      setShowForm(false)
      fireSparkleFromEl(submitBtnRef.current)
      await load()
    } catch (err) {
      const msg = err?.body?.detail || err?.body?.end_date || err?.body?.non_field_errors || (typeof err?.body === "string" ? err.body : "") || "Failed to submit leave request."
      setError(Array.isArray(msg) ? msg.join(" ") : String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  async function decide(id, verb) {
    setBusyId(id)
    setError("")
    try {
      await apiRequest(`/leaves/${id}/${verb}/`, { method: "POST" })
      await load()
    } catch (err) {
      setError(err?.body?.detail || "Failed to update request.")
    } finally {
      setBusyId(null)
    }
  }

  async function confirmCancel(item) {
    setBusyId(item.id)
    setCancelTarget(null)
    try {
      await apiRequest(`/leaves/${item.id}/cancel/`, { method: "POST" })
      await load()
    } catch (err) {
      setError(err?.body?.detail || "Failed to cancel.")
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(item) {
    setEditingItem(item)
    setEditLeaveType(item.leave_type)
    setEditStartDate(item.start_date)
    setEditEndDate(item.end_date)
    setEditReason(item.reason || "")
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!editingItem) return
    setEditSubmitting(true)
    setError("")
    try {
      await apiRequest(`/leaves/${editingItem.id}/`, {
        method: "PATCH",
        json: { leave_type: editLeaveType, start_date: editStartDate, end_date: editEndDate, reason: editReason }
      })
      setEditingItem(null)
      await load()
    } catch (err) {
      const msg = err?.body?.detail || err?.body?.end_date || "Failed to update."
      setError(Array.isArray(msg) ? msg.join(" ") : String(msg))
    } finally {
      setEditSubmitting(false)
    }
  }

  const days = daysBetween(startDate, endDate)

  // Filtered and sorted items calculation
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        if (statusFilter === "pending") return item.status === "pending" || item.status === "pending_cancel";
        if (statusFilter === "approved") return item.status === "approved";
        if (statusFilter === "rejected_cancelled") return item.status === "rejected" || item.status === "cancelled";
        return true; // "all"
      })
      .filter(item => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        const nameMatch = item.employee_name ? item.employee_name.toLowerCase().includes(q) : false;
        const typeMatch = item.leave_type ? item.leave_type.toLowerCase().includes(q) : false;
        const reasonMatch = item.reason ? item.reason.toLowerCase().includes(q) : false;
        return nameMatch || typeMatch || reasonMatch;
      })
      .sort((a, b) => {
        if (sortBy === "newest") {
          return new Date(b.start_date) - new Date(a.start_date);
        }
        if (sortBy === "oldest") {
          return new Date(a.start_date) - new Date(b.start_date);
        }
        if (sortBy === "duration") {
          const durA = daysBetween(a.start_date, a.end_date);
          const durB = daysBetween(b.start_date, b.end_date);
          return durB - durA; // Longest first
        }
        if (sortBy === "employee") {
          const nameA = a.employee_name || "";
          const nameB = b.employee_name || "";
          return nameA.localeCompare(nameB);
        }
        return 0;
      });
  }, [items, statusFilter, searchQuery, sortBy]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: isDark ? "#0B111D" : "#f0f4ff", overflow: "auto" }}>

      {/* ── Hero Header ─────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)",
        padding: "32px 40px 76px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -50, right: -50, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: 100, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              Leave Management
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 12 }}>
              <CalendarDays size={28} style={{ opacity: 0.9 }} />
              {isAdmin ? "All Leave Requests" : "My Time Off"}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 500, marginTop: 8, marginBottom: 0 }}>
              {isAdmin ? "Review and manage employee time-off requests." : "Request, track and manage your leave."}
            </p>
          </div>

          {!isAdmin && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 28px", borderRadius: 18,
                background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.35)",
                color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
                backdropFilter: "blur(12px)", transition: "all 0.2s",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "none" }}
            >
              <Plus size={18} />
              Request Leave
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Bar (overlap) ──────────────────────────── */}
      <div style={{ padding: "0 40px", marginTop: -44, position: "relative", zIndex: 5 }}>
        <div style={{
          background: isDark ? "#111827" : "#fff", borderRadius: 22, padding: "18px 24px",
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 16px 48px rgba(67,56,202,0.14), 0 4px 16px rgba(0,0,0,0.06)",
          border: `1px solid ${isDark ? "#1f2937" : "rgba(99,102,241,0.1)"}`,
          display: "flex", gap: 0, flexWrap: "wrap",
        }}>
          {(isAdmin ? [
            { label: "Total Requests", value: items.length, icon: "📋", color: "#4f46e5" },
            { label: "Pending Approval", value: pendingCount, icon: "⏳", color: "#f59e0b" },
            { label: "Approved", value: approvedCount, icon: "✅", color: "#059669" },
            { label: "Rejected / Cancelled", value: items.filter(i => i.status === "rejected" || i.status === "cancelled").length, icon: "❌", color: "#ef4444" },
          ] : [
            { label: "Total Requests", value: items.length, icon: "📋", color: "#4f46e5" },
            { label: "Approved Days Off", value: totalDaysOff, icon: "🏖️", color: "#10b981" },
            { label: "Pending Approval", value: pendingCount, icon: "⏳", color: "#f59e0b" },
            { label: "Currently Approved", value: approvedCount, icon: "✅", color: "#059669" },
          ]).map((s, i) => (
            <div key={s.label} style={{
              flex: 1, minWidth: 130, padding: "8px 16px",
              borderRight: i < 3 ? `1.5px solid ${isDark ? "#1f2937" : "#f1f5f9"}` : "none",
            }}>
              <div style={{ fontSize: 11, color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div style={{ padding: "24px 40px 40px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

        {error && (
          <div style={{
            padding: "14px 20px", background: "#fef2f2", border: "1.5px solid #fca5a5",
            borderRadius: 16, color: "#dc2626", fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Leave cards list */}
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", color: "#94a3b8", gap: 10 }}>
            <Loader2 style={{ animation: "spin 0.8s linear infinite" }} size={22} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Loading leave requests…</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "56px 0",
            background: isDark ? "#111827" : "#fff", borderRadius: 24, border: `2px dashed ${isDark ? "#1f2937" : "#e2e8f0"}`,
          }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🌴</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: isDark ? "#f9fafb" : "#334155", marginBottom: 6 }}>No leave requests yet</div>
            <div style={{ fontSize: 13, color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 600, marginBottom: 24 }}>Request your first day off!</div>
            {!isAdmin && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  padding: "12px 28px", borderRadius: 16,
                  background: "linear-gradient(135deg, #4338ca, #7c3aed)",
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  border: "none", boxShadow: "0 8px 24px rgba(79,70,229,0.3)",
                }}
              >
                + Request Leave
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {/* Toolbar: Tabs, Search & Sort */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 10 }}>
              
              {/* Top controls: title & refresh */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: isDark ? "#cbd5e1" : "#334155" }}>
                  {isAdmin ? "All Requests" : "My Requests"} ({filteredItems.length})
                </div>
                <button
                  onClick={load}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 10,
                    background: isDark ? "#1f2937" : "#f1f5f9", border: `1px solid ${isDark ? "#374151" : "#e2e8f0"}`,
                    color: isDark ? "#cbd5e1" : "#64748b", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = isDark ? "#374151" : "#e2e8f0" }}
                  onMouseLeave={e => { e.currentTarget.style.background = isDark ? "#1f2937" : "#f1f5f9" }}
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {/* Tabs control */}
              <div style={{
                display: "flex", gap: 6, padding: 4, borderRadius: 16,
                background: isDark ? "#111827" : "#e2e8f0",
                border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
                alignSelf: "flex-start", width: "100%", maxWidth: 640,
                boxSizing: "border-box", overflowX: "auto"
              }}>
                {[
                  { id: "all", label: "All Requests", count: items.length },
                  { id: "pending", label: "Pending", count: items.filter(i => i.status === "pending" || i.status === "pending_cancel").length, color: "#f59e0b" },
                  { id: "approved", label: "Approved", count: items.filter(i => i.status === "approved").length, color: "#10b981" },
                  { id: "rejected_cancelled", label: "Rejected / Cancelled", count: items.filter(i => i.status === "rejected" || i.status === "cancelled").length, color: "#ef4444" },
                ].map(tab => {
                  const active = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        padding: "10px 16px", borderRadius: 12, fontSize: 12, fontWeight: 850,
                        border: "none", cursor: "pointer", whiteSpace: "nowrap",
                        background: active ? (isDark ? "#1f2937" : "#fff") : "transparent",
                        color: active ? (isDark ? "#fff" : "#1e1b4b") : (isDark ? "#9ca3af" : "#64748b"),
                        boxShadow: active ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tab.label}
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, fontSize: 10, fontWeight: 900,
                        background: active ? (tab.color || "#4f46e5") : (isDark ? "#374151" : "#cbd5e1"),
                        color: active ? "#fff" : (isDark ? "#9ca3af" : "#64748b"),
                        transition: "all 0.15s ease",
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search & Sort inputs */}
              <div style={{
                display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                marginTop: 4
              }}>
                {/* Search */}
                <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
                  <input
                    type="text"
                    placeholder={isAdmin ? "Search by employee, leave type, or reason..." : "Search by leave type or reason..."}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 14px 10px 16px", borderRadius: 12,
                      border: `1.5px solid ${isDark ? "#1f2937" : "#cbd5e1"}`,
                      background: isDark ? "#111827" : "#fff",
                      color: isDark ? "#f9fafb" : "#0f172a",
                      fontSize: 13, fontWeight: 700, outline: "none",
                      boxSizing: "border-box", transition: "all 0.2s"
                    }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        border: "none", background: "transparent", color: isDark ? "#9ca3af" : "#64748b",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Sort */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    style={{
                      padding: "9px 12px", borderRadius: 11,
                      border: `1.5px solid ${isDark ? "#1f2937" : "#cbd5e1"}`,
                      background: isDark ? "#111827" : "#fff",
                      color: isDark ? "#f9fafb" : "#0f172a",
                      fontSize: 13, fontWeight: 700, outline: "none", cursor: "pointer"
                    }}
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="duration">⏱️ Duration</option>
                    {isAdmin && <option value="employee">👤 Employee</option>}
                  </select>
                </div>
              </div>

            </div>

            {/* List map */}
            {filteredItems.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "48px 20px",
                background: isDark ? "#111827" : "#fff", borderRadius: 24,
                border: `2px dashed ${isDark ? "#1f2937" : "#e2e8f0"}`,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: isDark ? "#f9fafb" : "#334155", marginBottom: 6 }}>No matching requests</div>
                <div style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 600 }}>Try clearing your filters or changing your search query.</div>
              </div>
            ) : (
              filteredItems.map(item => (
                <LeaveCard
                  key={item.id}
                  item={item}
                  isAdmin={isAdmin}
                  busy={busyId === item.id}
                  onDecide={decide}
                  onEdit={startEdit}
                  onCancel={setCancelTarget}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── NEW REQUEST MODAL ─────────────────────────────── */}
      {showForm && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }} onClick={() => setShowForm(false)} />
          <div style={{
            position: "relative", zIndex: 10000, width: "100%", maxWidth: 560,
            background: isDark ? "#111827" : "#fff", borderRadius: 28, overflow: "hidden",
            boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 32px 80px rgba(0,0,0,0.25)",
            animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {/* Modal header */}
            <div style={{ background: "linear-gradient(135deg, #4338ca, #7c3aed)", padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>🏖️ New Leave Request</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 4 }}>Submit for admin approval</div>
                </div>
                <button onClick={() => setShowForm(false)} style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <form onSubmit={submit} style={{ padding: "28px" }}>
              {/* Error banner inside modal */}
              {error && (
                <div style={{ padding: "12px 16px", borderRadius: 14, background: "#fef2f2", border: "1.5px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={16} style={{ color: "#ef4444", flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Leave type cards */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Leave Type</div>
                <div style={{ display: "flex", gap: 10 }}>
                  {LEAVE_TYPES.map(lt => (
                    <div
                      key={lt.value}
                      onClick={() => setLeaveType(lt.value)}
                      style={{
                        flex: 1, padding: "12px 10px", borderRadius: 16, cursor: "pointer",
                        border: `2px solid ${leaveType === lt.value ? lt.color : (isDark ? "#374151" : "#e2e8f0")}`,
                        background: leaveType === lt.value ? `${lt.color}10` : (isDark ? "#1f2937" : "#f8fafc"),
                        textAlign: "center", transition: "all 0.18s",
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{lt.label.split(" ")[0]}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: leaveType === lt.value ? lt.color : (isDark ? "#9ca3af" : "#64748b") }}>
                        {lt.label.split(" ").slice(1).join(" ")}
                      </div>
                      <div style={{ fontSize: 10, color: isDark ? "#6b7280" : "#94a3b8", marginTop: 2 }}>{lt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                {[
                  { label: "Start Date", value: startDate, onChange: v => { setStartDate(v); setError("") } },
                  { label: "End Date", value: endDate, onChange: v => { setEndDate(v); setError("") } },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{f.label}</label>
                    <input
                      type="date" value={f.value} onChange={e => f.onChange(e.target.value)} required
                      style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${startDate && endDate && endDate < startDate ? "#ef4444" : (isDark ? "#374151" : "#e2e8f0")}`, fontSize: 14, fontWeight: 700, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#f8fafc", outline: "none", boxSizing: "border-box" }}
                    />
                  </div>
                ))}
              </div>

              {/* Invalid date warning */}
              {startDate && endDate && endDate < startDate && (
                <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fff1f2", border: "1.5px solid #fecdd3", color: "#e11d48", fontSize: 12, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={15} />
                  <span>End date cannot be earlier than start date ({formatDate(endDate)} is before {formatDate(startDate)}).</span>
                </div>
              )}

              {/* Duration preview */}
              {startDate && endDate && endDate >= startDate && days > 0 && (
                <div style={{ padding: "12px 18px", borderRadius: 14, background: isDark ? "rgba(99,102,241,0.15)" : "linear-gradient(135deg, #ede9fe, #e0e7ff)", border: `1.5px solid ${isDark ? "rgba(99,102,241,0.3)" : "#c7d2fe"}`, marginBottom: 22, display: "flex", alignItems: "center", gap: 10 }}>
                  <Clock size={16} style={{ color: isDark ? "#818cf8" : "#4f46e5" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#818cf8" : "#4338ca" }}>
                    {days} day{days !== 1 ? "s" : ""} off — {formatDate(startDate)} to {formatDate(endDate)}
                  </span>
                </div>
              )}

              {/* Reason */}
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Reason (optional)</label>
                <textarea
                  value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="Provide any additional details..."
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, fontSize: 13, fontWeight: 600, color: isDark ? "#f9fafb" : "#334155", background: isDark ? "#1f2937" : "#f8fafc", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: "14px", borderRadius: 16, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, background: isDark ? "#1f2937" : "#f8fafc", color: isDark ? "#cbd5e1" : "#64748b", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Cancel
                </button>
                <button
                  ref={submitBtnRef}
                  type="submit"
                  disabled={submitting || Boolean(startDate && endDate && endDate < startDate)}
                  style={{ flex: 2, padding: "14px", borderRadius: 16, border: "none", background: (startDate && endDate && endDate < startDate) ? "#94a3b8" : "linear-gradient(135deg, #4338ca, #7c3aed)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: (startDate && endDate && endDate < startDate) ? "not-allowed" : "pointer", boxShadow: "0 8px 24px rgba(79,70,229,0.3)", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Submitting…" : "Submit Request ✨"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── EDIT MODAL ────────────────────────────────────── */}
      {editingItem && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }} onClick={() => setEditingItem(null)} />
          <div style={{
            position: "relative", zIndex: 10000, width: "100%", maxWidth: 560,
            background: isDark ? "#111827" : "#fff", borderRadius: 28, overflow: "hidden",
            boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 32px 80px rgba(0,0,0,0.25)",
          }}>
            <div style={{ background: "linear-gradient(135deg, #0f766e, #0284c7)", padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>🔄 Edit & Resubmit</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 600, marginTop: 4 }}>Status: <span style={{ fontWeight: 900 }}>{editingItem.status?.toUpperCase()}</span> → will reset to Pending</div>
              </div>
              <button onClick={() => setEditingItem(null)} style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.25)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} style={{ padding: "28px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {LEAVE_TYPES.map(lt => (
                  <div key={lt.value} onClick={() => setEditLeaveType(lt.value)}
                    style={{ flex: 1, padding: "10px 8px", borderRadius: 14, cursor: "pointer", border: `2px solid ${editLeaveType === lt.value ? lt.color : (isDark ? "#374151" : "#e2e8f0")}`, background: editLeaveType === lt.value ? `${lt.color}10` : (isDark ? "#1f2937" : "#f8fafc"), textAlign: "center" }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 3 }}>{lt.label.split(" ")[0]}</div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: editLeaveType === lt.value ? lt.color : (isDark ? "#9ca3af" : "#94a3b8") }}>{lt.label.split(" ").slice(1).join(" ")}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                {[
                  { label: "Start Date", value: editStartDate, onChange: v => setEditStartDate(v) },
                  { label: "End Date", value: editEndDate, onChange: v => setEditEndDate(v) },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>{f.label}</label>
                    <input type="date" value={f.value} onChange={e => f.onChange(e.target.value)} required
                      style={{ width: "100%", padding: "11px 13px", borderRadius: 13, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, fontSize: 13, fontWeight: 700, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#f8fafc", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <textarea value={editReason} onChange={e => setEditReason(e.target.value)} rows={3} placeholder="Update notes or reason..."
                style={{ width: "100%", padding: "11px 13px", borderRadius: 13, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, fontSize: 13, color: isDark ? "#f9fafb" : "#334155", background: isDark ? "#1f2937" : "#f8fafc", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 20 }} />
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setEditingItem(null)} style={{ flex: 1, padding: "13px", borderRadius: 15, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, background: isDark ? "#1f2937" : "#f8fafc", color: isDark ? "#9ca3af" : "#64748b", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={editSubmitting} style={{ flex: 2, padding: "13px", borderRadius: 15, border: "none", background: "linear-gradient(135deg, #0f766e, #0284c7)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: editSubmitting ? 0.7 : 1 }}>
                  {editSubmitting ? "Saving…" : "Save & Resubmit"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── CANCEL CONFIRMATION MODAL ─────────────────────── */}
      {cancelTarget && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }} onClick={() => setCancelTarget(null)} />
          <div style={{
            position: "relative", zIndex: 10000, width: "100%", maxWidth: 460,
            background: isDark ? "#111827" : "#fff", borderRadius: 28, overflow: "hidden",
            boxShadow: isDark ? "0 32px 80px rgba(0,0,0,0.6)" : "0 32px 80px rgba(0,0,0,0.25)",
          }}>
            <div style={{ background: "linear-gradient(135deg, #dc2626, #f97316)", padding: "22px 26px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertTriangle size={20} style={{ color: "#fff" }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>Cancel Remaining Leave?</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>This notifies your admin immediately</div>
                </div>
              </div>
              <button onClick={() => setCancelTarget(null)} style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} />
              </button>
            </div>
            {(() => {
              const today = new Date().toISOString().slice(0, 10)
              const totalDays = daysBetween(cancelTarget.start_date, cancelTarget.end_date)
              const daysTaken = Math.max(0, Math.round((new Date(today) - new Date(cancelTarget.start_date)) / 86400000))
              const daysLeft = Math.max(0, totalDays - daysTaken)
              return (
                <div style={{ padding: "24px 26px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                    {[
                      { label: "Approved Days", value: totalDays, color: "#4f46e5", bg: isDark ? "#1e1b4b" : "#ede9fe" },
                      { label: "Days Taken", value: daysTaken, color: isDark ? "#cbd5e1" : "#64748b", bg: isDark ? "#1f2937" : "#f1f5f9" },
                      { label: "Remaining", value: daysLeft, color: "#059669", bg: isDark ? "rgba(5,150,105,0.15)" : "#d1fae5" },
                    ].map(s => (
                      <div key={s.label} style={{ textAlign: "center", padding: "14px 10px", borderRadius: 16, background: s.bg }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: s.color, opacity: 0.7, textTransform: "uppercase" }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 16px", borderRadius: 14, background: isDark ? "rgba(194,65,12,0.15)" : "#fff7ed", border: `1.5px solid ${isDark ? "rgba(194,65,12,0.3)" : "#fed7aa"}`, fontSize: 12, color: isDark ? "#fb923c" : "#c2410c", fontWeight: 700, marginBottom: 20 }}>
                    ⚡ Cancelling now forfeits your remaining <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>. Your admin will be notified.
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={() => setCancelTarget(null)} style={{ flex: 1, padding: "13px", borderRadius: 15, border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, background: isDark ? "#1f2937" : "#f8fafc", color: isDark ? "#cbd5e1" : "#475569", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      Keep My Leave
                    </button>
                    <button
                      onClick={() => confirmCancel(cancelTarget)}
                      disabled={busyId === cancelTarget.id}
                      style={{ flex: 1, padding: "13px", borderRadius: 15, border: "none", background: "linear-gradient(135deg, #dc2626, #f97316)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: busyId === cancelTarget.id ? 0.7 : 1 }}
                    >
                      {busyId === cancelTarget.id ? "Cancelling…" : "Yes, Cancel"}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

function LeaveCard({ item, isAdmin, busy, onDecide, onEdit, onCancel }) {
  const [hovered, setHovered] = useState(false)
  const isDark = useDarkMode()
  const days = daysBetween(item.start_date, item.end_date)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isDark ? "#111827" : "#fff", borderRadius: 22, padding: "20px 24px",
        border: hovered ? "1.5px solid #6366f1" : `1.5px solid ${isDark ? "#1f2937" : "#e8eaf6"}`,
        boxShadow: hovered ? (isDark ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 32px rgba(79,70,229,0.10), 0 2px 8px rgba(0,0,0,0.04)") : "0 2px 8px rgba(0,0,0,0.04)",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-1px)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        {/* Left info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
            <LeaveTypeTag type={item.leave_type} />
            <StatusBadge status={item.status} />
            {isAdmin && item.employee_name && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: isDark ? "rgba(99,102,241,0.2)" : "#ede9fe",
                  border: `1px solid ${isDark ? "#4f46e5" : "#c7d2fe"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, color: isDark ? "#a5b4fc" : "#4f46e5",
                  textTransform: "uppercase"
                }}>
                  {item.employee_name.charAt(0)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? "#cbd5e1" : "#475569" }}>
                  {item.employee_name}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Period</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#cbd5e1" : "#334155" }}>
                {formatDate(item.start_date)} → {formatDate(item.end_date)}
              </div>
            </div>
            <div style={{ padding: "6px 14px", borderRadius: 12, background: isDark ? "rgba(99,102,241,0.15)" : "#f0f4ff", border: `1px solid ${isDark ? "rgba(99,102,241,0.3)" : "#c7d2fe"}` }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#818cf8" : "#4338ca" }}>{days}</span>
              <span style={{ fontSize: 11, color: isDark ? "#818cf8" : "#6366f1", fontWeight: 700, marginLeft: 4 }}>day{days !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {item.reason && (
            <div style={{ marginTop: 10, fontSize: 12, color: isDark ? "#9ca3af" : "#64748b", fontWeight: 600, fontStyle: "italic", padding: "8px 14px", background: isDark ? "#1f2937" : "#f8fafc", borderRadius: 10, borderLeft: "3px solid #6366f1" }}>
              "{item.reason}"
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {isAdmin ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {item.status === "pending" && (
                <>
                  <ActionBtn onClick={() => onDecide(item.id, "approve")} disabled={busy} color="#059669" bg="#d1fae5" border="#6ee7b7" label="✅ Approve" />
                  <ActionBtn onClick={() => onDecide(item.id, "rework")} disabled={busy} color="#d97706" bg="#fef3c7" border="#fde68a" label="🔄 Rework" />
                  <ActionBtn onClick={() => onDecide(item.id, "reject")} disabled={busy} color="#dc2626" bg="#fee2e2" border="#fca5a5" label="❌ Reject" />
                </>
              )}
              {item.status === "pending_cancel" && (
                <>
                  <ActionBtn onClick={() => onDecide(item.id, "approve")} disabled={busy} color="#059669" bg="#d1fae5" border="#6ee7b7" label="✅ Keep Leave" />
                  <ActionBtn onClick={() => onDecide(item.id, "cancel")} disabled={busy} color="#dc2626" bg="#fee2e2" border="#fca5a5" label="❌ Approve Cancel" />
                </>
              )}
              {item.status === "approved" && (
                <ActionBtn onClick={() => onDecide(item.id, "cancel")} disabled={busy} color="#dc2626" bg="#fee2e2" border="#fca5a5" label="Cancel Leave" />
              )}
              {["cancelled", "rejected", "rework"].includes(item.status) && (
                <span style={{ fontSize: 11, color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 700, fontStyle: "italic" }}>{STATUS_CONFIG[item.status]?.label}</span>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {(item.status === "pending" || item.status === "approved") && (
                <ActionBtn onClick={() => onCancel(item)} disabled={busy} color="#dc2626" bg="#fee2e2" border="#fca5a5"
                  label={item.status === "approved" ? "Cancel Leave" : "Cancel"} />
              )}
              {item.status === "pending_cancel" && (
                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 800, background: isDark ? "rgba(124,58,237,0.15)" : "#f5f3ff", padding: "4px 12px", borderRadius: 10, border: `1px solid ${isDark ? "rgba(124,58,237,0.3)" : "#ddd6fe"}` }}>Cancellation Requested</span>
              )}
              {["rework", "cancelled", "rejected"].includes(item.status) && (
                <ActionBtn onClick={() => onEdit(item)} disabled={busy} color="#4338ca" bg="#ede9fe" border="#c7d2fe" label="✏️ Edit & Resubmit" />
              )}
            </div>
          )}

          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: isDark ? "#6b7280" : "#94a3b8", fontWeight: 700 }}>
              <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> Processing…
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionBtn({ onClick, disabled, color, bg, border, label }) {
  const [hovered, setHovered] = useState(false)
  const isDark = useDarkMode()

  // Adapt colors for dark mode
  const finalBg = isDark ? (hovered ? color : "rgba(255,255,255,0.05)") : (hovered ? color : bg)
  const finalColor = hovered ? "#fff" : color
  const finalBorder = isDark ? (hovered ? color : border) : border

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 16px", borderRadius: 12, fontSize: 11, fontWeight: 800,
        border: `1.5px solid ${finalBorder}`,
        background: finalBg, color: finalColor,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  )
}
