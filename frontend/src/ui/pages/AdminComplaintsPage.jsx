import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldAlert, RefreshCw, Filter, MessageSquare, AlertTriangle, CheckCircle, Search, User, Calendar, X, AlertCircle, Phone, FileText, Send, ChevronRight, Activity, CornerDownRight } from "lucide-react"
import { apiRequest } from "../../api/client.js"

export function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Filters
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  
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

  const loadComplaints = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status) params.append("status", status)
      if (priority) params.append("priority", priority)

      const res = await apiRequest(`/admin/complaints/?${params.toString()}`)
      if (res?.success) {
        setComplaints(res.data)
      } else {
        setError("Failed to fetch complaints.")
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
  }, [status, priority])

  const openComplaint = async (id) => {
    setDetailLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${id}/`)
      if (res?.success) {
        setSelectedComplaint(res.data)
        setAssignEmployee(res.data.assigned_employee?.id || "")
        setAssignPriority(res.data.priority || "MEDIUM")
      }
    } catch (err) {
      console.error("Failed to load complaint details", err)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeComplaintModal = () => {
    setSelectedComplaint(null)
    setActiveTab("details")
    setMessage("")
    setResolutionNotes("")
  }

  const refreshComplaint = () => {
    if (selectedComplaint) {
      openComplaint(selectedComplaint.id)
      loadComplaints()
    }
  }

  // Actions
  const handleAssign = async () => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/assign/`, {
        method: "POST",
        json: { employee_id: assignEmployee, priority: assignPriority }
      })
      if (res?.success) refreshComplaint()
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
        setMessage("")
        refreshComplaint()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message) return
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/response/`, {
        method: "POST",
        json: { message }
      })
      if (res?.success) {
        setMessage("")
        refreshComplaint()
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolve = async () => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedComplaint.id}/resolve/`, {
        method: "POST",
        json: { resolution_type: resolutionType, resolution_notes: resolutionNotes }
      })
      if (res?.success) refreshComplaint()
    } finally {
      setActionLoading(false)
    }
  }

  const getPriorityColor = (pri) => {
    switch (pri) {
      case "CRITICAL": return "bg-red-100 text-red-700 border-red-200"
      case "HIGH": return "bg-orange-100 text-orange-700 border-orange-200"
      case "MEDIUM": return "bg-amber-100 text-amber-700 border-amber-200"
      case "LOW": return "bg-slate-100 text-slate-700 border-slate-200"
      default: return "bg-slate-100 text-slate-700 border-slate-200"
    }
  }

  const getStatusColor = (stat) => {
    if (stat === "RESOLVED" || stat === "CLOSED") return "bg-emerald-100 text-emerald-700 border-emerald-200"
    if (stat === "OPEN") return "bg-red-100 text-red-700 border-red-200"
    return "bg-indigo-100 text-indigo-700 border-indigo-200"
  }

  const metrics = {
    total: complaints.length,
    critical: complaints.filter(c => c.priority === "CRITICAL" && !["RESOLVED", "CLOSED"].includes(c.status)).length,
    open: complaints.filter(c => c.status === "OPEN").length
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50 text-slate-800 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-tight">
            Customer Complaints Center
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Manage, investigate, and resolve customer complaints and escalations.
          </p>
        </div>
        <button
          onClick={loadComplaints}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-600">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Complaints</span>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{metrics.total}</h2>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100/50 text-red-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">New / Open</span>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{metrics.open}</h2>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl relative overflow-hidden shadow-sm">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100/50 text-orange-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Critical Priority</span>
          <h2 className="text-3xl font-black text-slate-900 mt-2">{metrics.critical}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex gap-4 items-end shadow-sm">
        <div className="space-y-1.5 flex-1 max-w-[200px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700">
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div className="space-y-1.5 flex-1 max-w-[200px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold text-slate-700">
            <option value="">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No complaints found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Complaint ID</th>
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Customer</th>
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Category</th>
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Priority</th>
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                  <th className="py-3 px-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Created</th>
                  <th className="py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => openComplaint(c.id)}>
                    <td className="py-3 px-4">
                      <span className="font-bold text-xs text-slate-900">{c.complaint_number}</span>
                      {c.booking_request_id && <span className="block text-[10px] text-slate-500 mt-0.5">{c.booking_request_id}</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-xs text-slate-800">{c.customer_name}</span>
                      {c.customer_phone && <span className="block text-[10px] text-slate-500 mt-0.5">{c.customer_phone}</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-600">{c.category_display}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getPriorityColor(c.priority)}`}>
                        {c.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(c.status)}`}>
                        {c.status_display}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] font-medium text-slate-500">
                      {new Date(c.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-colors shadow-sm ml-auto">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedComplaint && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
              onClick={closeComplaintModal} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getStatusColor(selectedComplaint.status)}`}>
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{selectedComplaint.complaint_number}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {selectedComplaint.category_display} &bull; {selectedComplaint.customer_name}
                    </p>
                  </div>
                </div>
                <button onClick={closeComplaintModal} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex px-4 border-b border-slate-100">
                <button onClick={() => setActiveTab("details")} className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === "details" ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Details</button>
                <button onClick={() => setActiveTab("thread")} className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "thread" ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                  Thread <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{selectedComplaint.messages?.length || 0}</span>
                </button>
                <button onClick={() => setActiveTab("actions")} className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === "actions" ? "border-indigo-500 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>Actions & Resolution</button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto flex-1 bg-slate-50/30">
                {detailLoading ? (
                  <div className="py-12 text-center text-slate-400 text-sm font-semibold">Loading details...</div>
                ) : (
                  <>
                    {/* DETAILS TAB */}
                    {activeTab === "details" && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400">Status</span>
                            <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedComplaint.status_display}</div>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400">Priority</span>
                            <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedComplaint.priority}</div>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400">Booking Ref</span>
                            <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedComplaint.booking_request_id || "None"}</div>
                          </div>
                          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-400">Risk Score</span>
                            <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedComplaint.risk_score || "N/A"}</div>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Customer Description</h3>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedComplaint.description}</p>
                        </div>
                        
                        {selectedComplaint.attachments?.length > 0 && (
                           <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Attachments</h3>
                            <div className="flex gap-2 flex-wrap">
                              {selectedComplaint.attachments.map(att => (
                                <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors text-xs font-bold text-indigo-600">
                                  <FileText className="w-3.5 h-3.5" />
                                  View {att.type}
                                </a>
                              ))}
                            </div>
                           </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Customer Info</h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Name</span><span className="text-xs font-bold">{selectedComplaint.customer_name}</span></div>
                              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Phone</span><span className="text-xs font-bold">{selectedComplaint.customer_phone || "-"}</span></div>
                            </div>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">Assignments</h3>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Admin</span><span className="text-xs font-bold">{selectedComplaint.assigned_admin?.name || "Unassigned"}</span></div>
                              <div className="flex items-center justify-between"><span className="text-xs text-slate-500">Technician</span><span className="text-xs font-bold">{selectedComplaint.assigned_employee?.name || "Unassigned"}</span></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* THREAD TAB */}
                    {activeTab === "thread" && (
                      <div className="flex flex-col h-[500px]">
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                          {selectedComplaint.messages?.length === 0 && (
                            <div className="text-center text-slate-400 py-8 text-xs font-medium">No messages yet.</div>
                          )}
                          {selectedComplaint.messages?.map(msg => (
                            <div key={msg.id} className={`flex ${msg.persona === "ADMIN" ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-2xl p-3 ${msg.persona === "ADMIN" ? "bg-indigo-600 text-white rounded-br-sm" : msg.persona === "CUSTOMER" ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
                                <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-1 flex justify-between gap-4">
                                  <span>{msg.sender} ({msg.persona})</span>
                                  <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="pt-4 mt-4 border-t border-slate-200">
                          <div className="flex gap-2">
                            <textarea
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:border-indigo-500 resize-none h-10 py-2.5"
                            />
                            <button onClick={handleSendMessage} disabled={actionLoading || !message} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl disabled:opacity-50">
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ACTIONS TAB */}
                    {activeTab === "actions" && (
                      <div className="space-y-6">
                        
                        {/* Assignment */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-100 pb-2">Assignment & Priority</h3>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400">Technician</label>
                              <select value={assignEmployee} onChange={e => setAssignEmployee(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700">
                                <option value="">-- Unassigned --</option>
                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                              </select>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[10px] font-black uppercase text-slate-400">Priority</label>
                              <select value={assignPriority} onChange={e => setAssignPriority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-700">
                                <option value="CRITICAL">Critical</option>
                                <option value="HIGH">High</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="LOW">Low</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              <button onClick={handleAssign} disabled={actionLoading} className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 px-4 rounded-xl w-full sm:w-auto h-9">
                                Update
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Status Updates */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-4 border-b border-slate-100 pb-2">Status Actions</h3>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleStatusUpdate("start_investigation")} disabled={actionLoading} className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 font-bold text-xs py-2 px-3 rounded-lg">
                              Start Investigation
                            </button>
                            <button onClick={() => handleStatusUpdate("escalate")} disabled={actionLoading} className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold text-xs py-2 px-3 rounded-lg">
                              Escalate
                            </button>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                            <label className="text-[10px] font-black uppercase text-slate-400">Request Information / Update</label>
                            <textarea
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              placeholder="Message context required for requesting info..."
                              className="w-full border border-slate-200 rounded-xl p-2 text-sm focus:outline-none focus:border-indigo-500 resize-none h-16"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleStatusUpdate("request_customer_info")} disabled={actionLoading || !message} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold text-xs py-2 px-3 rounded-lg">
                                Ask Customer
                              </button>
                              <button onClick={() => handleStatusUpdate("request_technician_info")} disabled={actionLoading || !message} className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold text-xs py-2 px-3 rounded-lg">
                                Ask Technician
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Resolution */}
                        {selectedComplaint.status !== "RESOLVED" && selectedComplaint.status !== "CLOSED" && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900 mb-4 border-b border-emerald-200/50 pb-2 flex items-center gap-2">
                              <CheckCircle className="w-4 h-4" /> Resolve Complaint
                            </h3>
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-emerald-700">Resolution Type</label>
                                <select value={resolutionType} onChange={e => setResolutionType(e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl p-2 text-xs font-bold text-slate-700">
                                  <option value="COMPLAINT_VALID">Complaint Valid</option>
                                  <option value="COMPLAINT_INVALID">Complaint Invalid</option>
                                  <option value="CUSTOMER_ERROR">Customer Error</option>
                                  <option value="TECHNICIAN_ERROR">Technician Error</option>
                                  <option value="COMPANY_ERROR">Company Error</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-emerald-700">Resolution Notes</label>
                                <textarea
                                  value={resolutionNotes}
                                  onChange={e => setResolutionNotes(e.target.value)}
                                  placeholder="Final outcome details..."
                                  className="w-full border border-emerald-200 rounded-xl p-2 text-sm focus:outline-none focus:border-emerald-500 resize-none h-16 bg-white"
                                />
                              </div>
                              <button onClick={handleResolve} disabled={actionLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl w-full shadow-sm">
                                Resolve & Close
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
