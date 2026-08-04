import React, { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ShieldAlert, RefreshCw, Filter, MessageSquare, AlertTriangle, CheckCircle, Search, User,
  Calendar, X, AlertCircle, Phone, FileText, Send, ChevronRight, Activity, CornerDownRight,
  CheckCircle2, DollarSign, UserCheck, Clock, AlertOctagon, HelpCircle
} from "lucide-react"
import { apiRequest } from "../../api/client.js"

/* ─── Toast Notification Component ─────────────────────────────────────── */
function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  const icons = {
    success: <CheckCircle2 size={15} />,
    error: <X size={15} />,
    warn: <AlertTriangle size={15} />,
    info: <AlertCircle size={15} />
  }
  return (
    <div className="fixed bottom-5 right-5 z-[200] flex items-center gap-2.5 px-4 py-3 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
      <span className={type === "error" ? "text-rose-400" : type === "warn" ? "text-amber-400" : "text-emerald-400"}>
        {icons[type] || icons.info}
      </span>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 text-slate-400 hover:text-white"><X size={13} /></button>
    </div>
  )
}

/* ─── Helper Formatting Maps ────────────────────────────────────────────── */
const CATEGORY_MAP = {
  BILLING: { label: "Billing & Charges", emoji: "💳", color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" },
  SERVICE_QUALITY: { label: "Service Quality", emoji: "⭐", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  TECHNICIAN_BEHAVIOR: { label: "Technician Behavior", emoji: "👨‍🔧", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
  DELAY: { label: "Delay / Late Arrival", emoji: "⏰", color: "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
  DAMAGE: { label: "Property Damage", emoji: "📦", color: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
  OTHER: { label: "General Issue", emoji: "❓", color: "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
}

const STATUS_MAP = {
  OPEN: { label: "Open", color: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  ASSIGNED: { label: "Assigned", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
  UNDER_INVESTIGATION: { label: "Under Investigation", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  WAITING_CUSTOMER: { label: "Waiting Customer", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  WAITING_TECHNICIAN: { label: "Waiting Tech", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  ESCALATED: { label: "Escalated", color: "bg-red-600/10 text-red-700 border-red-600/30" },
  RESOLVED: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  CLOSED: { label: "Closed", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
}

const PRIORITY_MAP = {
  CRITICAL: { label: "Critical", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  HIGH: { label: "High", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  MEDIUM: { label: "Medium", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  LOW: { label: "Low", color: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
}

export function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  
  // Search & Filters
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [category, setCategory] = useState("")
  
  // Modal state
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("details") // details, thread, actions

  // Action states
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [assignEmployee, setAssignEmployee] = useState("")
  const [assignPriority, setAssignPriority] = useState("")
  const [resolutionType, setResolutionType] = useState("COMPLAINT_VALID")
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [refundAmount, setRefundAmount] = useState("")

  const showToast = (msg, type = "success") => setToast({ msg, type, id: Date.now() })

  const loadComplaints = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.append("status", status)
      if (priority) params.append("priority", priority)
      if (category) params.append("category", category)

      const res = await apiRequest(`/admin/complaints/?${params.toString()}`)
      if (res?.success) {
        setComplaints(Array.isArray(res.data) ? res.data : [])
      } else {
        setError(res?.message || "Failed to fetch complaints.")
      }
    } catch (err) {
      setError("Failed to load complaints from server.")
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    try {
      const res = await apiRequest("/admin/service-requests/employees/")
      if (res?.success) setEmployees(res.data)
    } catch (err) {}
  }

  useEffect(() => {
    loadEmployees()
  }, [])

  useEffect(() => {
    loadComplaints()
  }, [status, priority, category])

  const openComplaint = async (id) => {
    setDetailLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${id}/`)
      if (res?.success) {
        setSelectedComplaint(res.data)
        setAssignEmployee(res.data.assigned_employee?.id || "")
        setAssignPriority(res.data.priority || "MEDIUM")
      } else {
        showToast(res?.message || "Failed to load complaint detail.", "error")
      }
    } catch (err) {
      showToast("Error loading complaint details.", "error")
    } finally {
      setDetailLoading(false)
    }
  }

  const closeComplaintModal = () => {
    setSelectedComplaint(null)
    setActiveTab("details")
    setMessage("")
    setResolutionNotes("")
    setRefundAmount("")
  }

  const refreshComplaint = async () => {
    if (selectedComplaint) {
      await openComplaint(selectedComplaint.id)
    }
    await loadComplaints()
  }

  // Client side search filtering
  const filteredComplaints = useMemo(() => {
    let list = complaints
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.complaint_number?.toLowerCase().includes(q) ||
        c.customer_name?.toLowerCase().includes(q) ||
        c.customer_phone?.toLowerCase().includes(q) ||
        c.booking_request_id?.toLowerCase().includes(q) ||
        c.category_display?.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q)
      )
    }
    return list
  }, [complaints, search])

  // Actions
  const handleAssign = async () => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/assign/`, {
        method: "POST",
        json: { employee_id: assignEmployee, priority: assignPriority }
      })
      if (res?.success) {
        showToast("Technician & Priority updated successfully!", "success")
        await refreshComplaint()
      } else {
        showToast(res?.message || "Assignment failed.", "error")
      }
    } catch (err) {
      showToast("Assignment failed.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleStatusUpdate = async (action) => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/status/`, {
        method: "POST",
        json: { action, message, notes: message }
      })
      if (res?.success) {
        showToast(`Workflow status updated to ${action.replace(/_/g, " ")}.`, "success")
        setMessage("")
        await refreshComplaint()
      } else {
        showToast(res?.message || "Status update failed.", "error")
      }
    } catch (err) {
      showToast("Status update error.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/response/`, {
        method: "POST",
        json: { message }
      })
      if (res?.success) {
        showToast("Message sent!", "success")
        setMessage("")
        await refreshComplaint()
      } else {
        showToast(res?.message || "Message send failed.", "error")
      }
    } catch (err) {
      showToast("Message send failed.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolve = async () => {
    setActionLoading(true)
    try {
      const payload = {
        resolution_type: resolutionType,
        resolution_notes: resolutionNotes
      }
      if (refundAmount) payload.refund_amount = parseFloat(refundAmount)

      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/resolve/`, {
        method: "POST",
        json: payload
      })
      if (res?.success) {
        showToast("Complaint resolved successfully!", "success")
        await refreshComplaint()
      } else {
        showToast(res?.message || "Resolution failed.", "error")
      }
    } catch (err) {
      showToast(err?.body?.message || "Failed to resolve complaint.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const getPriorityBadge = (pri) => {
    const meta = PRIORITY_MAP[pri] || { label: pri, color: "bg-slate-100 text-slate-700 border-slate-200" }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
        {meta.label}
      </span>
    )
  }

  const getStatusBadge = (stat) => {
    const meta = STATUS_MAP[stat] || { label: stat, color: "bg-slate-100 text-slate-700 border-slate-200" }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
        {meta.label}
      </span>
    )
  }

  const getCategoryInfo = (cat) => {
    return CATEGORY_MAP[cat] || { label: cat || "General", emoji: "📌", color: "bg-slate-100 text-slate-700 border-slate-200" }
  }

  const metrics = useMemo(() => {
    return {
      total: complaints.length,
      open: complaints.filter(c => c.status === "OPEN").length,
      investigating: complaints.filter(c => ["ASSIGNED", "UNDER_INVESTIGATION", "WAITING_CUSTOMER", "WAITING_TECHNICIAN"].includes(c.status)).length,
      critical: complaints.filter(c => c.priority === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(c.status)).length,
      resolved: complaints.filter(c => ["RESOLVED", "CLOSED"].includes(c.status)).length
    }
  }, [complaints])

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 min-h-screen">
      {toast && <Toast message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight flex items-center gap-2">
            <ShieldAlert className="text-rose-600 dark:text-rose-400" size={26} />
            Customer Complaints Center
          </h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Manage, investigate, and resolve customer complaints, dispute claims, and escalations.
          </p>
        </div>
        <button
          onClick={loadComplaints}
          className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Center
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Complaints</span>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.total}</h2>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm">
          <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">New / Open</span>
          <h2 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{metrics.open}</h2>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm">
          <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Investigating</span>
          <h2 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{metrics.investigating}</h2>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm">
          <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Critical Priority</span>
          <h2 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{metrics.critical}</h2>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl relative overflow-hidden shadow-sm col-span-2 md:col-span-1">
          <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Resolved / Closed</span>
          <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{metrics.resolved}</h2>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search complaint ID, customer, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center gap-1 text-slate-400 text-xs font-bold mr-1">
            <Filter size={14} /> Filter:
          </div>

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="WAITING_CUSTOMER">Waiting Customer</option>
            <option value="WAITING_TECHNICIAN">Waiting Technician</option>
            <option value="ESCALATED">Escalated</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="BILLING">Billing & Charges</option>
            <option value="SERVICE_QUALITY">Service Quality</option>
            <option value="TECHNICIAN_BEHAVIOR">Technician Behavior</option>
            <option value="DELAY">Delay / Late Arrival</option>
            <option value="DAMAGE">Property Damage</option>
            <option value="OTHER">General Issue</option>
          </select>
        </div>
      </div>

      {/* Complaints List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium text-sm flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={16} /> Loading complaint tickets...
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldAlert className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={42} />
            <h3 className="font-bold text-slate-700 dark:text-slate-300">No complaint records found</h3>
            <p className="text-xs text-slate-400 mt-1">Try clearing your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Complaint ID</th>
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Customer</th>
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Priority</th>
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                  <th className="py-3.5 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Created</th>
                  <th className="py-3.5 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredComplaints.map(c => {
                  const catInfo = getCategoryInfo(c.category)

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => openComplaint(c.id)}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-xs font-mono text-slate-900 dark:text-white block">{c.complaint_number}</span>
                        {c.booking_request_id && (
                          <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5 block">
                            {c.booking_request_id}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">{c.customer_name}</span>
                        {c.customer_phone && <span className="text-[10px] text-slate-400 block mt-0.5">📞 {c.customer_phone}</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${catInfo.color}`}>
                          <span>{catInfo.emoji}</span>
                          <span>{catInfo.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getPriorityBadge(c.priority)}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(c.status)}
                      </td>
                      <td className="py-3.5 px-4 text-[11px] font-medium text-slate-500">
                        {c.created_at ? new Date(c.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-300 transition-colors shadow-sm ml-auto">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Complaint Detail Modal */}
      <AnimatePresence>
        {selectedComplaint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={closeComplaintModal}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      Ticket #{selectedComplaint.complaint_number}
                    </h2>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {getCategoryInfo(selectedComplaint.category).label} &bull; {selectedComplaint.customer_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeComplaintModal}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs Header */}
              <div className="flex px-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                    activeTab === "details"
                      ? "border-rose-600 text-rose-600 dark:text-rose-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Details & Context
                </button>
                <button
                  onClick={() => setActiveTab("thread")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                    activeTab === "thread"
                      ? "border-rose-600 text-rose-600 dark:text-rose-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Message Thread
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                    {selectedComplaint.messages?.length || 0}
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab("actions")}
                  className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                    activeTab === "actions"
                      ? "border-rose-600 text-rose-600 dark:text-rose-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  Actions & Resolution
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/40">
                {detailLoading ? (
                  <div className="py-12 text-center text-slate-400 text-sm font-semibold flex items-center justify-center gap-2">
                    <RefreshCw className="animate-spin" size={16} /> Loading complaint dossier...
                  </div>
                ) : (
                  <>
                    {/* DETAILS TAB */}
                    {activeTab === "details" && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Current Status</span>
                            <div className="mt-1">{getStatusBadge(selectedComplaint.status)}</div>
                          </div>
                          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Priority</span>
                            <div className="mt-1">{getPriorityBadge(selectedComplaint.priority)}</div>
                          </div>
                          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Booking Reference</span>
                            <div className="font-bold text-xs font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                              {selectedComplaint.booking_request_id || "Direct File"}
                            </div>
                          </div>
                          <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400 block">Risk Score</span>
                            <div className="font-extrabold text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                              <span>{selectedComplaint.risk_score ? `${selectedComplaint.risk_score} / 100` : "Low Risk"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Description */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Customer Complaint Details</h3>
                          <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {selectedComplaint.description || "No description provided."}
                          </p>
                        </div>
                        
                        {/* Attachments */}
                        {selectedComplaint.attachments?.length > 0 && (
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Evidence Attachments</h3>
                            <div className="flex gap-2 flex-wrap">
                              {selectedComplaint.attachments.map(att => (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:border-indigo-500 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View File #{att.id}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Customer & Assignment Breakdown */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Customer Information</h3>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Name</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.customer_name}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Phone</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.customer_phone || "—"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Personnel Assignments</h3>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Assigned Admin</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{selectedComplaint.assigned_admin?.name || "Unassigned"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Assigned Technician</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedComplaint.assigned_employee?.name || "Unassigned"}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* THREAD TAB */}
                    {activeTab === "thread" && (
                      <div className="flex flex-col h-[420px]">
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {(!selectedComplaint.messages || selectedComplaint.messages.length === 0) ? (
                            <div className="text-center text-slate-400 py-12 text-xs font-medium">No messaging history recorded for this ticket.</div>
                          ) : (
                            selectedComplaint.messages.map(msg => {
                              const isAdmin = msg.persona === "ADMIN"
                              const isCustomer = msg.persona === "CUSTOMER"

                              return (
                                <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-sm ${
                                    isAdmin
                                      ? "bg-indigo-600 text-white rounded-br-none"
                                      : isCustomer
                                      ? "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none"
                                      : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 rounded-bl-none"
                                  }`}>
                                    <div className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1 flex justify-between gap-4">
                                      <span>{msg.sender || "User"} ({msg.persona})</span>
                                      <span>{msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex gap-2">
                            <textarea
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              placeholder="Type official response or update..."
                              className="flex-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-11"
                            />
                            <button
                              onClick={handleSendMessage}
                              disabled={actionLoading || !message.trim()}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACTIONS TAB */}
                    {activeTab === "actions" && (
                      <div className="space-y-5">
                        {/* Assignment & Priority */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                            Technician Assignment & Priority
                          </h3>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400">Assigned Technician</label>
                              <select
                                value={assignEmployee}
                                onChange={e => setAssignEmployee(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-700 dark:text-slate-300"
                              >
                                <option value="">-- Unassigned --</option>
                                {employees.map(e => (
                                  <option key={e.id} value={e.id}>{e.full_name} ({e.title || "Technician"})</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400">Ticket Priority</label>
                              <select
                                value={assignPriority}
                                onChange={e => setAssignPriority(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 text-xs font-bold text-slate-700 dark:text-slate-300"
                              >
                                <option value="CRITICAL">Critical Priority</option>
                                <option value="HIGH">High Priority</option>
                                <option value="MEDIUM">Medium Priority</option>
                                <option value="LOW">Low Priority</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={handleAssign}
                                disabled={actionLoading}
                                className="bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs py-2 px-4 rounded-xl w-full sm:w-auto h-9"
                              >
                                Update Ticket
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Status Actions */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                            Workflow Actions
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleStatusUpdate("start_investigation")}
                              disabled={actionLoading}
                              className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-xs py-2 px-3 rounded-xl"
                            >
                              Start Investigation
                            </button>
                            <button
                              onClick={() => handleStatusUpdate("escalate")}
                              disabled={actionLoading}
                              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs py-2 px-3 rounded-xl"
                            >
                              Escalate Ticket
                            </button>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Request Context Message</label>
                            <textarea
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              placeholder="Message explanation for requesting information..."
                              className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-14"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStatusUpdate("request_customer_info")}
                                disabled={actionLoading || !message.trim()}
                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold text-xs py-1.5 px-3 rounded-xl disabled:opacity-50"
                              >
                                Ask Customer for Info
                              </button>
                              <button
                                onClick={() => handleStatusUpdate("request_technician_info")}
                                disabled={actionLoading || !message.trim()}
                                className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-xs py-1.5 px-3 rounded-xl disabled:opacity-50"
                              >
                                Ask Technician for Info
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Resolution */}
                        {selectedComplaint.status !== "RESOLVED" && selectedComplaint.status !== "CLOSED" && (
                          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 mb-3 border-b border-emerald-200/60 dark:border-emerald-800 pb-2 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" /> Final Ticket Resolution
                            </h3>
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Resolution Finding</label>
                                  <select
                                    value={resolutionType}
                                    onChange={e => setResolutionType(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                                  >
                                    <option value="COMPLAINT_VALID">Complaint Valid</option>
                                    <option value="COMPLAINT_INVALID">Complaint Invalid</option>
                                    <option value="CUSTOMER_ERROR">Customer Error</option>
                                    <option value="TECHNICIAN_ERROR">Technician Error</option>
                                    <option value="COMPANY_ERROR">Company Error</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Optional Refund Amount (₹)</label>
                                  <input
                                    type="number"
                                    placeholder="0"
                                    value={refundAmount}
                                    onChange={e => setRefundAmount(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2 text-xs font-bold text-slate-700 dark:text-slate-200"
                                  />
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Resolution Notes</label>
                                <textarea
                                  value={resolutionNotes}
                                  onChange={e => setResolutionNotes(e.target.value)}
                                  placeholder="Document the resolution steps taken and final customer outcome..."
                                  className="w-full border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none h-16 bg-white dark:bg-slate-900"
                                />
                              </div>

                              <button
                                onClick={handleResolve}
                                disabled={actionLoading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl w-full shadow-sm flex items-center justify-center gap-2"
                              >
                                <CheckCircle size={15} />
                                Resolve & Close Ticket
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
