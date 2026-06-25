import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Filter, Wrench, ShieldAlert, AlertCircle, Clock, CheckCircle2, User, Phone, Mail, MapPin, Calendar, FileText, ArrowRight, CornerDownLeft, Eye, RefreshCw, Star, HelpCircle } from "lucide-react"
import { apiRequest } from "../../api/client.js"

const STATUS_BADGES = {
  new_request: { bg: "bg-blue-500/10 text-blue-400 border-blue-500/20", name: "New Request" },
  reviewed: { bg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", name: "Reviewed" },
  assigned: { bg: "bg-purple-500/10 text-purple-400 border-purple-500/20", name: "Assigned" },
  accepted: { bg: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", name: "Accepted" },
  in_progress: { bg: "bg-orange-500/10 text-orange-400 border-orange-500/20", name: "In Progress" },
  completed: { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", name: "Completed" },
  awaiting_verification: { bg: "bg-teal-500/10 text-teal-400 border-teal-500/20", name: "Awaiting Verification" },
  verified: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", name: "Verified" },
  feedback_pending: { bg: "bg-slate-500/10 text-slate-400 border-slate-500/20", name: "Feedback Pending" },
  feedback_received: { bg: "bg-pink-500/10 text-pink-400 border-pink-500/20", name: "Feedback Received" },
  closed: { bg: "bg-slate-700/20 text-slate-400 border-slate-700/30", name: "Closed" },
  rejected: { bg: "bg-rose-500/10 text-rose-400 border-rose-500/20", name: "Rejected" },
  rework_requested: { bg: "bg-red-500/10 text-red-400 border-red-500/20", name: "Rework Requested" },
}

const PRIORITY_BADGES = {
  low: { bg: "bg-slate-500/10 text-slate-400", name: "Low" },
  normal: { bg: "bg-blue-500/10 text-blue-400", name: "Normal" },
  high: { bg: "bg-orange-500/10 text-orange-400", name: "High" },
  urgent: { bg: "bg-rose-500/10 text-rose-400 border-rose-500/25", name: "Urgent" },
}

export function ServiceRequestsPage() {
  const [requests, setRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionSuccess, setActionSuccess] = useState(null)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("")
  const [assigneeId, setAssigneeId] = useState("")

  // Load request list
  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (statusFilter) params.append("status", statusFilter)
      if (priorityFilter) params.append("priority", priorityFilter)

      const response = await apiRequest(`/admin/service-requests/?${params.toString()}`)
      if (response?.success) {
        setRequests(Array.isArray(response.data) ? response.data : [])
      } else {
        setError(response?.message || "Failed to load requests.")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to fetch service requests from server.")
    } finally {
      setLoading(false)
    }
  }

  // Load initial lists
  useEffect(() => {
    loadRequests()
    // Fetch technicians list for assignee picker
    apiRequest("/admin/service-requests/employees/")
      .then((res) => {
        if (res?.success) setEmployees(res.data)
      })
      .catch((err) => console.error("Error loading technicians:", err))
  }, [search, statusFilter, priorityFilter])

  // Load detail panel when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    let active = true
    setDetailLoading(true)
    setActionSuccess(null)
    apiRequest(`/admin/service-requests/${selectedId}/`)
      .then((res) => {
        if (!active) return
        if (res?.success) setDetail(res.data)
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (active) setDetailLoading(false)
      })
    return () => {
      active = false
    }
  }, [selectedId])

  const handleAction = async (endpoint, method = "PATCH", payload = {}) => {
    setActionLoading(true)
    setActionSuccess(null)
    try {
      const response = await apiRequest(`/admin/service-requests/${selectedId}/${endpoint}`, {
        method,
        json: payload,
      })
      if (response?.success) {
        setActionSuccess(response.message || "Operation completed successfully.")
        // Refresh details & list
        const detailRes = await apiRequest(`/admin/service-requests/${selectedId}/`)
        if (detailRes?.success) setDetail(detailRes.data)
        const listRes = await apiRequest("/admin/service-requests/")
        if (listRes?.success) setRequests(Array.isArray(listRes.data) ? listRes.data : [])
      } else {
        alert(response?.message || "Operation failed.")
      }
    } catch (err) {
      console.error(err)
      alert(err?.body?.message || err?.body?.detail || "An error occurred.")
    } finally {
      setActionLoading(false)
    }
  }

  const handlePriorityChange = async (newPriority) => {
    if (!selectedId) return
    setActionLoading(true)
    try {
      const response = await apiRequest(`/admin/service-requests/${selectedId}/priority/`, {
        method: "PATCH",
        json: { priority: newPriority },
      })
      if (response?.success) {
        setActionSuccess("Priority updated successfully.")
        // Refresh details & list
        const detailRes = await apiRequest(`/admin/service-requests/${selectedId}/`)
        if (detailRes?.success) setDetail(detailRes.data)
        const listRes = await apiRequest("/admin/service-requests/")
        if (listRes?.success) setRequests(Array.isArray(listRes.data) ? listRes.data : [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* Left side: List pane */}
      <div className="w-full md:w-5/12 lg:w-4/12 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-white dark:bg-slate-900/20">
        
        {/* Filters Panel */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search ID, customer, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-1/2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Statuses</option>
              {Object.keys(STATUS_BADGES).map((k) => (
                <option key={k} value={k}>{STATUS_BADGES[k].name}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-1/2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-[11px] font-semibold text-slate-600 dark:text-slate-400 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">All Priorities</option>
              {Object.keys(PRIORITY_BADGES).map((k) => (
                <option key={k} value={k}>{PRIORITY_BADGES[k].name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Master List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 custom-scrollbar">
          {loading && (!Array.isArray(requests) || requests.length === 0) ? (
            <div className="flex flex-col items-center justify-center p-8 gap-3 text-slate-400 dark:text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-widest">Loading Requests...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-500/80 mx-auto" />
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{error}</div>
            </div>
          ) : (!Array.isArray(requests) || requests.length === 0) ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider">
              No matching service requests found.
            </div>
          ) : (
            requests.map((r) => {
              const isSelected = r.id === selectedId
              const statusInfo = STATUS_BADGES[r.status] || { bg: "bg-slate-800", name: r.status }
              const priorityInfo = PRIORITY_BADGES[r.priority] || { bg: "bg-slate-800", name: r.priority }
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left p-4 transition-all flex flex-col gap-2.5 border-l-2 ${
                    isSelected ? "bg-indigo-50/50 dark:bg-slate-900/60 border-l-indigo-500" : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/20"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{r.request_id}</span>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">{new Date(r.created_at).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 leading-snug line-clamp-1">{r.issue_title}</h4>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{r.customer_name} • {r.phone}</p>
                  </div>
                  <div className="flex items-center justify-between w-full mt-1">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border capitalize ${statusInfo.bg}`}>
                      {statusInfo.name}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded capitalize ${priorityInfo.bg}`}>
                      {priorityInfo.name}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right side: Detail pane */}
      <div className="flex-1 h-full overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          {detailLoading ? (
            <motion.div
              key="detail-loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col items-center justify-center gap-3 text-slate-400 dark:text-slate-500"
            >
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="text-xs font-black uppercase tracking-widest">Fetching request details...</span>
            </motion.div>
          ) : !detail ? (
            <motion.div
              key="no-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600">
                <Wrench className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Select a Service Request</h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  Choose a ticket from the left panel to review job workflow progress, proofs, feedback, and action options.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="detail-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              
              {/* Header details block */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{detail.request_id}</span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border capitalize ${STATUS_BADGES[detail.status]?.bg}`}>
                      {STATUS_BADGES[detail.status]?.name}
                    </span>
                  </div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1 leading-snug">{detail.issue_title}</h2>
                </div>
                
                {/* Priority Selector dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Priority:</span>
                  <select
                    value={detail.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    disabled={actionLoading}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {actionSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3 text-emerald-600 dark:text-emerald-400 text-sm">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {/* Grid sections for detailed booking info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Customer and Location Pane */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Customer Information</h3>
                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div>
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-300">{detail.customer_name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">Contact Person</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div>
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-300">{detail.phone}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">Mobile Phone</div>
                        </div>
                      </div>
                      {detail.email && (
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                          <div>
                            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-300">{detail.email}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500">Email Address</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-extrabold text-slate-800 dark:text-slate-300 leading-relaxed">{detail.address}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">Service Location</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Service Booking Info</h3>
                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-semibold">Category</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold capitalize">{detail.service_category?.replace("_", " ")}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-semibold">Scheduled Date</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold">{detail.preferred_date}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-semibold">Created At</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold">{new Date(detail.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Description & Technical details */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Description of Issue</h3>
                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {detail.description}
                      </p>
                      {detail.photo && (
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-2">Customer Attached Photo</span>
                          <a href={detail.photo} target="_blank" rel="noreferrer" className="inline-block relative w-32 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
                            <img src={detail.photo} alt="Issue Attachment" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye className="w-4 h-4 text-white" />
                            </div>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assigned Technician details */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Technician Assignment</h3>
                    <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                      {detail.assigned_employee ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                              {detail.assigned_employee.full_name?.charAt(0) || "T"}
                            </div>
                            <div>
                              <div className="text-xs font-extrabold text-slate-800 dark:text-slate-300">{detail.assigned_employee.full_name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">{detail.assigned_employee.title || "Field Technician"}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950">
                            ID: {detail.assigned_employee.employee_id}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 text-center py-2 italic flex items-center justify-center gap-2">
                          <HelpCircle className="w-4 h-4" />
                          No Technician Assigned Yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Completion details & proofs (Awaiting verification or later) */}
              {detail.employee_job && detail.employee_job.proofs?.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Technician Work Verification Proofs</h3>
                  <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                    {detail.employee_job.notes && (
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 italic leading-relaxed">
                        &ldquo;{detail.employee_job.notes}&rdquo;
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {detail.employee_job.proofs.map((proof, idx) => (
                        <div key={proof.id || idx} className="space-y-1.5">
                          {proof.photo ? (
                            <a href={proof.photo} target="_blank" rel="noreferrer" className="block relative h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 group">
                              <img src={proof.photo} alt="Completion Proof" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </a>
                          ) : (
                            <a href={proof.document} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center h-24 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors text-slate-500 dark:text-slate-400 gap-1.5">
                              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-[9px] font-black uppercase tracking-wider">Document</span>
                            </a>
                          )}
                          {proof.note && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold block leading-snug line-clamp-1">{proof.note}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Feedback (Feedback received or Closed) */}
              {detail.feedback && detail.feedback.is_submitted && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Customer Feedback Report</h3>
                  <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block uppercase tracking-wider">Overall Rating</span>
                        <div className="flex items-center gap-1 mt-1 justify-center">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-2xl font-black text-slate-800 dark:text-white">{detail.feedback.rating}</span>
                        </div>
                      </div>
                      <div className="border-l border-slate-200 dark:border-slate-800 pl-6 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                        <div className="text-slate-500 dark:text-slate-400 font-semibold">
                          Technician Behavior: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold capitalize">{detail.feedback.employee_behaviour}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-semibold">
                          Work Quality: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold capitalize">{detail.feedback.work_quality}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-semibold">
                          Problem Resolved: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{detail.feedback.issue_resolved ? "Yes" : "No"}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-semibold">
                          Submitted On: <span className="text-slate-700 dark:text-slate-300 font-bold">{new Date(detail.feedback.submitted_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    {detail.feedback.comment && (
                      <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl p-3 border border-slate-200 dark:border-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                        &ldquo;{detail.feedback.comment}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons Panel matching the State Machine transitions */}
              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Workflows Operations</h3>
                
                <div className="flex flex-wrap gap-3">
                  
                  {/* Workflow: New Request → Reviewed OR Rejected */}
                  {detail.status === "new_request" && (
                    <>
                      <button
                        onClick={() => handleAction("review/")}
                        disabled={actionLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Mark as Reviewed
                      </button>
                      <button
                        onClick={() => handleAction("reject/")}
                        disabled={actionLoading}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Reject Request
                      </button>
                    </>
                  )}

                  {/* Workflow: Reviewed → Assigned (Technician assignment guidance) */}
                  {detail.status === "reviewed" && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 border border-indigo-200 dark:border-indigo-500/25 rounded-2xl w-full">
                      <div className="space-y-1 flex-1">
                        <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Service Booking Reviewed</div>
                        <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                          Please go to the <strong className="text-slate-900 dark:text-white">Jobs</strong> tab to manually create a work order and assign a technician for this reviewed service request.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workflow: Awaiting Verification → Verified & Feedback Pending OR Rework Requested */}
                  {detail.status === "awaiting_verification" && (
                    <>
                      <button
                        onClick={() => handleAction("verify/")}
                        disabled={actionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        Verify & Send Feedback Link
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleAction("request-rework/")}
                        disabled={actionLoading}
                        className="bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <CornerDownLeft className="w-3.5 h-3.5" />
                        Request Rework
                      </button>
                    </>
                  )}

                  {/* Workflow: Feedback Received → Closed */}
                  {detail.status === "feedback_received" && (
                    <button
                      onClick={() => handleAction("close/")}
                      disabled={actionLoading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3 px-5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      Close Service Request
                    </button>
                  )}

                  {/* Showing feedback token link if request is active and feedback is not yet submitted */}
                  {!["closed", "rejected", "feedback_received"].includes(detail.status) && (
                    <div className="flex flex-col gap-4 w-full">
                      {detail.feedback && (
                        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl space-y-2 w-full text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block">Customer Feedback URL (Token active)</span>
                          <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono select-all flex-1 truncate">
                              {`${window.location.origin}/feedback/${detail.feedback.feedback_token}`}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/feedback/${detail.feedback.feedback_token}`)
                                alert("Copied to clipboard!")
                              }}
                              className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => handleAction("resend-feedback/", "POST")}
                        disabled={actionLoading}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider py-3.5 px-6 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 w-full sm:w-auto"
                      >
                        <Mail size={14} />
                        {detail.feedback ? "Resend Feedback Email" : "Send Feedback Email"}
                      </button>
                    </div>
                  )}

                  {/* Closed state */}
                  {detail.status === "closed" && (
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 italic py-2">
                      This service request has been fully resolved and Closed.
                    </div>
                  )}

                  {/* Rejected state */}
                  {detail.status === "rejected" && (
                    <div className="text-xs font-bold text-rose-600 dark:text-rose-500 italic py-2">
                      This service request has been Rejected.
                    </div>
                  )}

                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
