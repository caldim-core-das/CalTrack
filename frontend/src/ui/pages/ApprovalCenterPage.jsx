import { useEffect, useState, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { apiRequest, unwrapResults } from "../../api/client.js"
import {
  apiFetchRegistrationDossier,
  apiSaveRegistrationDossier,
  apiApproveRegistrationDossier,
  apiRejectRegistrationDossier
} from "../../api/authService.js"
import { Button, Card, Pill } from "../components/kit.jsx"
import {
  Award, CalendarDays, Users, Check, X, RefreshCw, Eye,
  User, Phone, Mail, MapPin, ShieldCheck, FileText, Cpu,
  Fingerprint, ShieldAlert, Clock, AlertTriangle, FileSpreadsheet,
  CheckCircle2, XCircle, UserCheck, Loader2, Building, Briefcase,
  Star, ChevronRight, BadgeCheck, UserX, ClipboardList
} from "lucide-react"

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatusTone(status) {
  if (status === "Activated" || status === "approved" || status === "activated") return "good"
  if (status === "Rejected" || status === "rejected") return "bad"
  return "warn"
}

// ─── Approved Employee Card ───────────────────────────────────────────────────
function ApprovedEmployeeCard({ emp, onView }) {
  const isActivated = emp.activation_status === "activated"
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-base shadow-sm ${isActivated ? "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white" : "bg-gradient-to-br from-indigo-500 to-indigo-700 text-white"}`}>
          {(emp.full_name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-black text-slate-900 dark:text-white text-sm truncate">{emp.full_name}</div>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${isActivated ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400"}`}>
              {isActivated ? "✓ Active" : "Invited"}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{emp.employee_id}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{emp.email}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] border-t border-slate-100 dark:border-slate-800 pt-3">
        <div>
          <span className="text-slate-400 font-bold uppercase block">Title</span>
          <span className="text-slate-700 dark:text-slate-300 font-semibold">{emp.title}</span>
        </div>
        <div>
          <span className="text-slate-400 font-bold uppercase block">Joined</span>
          <span className="text-slate-700 dark:text-slate-300 font-semibold">{emp.date_joined}</span>
        </div>
        <div>
          <span className="text-slate-400 font-bold uppercase block">Phone</span>
          <span className="text-slate-700 dark:text-slate-300 font-semibold">{emp.phone}</span>
        </div>
        <div>
          <span className="text-slate-400 font-bold uppercase block">Billing Rate</span>
          <span className={`font-black ${emp.hourly_rate > 0 ? "text-emerald-600" : "text-amber-500"}`}>
            {emp.hourly_rate > 0 ? `$${emp.hourly_rate}/hr` : "Not Set"}
          </span>
        </div>
      </div>

      <button
        onClick={() => onView(emp)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl py-2 transition-all"
      >
        <Eye size={12} /> View Employee Profile
      </button>
    </div>
  )
}

// ─── Approved Employee Detail Modal ──────────────────────────────────────────
function ApprovedEmployeeDetailModal({ emp, onClose }) {
  if (!emp) return null
  const isActivated = emp.activation_status === "activated"
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-gradient-to-r from-slate-900 to-indigo-900 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-sm ${isActivated ? "bg-emerald-600" : "bg-indigo-600"}`}>
              {(emp.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-black text-sm">{emp.full_name}</div>
              <div className="text-indigo-300 text-[10px] font-mono">{emp.employee_id}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full border ${isActivated ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" : "text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400"}`}>
              {isActivated ? "✓ Account Activated" : "⏳ Invitation Sent — Pending Activation"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              { label: "Full Name", value: emp.full_name },
              { label: "Email", value: emp.email },
              { label: "Phone", value: emp.phone },
              { label: "Employee ID", value: emp.employee_id, mono: true },
              { label: "Title / Role", value: emp.title },
              { label: "Department", value: emp.department },
              { label: "Country", value: emp.country },
              { label: "Date Joined", value: emp.date_joined },
            ].map(({ label, value, mono }) => (
              <div key={label} className="bg-slate-50 dark:bg-slate-950/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider mb-0.5">{label}</span>
                <span className={`text-slate-800 dark:text-slate-200 font-bold ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/30 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <span className="block text-[8px] text-slate-400 font-black uppercase tracking-wider mb-1">Billing / Hourly Rate</span>
            <span className={`text-lg font-black ${emp.hourly_rate > 0 ? "text-emerald-600" : "text-amber-500"}`}>
              {emp.hourly_rate > 0 ? `$${emp.hourly_rate}/hr` : "Not Configured"}
            </span>
            {emp.hourly_rate === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">Inviting admin must configure their billing rate before they can be assigned to tasks.</p>
            )}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function ApprovalCenterPage() {
  // ── Tab state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("pending") // "pending" | "approved" | "rejected"

  // ── Dossiers state (employee registration dossiers) ──────────────────────────
  const [pendingDossiers, setPendingDossiers] = useState([])
  const [approvedDossiers, setApprovedDossiers] = useState([])
  const [rejectedDossiers, setRejectedDossiers] = useState([])
  const [dossiersLoading, setDossiersLoading] = useState(true)

  // ── Approved employees from DB ─────────────────────────────────────────────
  const [approvedEmployees, setApprovedEmployees] = useState([])
  const [approvedLoading, setApprovedLoading] = useState(true)
  const [viewingEmployee, setViewingEmployee] = useState(null)

  // ── Review modal ───────────────────────────────────────────────────────────
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectRemarks, setRejectRemarks] = useState("")
  const [rejectReasons, setRejectReasons] = useState({
    aadhaar: false, pan: false, blurred: false, face: false,
    training: false, call: false, duplicate: false, fraud: false, other: false
  })
  const [rejectError, setRejectError] = useState("")
  const [showDocModal, setShowDocModal] = useState(null)

  // ── Fetch dossiers ──────────────────────────────────────────────────────────
  const loadDossiers = useCallback(async () => {
    try {
      const { apiFetchRegistrationDossiers } = await import("../../api/authService.js")
      const pending = await apiFetchRegistrationDossiers("pending")
      setPendingDossiers(pending || [])
      
      const approved = await apiFetchRegistrationDossiers("approved")
      setApprovedDossiers(approved || [])
      
      const rejected = await apiFetchRegistrationDossiers("rejected")
      setRejectedDossiers(rejected || [])
    } catch (e) {
      console.error("Failed to load dossiers", e)
    } finally {
      setDossiersLoading(false)
    }
  }, [])

  // ── Fetch approved employees from DB ───────────────────────────────────────
  const loadApprovedEmployees = useCallback(async () => {
    try {
      const res = await apiRequest("/auth/approved-employees/")
      if (res?.success) {
        setApprovedEmployees(res.data || [])
      }
    } catch (e) {
      console.error("Failed to load approved employees", e)
    } finally {
      setApprovedLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDossiers()
    loadApprovedEmployees()
    const interval = setInterval(() => {
      loadDossiers()
      loadApprovedEmployees()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadDossiers, loadApprovedEmployees])

  // Build active employee from real dossier data
  const pendingQueue = useMemo(() => {
    return pendingDossiers.map(d => {
      const statusLabel = "Pending Review"
      return {
        id: d.id,
        name: d.regForm?.fullName || d.email || "—",
        phone: d.regForm?.phone || "—",
        email: d.regForm?.email || d.email || "—",
        location: d.regForm?.address || "—",
        regDate: d.regForm?.regDate || d.created_at || "—",
        trustScore: d.trustScore || 100,
        status: statusLabel,
        dossierStatus: "pending",
        regForm: d.regForm,
        docForm: d.docForm,
        academyState: d.academyState,
        interviewState: d.interviewState,
        adminClearance: d.adminClearance,
        rawDossier: d
      }
    })
  }, [pendingDossiers])

  const approvedQueue = useMemo(() => {
    return approvedDossiers.map(d => {
      const statusLabel = "Approved"
      return {
        id: d.id,
        name: d.regForm?.fullName || d.email || "—",
        phone: d.regForm?.phone || "—",
        email: d.regForm?.email || d.email || "—",
        location: d.regForm?.address || "—",
        regDate: d.regForm?.regDate || d.created_at || "—",
        trustScore: d.trustScore || 100,
        status: statusLabel,
        dossierStatus: "approved",
        regForm: d.regForm,
        docForm: d.docForm,
        academyState: d.academyState,
        interviewState: d.interviewState,
        adminClearance: d.adminClearance,
        rawDossier: d
      }
    })
  }, [approvedDossiers])

  const rejectedQueue = useMemo(() => {
    return rejectedDossiers.map(d => {
      const statusLabel = "Rejected"
      return {
        id: d.id,
        name: d.regForm?.fullName || d.email || "—",
        phone: d.regForm?.phone || "—",
        email: d.regForm?.email || d.email || "—",
        location: d.regForm?.address || "—",
        regDate: d.regForm?.regDate || d.created_at || "—",
        trustScore: d.trustScore || 100,
        status: statusLabel,
        dossierStatus: "rejected",
        regForm: d.regForm,
        docForm: d.docForm,
        academyState: d.academyState,
        interviewState: d.interviewState,
        adminClearance: d.adminClearance,
        rawDossier: d
      }
    })
  }, [rejectedDossiers])

  const currentQueue = useMemo(() => {
    if (activeTab === "approved") return approvedQueue
    if (activeTab === "rejected") return rejectedQueue
    return pendingQueue
  }, [activeTab, pendingQueue, approvedQueue, rejectedQueue])

  const activeEmployee = viewingEmployee || (currentQueue.length > 0 ? currentQueue[0] : null)

  useEffect(() => {
    setViewingEmployee(null)
  }, [activeTab])

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    return {
      pending: pendingQueue.length,
      approved: approvedEmployees.length + approvedQueue.length,
      rejected: rejectedQueue.length,
    }
  }, [pendingQueue, approvedEmployees, approvedQueue, rejectedQueue])

  // ── Approve/Reject handlers ────────────────────────────────────────────────
  async function confirmApprove() {
    try {
      if (!activeEmployee) return
      await apiApproveRegistrationDossier(activeEmployee.id)
      await loadDossiers()
      await loadApprovedEmployees()
      setShowApproveConfirm(false)
      setShowReviewModal(false)
      setViewingEmployee(null)
      setActiveTab("approved") // Switch to approved tab
    } catch (e) {
      console.error("Failed to approve employee", e)
      setShowApproveConfirm(false)
      alert("Error: " + (e.body?.error || "Failed to approve application."))
    }
  }

  async function handleRejectSubmit(e) {
    e.preventDefault()
    if (!rejectRemarks.trim()) {
      setRejectError("Cannot submit rejection without remarks.")
      return
    }
    const selectedReasons = Object.entries(rejectReasons)
      .filter(([_, v]) => v)
      .map(([k]) => ({
        aadhaar: "Aadhaar Mismatch", pan: "PAN Mismatch", blurred: "Blurred Documents",
        face: "Face Verification Failed", training: "Training Incomplete",
        call: "Verification Call Failed", duplicate: "Duplicate Registration",
        fraud: "Fraud Risk Detected", other: "Other"
      }[k] || k))
    try {
      if (!activeEmployee) return
      await apiRejectRegistrationDossier({
        id: activeEmployee.id,
        remarks: rejectRemarks,
        reasonCategory: selectedReasons.join(", ") || "Document Verification Failed"
      })
      await loadDossiers()
      setShowRejectForm(false)
      setShowReviewModal(false)
      setViewingEmployee(null)
      setRejectRemarks("")
      setRejectReasons({ aadhaar: false, pan: false, blurred: false, face: false, training: false, call: false, duplicate: false, fraud: false, other: false })
      setRejectError("")
      setActiveTab("rejected")
    } catch (e) {
      console.error("Failed to reject employee", e)
      setRejectError(e.body?.error || "Failed to reject application.")
    }
  }

  // ── Tab config ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: "pending", label: "Pending Review", icon: Clock, count: metrics.pending, color: "amber" },
    { id: "approved", label: "Approved Queue", icon: UserCheck, count: metrics.approved, color: "emerald" },
    { id: "rejected", label: "Rejected Queue", icon: UserX, count: metrics.rejected, color: "rose" },
  ]

  // ─── Main Render ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">

      {/* ── HEADER ── */}
      <div className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 z-10">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight">
            <Award className="text-indigo-600 dark:text-indigo-500" size={22} />
            Registration Management
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
            Review and process employee registration dossiers.
          </p>
        </div>
        <Button variant="ghost" onClick={() => { loadDossiers(); loadApprovedEmployees() }} className="flex gap-2 text-xs">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* ── METRICS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div
          onClick={() => setActiveTab("pending")}
          className={`rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all border ${activeTab === "pending" ? "bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700 shadow-sm" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 hover:border-slate-350"}`}
        >
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Review</span>
            <span className="text-2xl font-black text-amber-500 mt-1 block">{metrics.pending}</span>
          </div>
          <Clock size={28} className="text-amber-500/40" />
        </div>

        <div
          onClick={() => setActiveTab("approved")}
          className={`rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all border ${activeTab === "approved" ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700 shadow-sm" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 hover:border-slate-350"}`}
        >
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Approved Queue</span>
            <span className="text-2xl font-black text-emerald-500 mt-1 block">{metrics.approved}</span>
          </div>
          <UserCheck size={28} className="text-emerald-500/40" />
        </div>

        <div
          onClick={() => setActiveTab("rejected")}
          className={`rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all border ${activeTab === "rejected" ? "bg-rose-50 dark:bg-rose-900/10 border-rose-300 dark:border-rose-700 shadow-sm" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800 hover:border-slate-350"}`}
        >
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rejected Queue</span>
            <span className="text-2xl font-black text-rose-500 mt-1 block">{metrics.rejected}</span>
          </div>
          <UserX size={28} className="text-rose-500/40" />
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-8">
        {tabs.map(({ id, label, icon: Icon, count, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all mr-2 ${activeTab === id
              ? color === "emerald" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : color === "rose" ? "border-rose-500 text-rose-600 dark:text-rose-400"
              : "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            }`}
          >
            <Icon size={14} />
            {label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === id
              ? color === "emerald" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : color === "rose" ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full overflow-hidden">
          {/* Left Queue List */}
          <div className="w-[300px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
            <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              {activeTab === "pending" ? <Clock size={12} /> : activeTab === "approved" ? <UserCheck size={12} /> : <UserX size={12} />}
              {activeTab === "pending" ? "Registration Queue" : activeTab === "approved" ? "Approved Queue" : "Rejected Queue"}
            </h2>

            {dossiersLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                <span className="text-xs">Loading...</span>
              </div>
            ) : currentQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400 space-y-2">
                <ClipboardList size={32} className="opacity-30" />
                <p className="text-xs font-bold uppercase tracking-wider">No Dossiers Available</p>
                <p className="text-[10px] font-semibold opacity-70">
                  {activeTab === "pending" ? "Waiting for registration." : activeTab === "approved" ? "No approved dossiers found." : "No rejected dossiers found."}
                </p>
              </div>
            ) : currentQueue.map((emp) => (
              <div key={emp.id} className={`p-4 rounded-2xl border transition-all ${activeEmployee?.id === emp.id ? (
                activeTab === 'pending' ? 'border-amber-400 dark:border-amber-600 bg-amber-100/50 dark:bg-amber-900/20 shadow-md ring-2 ring-amber-400/20' :
                activeTab === 'approved' ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-100/50 dark:bg-emerald-900/20 shadow-md ring-2 ring-emerald-400/20' :
                'border-rose-400 dark:border-rose-600 bg-rose-100/50 dark:bg-rose-900/20 shadow-md ring-2 ring-rose-400/20'
              ) : (
                activeTab === 'pending' ? 'border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/5 shadow-sm' :
                activeTab === 'approved' ? 'border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/5 shadow-sm' :
                'border-rose-205 dark:border-rose-800/40 bg-rose-50/50 dark:bg-rose-900/5 shadow-sm'
              )}`}>
                <div className="flex justify-between items-start gap-1 mb-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white truncate">{emp.name}</div>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">{emp.id}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{emp.email}</div>
                  </div>
                  <Pill tone={activeTab === 'pending' ? 'warn' : activeTab === 'approved' ? 'good' : 'bad'}>{emp.status}</Pill>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 border-t border-slate-200/60 dark:border-slate-800/30 pt-2 mt-1">
                  <div>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">Submitted</span>
                    {emp.regDate}
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-400 font-bold uppercase">Trust Score</span>
                    <span className="text-emerald-600 font-black">{emp.trustScore}%</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setViewingEmployee(emp)}
                  className={`w-full mt-3 h-9 font-bold border transition-all ${activeEmployee?.id === emp.id ? (
                    activeTab === 'pending' ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600' :
                    activeTab === 'approved' ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600' :
                    'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                  ) : 'bg-white dark:bg-slate-800 border-slate-205 dark:border-slate-800/45'}`}
                >
                  <Eye size={12} className="mr-1.5" /> {activeEmployee?.id === emp.id ? 'Viewing Details' : 'Review Dossier'}
                </Button>
              </div>
            ))}
          </div>

          {/* Right: Dossier Detail */}
          <div className="flex-grow flex flex-col bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
            {activeEmployee ? (
              <>
                <DossierContent emp={activeEmployee} setShowDocModal={setShowDocModal} />
                
                {/* Decision / Status Panel */}
                {activeTab === "pending" && (
                  <div className="absolute bottom-0 inset-x-0 h-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-10 flex items-center justify-between z-20 shrink-0">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-widest font-mono">Final Decision Panel</span>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => setShowApproveConfirm(true)}
                        className="px-6 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                      >
                        <Check size={14} className="mr-2" /> Approve Employee
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setShowRejectForm(true)}
                        className="px-6 h-11 font-bold rounded-xl"
                      >
                        <X size={14} className="mr-2" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {activeTab === "approved" && (
                  <div className="absolute bottom-0 inset-x-0 h-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-10 flex items-center justify-between z-20 shrink-0">
                    <span className="text-xs font-black uppercase text-emerald-600 tracking-widest font-mono">✓ Dossier Approved</span>
                    <span className="text-xs font-bold text-slate-500">This employee registration has been approved. Account invitation details sent.</span>
                  </div>
                )}

                {activeTab === "rejected" && (
                  <div className="absolute bottom-0 inset-x-0 h-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-10 flex items-center justify-between z-20 shrink-0">
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-rose-600 tracking-widest font-mono">✕ Dossier Rejected</span>
                      <span className="text-[10px] font-bold text-slate-500 mt-0.5 font-mono">
                        Category: {activeEmployee.rawDossier?.adminClearance?.reasonCategory || "Failed Verification"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500 italic max-w-md truncate">
                      "{activeEmployee.rawDossier?.adminClearance?.remarks || "No remarks provided"}"
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={36} className="text-slate-300" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">No Dossier Selected</h3>
                  <p className="text-xs text-slate-505 text-slate-500 max-w-sm">
                    Select a dossier from the left list to review and verify their details and credentials.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── DOSSIER REVIEW MODAL ── */}
      {showReviewModal && activeEmployee && createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-900 to-indigo-700 border border-indigo-500/40 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                  {activeEmployee.regForm?.profilePic
                    ? <img src={activeEmployee.regForm.profilePic} alt="Biometric" className="w-full h-full object-cover" />
                    : <User className="text-indigo-300 w-6 h-6" />
                  }
                </div>
                <div>
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest block">Technician Audit Dossier</span>
                  <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">{activeEmployee.name}</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Pill tone="good">Trust: {activeEmployee.trustScore}%</Pill>
                <Pill tone="warn">{activeEmployee.status}</Pill>
                <Button variant="ghost" onClick={() => setShowReviewModal(false)} className="text-xs">
                  <X size={16} className="mr-1" /> Close
                </Button>
              </div>
            </div>
            <DossierContent emp={activeEmployee} inModal setShowDocModal={setShowDocModal} />
          </div>
        </div>,
        document.body
      )}

      {/* ── APPROVE CONFIRM DIALOG ── */}
      {showApproveConfirm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-full flex items-center justify-center mx-auto">
              <UserCheck size={28} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Approve This Employee?</h3>
              <p className="text-xs text-slate-500 mt-2">
                This will create their account in the system and dispatch a secure invitation email with an activation link.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowApproveConfirm(false)} className="flex-1">Cancel</Button>
              <Button onClick={confirmApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                <Check size={14} className="mr-1.5" /> Confirm Approve
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── REJECT FORM ── */}
      {showRejectForm && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="h-14 bg-rose-600 px-6 flex items-center justify-between">
              <h3 className="text-white font-black text-sm flex items-center gap-2"><UserX size={16} /> Reject Registration</h3>
              <button onClick={() => setShowRejectForm(false)} className="text-rose-200 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-2">Rejection Reasons</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["aadhaar", "Aadhaar Mismatch"],
                    ["pan", "PAN Mismatch"],
                    ["blurred", "Blurred Documents"],
                    ["face", "Face Scan Failed"],
                    ["training", "Training Incomplete"],
                    ["fraud", "Fraud Risk"],
                    ["duplicate", "Duplicate"],
                    ["other", "Other"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rejectReasons[key]}
                        onChange={e => setRejectReasons(p => ({ ...p, [key]: e.target.checked }))}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide block mb-2">Rejection Remarks *</label>
                <textarea
                  value={rejectRemarks}
                  onChange={e => setRejectRemarks(e.target.value)}
                  rows={3}
                  placeholder="Provide detailed reason for rejection..."
                  className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/30 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-rose-500 resize-none"
                />
                {rejectError && <p className="text-rose-600 text-xs mt-1 font-semibold">{rejectError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowRejectForm(false)} className="flex-1">Cancel</Button>
                <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                  <X size={14} /> Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ── APPROVED EMPLOYEE DETAIL MODAL ── */}
      {viewingEmployee && (
        <ApprovedEmployeeDetailModal emp={viewingEmployee} onClose={() => setViewingEmployee(null)} />
      )}

      {/* ── DOCUMENT VIEW MODAL ── */}
      {showDocModal && activeEmployee && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDocModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Eye size={18} className="text-indigo-500" /> 
                {showDocModal === "aadhaar" ? "Aadhaar Card" : showDocModal === "pan" ? "PAN Card" : "Driving License"}
              </h3>
              <button onClick={() => setShowDocModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-center">
              {(() => {
                const activeFileKey = showDocModal === "aadhaar" ? "aadhaarFileFileData" : showDocModal === "pan" ? "panFileFileData" : "drivingLicenseFileFileData";
                const activeFileData = activeEmployee?.docForm?.[activeFileKey];
                
                if (activeFileData && activeFileData.startsWith("data:image")) {
                  return (
                    <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-center p-2">
                      <img src={activeFileData} alt="Document" className="w-full h-auto object-contain rounded-lg max-h-[60vh]" />
                    </div>
                  );
                }

                if (activeFileData && activeFileData.startsWith("data:application/pdf")) {
                  return (
                    <div className="w-full max-w-3xl h-[65vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex items-center justify-center p-2">
                      <iframe src={activeFileData} title="Document PDF" className="w-full h-full rounded-lg" />
                    </div>
                  );
                }

                return (
                  <div className="w-full max-w-2xl aspect-[4/3] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center text-slate-400 relative overflow-hidden group">
                     <div className="absolute inset-0 bg-slate-100 dark:bg-slate-800 animate-pulse opacity-50" />
                     <FileText size={64} className="mb-4 text-slate-300 dark:text-slate-700 relative z-10" />
                     <p className="font-bold text-slate-600 dark:text-slate-400 relative z-10 text-center px-4">
                       {showDocModal === "aadhaar" ? activeEmployee.docForm?.aadhaarFile || "aadhaar_scan.pdf" : 
                        showDocModal === "pan" ? activeEmployee.docForm?.panFile || "pan_scan.pdf" : 
                        activeEmployee.docForm?.drivingLicenseFile || "driving_license.pdf"}
                     </p>
                     <p className="text-xs mt-2 text-slate-400 relative z-10 text-center px-4">
                       Document viewer integration is pending actual file storage backend. This is a secure preview placeholder.
                     </p>
                  </div>
                );
              })()}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 shrink-0">
              <Button variant="ghost" onClick={() => setShowDocModal(null)}>Close</Button>
              <button onClick={() => setShowDocModal(null)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-colors">
                Download Copy
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Dossier Review Content (reusable component) ──────────────────────────
export function DossierContent({ emp, inModal = false, setShowDocModal = () => {} }) {
  if (!emp) return null
  return (
    <div className={`flex-1 overflow-y-auto pb-32 space-y-5 ${inModal ? "p-4" : "p-6"}`}>

      {/* Header info */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-900 to-indigo-700 border-2 border-indigo-500/40 overflow-hidden flex items-center justify-center shrink-0">
            {emp.regForm?.profilePic
              ? <img src={emp.regForm.profilePic} alt="Biometric" className="w-full h-full object-cover" />
              : <User className="text-indigo-300 w-6 h-6" />
            }
          </div>
          <div>
            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Active Dossier Audit</span>
            <h2 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{emp.name}</h2>
            <span className="text-[10px] text-slate-400 font-mono">{emp.id} • Submitted {emp.regDate || "—"}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Pill tone="good">Trust Score: {emp.trustScore || 100}%</Pill>
          <Pill tone={emp.status === "Invitation Sent" || emp.status === "Activated" || emp.status === "Active" ? "good" : emp.status === "Rejected" ? "bad" : "warn"}>
            {emp.status}
          </Pill>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-indigo-500">1️⃣</span> Personal Information
          </h3>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">✓ VERIFIED</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold">
          {[
            ["Full Name", emp.name],
            ["Phone Number", emp.phone],
            ["Email Address", emp.email],
            ["Current Location", emp.location || emp.country],
            ["Registration Date", emp.regDate || "—"],
            ["Employee ID", emp.id],
          ].map(([lbl, val]) => (
            <div key={lbl}>
              <span className="block text-[8px] text-slate-400 font-bold uppercase mb-1">{lbl}</span>
              <span className="text-slate-800 dark:text-slate-200">{val || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Registration Verification */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-indigo-500">2️⃣</span> Registration Verification
          </h3>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">✓ VERIFIED</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Phone OTP", emp.regForm?.otpStatus === "verified" || emp.status === "Active"],
            ["Face Scan", emp.regForm?.isBiometricCompleted || emp.status === "Active"],
            ["Registration", emp.regForm?.isCompleted || emp.status === "Active"],
          ].map(([lbl, done]) => (
            <div key={lbl} className={`flex items-center gap-3 p-3 rounded-xl border ${done ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"}`}>
              <CheckCircle2 size={15} className={done ? "text-emerald-600 shrink-0" : "text-slate-400 shrink-0"} />
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{lbl}</div>
                <div className={`text-[10px] font-bold ${done ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>{done ? "Verified" : "Pending"}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Score */}
        <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Trust Score</span>
            <span className="text-sm font-black text-emerald-600">{emp.trustScore || 100}%</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-700" style={{ width: `${emp.trustScore || 100}%` }} />
          </div>
        </div>
      </div>

      {/* Identity Documents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-indigo-500">3️⃣</span> Identity Documents
          </h3>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">✓ VERIFIED</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Aadhaar Card", key: "aadhaar", fileKey: "aadhaarFile" },
            { label: "PAN Card", key: "pan", fileKey: "panFile" },
            { label: "Driving License", key: "license", fileKey: "drivingLicenseFile" },
          ].map(({ label, key, fileKey }) => (
            <div key={key} className="p-3 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col justify-between h-24 bg-slate-50 dark:bg-slate-950/20">
              <div>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">{label}</span>
                <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 mt-1 block truncate">
                  {emp.docForm?.[fileKey] || `${key}_scan.pdf`}
                </span>
              </div>
              <button
                onClick={() => setShowDocModal(key)}
                className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:text-indigo-700 mt-1"
              >
                <Eye size={10} /> View
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Training & Interview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <span className="text-indigo-500">4️⃣</span> Training &amp; Interview
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-xl border ${emp.academyState?.isCompleted || emp.status === "Active" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200"}`}>
            <span className="text-[8px] font-black text-slate-400 uppercase block">Training Academy</span>
            <span className={`text-xs font-bold ${emp.academyState?.isCompleted || emp.status === "Active" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
              {emp.academyState?.isCompleted || emp.status === "Active" ? "✓ Completed (100%)" : "Pending"}
            </span>
          </div>
          <div className={`p-3 rounded-xl border ${emp.interviewState?.isCompleted || emp.status === "Active" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-950/30 border-slate-200"}`}>
            <span className="text-[8px] font-black text-slate-400 uppercase block">Interview / Compliance</span>
            <span className={`text-xs font-bold ${emp.interviewState?.isCompleted || emp.status === "Active" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500"}`}>
              {emp.interviewState?.isCompleted || emp.status === "Active" ? "✓ Passed" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Email Telemetry (post-approval) */}
      {emp.adminClearance?.invitationToken && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <span className="text-indigo-500">5️⃣</span> Email &amp; Invitation Telemetry
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="block text-[8px] text-slate-400 font-bold uppercase">Recipient</span>
              <span className="text-slate-800 dark:text-slate-200 text-xs font-semibold truncate block">{emp.email}</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
              <span className="block text-[8px] text-slate-400 font-bold uppercase">Status</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {emp.adminClearance?.invitationEmailStatus || "Delivered"}
              </span>
            </div>
            <div className="col-span-2 p-3 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[8px] text-indigo-500 font-black uppercase block">Activation URL</span>
                  <span className="text-[9px] font-mono text-slate-700 dark:text-slate-300 truncate block max-w-xs">
                    {`${window.location.origin}/create-password?token=${emp.adminClearance.invitationToken}`}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/create-password?token=${emp.adminClearance.invitationToken}`)
                    alert("Activation Link copied!")
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-bold shrink-0 ml-2"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Timeline */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-sm">
        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-3 border-b border-slate-100 dark:border-slate-800/80">
          <Clock className="text-indigo-600" size={14} /> Audit Timeline
        </h3>
        <div className="space-y-3 font-mono text-[10px] text-slate-500 dark:text-slate-400 pl-4 border-l border-indigo-500/20">
          {emp.adminClearance?.auditLogs?.length > 0 ? (
            emp.adminClearance.auditLogs.map((log, idx) => (
              <div key={idx} className="relative">
                <div className="absolute left-[-21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <span className="text-slate-900 dark:text-white font-bold mr-2">{log.timestamp}</span>
                <span className="text-indigo-500 font-bold mr-2">[{log.action}]</span>
                <span className="text-slate-600 dark:text-slate-300">{log.details}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-400 text-[10px]">No audit logs yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}
