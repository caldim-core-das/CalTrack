import React, { useState, useEffect } from "react"
import { apiRequest } from "../../api/client.js"
import { MessageSquare, AlertTriangle, CheckCircle, Clock, User, Shield, Send, RefreshCw, AlertCircle, FileText, Check } from "lucide-react"

const STATUS_TABS = [
  { key: "ALL",                        label: "All" },
  { key: "PENDING",                    label: "Pending" },
  { key: "ADMIN_REVIEW",               label: "In Review" },
  { key: "SLOT_SUGGESTED",             label: "Slot Suggested" },
  { key: "AWAITING_EMPLOYEE_RESPONSE", label: "Awaiting Employee" },
  { key: "REASSIGNMENT_NEEDED",        label: "Reassignment Needed" },
  { key: "RESCHEDULED",                label: "Completed" },
  { key: "REJECTED",                   label: "Rejected" },
  { key: "CANCELLED",                  label: "Cancelled" },
]

const STATUS_STYLE = {
  PENDING:                    "bg-amber-100 text-amber-800 border-amber-200",
  ADMIN_REVIEW:               "bg-blue-100 text-blue-800 border-blue-200",
  SLOT_SUGGESTED:             "bg-purple-100 text-purple-800 border-purple-200",
  AWAITING_EMPLOYEE_RESPONSE: "bg-indigo-100 text-indigo-800 border-indigo-200",
  REASSIGNMENT_NEEDED:        "bg-orange-100 text-orange-800 border-orange-200",
  RESCHEDULED:                "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED:                   "bg-rose-100 text-rose-800 border-rose-200",
  CANCELLED:                  "bg-slate-100 text-slate-600 border-slate-200",
  APPROVED:                   "bg-emerald-100 text-emerald-800 border-emerald-200",
  CUSTOMER_NOTIFIED:          "bg-emerald-100 text-emerald-800 border-emerald-200",
  TECHNICIAN_CONFIRMATION:    "bg-indigo-100 text-indigo-800 border-indigo-200",
}

const REJECTION_REASONS = [
  { value: "EMPLOYEE_UNAVAILABLE", label: "Employee Unavailable" },
  { value: "POLICY_VIOLATION",     label: "Policy Violation" },
  { value: "OTHER",                label: "Other" },
]

const TIME_SLOTS = [
  { value: "09-10", label: "09:00 - 10:00" },
  { value: "10-11", label: "10:00 - 11:00" },
  { value: "11-12", label: "11:00 - 12:00" },
  { value: "14-15", label: "14:00 - 15:00" },
  { value: "15-16", label: "15:00 - 16:00" },
]

export function AdminReschedulesPanel({ showToast }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("ALL")
  const [employees, setEmployees] = useState([])
  const [actionLoading, setActionLoading] = useState({})

  // Modal states
  const [rejectModal, setRejectModal] = useState(null)  // { id, reason, notes }
  const [suggestModal, setSuggestModal] = useState(null) // { id, date, slot, notes }
  const [reassignModal, setReassignModal] = useState(null) // { id, employeeId }

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiRequest("/admin/reschedules/list/")
      if (res?.success) setData(res.data || [])
      else if (showToast) showToast(res?.error?.message || "Failed to load reschedules", "error")
    } catch (e) {
      if (showToast) showToast("Network error", "error")
    } finally { setLoading(false) }
  }

  const loadEmployees = async () => {
    try {
      const res = await apiRequest("/admin/service-requests/employees/")
      if (res?.success) setEmployees(res.data || [])
    } catch (e) {}
  }

  useEffect(() => { load(); loadEmployees() }, [])

  const setLoading_ = (id, val) => setActionLoading(p => ({ ...p, [id]: val }))

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this reschedule request? The employee will be notified to confirm.")) return
    setLoading_(id, true)
    try {
      const res = await apiRequest(`/admin/reschedules/${id}/approve/`, { method: "POST", json: {} })
      if (res?.success) {
        const outcome = res.meta?.outcome || res.data?.status || "processed"
        showToast?.(`Approved — Status: ${outcome}`, "success")
        load()
      } else {
        showToast?.(res?.error?.message || "Approval failed", "error")
      }
    } catch (e) { showToast?.("Network error", "error") }
    finally { setLoading_(id, false) }
  }

  const handleRejectSubmit = async () => {
    const { id, reason, notes } = rejectModal
    setLoading_(id, true)
    try {
      const res = await apiRequest(`/admin/reschedules/${id}/reject/`, {
        method: "POST", json: { reason, notes }
      })
      if (res?.success) { showToast?.("Reschedule rejected. Customer notified.", "success"); setRejectModal(null); load() }
      else showToast?.(res?.error?.message || "Rejection failed", "error")
    } catch (e) { showToast?.("Network error", "error") }
    finally { setLoading_(id, false) }
  }

  const handleSuggestSubmit = async () => {
    const { id, date, slot, notes } = suggestModal
    if (!date || !slot) return showToast?.("Date and slot are required", "error")
    setLoading_(id, true)
    try {
      const res = await apiRequest(`/admin/reschedules/${id}/suggest-slot/`, {
        method: "POST", json: { suggested_date: date, suggested_time_slot: slot, notes }
      })
      if (res?.success) { showToast?.("Slot suggestion sent to customer.", "success"); setSuggestModal(null); load() }
      else showToast?.(res?.error?.message || "Suggestion failed", "error")
    } catch (e) { showToast?.("Network error", "error") }
    finally { setLoading_(id, false) }
  }

  const handleReassignSubmit = async () => {
    const { id, employeeId } = reassignModal
    if (!employeeId) return showToast?.("Please select an employee", "error")
    setLoading_(id, true)
    try {
      const res = await apiRequest(`/admin/reschedules/${id}/reassign/`, {
        method: "POST", json: { employee_id: parseInt(employeeId) }
      })
      if (res?.success) { showToast?.("Employee reassigned. Notification sent.", "success"); setReassignModal(null); load() }
      else showToast?.(res?.error?.message || "Reassignment failed", "error")
    } catch (e) { showToast?.("Network error", "error") }
    finally { setLoading_(id, false) }
  }

  const filtered = activeTab === "ALL" ? data : data.filter(r => r.status === activeTab)

  if (loading) return (
    <div className="p-8 text-center text-slate-500 font-semibold">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
      Loading reschedule requests...
    </div>
  )

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-start mb-5">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Reschedule Requests</h2>
          <p className="text-xs text-slate-500 mt-1">Full workflow — Customer → Admin → Employee confirmation</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-sm">
          ↺ Refresh
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUS_TABS.map(t => {
          const count = t.key === "ALL" ? data.length : data.filter(r => r.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                activeTab === t.key
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {t.label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4 max-w-5xl">
        {filtered.length === 0 && (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 italic shadow-sm">
            No reschedule requests in this category.
          </div>
        )}

        {filtered.map(r => {
          const statusStyle = STATUS_STYLE[r.status] || "bg-slate-100 text-slate-700 border-slate-200"
          const canApprove = ["PENDING", "ADMIN_REVIEW"].includes(r.status)
          const canReject  = ["PENDING", "ADMIN_REVIEW", "REASSIGNMENT_NEEDED"].includes(r.status)
          const canSuggest = ["PENDING", "ADMIN_REVIEW"].includes(r.status)
          const canReassign = r.status === "REASSIGNMENT_NEEDED"
          const isTerminal = ["RESCHEDULED", "REJECTED", "CANCELLED"].includes(r.status)
          const isLoading_ = actionLoading[r.id]

          return (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
              {/* Card Header */}
              <div className="flex justify-between items-start p-5 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {r.reschedule_id || `#${r.id}`}
                    </span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-sm font-bold text-slate-900">{r.booking_request_id || r.request_id || "Booking"}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Customer: <span className="font-bold text-slate-700">{r.customer_name || r.requested_by_name || "—"}</span>
                    {r.customer_email && <span className="ml-1 text-slate-400">({r.customer_email})</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Service: <span className="font-semibold text-slate-700">{r.service || "—"}</span>
                    {r.requested_by_name && <span className="ml-2">· Requested by: <span className="font-semibold">{r.requested_by_name}</span></span>}
                  </div>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border ${statusStyle}`}>
                  {r.status_display || r.status}
                </span>
              </div>

              {/* Schedule Visualizer */}
              <div className="mx-5 my-3 bg-slate-900 text-white p-4 rounded-xl flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Current Schedule</div>
                  <div className="text-sm font-extrabold truncate">{r.previous_date || r.current_date || "—"}</div>
                  <div className="text-xs text-slate-400">{r.previous_slot || r.current_time || "—"}</div>
                </div>
                <div className="text-2xl text-purple-400 font-black">→</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Requested New Schedule</div>
                  <div className="text-sm font-extrabold text-emerald-300 truncate">{r.requested_date || r.new_date || "—"}</div>
                  <div className="text-xs text-emerald-400">{r.requested_slot || r.new_time_slot || "—"}</div>
                </div>
                {r.suggested_date && (
                  <>
                    <div className="text-lg text-purple-400">✦</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1">Admin Suggested</div>
                      <div className="text-sm font-extrabold text-purple-300 truncate">{r.suggested_date}</div>
                      <div className="text-xs text-purple-400">{r.suggested_time_slot || "—"}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Info Grid */}
              <div className="mx-5 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div><span className="text-slate-500 font-bold">Reason:</span> <span className="text-slate-800">{r.reason || "—"}</span></div>
                <div><span className="text-slate-500 font-bold">Requested On:</span> <span className="text-slate-800">{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</span></div>
                {r.employee_name && (
                  <div><span className="text-slate-500 font-bold">Assigned Tech:</span> <span className="text-indigo-700 font-bold">{r.employee_name}</span></div>
                )}
                {r.proposed_technician_name && r.proposed_technician_name !== r.employee_name && (
                  <div><span className="text-slate-500 font-bold">Proposed Tech:</span> <span className="text-purple-700 font-bold">{r.proposed_technician_name}</span></div>
                )}
                {r.additional_notes && (
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Customer Notes:</span> <span className="text-slate-700 italic">"{r.additional_notes}"</span></div>
                )}
                {r.review_notes && (
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Admin Notes:</span> <span className="text-slate-700">{r.review_notes}</span></div>
                )}
                {r.rejection_reason && (
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Rejection Reason:</span> <span className="text-rose-700 font-bold">{r.rejection_reason_display || r.rejection_reason}</span> {r.rejection_notes && <span className="text-slate-600 ml-1">— {r.rejection_notes}</span>}</div>
                )}
                {r.employee_response && (
                  <div className="col-span-2"><span className="text-slate-500 font-bold">Employee Response:</span> <span className={`font-bold ${r.employee_response === "ACCEPTED" ? "text-emerald-700" : r.employee_response === "REJECTED" ? "text-rose-700" : "text-slate-700"}`}>{r.employee_response}</span> {r.employee_response_note && <span className="text-slate-600 ml-1">— {r.employee_response_note}</span>}</div>
                )}
                {r.admin_reviewed_by_name && (
                  <div><span className="text-slate-500 font-bold">Reviewed By:</span> <span className="text-slate-700">{r.admin_reviewed_by_name}</span></div>
                )}
              </div>

              {/* Action Buttons */}
              {!isTerminal && (
                <div className="px-5 pb-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  {canApprove && (
                    <button
                      onClick={() => handleApprove(r.id)}
                      disabled={isLoading_}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isLoading_ ? "…" : "✓ Approve & Notify Employee"}
                    </button>
                  )}
                  {canReject && (
                    <button
                      onClick={() => setRejectModal({ id: r.id, reason: "OTHER", notes: "" })}
                      disabled={isLoading_}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      ✕ Reject Request
                    </button>
                  )}
                  {canSuggest && (
                    <button
                      onClick={() => setSuggestModal({ id: r.id, date: "", slot: "09-10", notes: "" })}
                      disabled={isLoading_}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      📅 Suggest New Slot
                    </button>
                  )}
                  {canReassign && (
                    <button
                      onClick={() => setReassignModal({ id: r.id, employeeId: "" })}
                      disabled={isLoading_}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      🔄 Reassign Employee
                    </button>
                  )}
                </div>
              )}

              {isTerminal && (
                <div className={`mx-5 mb-4 px-3 py-2 rounded-lg text-xs font-bold text-center ${
                  r.status === "RESCHEDULED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                  r.status === "CANCELLED" ? "bg-slate-100 text-slate-500 border border-slate-200" :
                  "bg-rose-50 text-rose-700 border border-rose-200"
                }`}>
                  {r.status === "RESCHEDULED" ? "✓ Booking successfully rescheduled" :
                   r.status === "CANCELLED" ? "Cancelled by customer" :
                   "Rejected — no further action required"}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Reject Reschedule Request</h3>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-600 block mb-1">Rejection Reason</label>
              <select
                value={rejectModal.reason}
                onChange={e => setRejectModal(p => ({ ...p, reason: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-400 outline-none"
              >
                {REJECTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 block mb-1">Notes for Customer (optional)</label>
              <textarea
                rows={3}
                value={rejectModal.notes}
                onChange={e => setRejectModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Explain the rejection reason..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-rose-400 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleRejectSubmit} className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors">Confirm Rejection</button>
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Suggest Slot Modal */}
      {suggestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Suggest New Slot to Customer</h3>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-600 block mb-1">Suggested Date</label>
              <input
                type="date"
                value={suggestModal.date}
                onChange={e => setSuggestModal(p => ({ ...p, date: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div className="mb-3">
              <label className="text-xs font-bold text-slate-600 block mb-1">Suggested Time Slot</label>
              <select
                value={suggestModal.slot}
                onChange={e => setSuggestModal(p => ({ ...p, slot: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-400 outline-none"
              >
                {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 block mb-1">Notes (optional)</label>
              <textarea
                rows={2}
                value={suggestModal.notes}
                onChange={e => setSuggestModal(p => ({ ...p, notes: e.target.value }))}
                placeholder="Explain why you're suggesting this slot..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-purple-400 outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSuggestSubmit} className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors">Send Suggestion</button>
              <button onClick={() => setSuggestModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Employee Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Reassign to Another Employee</h3>
            <div className="mb-4">
              <label className="text-xs font-bold text-slate-600 block mb-1">Select Employee</label>
              <select
                value={reassignModal.employeeId}
                onChange={e => setReassignModal(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
              >
                <option value="">— Select an employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name || emp.username} ({emp.email || emp.employee_id || "—"})
                  </option>
                ))}
              </select>
              {employees.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">No employees available. Ensure employees are registered.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleReassignSubmit} className="flex-1 py-2 bg-amber-600 text-white rounded-xl font-bold text-sm hover:bg-amber-700 transition-colors">Reassign</button>
              <button onClick={() => setReassignModal(null)} className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminComplaintsPanel({ showToast }) {
  const [data, setData] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedData, setSelectedData] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [subTab, setSubTab] = useState('overview') // 'overview', 'thread', 'actions', 'resolution'

  // Action states
  const [assignEmpId, setAssignEmpId] = useState('')
  const [assignPriority, setAssignPriority] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [resType, setResType] = useState('COMPLAINT_VALID')
  const [resNotes, setResNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiRequest("/admin/complaints/")
      if (res?.success) {
        setData(res.data)
        if (res.data.length > 0 && !selectedId) {
          setSelectedId(res.data[0].id)
        }
      }
      else showToast(res?.message || "Failed to load complaints", "error")
    } catch (e) {
      showToast("Network error", "error")
    } finally { setLoading(false) }
  }

  const loadEmployees = async () => {
    try {
      const res = await apiRequest("/admin/service-requests/employees/")
      if (res?.success) setEmployees(res.data)
    } catch (e) {}
  }

  useEffect(() => {
    load()
    loadEmployees()
  }, [])

  const loadDetail = async (id) => {
    try {
      const res = await apiRequest(`/admin/complaints/${id}/`)
      if (res?.success) {
        setSelectedData(res.data)
        setAssignEmpId(res.data.assigned_employee?.id || '')
        setAssignPriority(res.data.priority || 'MEDIUM')
      }
    } catch (e) {
      showToast("Network error", "error")
    }
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId])

  const handleReply = async () => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedId}/response/`, {
        method: "POST",
        json: { message: replyText }
      })
      if (res?.success) {
        setReplyText('')
        loadDetail(selectedId)
        showToast("Message sent successfully")
      } else {
        showToast(res?.message || "Failed to send reply", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally { setReplying(false) }
  }

  const handleAssign = async () => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedId}/assign/`, {
        method: "POST",
        json: { employee_id: assignEmpId, priority: assignPriority }
      })
      if (res?.success) {
        showToast("Complaint assigned successfully")
        loadDetail(selectedId)
        load()
      } else {
        showToast(res?.message || "Failed to assign", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally { setActionLoading(false) }
  }

  const handleStatusAction = async (action) => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedId}/status/`, {
        method: "POST",
        json: { action, message: statusMsg, notes: statusMsg }
      })
      if (res?.success) {
        showToast(`Action ${action} executed`)
        setStatusMsg('')
        loadDetail(selectedId)
        load()
      } else {
        showToast(res?.message || "Failed to update status", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally { setActionLoading(false) }
  }

  const handleResolve = async () => {
    setActionLoading(true)
    try {
      const res = await apiRequest(`/admin/complaints/${selectedId}/resolve/`, {
        method: "POST",
        json: { resolution_type: resType, resolution_notes: resNotes }
      })
      if (res?.success) {
        showToast("Complaint resolved successfully")
        loadDetail(selectedId)
        load()
      } else {
        showToast(res?.message || "Failed to resolve", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally { setActionLoading(false) }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading complaints...</div>

  return (
    <div className="flex h-full border-t border-slate-200">
      {/* Left List Pane */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 flex justify-between items-center">
          <span>Complaints ({data.length})</span>
          <button onClick={load} className="text-xs text-indigo-600 hover:underline">Refresh</button>
        </div>
        {data.length === 0 && <div className="p-4 text-sm text-slate-500 italic">No complaints found.</div>}
        {data.map(c => (
          <div
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedId === c.id ? 'bg-indigo-50/60 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
          >
            <div className="flex justify-between mb-1 items-center">
              <span className="font-bold text-xs text-slate-900">{c.complaint_number || c.category_display}</span>
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                c.status === 'OPEN' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                c.status === 'CLOSED' || c.status === 'RESOLVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>{c.status_display}</span>
            </div>
            <div className="text-xs font-semibold text-slate-700 mt-1">{c.category_display}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">{c.customer_name} &bull; {c.booking_request_id || 'General'}</div>
            <div className="text-xs text-slate-600 mt-1.5 line-clamp-2">{c.description}</div>
          </div>
        ))}
      </div>

      {/* Right Detail & Sub-Modules Pane */}
      <div className="flex-1 bg-slate-50 overflow-y-auto flex flex-col">
        {selectedData ? (
          <div className="p-6 max-w-5xl w-full mx-auto space-y-6">
            
            {/* Top Header Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">{selectedData.complaint_number}</span>
                    <h3 className="font-extrabold text-lg text-slate-900">{selectedData.category_display}</h3>
                  </div>
                  <div className="text-xs font-medium text-slate-500 mt-1">
                    Customer: <span className="font-bold text-slate-800">{selectedData.customer_name}</span> {selectedData.customer_phone && `(${selectedData.customer_phone})`}
                    {selectedData.booking_request_id && ` | Booking: ${selectedData.booking_request_id}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Priority:</span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">{selectedData.priority}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase ml-2">Status:</span>
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">{selectedData.status_display}</span>
                </div>
              </div>

              {/* Sub-Module Navigation Tabs */}
              <div className="flex gap-4 pt-3 text-xs font-bold border-b border-slate-100">
                <button
                  onClick={() => setSubTab('overview')}
                  className={`pb-2.5 border-b-2 transition-colors ${subTab === 'overview' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Overview & Details
                </button>
                <button
                  onClick={() => setSubTab('thread')}
                  className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1 ${subTab === 'thread' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Conversation Thread ({selectedData.messages?.length || 0})
                </button>
                <button
                  onClick={() => setSubTab('actions')}
                  className={`pb-2.5 border-b-2 transition-colors ${subTab === 'actions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Assignment & Actions
                </button>
                <button
                  onClick={() => setSubTab('resolution')}
                  className={`pb-2.5 border-b-2 transition-colors ${subTab === 'resolution' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  Resolution & Outcome
                </button>
              </div>
            </div>

            {/* Sub-Module Content Panels */}
            
            {/* SUB-MODULE 1: OVERVIEW */}
            {subTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Complaint Description</h4>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selectedData.description}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Assignments & Owner</h4>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-slate-500">Assigned Admin:</span> <span className="font-bold text-slate-800">{selectedData.assigned_admin?.name || 'Unassigned'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Assigned Technician:</span> <span className="font-bold text-slate-800">{selectedData.assigned_employee?.name || 'Unassigned'}</span></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Risk Analysis</h4>
                    <div className="text-xs space-y-1.5">
                      <div className="flex justify-between"><span className="text-slate-500">Risk Score:</span> <span className="font-extrabold text-indigo-600">{selectedData.risk_score || 'N/A'}</span></div>
                      {selectedData.risk_analysis?.reasons?.length > 0 && (
                        <div className="text-[11px] text-slate-600 mt-1">
                          Reasons: {selectedData.risk_analysis.reasons.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-MODULE 2: THREAD */}
            {subTab === 'thread' && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare size={14} /> Message History
                </h4>
                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
                  {(!selectedData.messages || selectedData.messages.length === 0) && (
                    <div className="text-slate-400 text-xs italic text-center py-6">No messages in thread yet.</div>
                  )}
                  {(selectedData.messages || []).map(r => {
                    const isAdmin = r.persona === 'ADMIN'
                    return (
                      <div key={r.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-3 rounded-xl text-xs shadow-sm ${isAdmin ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                          <div className={`text-[9px] font-bold mb-1 uppercase tracking-wider ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {r.sender} ({r.persona})
                          </div>
                          <div className="leading-relaxed whitespace-pre-wrap">{r.message}</div>
                          <div className={`text-[9px] mt-1.5 text-right ${isAdmin ? 'text-indigo-300' : 'text-slate-400'}`}>
                            {new Date(r.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedData.status !== 'CLOSED' && selectedData.status !== 'RESOLVED' && (
                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <textarea 
                      value={replyText} 
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type a message to add to thread..."
                      className="flex-1 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 focus:bg-white resize-none"
                      rows={2}
                    />
                    <button 
                      onClick={handleReply} 
                      disabled={replying || !replyText.trim()}
                      className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-xs hover:bg-indigo-700 disabled:opacity-50 h-auto"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SUB-MODULE 3: ACTIONS & ASSIGNMENT */}
            {subTab === 'actions' && (
              <div className="space-y-4">
                {/* Assignment Sub-Module */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Technician Assignment & Priority</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Technician</label>
                      <select
                        value={assignEmpId}
                        onChange={e => setAssignEmpId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                      >
                        <option value="">-- Unassigned --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Priority</label>
                      <select
                        value={assignPriority}
                        onChange={e => setAssignPriority(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700"
                      >
                        <option value="CRITICAL">Critical</option>
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleAssign}
                    disabled={actionLoading}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-4 rounded-lg mt-2"
                  >
                    Save Assignment
                  </button>
                </div>

                {/* Workflow Status Actions Sub-Module */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">Workflow Status Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStatusAction('start_investigation')}
                      disabled={actionLoading}
                      className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold text-xs py-1.5 px-3 rounded"
                    >
                      Start Investigation
                    </button>
                    <button
                      onClick={() => handleStatusAction('escalate')}
                      disabled={actionLoading}
                      className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-xs py-1.5 px-3 rounded"
                    >
                      Escalate Complaint
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400 block">Message Context for Requesting Info</label>
                    <textarea
                      value={statusMsg}
                      onChange={e => setStatusMsg(e.target.value)}
                      placeholder="Context/Reasoning..."
                      className="w-full border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 resize-none h-16"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusAction('request_customer_info')}
                        disabled={actionLoading || !statusMsg.trim()}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold text-xs py-1.5 px-3 rounded"
                      >
                        Request Customer Info
                      </button>
                      <button
                        onClick={() => handleStatusAction('request_technician_info')}
                        disabled={actionLoading || !statusMsg.trim()}
                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-bold text-xs py-1.5 px-3 rounded"
                      >
                        Request Technician Info
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-MODULE 4: RESOLUTION */}
            {subTab === 'resolution' && (
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-5 shadow-sm space-y-4">
                <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider border-b border-emerald-200/60 pb-2">
                  Final Complaint Resolution
                </h4>
                {selectedData.status === 'RESOLVED' || selectedData.status === 'CLOSED' ? (
                  <div className="space-y-2 text-xs">
                    <div className="font-bold text-emerald-800">This complaint has been resolved.</div>
                    <div><span className="text-slate-500">Resolution Type:</span> <span className="font-bold">{selectedData.resolution_type || 'N/A'}</span></div>
                    <div><span className="text-slate-500">Notes:</span> <span className="font-medium text-slate-700">{selectedData.resolution_notes || 'None'}</span></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-emerald-800 block mb-1">Resolution Category</label>
                      <select
                        value={resType}
                        onChange={e => setResType(e.target.value)}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-xs font-bold text-slate-700"
                      >
                        <option value="COMPLAINT_VALID">Complaint Valid</option>
                        <option value="COMPLAINT_INVALID">Complaint Invalid</option>
                        <option value="CUSTOMER_ERROR">Customer Error</option>
                        <option value="TECHNICIAN_ERROR">Technician Error</option>
                        <option value="COMPANY_ERROR">Company Error</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold uppercase text-emerald-800 block mb-1">Resolution Notes & Actions Taken</label>
                      <textarea
                        value={resNotes}
                        onChange={e => setResNotes(e.target.value)}
                        placeholder="Detail the resolution outcome..."
                        className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 resize-none h-20"
                      />
                    </div>
                    <button
                      onClick={handleResolve}
                      disabled={actionLoading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2.5 px-5 rounded-lg w-full shadow-sm"
                    >
                      Mark Complaint Resolved
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-semibold flex-col gap-3 py-16">
            <MessageSquare size={36} className="text-slate-300" />
            <div className="text-sm font-bold text-slate-600">Select a complaint from the left to view sub-modules</div>
            <div className="text-xs text-slate-400">Overview &bull; Conversation Thread &bull; Technician Assignment &bull; Resolution</div>
          </div>
        )}
      </div>
    </div>
  )
}

export function EmployeeComplaintsPanel({ showToast }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedData, setSelectedData] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await apiRequest("/employee/complaints/")
      if (res?.success) setData(res.data)
      else showToast(res?.message || "Failed to load complaints", "error")
    } catch (e) {
      showToast("Network error", "error")
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const loadDetail = async (id) => {
    try {
      // Employees don't have a specific detail view in urls.py, so we just use the list data since it includes responses 
      const complaint = data.find(c => c.id === id)
      if (complaint) setSelectedData(complaint)
    } catch (e) {
      showToast("Network error", "error")
    }
  }

  useEffect(() => {
    if (selectedId) loadDetail(selectedId)
  }, [selectedId, data])

  const handleReply = async () => {
    if (!replyText.trim()) return
    setReplying(true)
    try {
      const res = await apiRequest(`/employee/complaints/${selectedId}/response/`, {
        method: "POST",
        json: { message: replyText }
      })
      if (res?.success) {
        setReplyText('')
        load() // Refresh list since it contains the thread
      } else {
        showToast(res?.message || "Failed to send reply", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally { setReplying(false) }
  }

  if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>

  return (
    <div className="flex h-[calc(100vh-140px)] w-full">
      {/* List */}
      <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-800 flex justify-between items-center">
          <span>My Assigned Complaints</span>
          <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">{data.length}</span>
        </div>
        {data.length === 0 && <div className="p-4 text-sm text-slate-500 italic">No assigned complaints.</div>}
        {data.map(c => (
          <div key={c.id} onClick={() => { setSelectedId(c.id); setSelectedData(c); }} className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${selectedId === c.id ? 'bg-indigo-50/50 border-l-2 border-l-indigo-600' : 'border-l-2 border-l-transparent'}`}>
            <div className="flex justify-between mb-1 items-center">
              <span className="font-bold text-sm text-slate-900">{c.category_display}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${c.status === 'OPEN' ? 'bg-rose-100 text-rose-700' : c.status === 'CLOSED' || c.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{c.status_display}</span>
            </div>
            <div className="text-xs text-slate-500 truncate">{c.customer_name} • Booking: {c.booking_request_id || 'N/A'}</div>
            <div className="text-xs text-slate-600 mt-2 line-clamp-2">{c.description}</div>
          </div>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 bg-slate-50 overflow-y-auto">
        {selectedData ? (
          <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{selectedData.category_display}</h3>
                  <div className="text-sm text-slate-500 mt-1">From: <span className="font-semibold text-slate-700">{selectedData.customer_name}</span></div>
                </div>
                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase ${selectedData.status === 'OPEN' ? 'bg-rose-100 text-rose-700' : selectedData.status === 'CLOSED' || selectedData.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedData.status_display}
                </span>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{selectedData.description}</p>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="font-bold text-sm text-slate-800 mb-4 flex items-center gap-2"><MessageSquare size={16} /> Conversation Thread</h4>
              <div className="flex flex-col gap-4">
                {(selectedData.messages || []).map(r => {
                  const isMe = r.persona === 'EMPLOYEE'
                  return (
                    <div key={r.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3.5 rounded-xl text-sm shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                        <div className={`text-[10px] font-bold mb-1.5 uppercase tracking-wider ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {r.persona === 'EMPLOYEE' ? 'Me (Technician)' : r.persona === 'CUSTOMER' ? 'Customer' : 'Support Agent'}
                        </div>
                        <div className="leading-relaxed">{r.message}</div>
                        <div className={`text-[10px] mt-2 text-right ${isMe ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedData.status !== 'CLOSED' && selectedData.status !== 'RESOLVED' && (
              <div className="flex gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-6">
                <textarea 
                  value={replyText} 
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type a response..."
                  className="flex-1 border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all bg-slate-50 focus:bg-white"
                  rows={2}
                />
                <button 
                  onClick={handleReply} 
                  disabled={replying || !replyText.trim()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 h-fit transition-colors shadow-md shadow-indigo-600/20"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-semibold flex-col gap-3 pt-20">
            <MessageSquare size={32} className="text-slate-300" />
            Select a complaint to view details
          </div>
        )}
      </div>
    </div>
  )
}


export function AdminRefundsPanel({ showToast }) {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStatus, setSelectedStatus] = useState("ALL")
  const [selectedRefund, setSelectedRefund] = useState(null)
  
  const [partialAmount, setPartialAmount] = useState("")
  const [actionNote, setActionNote] = useState("")
  const [infoTarget, setInfoTarget] = useState("CUSTOMER")
  const [assignEmployeeId, setAssignEmployeeId] = useState("")
  const [actionSubmitting, setActionSubmitting] = useState(false)

  const loadRefunds = async () => {
    setLoading(true)
    try {
      const url = selectedStatus !== "ALL" ? `/admin/refunds/list/?status=${selectedStatus}` : "/admin/refunds/list/"
      const res = await apiRequest(url)
      if (res?.success) {
        setRefunds(res.data || [])
        if (res.data && res.data.length > 0 && !selectedRefund) {
          setSelectedRefund(res.data[0])
        }
      } else {
        showToast(res?.message || "Failed to load refund requests", "error")
      }
    } catch (e) {
      showToast("Network error", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRefunds()
  }, [selectedStatus])

  const handleApproveFull = async () => {
    if (!selectedRefund) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/approve/`, {
        method: "POST",
        json: { is_full: true, internal_note: actionNote }
      })
      if (res?.success) {
        showToast("Refund request approved in full.")
        setActionNote("")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to approve refund", "error")
      }
    } catch (e) {
      showToast("Error processing approval", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleApprovePartial = async () => {
    if (!selectedRefund || !partialAmount) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/approve/`, {
        method: "POST",
        json: { is_full: false, approved_amount: partialAmount, internal_note: actionNote }
      })
      if (res?.success) {
        showToast(`Partial refund of ₹${partialAmount} approved.`)
        setActionNote("")
        setPartialAmount("")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to approve partial refund", "error")
      }
    } catch (e) {
      showToast("Error processing partial approval", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRefund) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/reject/`, {
        method: "POST",
        json: { internal_note: actionNote }
      })
      if (res?.success) {
        showToast("Refund request rejected.")
        setActionNote("")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to reject refund", "error")
      }
    } catch (e) {
      showToast("Error rejecting refund", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleRequestInfo = async () => {
    if (!selectedRefund || !actionNote) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/request-info/`, {
        method: "POST",
        json: { target: infoTarget, note: actionNote, employee_id: assignEmployeeId || undefined }
      })
      if (res?.success) {
        showToast(`Information requested from ${infoTarget}.`)
        setActionNote("")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to request information", "error")
      }
    } catch (e) {
      showToast("Error sending info request", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleSendToFinance = async () => {
    if (!selectedRefund) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/send-to-finance/`, {
        method: "POST",
        json: {}
      })
      if (res?.success) {
        showToast("Approved refund dispatched to Finance queue.")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to submit to Finance", "error")
      }
    } catch (e) {
      showToast("Error sending to finance", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const handleAddInternalNote = async () => {
    if (!selectedRefund || !actionNote) return
    setActionSubmitting(true)
    try {
      const res = await apiRequest(`/admin/refunds/${selectedRefund.id}/internal-note/`, {
        method: "POST",
        json: { note: actionNote }
      })
      if (res?.success) {
        showToast("Internal note recorded.")
        setActionNote("")
        loadRefunds()
      } else {
        showToast(res?.error?.message || "Failed to add internal note", "error")
      }
    } catch (e) {
      showToast("Error saving note", "error")
    } finally {
      setActionSubmitting(false)
    }
  }

  const statuses = [
    { code: "ALL", label: "All Requests" },
    { code: "PENDING", label: "Pending" },
    { code: "INFO_REQUESTED", label: "Info Requested" },
    { code: "APPROVED_FULL", label: "Approved Full" },
    { code: "APPROVED_PARTIAL", label: "Approved Partial" },
    { code: "SENT_TO_FINANCE", label: "Sent to Finance" },
    { code: "COMPLETED", label: "Completed" },
    { code: "REJECTED", label: "Rejected" },
  ]

  if (loading && refunds.length === 0) {
    return <div className="p-8 text-center text-slate-500 font-semibold">Loading refund requests...</div>
  }

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">
      {/* Left List Pane */}
      <div className="w-1/2 border-r border-slate-200 bg-white flex flex-col h-full">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-lg font-extrabold text-slate-900 mb-3">Refund Requests Management</h2>
          
          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {statuses.map(s => (
              <button
                key={s.code}
                onClick={() => setSelectedStatus(s.code)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedStatus === s.code
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {refunds.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic font-semibold">
              No refund requests matching current filter.
            </div>
          )}

          {refunds.map(r => {
            const isSel = selectedRefund?.id === r.id
            return (
              <div
                key={r.id}
                onClick={() => setSelectedRefund(r)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  isSel
                    ? "border-purple-600 bg-purple-50/40 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-500">{r.refund_id || `RF-${r.id}`}</span>
                    <h4 className="font-bold text-sm text-slate-900 mt-0.5">{r.customer_name || 'Customer'}</h4>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase ${
                    r.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    r.status === 'INFO_REQUESTED' ? 'bg-indigo-100 text-indigo-700' :
                    r.status.startsWith('APPROVED') ? 'bg-emerald-100 text-emerald-700' :
                    r.status === 'SENT_TO_FINANCE' ? 'bg-purple-100 text-purple-700' :
                    r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {r.status_display || r.status}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>Paid: <strong className="text-slate-800">₹{r.paid_amount}</strong></div>
                  <div>Requested: <strong className="text-purple-600 font-bold">₹{r.requested_amount}</strong></div>
                  <div>Reason: <span className="font-semibold">{r.reason}</span></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Detail & Action Pane */}
      <div className="flex-1 bg-slate-50 overflow-y-auto p-6">
        {selectedRefund ? (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            
            {/* Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
                <div>
                  <span className="text-xs font-mono font-bold text-purple-600">{selectedRefund.refund_id}</span>
                  <h3 className="text-lg font-extrabold text-slate-900 mt-1">Refund Review & Audit</h3>
                  <div className="text-xs text-slate-500 mt-0.5">Booking: {selectedRefund.booking_request_id} • Customer: {selectedRefund.customer_name} ({selectedRefund.customer_email})</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 font-semibold">Requested Amount</div>
                  <div className="text-xl font-black text-purple-600">₹{selectedRefund.requested_amount}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold">Paid Amount Snapshot</span>
                  <strong className="text-sm text-slate-800">₹{selectedRefund.paid_amount}</strong>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 block font-semibold">Approved Amount</span>
                  <strong className="text-sm text-emerald-600">{selectedRefund.approved_amount ? `₹${selectedRefund.approved_amount}` : 'Pending Approval'}</strong>
                </div>
              </div>

              {/* Reason & Notes */}
              <div className="text-xs space-y-2 text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div><strong className="text-slate-900">Reason:</strong> {selectedRefund.reason}</div>
                {selectedRefund.additional_notes && <div><strong className="text-slate-900">Customer Notes:</strong> {selectedRefund.additional_notes}</div>}
              </div>

              {/* Evidence attachments */}
              {selectedRefund.evidence && selectedRefund.evidence.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-700 block mb-2">Uploaded Evidence ({selectedRefund.evidence.length})</span>
                  <div className="flex gap-2 flex-wrap">
                    {selectedRefund.evidence.map(ev => (
                      <a key={ev.id} href={ev.file} target="_blank" rel="noreferrer" className="text-xs text-purple-600 font-bold underline bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100 hover:bg-purple-100 transition-all">
                        Evidence #{ev.id}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Technician / Employee Investigation Notes */}
              {selectedRefund.investigation_notes && selectedRefund.investigation_notes.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-800 block mb-2">Technician Investigation Audit</span>
                  <div className="space-y-2">
                    {selectedRefund.investigation_notes.map(note => (
                      <div key={note.id} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 text-xs text-indigo-950">
                        <div className="flex justify-between font-bold text-indigo-700 mb-1">
                          <span>{note.employee_name} ({note.employee_id})</span>
                          <span>Work Confirmed: {note.work_completed_confirmed ? '✓ Yes' : '✕ No'}</span>
                        </div>
                        <p className="leading-relaxed">{note.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal Notes Thread */}
              {selectedRefund.internal_notes && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <span className="text-xs font-bold text-slate-800 block mb-2">Internal Audit Notes Log</span>
                  <pre className="text-xs bg-slate-900 text-slate-200 p-3 rounded-xl whitespace-pre-wrap font-mono leading-relaxed">
                    {selectedRefund.internal_notes}
                  </pre>
                </div>
              )}
            </div>

            {/* Action Bar Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h4 className="font-extrabold text-sm text-slate-900 mb-4">Admin Decision & Action Controls</h4>

              {/* Input for Notes / Partial Amount */}
              <div className="flex flex-col gap-3 mb-4">
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  placeholder="Enter internal review notes or instructions..."
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:ring-1 focus:ring-purple-500 outline-none bg-slate-50 focus:bg-white transition-all"
                />

                {/* Target Picker for Request Info */}
                <div className="flex gap-3 items-center">
                  <span className="text-xs font-bold text-slate-600">Info Target:</span>
                  <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="target" value="CUSTOMER" checked={infoTarget === 'CUSTOMER'} onChange={() => setInfoTarget('CUSTOMER')} /> Customer
                  </label>
                  <label className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="target" value="EMPLOYEE" checked={infoTarget === 'EMPLOYEE'} onChange={() => setInfoTarget('EMPLOYEE')} /> Technician / Employee
                  </label>
                </div>

                {/* Partial amount input */}
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.01"
                    value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value)}
                    placeholder="Custom partial amount (₹)"
                    className="w-48 border border-slate-300 rounded-xl p-2.5 text-xs font-bold focus:ring-1 focus:ring-purple-500 outline-none bg-slate-50"
                  />
                  <button
                    onClick={handleApprovePartial}
                    disabled={actionSubmitting || !partialAmount}
                    className="bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    Approve Partial
                  </button>
                </div>
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={handleApproveFull}
                  disabled={actionSubmitting || selectedRefund.status.startsWith('APPROVED') || selectedRefund.status === 'COMPLETED'}
                  className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  ✓ Approve Full
                </button>

                <button
                  onClick={handleReject}
                  disabled={actionSubmitting || selectedRefund.status === 'REJECTED' || selectedRefund.status === 'COMPLETED'}
                  className="bg-rose-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-rose-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  ✕ Reject
                </button>

                <button
                  onClick={handleRequestInfo}
                  disabled={actionSubmitting || !actionNote}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-indigo-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  💬 Request Info
                </button>

                <button
                  onClick={handleSendToFinance}
                  disabled={actionSubmitting || !selectedRefund.status.startsWith('APPROVED')}
                  className="bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-purple-700 disabled:opacity-40 transition-colors shadow-sm"
                >
                  ➔ Send to Finance
                </button>

                <button
                  onClick={handleAddInternalNote}
                  disabled={actionSubmitting || !actionNote}
                  className="bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-40 transition-colors shadow-sm"
                >
                  📝 Add Note
                </button>
              </div>

            </div>

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 font-semibold italic">
            Select a refund request from the left list to review details.
          </div>
        )}
      </div>
    </div>
  )
}
