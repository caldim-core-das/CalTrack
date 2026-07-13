import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star, RefreshCw, Award, BarChart3, TrendingUp, ThumbsUp, CheckCircle2,
  MapPin, Phone, Calendar, Clock, Wrench, Camera, Upload, X,
  CheckCheck, Play, XCircle, AlertTriangle, Image as ImageIcon,
  Zap, Target, Activity, User, FileText, ChevronDown, ChevronUp, Info
} from "lucide-react"
import { apiRequest } from "../../api/client.js"

/* ─── Category emojis ────────────────────────────────────────────────────── */
const CAT_EMOJIS = {
  plumbing: "🔧", electrical: "⚡", carpentry: "🪵", hvac: "❄️",
  cleaning: "🧹", pest_control: "🦟", painting: "🎨",
  appliance_repair: "🏠", security: "📷", general: "🔨",
}

/* ─── Status config ──────────────────────────────────────────────────────── */
const JOB_STATUS = {
  assigned:    { label: "Assigned",    color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE" },
  accepted:    { label: "Accepted",    color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  in_progress: { label: "In Progress", color: "#F97316", bg: "#FFF7ED", border: "#FDBA74" },
  completed:   { label: "Completed",   color: "#10B981", bg: "#ECFDF5", border: "#6EE7B7" },
  rejected:    { label: "Rejected",    color: "#EF4444", bg: "#FEF2F2", border: "#FECACA" },
}

/* ─── Toast ─────────────────────────────────────────────────────────────── */
function Toast({ message, type, onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  const icons = { success: <CheckCircle2 size={14} />, error: <XCircle size={14} />, warn: <AlertTriangle size={14} /> }
  const colors = { success: "#059669", error: "#DC2626", warn: "#D97706" }
  const bgs = { success: "#ECFDF5", error: "#FEF2F2", warn: "#FFFBEB" }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      style={{
        position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
        background: bgs[type] || "#F8FAFC", color: colors[type] || "#475569",
        border: `1px solid ${colors[type] || "#E2E8F0"}20`,
        borderRadius: 12, padding: "0.75rem 1.1rem",
        display: "flex", alignItems: "center", gap: "0.5rem",
        fontSize: "0.82rem", fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        maxWidth: 320, fontFamily: "inherit",
      }}
    >
      {icons[type] || <Info size={14} />}
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 2 }}>
        <X size={12} />
      </button>
    </motion.div>
  )
}

/* ─── Proof Upload Modal ─────────────────────────────────────────────────── */
function ProofModal({ job, onClose, onSubmit, loading }) {
  const [files, setFiles] = useState([])
  const [note, setNote] = useState("")
  const [previews, setPreviews] = useState([])
  const fileRef = useRef()

  const handleFiles = (e) => {
    const chosen = Array.from(e.target.files)
    setFiles(chosen)
    setPreviews(chosen.map(f => URL.createObjectURL(f)))
  }

  const handleSubmit = () => {
    onSubmit(job.id, files, note)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        style={{
          background: "white", borderRadius: 20, padding: "1.5rem",
          width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)", fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Camera size={18} style={{ color: "#7C3AED" }} />
            <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#1e293b" }}>Upload Completion Proof</span>
          </div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "0.3rem 0.5rem", cursor: "pointer", color: "#64748b" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "1rem" }}>
          Job: <strong style={{ color: "#1e293b" }}>{job.service_request?.request_id}</strong> — {job.service_request?.issue_title}
        </div>

        {/* Photo Upload */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: "2px dashed #e2e8f0", borderRadius: 12, padding: "1.25rem",
            cursor: "pointer", textAlign: "center", marginBottom: "0.75rem",
            transition: "border-color 0.2s",
            ...(previews.length > 0 ? { borderColor: "#7C3AED" } : {}),
          }}
        >
          {previews.length === 0 ? (
            <>
              <ImageIcon size={28} style={{ color: "#cbd5e1", marginBottom: "0.4rem" }} />
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#64748b" }}>Click to upload photos</div>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>JPG, PNG — multiple allowed</div>
            </>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
              {previews.map((p, i) => (
                <img key={i} src={p} alt="" style={{ width: 80, height: 70, objectFit: "cover", borderRadius: 8 }} />
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
        </div>

        {/* Notes */}
        <textarea
          placeholder="Add notes about the completed work (optional)..."
          value={note}
          onChange={e => setNote(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            border: "1.5px solid #e2e8f0", borderRadius: 10,
            padding: "0.65rem 0.85rem", fontSize: "0.82rem", fontFamily: "inherit",
            color: "#1e293b", resize: "vertical", minHeight: 80, outline: "none",
            marginBottom: "1rem",
          }}
        />

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: "#f1f5f9", border: "none", borderRadius: 10,
              padding: "0.65rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: "#64748b",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (files.length === 0 && !note)}
            style={{
              flex: 2, background: "#7C3AED", color: "white", border: "none",
              borderRadius: 10, padding: "0.65rem", fontSize: "0.82rem", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "0.4rem", opacity: (loading || (files.length === 0 && !note)) ? 0.5 : 1,
            }}
          >
            {loading ? <RefreshCw size={14} style={{ animation: "ejSpin 0.8s linear infinite" }} /> : <Upload size={14} />}
            Submit Proof
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Confirm Action Modal ───────────────────────────────────────────────── */
function ConfirmModal({ title, message, onConfirm, onClose, confirmLabel = "Confirm", danger = false }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        style={{
          background: "white", borderRadius: 16, padding: "1.5rem",
          width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.18)", fontFamily: "inherit",
        }}
      >
        <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem" }}>{title}</h3>
        <p style={{ fontSize: "0.82rem", color: "#64748b", marginBottom: "1.25rem", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={onClose} style={{
            flex: 1, background: "#f1f5f9", border: "none", borderRadius: 10,
            padding: "0.65rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: "#64748b",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 2, background: danger ? "#EF4444" : "#7C3AED", color: "white", border: "none",
            borderRadius: 10, padding: "0.65rem", fontSize: "0.82rem", fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Job Card ───────────────────────────────────────────────────────────── */
function JobCard({ job, onAction, onProof, actionLoading }) {
  const [expanded, setExpanded] = useState(false)
  const sr = job.service_request || {}
  const sm = JOB_STATUS[job.status] || JOB_STATUS.assigned

  const canAccept    = job.status === "assigned"
  const canReject    = job.status === "assigned"
  const canStart     = job.status === "accepted"
  const canComplete  = job.status === "in_progress"
  const canProof     = ["in_progress", "completed"].includes(job.status)
  const isDone       = job.status === "completed"
  const isRejected   = job.status === "rejected"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      style={{
        background: "white",
        border: `1.5px solid ${sm.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        borderLeft: `5px solid ${sm.color}`,
        fontFamily: "inherit",
      }}
    >
      {/* Card Top */}
      <div style={{ padding: "1rem 1.1rem 0.85rem" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>{CAT_EMOJIS[sr.service_category] || "🔧"}</span>
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#7C3AED", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {sr.request_id}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, textTransform: "capitalize" }}>
                {(sr.service_category || "").replace(/_/g, " ")}
              </div>
            </div>
          </div>
          <span style={{
            background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`,
            borderRadius: 99, padding: "3px 9px", fontSize: "0.65rem", fontWeight: 700,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sm.color, display: "inline-block" }} />
            {sm.label}
          </span>
        </div>

        {/* Issue title */}
        <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#1e293b", marginBottom: "0.5rem", lineHeight: 1.3 }}>
          {sr.issue_title || "—"}
        </h3>

        {/* Info pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
          {sr.address && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "#64748b", fontWeight: 600, background: "#f8fafc", padding: "3px 8px", borderRadius: 99, border: "1px solid #e2e8f0" }}>
              <MapPin size={11} /> {sr.address.split(",").slice(0, 2).join(",")}
            </div>
          )}
          {sr.phone && (
            <a href={`tel:${sr.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "#7C3AED", fontWeight: 600, background: "#faf5ff", padding: "3px 8px", borderRadius: 99, border: "1px solid #DDD6FE", textDecoration: "none" }}>
              <Phone size={11} /> {sr.phone}
            </a>
          )}
          {sr.preferred_date && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "#64748b", fontWeight: 600, background: "#f8fafc", padding: "3px 8px", borderRadius: 99, border: "1px solid #e2e8f0" }}>
              <Calendar size={11} /> {sr.preferred_date}
            </div>
          )}
        </div>

        {/* Expand/Collapse */}
        {sr.description && (
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600, padding: 0, fontFamily: "inherit" }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? "Hide details" : "View details"}
          </button>
        )}

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div style={{ padding: "0.75rem 0 0", fontSize: "0.8rem", color: "#475569", lineHeight: 1.6 }}>
                {sr.description}
              </div>
              {sr.customer_name && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginTop: "0.5rem", fontSize: "0.72rem", color: "#64748b", fontWeight: 600 }}>
                  <User size={11} /> Customer: {sr.customer_name}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar */}
      {!isDone && !isRejected && (
        <div style={{
          display: "flex", gap: "0.4rem", padding: "0.75rem 1.1rem",
          borderTop: "1px solid #f1f5f9", flexWrap: "wrap",
        }}>
          {canAccept && (
            <button
              onClick={() => onAction(job.id, "accept")}
              disabled={actionLoading === job.id}
              style={btnStyle("#059669", "#ECFDF5", "#6EE7B7")}
            >
              <CheckCircle2 size={13} /> Accept Job
            </button>
          )}
          {canReject && (
            <button
              onClick={() => onAction(job.id, "reject")}
              disabled={actionLoading === job.id}
              style={btnStyle("#EF4444", "#FEF2F2", "#FECACA")}
            >
              <XCircle size={13} /> Decline
            </button>
          )}
          {canStart && (
            <button
              onClick={() => onAction(job.id, "start")}
              disabled={actionLoading === job.id}
              style={btnStyle("#F97316", "#FFF7ED", "#FDBA74")}
            >
              <Play size={13} /> Start Work
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => onAction(job.id, "complete")}
              disabled={actionLoading === job.id}
              style={btnStyle("#7C3AED", "#faf5ff", "#DDD6FE")}
            >
              <CheckCheck size={13} /> Mark Complete
            </button>
          )}
          {canProof && (
            <button
              onClick={() => onProof(job)}
              style={{
                display: "flex", alignItems: "center", gap: "0.3rem",
                fontSize: "0.72rem", fontWeight: 700, padding: "0.4rem 0.75rem",
                border: "1.5px solid #CBD5E1", borderRadius: 8, cursor: "pointer",
                background: "#f8fafc", color: "#475569", fontFamily: "inherit",
                transition: "all 0.15s ease",
              }}
            >
              <Camera size={13} /> Upload Proof
            </button>
          )}

          {actionLoading === job.id && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>
              <RefreshCw size={12} style={{ animation: "ejSpin 0.8s linear infinite" }} />
              Processing...
            </div>
          )}
        </div>
      )}

      {/* Completed stamp */}
      {isDone && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.6rem 1.1rem", borderTop: "1px solid #D1FAE5",
          background: "#ECFDF5", fontSize: "0.75rem", fontWeight: 700, color: "#059669",
        }}>
          <CheckCheck size={14} /> Job Completed
          {job.completed_date && (
            <span style={{ marginLeft: "auto", fontSize: "0.65rem", color: "#6EE7B7" }}>
              {new Date(job.completed_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* Rejected stamp */}
      {isRejected && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.6rem 1.1rem", borderTop: "1px solid #FECACA",
          background: "#FEF2F2", fontSize: "0.75rem", fontWeight: 700, color: "#EF4444",
        }}>
          <XCircle size={14} /> Job Declined
        </div>
      )}
    </motion.div>
  )
}

function btnStyle(color, bg, border) {
  return {
    display: "flex", alignItems: "center", gap: "0.3rem",
    fontSize: "0.72rem", fontWeight: 700, padding: "0.4rem 0.85rem",
    border: `1.5px solid ${border}`, borderRadius: 8, cursor: "pointer",
    background: bg, color, fontFamily: "inherit", transition: "all 0.15s ease",
  }
}

/* ─── KPI Card ───────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon: Icon, color, suffix = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "white", border: "1px solid #e2e8f0", borderRadius: 14,
        padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.5rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)", position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: "14px 14px 0 0",
      }} />
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: color + "18", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, color: "#1e293b", lineHeight: 1, fontFamily: "Outfit, sans-serif" }}>
          {value}{suffix}
        </div>
        <div style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: "0.2rem" }}>
          {label}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Star Rating ────────────────────────────────────────────────────────── */
function StarRating({ score }) {
  const num = Math.round(parseFloat(score) || 0)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <Star key={s} size={16} style={{ fill: s <= num ? "#F59E0B" : "none", color: s <= num ? "#F59E0B" : "#e2e8f0" }} />
      ))}
      <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#1e293b", marginLeft: 4 }}>{parseFloat(score || 0).toFixed(1)}</span>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export function EmployeeJobsPage() {
  const [jobs, setJobs]               = useState([])
  const [performance, setPerformance] = useState(null)
  const [jobsLoading, setJobsLoading] = useState(true)
  const [perfLoading, setPerfLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null) // jobId
  const [proofLoading, setProofLoading]   = useState(false)
  const [proofJob, setProofJob]           = useState(null)
  const [confirmModal, setConfirmModal]   = useState(null) // { jobId, action, title, message }
  const [toast, setToast]                 = useState(null)
  const [activeTab, setActiveTab]         = useState("active") // active | history | performance

  const showToast = (msg, type = "success") => setToast({ msg, type, id: Date.now() })

  /* ── Load Jobs ── */
  const loadJobs = async () => {
    setJobsLoading(true)
    try {
      const res = await apiRequest("/employee/jobs/")
      if (res?.success) setJobs(Array.isArray(res.data) ? res.data : [])
    } catch (err) { console.error(err) }
    finally { setJobsLoading(false) }
  }

  /* ── Load Performance ── */
  const loadPerformance = async () => {
    setPerfLoading(true)
    try {
      const res = await apiRequest("/employee/performance/")
      if (res?.success) setPerformance(res.data)
    } catch (err) { console.error(err) }
    finally { setPerfLoading(false) }
  }

  useEffect(() => { loadJobs(); loadPerformance() }, [])

  /* ── Job Actions ── */
  const handleAction = (jobId, action) => {
    const labels = {
      accept: { title: "Accept Job", message: "Are you ready to take on this job?", label: "Accept", danger: false },
      reject: { title: "Decline Job", message: "Are you sure you want to decline this assignment?", label: "Decline", danger: true },
      start:  { title: "Start Work", message: "Confirm that you are at the customer's location and starting work now.", label: "Start", danger: false },
      complete: { title: "Mark Complete", message: "Confirm that the work has been fully completed to the customer's satisfaction.", label: "Mark Complete", danger: false },
    }
    setConfirmModal({ jobId, action, ...labels[action] })
  }

  const executeAction = async () => {
    const { jobId, action } = confirmModal
    setConfirmModal(null)
    setActionLoading(jobId)

    const endpointMap = {
      accept: "accept", reject: "reject", start: "start", complete: "complete"
    }

    try {
      const res = await apiRequest(`/employee/jobs/${jobId}/${endpointMap[action]}/`, { method: "POST" })
      if (res?.success) {
        showToast(res.message || "Action completed!", "success")
        loadJobs()
        if (action === "complete") loadPerformance()
      } else {
        showToast(res?.message || "Action failed.", "error")
      }
    } catch (err) {
      showToast(err?.body?.message || "An error occurred.", "error")
    } finally {
      setActionLoading(null)
    }
  }

  /* ── Proof Upload ── */
  const handleProofSubmit = async (jobId, files, note) => {
    setProofLoading(true)
    try {
      const form = new FormData()
      files.forEach(f => form.append("photo", f))
      if (note) form.append("note", note)
      const res = await apiRequest(`/employee/jobs/${jobId}/proof/`, { method: "POST", body: form })
      if (res?.success) {
        showToast("Proof uploaded successfully!", "success")
        setProofJob(null)
        loadJobs()
      } else {
        showToast(res?.message || "Upload failed.", "error")
      }
    } catch (err) {
      showToast(err?.body?.message || "Upload error.", "error")
    } finally {
      setProofLoading(false)
    }
  }

  /* ── Derived ── */
  const activeJobs = jobs.filter(j => !["completed", "rejected"].includes(j.status))
  const historyJobs = jobs.filter(j => ["completed", "rejected"].includes(j.status))

  return (
    <div className="ej-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap');
        @keyframes ejSpin { to { transform: rotate(360deg); } }
        .ej-root { display: flex; flex-direction: column; height: 100%; background: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif; overflow: hidden; }
        .ej-header { background: white; border-bottom: 1px solid #e2e8f0; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
        .ej-header-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 800; color: #1e293b; letter-spacing: -0.01em; }
        .ej-header-actions { display: flex; gap: 0.5rem; }
        .ej-refresh-btn { display: flex; align-items: center; gap: 0.3rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.35rem 0.7rem; font-size: 0.72rem; font-weight: 700; cursor: pointer; color: #64748b; font-family: inherit; transition: all 0.15s ease; }
        .ej-refresh-btn:hover { background: #f1f5f9; color: #7C3AED; }
        .ej-tabs { background: white; border-bottom: 1px solid #e2e8f0; display: flex; padding: 0 1.5rem; flex-shrink: 0; }
        .ej-tab { padding: 0.75rem 1rem; font-size: 0.8rem; font-weight: 700; color: #94a3b8; border: none; background: none; cursor: pointer; border-bottom: 2.5px solid transparent; display: flex; align-items: center; gap: 0.35rem; font-family: inherit; transition: all 0.15s ease; }
        .ej-tab--active { color: #7C3AED; border-bottom-color: #7C3AED; }
        .ej-tab-count { background: #7C3AED18; color: #7C3AED; border-radius: 99px; padding: 1px 6px; font-size: 0.65rem; font-weight: 800; }
        .ej-content { flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; }
        .ej-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; }
        @media (max-width: 600px) { .ej-grid { grid-template-columns: 1fr; } }
        .ej-kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
        .ej-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 3rem 1rem; text-align: center; }
        .ej-empty-icon { width: 56px; height: 56px; border-radius: 50%; background: white; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; color: #94a3b8; }
        .ej-section-title { font-size: 0.78rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin: 1rem 0 0.75rem; display: flex; align-items: center; gap: 0.35rem; }
        .ej-perf-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; }
        .ej-perf-title { font-size: 0.75rem; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.35rem; }
        .ej-perf-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f8fafc; }
        .ej-perf-row:last-child { border-bottom: none; }
        .ej-perf-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }
        .ej-perf-val { font-size: 0.88rem; font-weight: 800; color: #1e293b; }
        .ej-progress-bar { height: 6px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
        .ej-progress-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #7C3AED, #10B981); transition: width 0.8s ease; }
      `}</style>

      {/* Header */}
      <div className="ej-header">
        <div className="ej-header-title">
          <Award size={18} style={{ color: "#7C3AED" }} />
          My Job Dashboard
        </div>
        <div className="ej-header-actions">
          <button className="ej-refresh-btn" onClick={() => { loadJobs(); loadPerformance() }}>
            <RefreshCw size={13} className={jobsLoading ? "ejSpin" : ""} style={{ animation: jobsLoading ? "ejSpin 0.8s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ej-tabs">
        <button className={`ej-tab ${activeTab === "active" ? "ej-tab--active" : ""}`} onClick={() => setActiveTab("active")}>
          <Zap size={14} /> Active Jobs
          {activeJobs.length > 0 && <span className="ej-tab-count">{activeJobs.length}</span>}
        </button>
        <button className={`ej-tab ${activeTab === "history" ? "ej-tab--active" : ""}`} onClick={() => setActiveTab("history")}>
          <CheckCheck size={14} /> History
          {historyJobs.length > 0 && <span className="ej-tab-count">{historyJobs.length}</span>}
        </button>
        <button className={`ej-tab ${activeTab === "performance" ? "ej-tab--active" : ""}`} onClick={() => setActiveTab("performance")}>
          <BarChart3 size={14} /> Performance
        </button>
      </div>

      {/* Content */}
      <div className="ej-content">
        <AnimatePresence mode="wait">

          {/* ── Active Jobs Tab ── */}
          {activeTab === "active" && (
            <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {jobsLoading ? (
                <div className="ej-center">
                  <RefreshCw size={24} style={{ color: "#7C3AED", animation: "ejSpin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700 }}>Loading jobs...</span>
                </div>
              ) : activeJobs.length === 0 ? (
                <div className="ej-center">
                  <div className="ej-empty-icon"><Wrench size={24} /></div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#475569" }}>No active jobs</h3>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", maxWidth: 280 }}>
                    You don't have any assigned or in-progress jobs right now.
                  </p>
                </div>
              ) : (
                <div className="ej-grid">
                  <AnimatePresence>
                    {activeJobs.map(job => (
                      <JobCard
                        key={job.id}
                        job={job}
                        onAction={handleAction}
                        onProof={setProofJob}
                        actionLoading={actionLoading}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}

          {/* ── History Tab ── */}
          {activeTab === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {historyJobs.length === 0 ? (
                <div className="ej-center">
                  <div className="ej-empty-icon"><CheckCheck size={24} /></div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#475569" }}>No completed jobs yet</h3>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", maxWidth: 280 }}>
                    Your completed and declined jobs will appear here.
                  </p>
                </div>
              ) : (
                <div className="ej-grid">
                  {historyJobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onAction={handleAction}
                      onProof={setProofJob}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Performance Tab ── */}
          {activeTab === "performance" && (
            <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {perfLoading ? (
                <div className="ej-center">
                  <RefreshCw size={24} style={{ color: "#7C3AED", animation: "ejSpin 0.8s linear infinite" }} />
                  <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700 }}>Loading stats...</span>
                </div>
              ) : !performance ? (
                <div className="ej-center">
                  <div className="ej-empty-icon"><BarChart3 size={24} /></div>
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 800, color: "#475569" }}>No stats yet</h3>
                  <p style={{ fontSize: "0.78rem", color: "#94a3b8", maxWidth: 280 }}>
                    Complete jobs and receive customer feedback to populate your performance dashboard.
                  </p>
                </div>
              ) : (
                <>
                  {/* KPI Grid */}
                  <div className="ej-kpi-grid">
                    <KpiCard label="Jobs Completed" value={performance.jobs_completed_count} icon={CheckCheck} color="#10B981" />
                    <KpiCard label="Avg Rating" value={parseFloat(performance.average_rating || 0).toFixed(1)} icon={Star} color="#F59E0B" suffix="/5" />
                    <KpiCard label="Completion Rate" value={parseFloat(performance.completion_rate || 0).toFixed(0)} icon={Target} color="#7C3AED" suffix="%" />
                    <KpiCard label="CSAT Score" value={parseFloat(performance.customer_satisfaction_score || 0).toFixed(1)} icon={ThumbsUp} color="#3B82F6" suffix="/5" />
                  </div>

                  {/* Detailed Stats */}
                  <div className="ej-perf-card">
                    <div className="ej-perf-title"><Activity size={14} style={{ color: "#7C3AED" }} /> Detailed Metrics</div>

                    <div className="ej-perf-row">
                      <span className="ej-perf-label">Average Rating</span>
                      <StarRating score={performance.average_rating} />
                    </div>

                    <div className="ej-perf-row">
                      <span className="ej-perf-label">Customer Satisfaction</span>
                      <span className="ej-perf-val" style={{ color: "#3B82F6" }}>
                        {parseFloat(performance.customer_satisfaction_score || 0).toFixed(2)} / 5.00
                      </span>
                    </div>

                    <div className="ej-perf-row">
                      <span className="ej-perf-label">Feedback Count</span>
                      <span className="ej-perf-val">{performance.feedback_count}</span>
                    </div>

                    <div className="ej-perf-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                        <span className="ej-perf-label">Completion Rate</span>
                        <span className="ej-perf-val">{parseFloat(performance.completion_rate || 0).toFixed(1)}%</span>
                      </div>
                      <div className="ej-progress-bar" style={{ width: "100%" }}>
                        <div className="ej-progress-fill" style={{ width: `${Math.min(parseFloat(performance.completion_rate || 0), 100)}%` }} />
                      </div>
                    </div>

                    <div className="ej-perf-row">
                      <span className="ej-perf-label">Last Updated</span>
                      <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>
                        {performance.last_updated ? new Date(performance.last_updated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </span>
                    </div>
                  </div>

                  {/* Tips */}
                  <div style={{ marginTop: "1rem", background: "#faf5ff", border: "1px solid #DDD6FE", borderRadius: 14, padding: "1rem" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#7C3AED", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      <Zap size={13} /> Tips to improve your rating
                    </div>
                    {[
                      "Arrive on time for every scheduled booking",
                      "Keep customer informed of progress",
                      "Upload completion proof photos after every job",
                      "Be professional and courteous at all times",
                    ].map(tip => (
                      <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", fontSize: "0.78rem", color: "#475569", padding: "0.25rem 0" }}>
                        <span style={{ color: "#10B981", fontWeight: 700, flexShrink: 0 }}>✓</span> {tip}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {proofJob && (
          <ProofModal
            job={proofJob}
            onClose={() => setProofJob(null)}
            onSubmit={handleProofSubmit}
            loading={proofLoading}
          />
        )}
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmLabel={confirmModal.label}
            danger={confirmModal.danger}
            onConfirm={executeAction}
            onClose={() => setConfirmModal(null)}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast key={toast.id} message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
