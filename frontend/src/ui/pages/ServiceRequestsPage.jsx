import React, { useState, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Wrench, ShieldAlert, AlertCircle, Clock, CheckCircle2,
  User, Phone, Mail, MapPin, Calendar, FileText, ArrowRight, CornerDownLeft,
  Eye, RefreshCw, Star, HelpCircle, X, Info, XCircle, AlertTriangle,
  Filter, Zap, ChevronDown, ClipboardCheck, Users, TrendingUp,
  CheckCheck, Ban, Repeat2, ThumbsUp, Send, Copy
} from "lucide-react"
import { apiRequest } from "../../api/client.js"
import { CATEGORY_TO_ROLES_MAP, TECHNICIAN_ROLES } from "../../utils/roles.js"

/* ─── Toast ─────────────────────────────────────────────────────────────── */
function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  const icons = { success: <CheckCircle2 size={15} />, error: <XCircle size={15} />, warn: <AlertTriangle size={15} />, info: <Info size={15} /> }
  return (
    <div className="settingsToast" data-type={type}>
      {icons[type] || icons.info}
      <span>{message}</span>
      <button onClick={onDismiss} className="settingsToastClose"><X size={13} /></button>
    </div>
  )
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STATUS_META = {
  new_request: { label: "New", color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
  reviewed: { label: "Reviewed", color: "#6366F1", bg: "#EEF2FF", border: "#C7D2FE" },
  assigned: { label: "Assigned", color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE" },
  accepted: { label: "Accepted", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  in_progress: { label: "In Progress", color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  completed: { label: "Completed", color: "#10B981", bg: "#ECFDF5", border: "#6EE7B7" },
  awaiting_verification: { label: "Verifying", color: "#14B8A6", bg: "#F0FDFA", border: "#99F6E4" },
  verified: { label: "Verified", color: "#059669", bg: "#D1FAE5", border: "#6EE7B7" },
  feedback_pending: { label: "Feedback", color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1" },
  feedback_received: { label: "Fb Received", color: "#EC4899", bg: "#FDF2F8", border: "#FBCFE8" },
  closed: { label: "Closed", color: "#475569", bg: "#F1F5F9", border: "#CBD5E1" },
  rejected: { label: "Rejected", color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
  rework_requested: { label: "Rework", color: "#DC2626", bg: "#FEF2F2", border: "#FCA5A5" },
}

const PRIORITY_META = {
  low: { label: "Low", color: "#64748B", bg: "#F1F5F9" },
  normal: { label: "Normal", color: "#3B82F6", bg: "#EFF6FF" },
  high: { label: "High", color: "#F97316", bg: "#FFF7ED" },
  urgent: { label: "Urgent", color: "#EF4444", bg: "#FEF2F2" },
}

const CAT_EMOJIS = {
  plumbing: "🔧", electrical: "⚡", carpentry: "🪵", hvac: "❄️",
  cleaning: "🧹", pest_control: "🦟", painting: "🎨",
  appliance_repair: "🏠", security: "📷", general: "🔨",
}

const PIPELINE_ORDER = [
  "new_request", "reviewed", "assigned", "accepted",
  "in_progress", "completed", "awaiting_verification",
  "verified", "feedback_pending", "feedback_received", "closed",
]

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function StatusBadge({ status, size = "sm" }) {
  const m = STATUS_META[status] || { label: status, color: "#64748B", bg: "#F1F5F9", border: "#CBD5E1" }
  const padding = size === "sm" ? "3px 8px" : "4px 10px"
  const fontSize = size === "sm" ? "0.62rem" : "0.7rem"
  return (
    <span style={{
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      borderRadius: 99, padding, fontSize, fontWeight: 700,
      whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: m.color, display: "inline-block" }} />
      {m.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || { label: priority, color: "#64748B", bg: "#F1F5F9" }
  const isUrgent = priority === "urgent"
  return (
    <span style={{
      background: m.bg, color: m.color,
      borderRadius: 99, padding: "2px 7px", fontSize: "0.6rem", fontWeight: 800,
      letterSpacing: "0.04em", textTransform: "uppercase",
      display: "inline-flex", alignItems: "center", gap: 3,
      animation: isUrgent ? "srPulse 1.4s ease-in-out infinite" : "none",
    }}>
      {m.label}
    </span>
  )
}

function TechAvatar({ name, size = 32 }) {
  const initial = (name || "?").charAt(0).toUpperCase()
  const colors = ["#7C3AED", "#2563EB", "#059669", "#D97706", "#DC2626", "#0891B2"]
  const color = colors[initial.charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color + "20", color, border: `2px solid ${color}40`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

/* ─── Pipeline Lane Counts ───────────────────────────────────────────────── */
function PipelineLanes({ requests, activeStatus, onFilter }) {
  const counts = useMemo(() => {
    const c = {}
    requests.forEach(r => { c[r.status] = (c[r.status] || 0) + 1 })
    return c
  }, [requests])

  const urgent = requests.filter(r => r.priority === "urgent").length

  return (
    <div className="sr-pipeline">
      <button
        className={`sr-lane ${!activeStatus ? "sr-lane--active" : ""}`}
        onClick={() => onFilter("")}
        style={!activeStatus ? { "--lc": "#7C3AED" } : {}}
      >
        <span className="sr-lane-count">{requests.length}</span>
        <span className="sr-lane-label">All</span>
      </button>

      {urgent > 0 && (
        <button
          className="sr-lane sr-lane--urgent"
          onClick={() => onFilter("urgent_filter")}
        >
          <span className="sr-lane-count">{urgent}</span>
          <span className="sr-lane-label">🚨 Urgent</span>
        </button>
      )}

      {PIPELINE_ORDER.filter(s => counts[s]).map(s => {
        const m = STATUS_META[s]
        const isActive = activeStatus === s
        return (
          <button
            key={s}
            className={`sr-lane ${isActive ? "sr-lane--active" : ""}`}
            onClick={() => onFilter(isActive ? "" : s)}
            style={isActive ? { "--lc": m.color } : {}}
          >
            <span className="sr-lane-count" style={{ color: m.color }}>{counts[s]}</span>
            <span className="sr-lane-label">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ─── Employee Picker ────────────────────────────────────────────────────── */
function EmployeePicker({ employees, onAssign, loading }) {
  const [selected, setSelected] = useState("")

  return (
    <div className="sr-assign-panel">
      <div className="sr-assign-title"><Users size={13} /> Assign Technician</div>
      <div className="sr-emp-list">
        {employees.map(emp => (
          <div
            key={emp.id}
            className={`sr-emp-card ${selected === emp.id ? "sr-emp-card--selected" : ""}`}
            onClick={() => setSelected(selected === emp.id ? "" : emp.id)}
          >
            <TechAvatar name={emp.full_name} size={34} />
            <div className="sr-emp-info">
              <div className="sr-emp-name">{emp.full_name}</div>
              <div className="sr-emp-role">{emp.title || "Field Technician"} · {emp.employee_id}</div>
            </div>
            {selected === emp.id && <CheckCircle2 size={16} style={{ color: "#7C3AED", flexShrink: 0 }} />}
          </div>
        ))}
        {employees.length === 0 && (
          <div className="sr-empty-mini">No technicians available</div>
        )}
      </div>
      <button
        className="sr-btn-primary"
        disabled={!selected || loading}
        onClick={() => selected && onAssign(selected)}
      >
        {loading ? <RefreshCw size={13} className="sr-spin" /> : <Send size={13} />}
        Assign Technician
      </button>
    </div>
  )
}

/* ─── Main Component ─────────────────────────────────────────────────────── */
export function ServiceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [allRequests, setAllRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [categoriesMap, setCategoriesMap] = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)
  const [toast, setToast] = useState(null)
  const [showAssign, setShowAssign] = useState(false)

  const showToast = (msg, type = "success") => setToast({ msg, type, id: Date.now() })

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")

  /* Load list */
  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiRequest("/admin/service-requests/")
      if (res?.success) {
        const data = Array.isArray(res.data) ? res.data : []
        setAllRequests(data)
        setRequests(data)
      } else setError(res?.message || "Failed to load requests.")
    } catch (err) {
      setError("Failed to fetch service requests from server.")
    } finally { setLoading(false) }
  }

  useEffect(() => {
    loadRequests()
    apiRequest("/admin/service-requests/employees/")
      .then(res => { if (res?.success) setEmployees(res.data) })
      .catch(err => console.error("Error loading technicians:", err))
      
    apiRequest("/catalog/categories/")
      .then(res => {
        if (res?.success) {
          const cmap = {}
          res.data.forEach(c => {
            const slug = c.slug || c.name.toLowerCase().replace(/ /g, "_")
            const entry = { name: c.name, image: c.image, slug }
            cmap[c.id.toString()] = entry
            cmap[slug] = entry
          })
          setCategoriesMap(cmap)
        }
      })
      .catch(err => console.error("Error loading categories:", err))
  }, [])

  const getCategoryInfo = (catIdOrSlug) => {
    if (!catIdOrSlug) return { name: "General", emoji: "🔧" }
    const key = catIdOrSlug.toString()
    const name = categoriesMap[key]?.name || key.replace(/_/g, " ")
    const slug = name.toLowerCase().replace(/ /g, "_")
    const emoji = CAT_EMOJIS[slug] || "🔧"
    return { name, emoji }
  }

  /* Client-side filtering */
  const filtered = useMemo(() => {
    let list = allRequests
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.request_id?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.issue_title?.toLowerCase().includes(q) ||
        r.phone?.includes(q)
      )
    }
    if (statusFilter === "urgent_filter") {
      list = list.filter(r => r.priority === "urgent")
    } else if (statusFilter) {
      list = list.filter(r => r.status === statusFilter)
    }
    if (priorityFilter) list = list.filter(r => r.priority === priorityFilter)
    return list
  }, [allRequests, search, statusFilter, priorityFilter])

  /* Load detail */
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let active = true
    setDetailLoading(true)
    setActionSuccess(null)
    setShowAssign(false)
    apiRequest(`/admin/service-requests/${selectedId}/`)
      .then(res => { if (active && res?.success) setDetail(res.data) })
      .catch(err => console.error(err))
      .finally(() => { if (active) setDetailLoading(false) })
    return () => { active = false }
  }, [selectedId])

  const refreshAll = async () => {
    const [detRes, listRes] = await Promise.all([
      apiRequest(`/admin/service-requests/${selectedId}/`),
      apiRequest("/admin/service-requests/"),
    ])
    if (detRes?.success) setDetail(detRes.data)
    if (listRes?.success) {
      const data = Array.isArray(listRes.data) ? listRes.data : []
      setAllRequests(data)
      setRequests(data)
    }
  }

  const handleAction = async (endpoint, method = "PATCH", payload = {}) => {
    setActionLoading(true)
    setActionSuccess(null)
    try {
      const res = await apiRequest(`/admin/service-requests/${selectedId}/${endpoint}`, { method, json: payload })
      if (res?.success) {
        showToast(res.message || "Done!", "success")
        setActionSuccess(res.message || "Operation completed.")
        await refreshAll()
      } else showToast(res?.message || "Failed.", "error")
    } catch (err) {
      showToast(err?.body?.message || "An error occurred.", "error")
    } finally { setActionLoading(false) }
  }

  const handleAssign = async (empId) => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/service-requests/${selectedId}/assign/`, {
        method: "PATCH", json: { employee_id: empId },
      })
      if (res?.success) {
        showToast("Technician assigned!", "success")
        setShowAssign(false)
        await refreshAll()
      } else showToast(res?.message || "Assignment failed.", "error")
    } catch (err) {
      const msg = err?.body?.detail || err?.body?.message || "Assignment error."
      showToast(msg, "error")
    } finally { setActionLoading(false) }
  }

  const handlePriorityChange = async (p) => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/service-requests/${selectedId}/priority/`, { method: "PATCH", json: { priority: p } })
      if (res?.success) { showToast("Priority updated.", "success"); await refreshAll() }
    } catch (err) { showToast("Error.", "error") }
    finally { setActionLoading(false) }
  }

  /* ── Render ── */
  return (
    <div className="sr-root">
      <SrStyles />

      {/* ── Left Pane ── */}
      <div className="sr-left">
        {/* Header */}
        <div className="sr-left-header">
          <div className="sr-left-title">
            <Wrench size={15} style={{ color: "#7C3AED" }} />
            Service Requests
          </div>
          <button className="sr-icon-btn" onClick={loadRequests} title="Refresh">
            <RefreshCw size={14} className={loading ? "sr-spin" : ""} />
          </button>
        </div>

        {/* Pipeline Lanes */}
        <PipelineLanes requests={allRequests} activeStatus={statusFilter} onFilter={setStatusFilter} />

        {/* Search + Filters */}
        <div className="sr-filters">
          <div className="sr-search-wrap">
            <Search size={14} className="sr-search-icon" />
            <input
              className="sr-search"
              placeholder="Search ID, customer, issue..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="sr-search-clear" onClick={() => setSearch("")}><X size={12} /></button>}
          </div>
          <select className="sr-select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priorities</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div className="sr-list">
          {loading && filtered.length === 0 ? (
            <div className="sr-center-msg">
              <RefreshCw size={20} className="sr-spin" style={{ color: "#7C3AED" }} />
              <span>Loading...</span>
            </div>
          ) : error ? (
            <div className="sr-center-msg">
              <AlertCircle size={20} style={{ color: "#EF4444" }} />
              <span style={{ color: "#EF4444", fontSize: "0.78rem" }}>{error}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="sr-center-msg">
              <HelpCircle size={20} style={{ color: "#94a3b8" }} />
              <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>No requests found</span>
            </div>
          ) : (
            filtered.map(r => {
              const isSelected = r.id === selectedId
              const sm = STATUS_META[r.status] || STATUS_META.closed
              const pm = PRIORITY_META[r.priority] || PRIORITY_META.normal
              return (
                <button
                  key={r.id}
                  className={`sr-list-item ${isSelected ? "sr-list-item--active" : ""} ${r.priority === "urgent" ? "sr-list-item--urgent" : ""}`}
                  onClick={() => setSelectedId(r.id)}
                  style={isSelected ? { "--lc": sm.color } : {}}
                >
                  <div className="sr-item-top">
                    <div className="sr-item-meta">
                      <span className="sr-item-id">{r.request_id}</span>
                      <span className="sr-item-emoji">{getCategoryInfo(r.service_category).emoji}</span>
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <span className="sr-item-date">{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>

                  <div className="sr-item-title">{r.issue_title}</div>
                  <div className="sr-item-customer">
                    <User size={11} /> {r.customer_name} · {r.phone}
                  </div>

                  <div className="sr-item-bottom">
                    <StatusBadge status={r.status} />
                    {r.assigned_employee && (
                      <div className="sr-item-tech">
                        <TechAvatar name={r.assigned_employee.full_name} size={18} />
                        <span>{r.assigned_employee.full_name?.split(" ")[0]}</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Right Pane ── */}
      <div className="sr-right">
        <AnimatePresence mode="wait">
          {detailLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sr-center-full">
              <RefreshCw size={28} className="sr-spin" style={{ color: "#7C3AED" }} />
              <span className="sr-loading-text">Loading details...</span>
            </motion.div>
          ) : !detail ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sr-center-full">
              <div className="sr-empty-icon"><Wrench size={32} /></div>
              <h3 className="sr-empty-title">Select a Request</h3>
              <p className="sr-empty-desc">Choose a service request from the list to view details and take action.</p>
            </motion.div>
          ) : (
            <motion.div key={`detail-${detail.id}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sr-detail">

              {/* Detail Header */}
              <div className="sr-detail-header">
                <div className="sr-detail-header-left">
                  <div className="sr-detail-id-row">
                    <span className="sr-detail-id">{detail.request_id}</span>
                    <span className="sr-detail-cat">
                      {getCategoryInfo(detail.service_category).emoji} {getCategoryInfo(detail.service_category).name}
                    </span>
                    <StatusBadge status={detail.status} size="md" />
                  </div>
                  <h2 className="sr-detail-title">{detail.issue_title}</h2>
                  <div className="sr-detail-sub">
                    <Calendar size={12} /> {detail.preferred_date} &nbsp;·&nbsp;
                    <Clock size={12} /> Created {new Date(detail.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>

                <div className="sr-detail-header-right">
                  <div className="sr-priority-control">
                    <span className="sr-priority-label">Priority</span>
                    <select
                      className="sr-priority-select"
                      value={detail.priority}
                      onChange={e => handlePriorityChange(e.target.value)}
                      disabled={actionLoading}
                      style={{ color: PRIORITY_META[detail.priority]?.color }}
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Success Banner */}
              {actionSuccess && (
                <div className="sr-success-banner">
                  <CheckCircle2 size={15} /> {actionSuccess}
                </div>
              )}

              {/* Pipeline Progress */}
              <div className="sr-pipeline-progress">
                {PIPELINE_ORDER.slice(0, 7).map((s, i) => {
                  const idx = PIPELINE_ORDER.indexOf(detail.status)
                  const done = PIPELINE_ORDER.indexOf(s) < idx
                  const active = s === detail.status
                  const m = STATUS_META[s]
                  return (
                    <React.Fragment key={s}>
                      <div className={`sr-pp-step ${done ? "sr-pp-step--done" : active ? "sr-pp-step--active" : ""}`}
                        style={active ? { "--ppc": m.color } : {}}>
                        <div className="sr-pp-dot" style={active ? { background: m.color } : done ? { background: "#10B981" } : {}}>
                          {done && <CheckCheck size={8} />}
                        </div>
                        <span className="sr-pp-label">{m.label}</span>
                      </div>
                      {i < 6 && <div className={`sr-pp-line ${done ? "sr-pp-line--done" : ""}`} />}
                    </React.Fragment>
                  )
                })}
              </div>

              {/* Two-column info grid */}
              <div className="sr-info-grid">
                {/* Customer */}
                <div className="sr-info-card">
                  <div className="sr-info-card-title"><User size={13} /> Customer</div>
                  <div className="sr-info-row"><span className="sr-info-key">Name</span><span className="sr-info-val">{detail.customer_name}</span></div>
                  <div className="sr-info-row">
                    <span className="sr-info-key">Phone</span>
                    <a href={`tel:${detail.phone}`} className="sr-info-link">{detail.phone}</a>
                  </div>
                  {detail.email && (
                    <div className="sr-info-row">
                      <span className="sr-info-key">Email</span>
                      <a href={`mailto:${detail.email}`} className="sr-info-link">{detail.email}</a>
                    </div>
                  )}
                  <div className="sr-info-row sr-info-row--col">
                    <span className="sr-info-key"><MapPin size={11} /> Address</span>
                    <span className="sr-info-val sr-info-val--sm">{detail.address}</span>
                  </div>
                </div>

                {/* Technician */}
                <div className="sr-info-card">
                  {(() => {
                    const catKey = detail.service_category?.toString()
                    const catEntry = categoriesMap[catKey]
                    const catName = catEntry?.name || (catKey ? catKey.replace(/_/g, " ") : "")
                    // Use the DB slug from categoriesMap; fall back to generating from name
                    const catSlug = catEntry?.slug || catName.toLowerCase().replace(/ /g, "_")
                    const reqRoleIds = CATEGORY_TO_ROLES_MAP[catSlug] || []
                    const reqRoleLabels = reqRoleIds.map(id => TECHNICIAN_ROLES.find(r => r.id === id)?.label).filter(Boolean)
                    const roleTitle = reqRoleLabels.length > 0 ? reqRoleLabels.join(" / ") : "Technician"
                    return (
                      <div className="sr-info-card-title"><Users size={13} /> {roleTitle}</div>
                    )
                  })()}
                  {detail.assigned_employee ? (
                    <div className="sr-tech-assigned">
                      <TechAvatar name={detail.assigned_employee.full_name} size={40} />
                      <div>
                        <div className="sr-tech-name">{detail.assigned_employee.full_name}</div>
                        <div className="sr-tech-role">{detail.assigned_employee.title || "Field Technician"}</div>
                        <div className="sr-tech-id">ID: {detail.assigned_employee.employee_id}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="sr-tech-unassigned">
                      <HelpCircle size={20} style={{ color: "#94a3b8" }} />
                      <span>No technician assigned yet</span>
                      <button
                        className="sr-btn-sm"
                        onClick={() => setShowAssign(v => !v)}
                      >
                        <Users size={11} /> Assign Now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Booking Details */}
              {(detail.cart_data || detail.total_amount > 0 || detail.preferred_time) && (
                (() => {
                  let parsedCart = [];
                  if (typeof detail.cart_data === "string") {
                    try { parsedCart = JSON.parse(detail.cart_data); } catch (e) { }
                  } else if (Array.isArray(detail.cart_data)) {
                    parsedCart = detail.cart_data;
                  }

                  if (parsedCart.length === 0 && !detail.total_amount && !detail.preferred_time) return null;

                  return (
                    <div className="sr-desc-card" style={{ marginBottom: 15 }}>
                      <div className="sr-info-card-title"><ClipboardCheck size={13} /> Booking Details</div>

                      {detail.preferred_time && (
                        <div className="sr-info-row" style={{ marginBottom: 15 }}>
                          <span className="sr-info-key"><Clock size={11} /> Preferred Time</span>
                          <span className="sr-info-val sr-info-val--sm">{detail.preferred_time}</span>
                        </div>
                      )}

                      {parsedCart.length > 0 && (
                        <div className="sr-cart-items" style={{ marginBottom: 15 }}>
                          <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#64748B", textAlign: "left" }}>
                                <th style={{ padding: "8px 0", fontWeight: 600 }}>Service</th>
                                <th style={{ padding: "8px 0", fontWeight: 600, textAlign: "center" }}>Qty</th>
                                <th style={{ padding: "8px 0", fontWeight: 600, textAlign: "right" }}>Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parsedCart.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                  <td style={{ padding: "10px 0", color: "#334155" }}>
                                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                                    {item.categoryName && <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{item.categoryName}</div>}
                                  </td>
                                  <td style={{ padding: "10px 0", textAlign: "center", color: "#475569" }}>{item.quantity}</td>
                                  <td style={{ padding: "10px 0", textAlign: "right", color: "#475569" }}>${item.price}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {(detail.total_amount > 0 || parsedCart.length > 0) && (
                        <div className="sr-info-row" style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, justifyContent: "space-between" }}>
                          <span className="sr-info-key" style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.95rem" }}>Total Amount</span>
                          <span className="sr-info-val" style={{ fontWeight: 700, color: "#7C3AED", fontSize: "1.05rem" }}>${detail.total_amount || 0}</span>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}

              {/* Description + Photo */}
              <div className="sr-desc-card">
                <div className="sr-info-card-title"><FileText size={13} /> Issue Description</div>
                <p className="sr-desc-text">{detail.description || <em style={{ color: "#94a3b8" }}>No description provided.</em>}</p>
                {detail.photo && (
                  <div className="sr-photo-wrap">
                    <a href={detail.photo} target="_blank" rel="noreferrer" className="sr-photo-link">
                      <img src={detail.photo} alt="Customer photo" className="sr-photo" />
                      <div className="sr-photo-hover"><Eye size={18} /></div>
                    </a>
                    <span className="sr-photo-label">Customer Attached Photo</span>
                  </div>
                )}
              </div>

              {/* Assign Panel (expandable) */}
              {showAssign && (
                (() => {
                  const catKey = detail.service_category?.toString()
                  const catEntry = categoriesMap[catKey]
                  const catName = catEntry?.name || (catKey ? catKey.replace(/_/g, " ") : "")
                  // Use the DB slug from categoriesMap; fall back to generating from name
                  const catSlug = catEntry?.slug || catName.toLowerCase().replace(/ /g, "_")
                  const reqRoleIds = CATEGORY_TO_ROLES_MAP[catSlug] || []
                  
                  const filteredEmployees = employees.filter(emp => {
                    if (reqRoleIds.length === 0) return true;
                    if (!emp.service_roles || !Array.isArray(emp.service_roles)) return false;
                    return emp.service_roles.some(r => reqRoleIds.includes(r));
                  });

                  return (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <EmployeePicker employees={filteredEmployees} onAssign={handleAssign} loading={actionLoading} />
                    </motion.div>
                  )
                })()
              )}

              {/* Completion Proofs */}
              {detail.employee_job?.proofs?.length > 0 && (
                <div className="sr-proofs-card">
                  <div className="sr-info-card-title"><Eye size={13} /> Completion Proofs</div>
                  {detail.employee_job.notes && (
                    <div className="sr-proof-note">&ldquo;{detail.employee_job.notes}&rdquo;</div>
                  )}
                  <div className="sr-proof-grid">
                    {detail.employee_job.proofs.map((proof, idx) => (
                      <div key={proof.id || idx} className="sr-proof-item">
                        {proof.photo ? (
                          <a href={proof.photo} target="_blank" rel="noreferrer" className="sr-proof-photo-link">
                            <img src={proof.photo} alt="Proof" className="sr-proof-photo" />
                            <div className="sr-proof-hover"><Eye size={14} /></div>
                          </a>
                        ) : (
                          <a href={proof.document} target="_blank" rel="noreferrer" className="sr-proof-doc">
                            <FileText size={20} style={{ color: "#7C3AED" }} />
                            <span>Document</span>
                          </a>
                        )}
                        {proof.note && <div className="sr-proof-caption">{proof.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              {detail.feedback?.is_submitted && (
                <div className="sr-feedback-card">
                  <div className="sr-info-card-title"><Star size={13} /> Customer Feedback</div>
                  <div className="sr-fb-row">
                    <div className="sr-fb-rating">
                      <Star size={20} style={{ fill: "#F59E0B", color: "#F59E0B" }} />
                      <span className="sr-fb-score">{detail.feedback.rating}</span>
                      <span className="sr-fb-of">/5</span>
                    </div>
                    <div className="sr-fb-meta">
                      <div className="sr-fb-meta-row">
                        <span className="sr-fb-key">Behaviour</span>
                        <span className="sr-fb-val" style={{ textTransform: "capitalize" }}>{detail.feedback.employee_behaviour}</span>
                      </div>
                      <div className="sr-fb-meta-row">
                        <span className="sr-fb-key">Work Quality</span>
                        <span className="sr-fb-val" style={{ textTransform: "capitalize" }}>{detail.feedback.work_quality}</span>
                      </div>
                      <div className="sr-fb-meta-row">
                        <span className="sr-fb-key">Resolved</span>
                        <span className="sr-fb-val">{detail.feedback.issue_resolved ? "✅ Yes" : "❌ No"}</span>
                      </div>
                    </div>
                  </div>
                  {detail.feedback.comment && (
                    <div className="sr-fb-comment">&ldquo;{detail.feedback.comment}&rdquo;</div>
                  )}
                </div>
              )}

              {/* Feedback Token URL */}
              {detail.feedback && !["closed", "rejected"].includes(detail.status) && (
                <div className="sr-token-card">
                  <div className="sr-token-label">Feedback Link</div>
                  <div className="sr-token-url-row">
                    <span className="sr-token-url">{`${window.location.origin}/feedback/${detail.feedback.feedback_token}`}</span>
                    <button
                      className="sr-token-copy"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/feedback/${detail.feedback.feedback_token}`)
                        showToast("Copied!", "success")
                      }}
                    >
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                </div>
              )}

              {/* ── Action Buttons ── */}
              <div className="sr-actions">
                <div className="sr-actions-title">Workflow Actions</div>
                <div className="sr-actions-row">

                  {/* NEW_REQUEST / CONFIRMED */}
                  {["new_request", "confirmed"].includes(detail.status) && (
                    <>
                      <button className="sr-btn-action sr-btn-action--primary" disabled={actionLoading} onClick={() => handleAction("review/")}>
                        <ClipboardCheck size={14} /> Mark Reviewed
                      </button>
                      <button
                        className="sr-btn-action sr-btn-action--primary"
                        onClick={() => setShowAssign(v => !v)}
                      >
                        <Users size={14} /> {showAssign ? "Close Assign Panel" : "Assign Technician"}
                      </button>
                      <button className="sr-btn-action sr-btn-action--danger" disabled={actionLoading} onClick={() => handleAction("reject/")}>
                        <Ban size={14} /> Reject
                      </button>
                    </>
                  )}

                  {/* REVIEWED */}
                  {detail.status === "reviewed" && (
                    <>
                      <button
                        className="sr-btn-action sr-btn-action--primary"
                        onClick={() => setShowAssign(v => !v)}
                      >
                        <Users size={14} /> {showAssign ? "Close Assign Panel" : "Assign Technician"}
                      </button>
                      <button className="sr-btn-action sr-btn-action--danger" disabled={actionLoading} onClick={() => handleAction("reject/")}>
                        <Ban size={14} /> Reject
                      </button>
                    </>
                  )}

                  {/* AWAITING_VERIFICATION */}
                  {detail.status === "awaiting_verification" && (
                    <>
                      <button className="sr-btn-action sr-btn-action--success" disabled={actionLoading} onClick={() => handleAction("verify/")}>
                        <CheckCheck size={14} /> Verify & Send Feedback
                      </button>
                      <button className="sr-btn-action sr-btn-action--warning" disabled={actionLoading} onClick={() => handleAction("request-rework/")}>
                        <Repeat2 size={14} /> Request Rework
                      </button>
                    </>
                  )}

                  {/* FEEDBACK_RECEIVED */}
                  {detail.status === "feedback_received" && (
                    <button className="sr-btn-action sr-btn-action--primary" disabled={actionLoading} onClick={() => handleAction("close/")}>
                      <CheckCircle2 size={14} /> Close Request
                    </button>
                  )}

                  {/* SEND/RESEND FEEDBACK EMAIL */}
                  {!["closed", "rejected"].includes(detail.status) && (
                    <button
                      className="sr-btn-action sr-btn-action--ghost"
                      disabled={actionLoading}
                      onClick={() => handleAction("resend-feedback/", "POST")}
                    >
                      <Send size={14} /> {detail.feedback ? "Resend Feedback Email" : "Send Feedback Email"}
                    </button>
                  )}

                  {/* CLOSED */}
                  {detail.status === "closed" && (
                    <div className="sr-status-msg sr-status-msg--closed">
                      <CheckCircle2 size={14} /> This request is fully closed.
                    </div>
                  )}

                  {/* REJECTED */}
                  {detail.status === "rejected" && (
                    <div className="sr-status-msg sr-status-msg--rejected">
                      <Ban size={14} /> This request has been rejected.
                    </div>
                  )}

                  {/* LOADING */}
                  {actionLoading && (
                    <div className="sr-status-msg">
                      <RefreshCw size={13} className="sr-spin" /> Processing...
                    </div>
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toast */}
      {toast && createPortal(
        <Toast key={toast.id} message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />,
        document.body
      )}
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
function SrStyles() {
  return (
    <style>{`
      @keyframes srPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .sr-spin { animation: srSpin 0.8s linear infinite; }
      @keyframes srSpin { to { transform: rotate(360deg); } }

      .sr-root {
        display: flex;
        height: calc(100vh - 64px);
        overflow: hidden;
        background: #f8fafc;
        font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
      }

      /* ── Left Pane ── */
      .sr-left {
        width: 340px;
        min-width: 280px;
        border-right: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        background: white;
        overflow: hidden;
      }
      @media (max-width: 768px) { .sr-left { width: 100%; } }

      .sr-left-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.9rem 1rem;
        border-bottom: 1px solid #f1f5f9;
        flex-shrink: 0;
      }
      .sr-left-title {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.82rem;
        font-weight: 800;
        color: #1e293b;
        letter-spacing: -0.01em;
      }
      .sr-icon-btn {
        background: none;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.35rem;
        cursor: pointer;
        color: #64748b;
        display: flex;
        align-items: center;
        transition: all 0.2s ease;
      }
      .sr-icon-btn:hover { background: #f1f5f9; color: #7C3AED; }

      /* ── Pipeline Lanes ── */
      .sr-pipeline {
        display: flex;
        gap: 0;
        overflow-x: auto;
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid #f1f5f9;
        scrollbar-width: none;
        flex-shrink: 0;
      }
      .sr-pipeline::-webkit-scrollbar { display: none; }
      .sr-lane {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        padding: 0.3rem 0.5rem;
        border-radius: 8px;
        border: none;
        background: none;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
        min-width: 50px;
        font-family: inherit;
      }
      .sr-lane:hover { background: #f8fafc; }
      .sr-lane--active { background: rgba(var(--lc-r, 124), var(--lc-g, 58), var(--lc-b, 237), 0.08); }
      .sr-lane--urgent { animation: srPulse 1.5s ease-in-out infinite; }
      .sr-lane-count { font-size: 1rem; font-weight: 800; color: #1e293b; line-height: 1; }
      .sr-lane--active .sr-lane-count { color: var(--lc, #7C3AED); }
      .sr-lane-label { font-size: 0.58rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.03em; }
      .sr-lane--active .sr-lane-label { color: var(--lc, #7C3AED); }

      /* ── Filters ── */
      .sr-filters {
        padding: 0.5rem 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        border-bottom: 1px solid #f1f5f9;
        flex-shrink: 0;
      }
      .sr-search-wrap { position: relative; }
      .sr-search-icon { position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: #94a3b8; }
      .sr-search {
        width: 100%;
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.5rem 0.75rem 0.5rem 2.2rem;
        font-size: 0.78rem;
        font-family: inherit;
        color: #1e293b;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .sr-search:focus { border-color: #7C3AED; background: white; }
      .sr-search-clear {
        position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; color: #94a3b8;
      }
      .sr-select {
        background: #f8fafc;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 0.4rem 0.6rem;
        font-size: 0.75rem;
        font-family: inherit;
        color: #475569;
        font-weight: 600;
        outline: none;
        cursor: pointer;
        width: 100%;
      }
      .sr-select:focus { border-color: #7C3AED; }

      /* ── List Items ── */
      .sr-list {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #e2e8f0 transparent;
      }
      .sr-list-item {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        width: 100%;
        text-align: left;
        padding: 0.85rem 1rem;
        border: none;
        background: none;
        border-left: 3px solid transparent;
        border-bottom: 1px solid #f8fafc;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
      }
      .sr-list-item:hover { background: #f8fafc; }
      .sr-list-item--active {
        background: #faf5ff;
        border-left-color: var(--lc, #7C3AED);
      }
      .sr-list-item--urgent { border-left-color: #EF4444 !important; }

      .sr-item-top { display: flex; align-items: center; justify-content: space-between; }
      .sr-item-meta { display: flex; align-items: center; gap: 0.35rem; }
      .sr-item-id { font-size: 0.68rem; font-weight: 800; color: #7C3AED; text-transform: uppercase; letter-spacing: 0.05em; }
      .sr-item-emoji { font-size: 0.9rem; }
      .sr-item-date { font-size: 0.65rem; font-weight: 600; color: #94a3b8; }
      .sr-item-title { font-size: 0.82rem; font-weight: 700; color: #1e293b; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sr-item-customer { display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; color: #64748b; font-weight: 600; }
      .sr-item-bottom { display: flex; align-items: center; justify-content: space-between; }
      .sr-item-tech { display: flex; align-items: center; gap: 0.3rem; font-size: 0.68rem; color: #64748b; font-weight: 600; }

      /* ── Right Pane ── */
      .sr-right {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        background: #f8fafc;
        scrollbar-width: thin;
        scrollbar-color: #e2e8f0 transparent;
      }
      .sr-center-full {
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
      }
      .sr-loading-text { font-size: 0.78rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
      .sr-empty-icon {
        width: 64px; height: 64px; border-radius: 50%;
        background: white; border: 1px solid #e2e8f0;
        display: flex; align-items: center; justify-content: center; color: #94a3b8;
      }
      .sr-empty-title { font-size: 0.92rem; font-weight: 800; color: #475569; }
      .sr-empty-desc { font-size: 0.78rem; color: #94a3b8; text-align: center; max-width: 280px; }

      /* ── Detail ── */
      .sr-detail { display: flex; flex-direction: column; gap: 1rem; max-width: 860px; }

      .sr-detail-header {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 1.25rem;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .sr-detail-header-left { flex: 1; }
      .sr-detail-id-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
      .sr-detail-id { font-size: 0.72rem; font-weight: 800; color: #7C3AED; letter-spacing: 0.05em; text-transform: uppercase; }
      .sr-detail-cat { font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: capitalize; background: #f1f5f9; border-radius: 99px; padding: 2px 8px; }
      .sr-detail-title { font-size: 1.15rem; font-weight: 800; color: #1e293b; line-height: 1.3; }
      .sr-detail-sub { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: #94a3b8; font-weight: 600; margin-top: 0.35rem; }

      .sr-priority-control { display: flex; flex-direction: column; gap: 0.25rem; align-items: flex-end; }
      .sr-priority-label { font-size: 0.62rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
      .sr-priority-select {
        background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px;
        padding: 0.35rem 0.6rem; font-size: 0.78rem; font-weight: 700;
        font-family: inherit; cursor: pointer; outline: none;
      }

      .sr-success-banner {
        display: flex; align-items: center; gap: 0.5rem;
        background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 10px;
        padding: 0.65rem 1rem; font-size: 0.8rem; color: #059669; font-weight: 600;
      }

      /* ── Pipeline Progress ── */
      .sr-pipeline-progress {
        background: white; border: 1px solid #e2e8f0; border-radius: 12px;
        padding: 0.85rem 1rem;
        display: flex; align-items: center; overflow-x: auto;
        scrollbar-width: none; gap: 0;
      }
      .sr-pipeline-progress::-webkit-scrollbar { display: none; }
      .sr-pp-step { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; min-width: 56px; }
      .sr-pp-dot {
        width: 22px; height: 22px; border-radius: 50%;
        background: #e2e8f0; display: flex; align-items: center; justify-content: center;
        color: white; font-size: 0.55rem; transition: all 0.3s ease;
      }
      .sr-pp-step--done .sr-pp-dot { background: #10B981; }
      .sr-pp-step--active .sr-pp-dot {
        background: var(--ppc, #7C3AED);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--ppc, #7C3AED) 20%, transparent);
      }
      .sr-pp-label { font-size: 0.58rem; font-weight: 700; color: #94a3b8; text-align: center; white-space: nowrap; }
      .sr-pp-step--done .sr-pp-label, .sr-pp-step--active .sr-pp-label { color: #1e293b; }
      .sr-pp-line { flex: 1; height: 2px; background: #e2e8f0; min-width: 14px; }
      .sr-pp-line--done { background: #10B981; }

      /* ── Info Grid ── */
      .sr-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
      @media (max-width: 640px) { .sr-info-grid { grid-template-columns: 1fr; } }
      .sr-info-card {
        background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem;
        display: flex; flex-direction: column; gap: 0.6rem;
      }
      .sr-info-card-title {
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.72rem; font-weight: 800; color: #475569;
        text-transform: uppercase; letter-spacing: 0.04em;
        margin-bottom: 0.25rem;
      }
      .sr-info-row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
      .sr-info-row--col { flex-direction: column; align-items: flex-start; gap: 0.2rem; }
      .sr-info-key { font-size: 0.7rem; color: #94a3b8; font-weight: 600; white-space: nowrap; }
      .sr-info-val { font-size: 0.8rem; font-weight: 700; color: #1e293b; text-align: right; }
      .sr-info-val--sm { font-size: 0.75rem; line-height: 1.4; text-align: left; color: #475569; }
      .sr-info-link { font-size: 0.8rem; font-weight: 700; color: #7C3AED; text-decoration: none; }
      .sr-info-link:hover { text-decoration: underline; }

      .sr-tech-assigned { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0; }
      .sr-tech-name { font-size: 0.88rem; font-weight: 700; color: #1e293b; }
      .sr-tech-role { font-size: 0.72rem; color: #64748b; }
      .sr-tech-id { font-size: 0.65rem; color: #94a3b8; font-weight: 600; }
      .sr-tech-unassigned {
        display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
        padding: 1rem 0; color: #94a3b8; font-size: 0.78rem; font-weight: 600; text-align: center;
      }

      .sr-desc-card {
        background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem;
        display: flex; flex-direction: column; gap: 0.75rem;
      }
      .sr-desc-text { font-size: 0.82rem; color: #475569; line-height: 1.6; }
      .sr-photo-wrap { display: flex; flex-direction: column; gap: 0.35rem; }
      .sr-photo-link { position: relative; display: inline-block; border-radius: 10px; overflow: hidden; width: 140px; height: 90px; }
      .sr-photo { width: 100%; height: 100%; object-fit: cover; }
      .sr-photo-hover {
        position: absolute; inset: 0; background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center; color: white;
        opacity: 0; transition: opacity 0.2s;
      }
      .sr-photo-link:hover .sr-photo-hover { opacity: 1; }
      .sr-photo-label { font-size: 0.68rem; color: #94a3b8; font-weight: 600; }

      /* ── Assign Panel ── */
      .sr-assign-panel {
        background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem;
        display: flex; flex-direction: column; gap: 0.75rem;
        border-top: 3px solid #7C3AED;
      }
      .sr-assign-title {
        display: flex; align-items: center; gap: 0.35rem;
        font-size: 0.75rem; font-weight: 800; color: #7C3AED;
        text-transform: uppercase; letter-spacing: 0.04em;
      }
      .sr-emp-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 220px; overflow-y: auto; }
      .sr-emp-card {
        display: flex; align-items: center; gap: 0.6rem;
        padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0;
        border-radius: 10px; cursor: pointer; transition: all 0.15s ease;
        background: #f8fafc;
      }
      .sr-emp-card:hover { border-color: #7C3AED; background: #faf5ff; }
      .sr-emp-card--selected { border-color: #7C3AED; background: #faf5ff; }
      .sr-emp-info { flex: 1; }
      .sr-emp-name { font-size: 0.82rem; font-weight: 700; color: #1e293b; }
      .sr-emp-role { font-size: 0.68rem; color: #64748b; }
      .sr-empty-mini { font-size: 0.78rem; color: #94a3b8; text-align: center; padding: 1rem; }

      /* ── Proofs ── */
      .sr-proofs-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; }
      .sr-proof-note { font-size: 0.78rem; color: #475569; font-style: italic; padding: 0.5rem 0; }
      .sr-proof-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 0.5rem; margin-top: 0.5rem; }
      .sr-proof-item { display: flex; flex-direction: column; gap: 0.25rem; }
      .sr-proof-photo-link { position: relative; display: block; height: 70px; border-radius: 8px; overflow: hidden; }
      .sr-proof-photo { width: 100%; height: 100%; object-fit: cover; }
      .sr-proof-hover {
        position: absolute; inset: 0; background: rgba(0,0,0,0.4);
        display: flex; align-items: center; justify-content: center; color: white;
        opacity: 0; transition: opacity 0.2s;
      }
      .sr-proof-photo-link:hover .sr-proof-hover { opacity: 1; }
      .sr-proof-doc {
        height: 70px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e8f0;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 0.25rem; font-size: 0.65rem; color: #64748b; text-decoration: none;
      }
      .sr-proof-caption { font-size: 0.62rem; color: #94a3b8; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

      /* ── Feedback ── */
      .sr-feedback-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem; }
      .sr-fb-row { display: flex; align-items: flex-start; gap: 1rem; margin-top: 0.5rem; }
      .sr-fb-rating { display: flex; align-items: center; gap: 0.35rem; }
      .sr-fb-score { font-size: 2rem; font-weight: 900; color: #1e293b; }
      .sr-fb-of { font-size: 0.9rem; color: #94a3b8; font-weight: 700; }
      .sr-fb-meta { flex: 1; display: flex; flex-direction: column; gap: 0.35rem; }
      .sr-fb-meta-row { display: flex; justify-content: space-between; }
      .sr-fb-key { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
      .sr-fb-val { font-size: 0.75rem; font-weight: 700; color: #1e293b; }
      .sr-fb-comment {
        margin-top: 0.75rem; background: #f8fafc; border: 1px solid #f1f5f9;
        border-radius: 10px; padding: 0.65rem; font-size: 0.8rem; color: #475569;
        font-style: italic; line-height: 1.5;
      }

      /* ── Token Card ── */
      .sr-token-card {
        background: #faf5ff; border: 1px solid #DDD6FE; border-radius: 12px; padding: 0.75rem 1rem;
        display: flex; flex-direction: column; gap: 0.35rem;
      }
      .sr-token-label { font-size: 0.65rem; font-weight: 800; color: #7C3AED; text-transform: uppercase; letter-spacing: 0.05em; }
      .sr-token-url-row { display: flex; align-items: center; gap: 0.5rem; }
      .sr-token-url { font-size: 0.72rem; color: #64748b; font-family: monospace; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sr-token-copy {
        display: flex; align-items: center; gap: 0.3rem;
        background: #7C3AED; color: white; border: none; border-radius: 7px;
        padding: 0.3rem 0.6rem; font-size: 0.68rem; font-weight: 700; cursor: pointer;
        font-family: inherit; white-space: nowrap; flex-shrink: 0;
      }

      /* ── Actions ── */
      .sr-actions {
        background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1rem;
      }
      .sr-actions-title { font-size: 0.68rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
      .sr-actions-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
      .sr-btn-action {
        display: flex; align-items: center; gap: 0.4rem;
        font-size: 0.75rem; font-weight: 700; font-family: inherit;
        padding: 0.55rem 1rem; border-radius: 10px; cursor: pointer;
        border: 1.5px solid transparent; transition: all 0.15s ease;
      }
      .sr-btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
      .sr-btn-action--primary { background: #7C3AED; color: white; border-color: #7C3AED; }
      .sr-btn-action--primary:hover:not(:disabled) { background: #6d28d9; }
      .sr-btn-action--success { background: #059669; color: white; border-color: #059669; }
      .sr-btn-action--success:hover:not(:disabled) { background: #047857; }
      .sr-btn-action--danger { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
      .sr-btn-action--danger:hover:not(:disabled) { background: #fee2e2; }
      .sr-btn-action--warning { background: #fffbeb; color: #d97706; border-color: #fde68a; }
      .sr-btn-action--warning:hover:not(:disabled) { background: #fef3c7; }
      .sr-btn-action--ghost { background: #f8fafc; color: #475569; border-color: #e2e8f0; }
      .sr-btn-action--ghost:hover:not(:disabled) { background: #f1f5f9; color: #1e293b; }

      .sr-status-msg {
        display: flex; align-items: center; gap: 0.4rem;
        font-size: 0.78rem; font-weight: 600; color: #64748b;
      }
      .sr-status-msg--closed { color: #059669; }
      .sr-status-msg--rejected { color: #dc2626; }

      .sr-btn-primary {
        display: flex; align-items: center; justify-content: center; gap: 0.4rem;
        background: #7C3AED; color: white; border: none; border-radius: 10px;
        padding: 0.6rem 1rem; font-size: 0.78rem; font-weight: 700; font-family: inherit;
        cursor: pointer; transition: all 0.15s ease; width: 100%;
      }
      .sr-btn-primary:hover:not(:disabled) { background: #6d28d9; }
      .sr-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
      .sr-btn-sm {
        display: flex; align-items: center; gap: 0.3rem;
        background: #7C3AED; color: white; border: none; border-radius: 8px;
        padding: 0.35rem 0.75rem; font-size: 0.72rem; font-weight: 700; font-family: inherit;
        cursor: pointer;
      }
      .sr-center-msg {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: 0.5rem; padding: 2.5rem 1rem; color: #94a3b8;
      }
    `}</style>
  )
}
