import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useSearchParams } from "react-router-dom"
import { apiRequest, unwrapResults, API_BASE_URL } from "../../api/client.js"
import { formatDateTime, Card, Button, Pill } from "../components/kit.jsx"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { useElapsed } from "../../hooks/useTimeTracking.js"
import {
  Camera, MapPin, CheckCircle2, Clock, Check, AlertCircle,
  Calendar, RefreshCw, Users, Search, Filter, ChevronDown,
  ChevronRight, FileText, X
} from "lucide-react"

const DAILY_TARGET_HRS = 8

async function downloadLogPdf(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/time/logs/${id}/download_pdf/`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Shift_Summary_#${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  } catch (err) {
    console.error("PDF download failed", err);
    alert("Failed to download PDF summary report.");
  }
}

function AdminLogRow({ log, onAction, onView }) {
  const elapsed = useElapsed(log.clock_out ? null : log.clock_in)
  const isLive = !log.clock_out
  const [busy, setBusy] = useState(false)

  async function handleApprove(action, notes = "") {
    setBusy(true)
    try {
      await apiRequest(`/time/logs/${log.id}/approve/`, {
        method: "POST",
        json: { action, admin_notes: notes }
      })
      onAction()
    } catch { /* ignore */ }
    finally { setBusy(false) }
  }

  return (
    <tr className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors ${isLive ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
      <td className="p-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${isLive ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
            {(log.employee_name || "?").charAt(0)}
          </div>
          <div>
            <div className="text-sm font-black text-slate-900 dark:text-white">{log.employee_name}</div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">@{log.employee_username}</div>
          </div>
        </div>
      </td>
      <td className="p-6">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{log.work_date}</div>
      </td>
      <td className="p-6">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">In</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDateTime(log.clock_in).split(",")[1]}</span>
            </div>
            {log.clock_out && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Out</span>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatDateTime(log.clock_out).split(",")[1]}</span>
              </div>
            )}
            {log.breaks && log.breaks.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-w-[180px]">
                {log.breaks.map((b, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {b.break_type === "tea" ? "☕ Tea" : b.break_type === "lunch" ? "🍱 Lunch" : "💤 Break"}: {b.duration_minutes ? `${b.duration_minutes}m` : "Active"}
                  </span>
                ))}
              </div>
            )}
          </div>
          {isLive && (
            <div className="px-2 py-0.5 bg-indigo-600 text-white text-[9px] font-black rounded-full animate-pulse">LIVE</div>
          )}
        </div>
      </td>
      <td className="p-6">
        <div className="flex items-center gap-2">
          {log.clock_in_photo && (
            <a href={log.clock_in_photo} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-110 transition-transform">
              <img src={log.clock_in_photo} className="w-full h-full object-cover" />
            </a>
          )}
          {log.clock_out_photo && (
            <a href={log.clock_out_photo} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-110 transition-transform">
              <img src={log.clock_out_photo} className="w-full h-full object-cover" />
            </a>
          )}
          {!log.clock_in_photo && !log.clock_out_photo && <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">N/A</span>}
        </div>
      </td>
      <td className="p-6">
        <div className="flex flex-col gap-2">
          <Pill variant={log.status === 'approved' ? 'success' : log.status === 'rejected' ? 'danger' : log.status === 'submitted' ? 'warning' : 'neutral'}>
            {log.status === 'submitted' ? 'In Review' : (log.status || (isLive ? 'Live' : 'Draft'))}
          </Pill>
          {log.face_match_status && log.face_match_status !== 'skipped' && (
            <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${log.face_match_status === 'matched' || log.status === 'approved' ? 'text-emerald-500' : 'text-red-500'}`}>
              {log.face_match_status === 'matched' || log.status === 'approved' ? <Check size={10} /> : <AlertCircle size={10} />}
              {log.face_match_status === 'matched' || log.status === 'approved' ? 'Verified' : 'Mismatch'}
            </div>
          )}
        </div>
      </td>
      <td className="p-6 text-right font-black text-slate-900 dark:text-white">
        {formatDuration(isLive ? elapsed : log.worked_seconds)}
      </td>
      <td className="p-6 text-right">
        <div className="inline-flex items-center gap-2">
          <button
            onClick={onView}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all"
            title="Inspect Timeline"
          >
            <EyeIcon size={15} />
          </button>
          <button
            onClick={() => downloadLogPdf(log.id)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all"
            title="Download PDF Summary"
          >
            <DownloadIcon size={15} />
          </button>
          {log.status === "submitted" && (
            <>
              <button
                disabled={busy}
                onClick={() => handleApprove("approve")}
                className="p-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 transition-all"
                title="Approve Shift"
              >
                <Check size={15} />
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  const reason = prompt("Enter rejection reason:")
                  if (reason) handleApprove("reject", reason)
                }}
                className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-400 transition-all"
                title="Reject Shift"
              >
                <XCircleIcon size={15} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function EyeIcon({ size }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg> }
function DownloadIcon({ size }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function XCircleIcon({ size }) { return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> }

function formatDuration(seconds) {
  if (!seconds) return "00:00:00"
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0")
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0")
  const s = Math.floor(seconds % 60).toString().padStart(2, "0")
  return `${h}:${m}:${s}`
}

export default function AuditLedgerPage() {
  const { isAdmin } = useRole()
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchQ, setSearchQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo] = useState("")
  const [selectedAuditLog, setSelectedAuditLog] = useState(null)
  const [sortField, setSortField] = useState("work_date")
  const [sortDir, setSortDir] = useState("desc")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set("date_from", filterFrom)
      if (filterTo) params.set("date_to", filterTo)
      const [logsRes, empRes] = await Promise.allSettled([
        apiRequest(`/time/logs/?${params}`),
        apiRequest("/employees/"),
      ])
      if (logsRes.status === "fulfilled") setLogs(unwrapResults(logsRes.value))
      if (empRes.status === "fulfilled") setEmployees(unwrapResults(empRes.value))
    } catch (e) { setError("Failed to load audit ledger data.") }
    finally { setLoading(false) }
  }, [filterFrom, filterTo])

  useEffect(() => {
    // Default to current month range
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-CA")
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("en-CA")
    setFilterFrom(firstDay)
    setFilterTo(lastDay)
  }, [])

  useEffect(() => {
    if (filterFrom && filterTo) load()
  }, [filterFrom, filterTo, load])

  const filteredLogs = useMemo(() => {
    let arr = [...logs]
    if (statusFilter === "live") arr = arr.filter(l => !l.clock_out)
    if (statusFilter === "submitted") arr = arr.filter(l => l.status === "submitted")
    if (statusFilter === "done") arr = arr.filter(l => !!l.clock_out)
    if (searchQ) {
      const q = searchQ.toLowerCase()
      arr = arr.filter(l =>
        (l.employee_name || "").toLowerCase().includes(q) ||
        (l.employee_username || "").toLowerCase().includes(q) ||
        (l.work_date || "").includes(q)
      )
    }
    arr.sort((a, b) => {
      let va = a[sortField], vb = b[sortField]
      if (sortField === "clock_in" || sortField === "clock_out") {
        va = va ? new Date(va).getTime() : 0
        vb = vb ? new Date(vb).getTime() : 0
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [logs, statusFilter, searchQ, sortField, sortDir])

  if (!isAdmin) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Access Denied</h1>
        <p className="text-slate-500 mt-2">Administrator privileges are required to view the Audit Ledger.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-bg dark:bg-bg overflow-hidden animate-[fadeIn_0.4s_ease-out]">
      {/* ── HEADER ── */}
      <div className="h-24 bg-surface dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Audit Ledger</h1>
          <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">
            {filteredLogs.length} Records synchronized
          </div>
        </div>
        <button
          onClick={load}
          className="w-12 h-12 bg-surface dark:bg-slate-800 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-2xl border border-stroke dark:border-slate-700 shadow-sm transition-all flex items-center justify-center group"
        >
          <RefreshCw size={20} className={`${loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* Filters Panel */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-4 p-3 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-3xl">
          {/* Search */}
          <div className="flex items-center gap-3 bg-surface dark:bg-slate-900 rounded-2xl px-5 py-3 border border-stroke dark:border-slate-800 shadow-sm w-full xl:w-auto xl:flex-1 xl:max-w-md">
            <Search size={18} className="text-indigo-400" />
            <input
              type="text"
              placeholder="Search personnel by name or ID..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="bg-transparent border-none text-[13px] font-bold text-slate-700 dark:text-slate-300 outline-none w-full placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
            {/* Status Tabs */}
            <div className="flex items-center bg-surface dark:bg-slate-900 border border-stroke dark:border-slate-800 rounded-2xl p-1 shadow-sm">
              {["all", "live", "submitted", "done"].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                >
                  {status === "all" ? "All" : status === "live" ? "Active" : status === "submitted" ? "Review" : "Completed"}
                </button>
              ))}
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-surface dark:bg-slate-900 border border-stroke dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-stroke">
                <Calendar size={14} className="text-slate-400" />
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="bg-transparent text-[11px] font-black text-slate-700 dark:text-slate-300 outline-none" />
              </div>
              <ChevronRight size={14} className="text-slate-300" />
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-stroke">
                <Calendar size={14} className="text-slate-400" />
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="bg-transparent text-[11px] font-black text-slate-700 dark:text-slate-300 outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-hidden rounded-3xl border border-stroke dark:border-slate-800/80 bg-surface dark:bg-slate-900/60 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-stroke dark:border-slate-800">
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Employee</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Shift Date</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Timeline</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Photos</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest">Verification</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Duration</th>
                  <th className="p-6 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-slate-800/50">
                {filteredLogs.map(l => (
                  <AdminLogRow key={l.id} log={l} onAction={load} onView={() => setSelectedAuditLog(l)} />
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-4 text-slate-400">
                        <FileText size={48} className="opacity-10" />
                        <div className="font-bold">No attendance records found</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Inspect Shift Details Modal */}
      {selectedAuditLog && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-surface dark:bg-slate-900 w-full max-w-5xl rounded-[2rem] shadow-2xl border border-stroke dark:border-slate-800 flex flex-col my-auto relative overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-8 border-b border-stroke dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3 tracking-tight">
                  <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                    <Clock size={24} />
                  </div>
                  Shift Summary
                </h2>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-2">
                  Detailed timeline of work hours, breaks, and location records for <strong className="text-indigo-600">{selectedAuditLog.employee_name}</strong>
                </p>
              </div>
              <button onClick={() => setSelectedAuditLog(null)} className="p-3 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl border border-stroke shadow-sm hover:scale-105 transition-all">
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
              {(() => {
                const log = selectedAuditLog;
                const isApproved = log.status === "approved";
                const clockInTime = log.clock_in ? new Date(log.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                const clockOutTime = log.clock_out ? new Date(log.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "In Progress";
                
                const allocateTime = "09:00 AM - 05:00 PM (8.00h Shift)";
                const teaBreaks = log.breaks?.filter(b => b.break_type === "tea") || [];
                const lunchBreaks = log.breaks?.filter(b => b.break_type === "lunch") || [];
                const otherBreaks = log.breaks?.filter(b => b.break_type === "other") || [];
                const totalTeaMin = teaBreaks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                const totalLunchMin = lunchBreaks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                const totalOtherMin = otherBreaks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Photos */}
                    <div className="col-span-1 lg:col-span-3 flex flex-col gap-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Photos</h3>
                      <div className="flex flex-col gap-4">
                        <div className="relative rounded-2xl overflow-hidden border border-stroke bg-slate-50 h-32 group">
                          {log.clock_in_photo ? (
                            <img src={log.clock_in_photo} alt="Clock In" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                              <Camera size={24} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">No In Photo</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-[9px] font-black rounded-lg shadow-sm">CLOCK IN</div>
                        </div>

                        <div className="relative rounded-2xl overflow-hidden border border-stroke bg-slate-50 h-32 group">
                          {log.clock_out_photo ? (
                            <img src={log.clock_out_photo} alt="Clock Out" className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                              <Camera size={24} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">No Out Photo</span>
                            </div>
                          )}
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-[9px] font-black rounded-lg shadow-sm">
                            {log.clock_out ? "CLOCK OUT" : "IN PROGRESS"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="col-span-1 lg:col-span-9 flex flex-col gap-6 lg:border-l border-stroke lg:pl-8">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {new Date(log.work_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <Pill variant={isApproved ? "success" : "neutral"}>{log.status}</Pill>
                      </div>

                      <div className="flex flex-col gap-6 relative before:absolute before:inset-y-0 before:left-2 before:w-0.5 before:bg-slate-100">
                        <div className="relative flex gap-4">
                          <div className="absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white"></div>
                          <div className="pl-6 flex flex-col">
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Shift Allocated</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white mt-1">Standard Target Slot: {allocateTime}</span>
                          </div>
                        </div>

                        <div className="relative flex gap-4">
                          <div className="absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                          <div className="pl-6 flex flex-col">
                            <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest">Clocked In</span>
                            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                              {clockInTime} {log.distance_from_site_meters !== undefined && `(${log.distance_from_site_meters}m from Site)`}
                            </div>
                            {log.clock_in_address && <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12} /> {log.clock_in_address}</div>}
                          </div>
                        </div>

                        <div className="relative flex gap-4">
                          <div className="absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-white"></div>
                          <div className="pl-6 flex flex-col">
                            <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Breaks</span>
                            <div className="flex gap-2 mt-1">
                              <span className="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-xs font-bold rounded-lg">Tea: {totalTeaMin}m</span>
                              <span className="px-2 py-1 bg-slate-50 dark:bg-slate-800 text-xs font-bold rounded-lg">Lunch: {totalLunchMin}m</span>
                            </div>
                          </div>
                        </div>

                        <div className="relative flex gap-4">
                          <div className="absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 ring-4 ring-white"></div>
                          <div className="pl-6 flex flex-col">
                            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Clocked Out</span>
                            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{clockOutTime}</div>
                            {log.clock_out_address && <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12} /> {log.clock_out_address}</div>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="px-8 py-6 border-t border-stroke dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/50 flex justify-end gap-3">
              <Button type="button" onClick={() => setSelectedAuditLog(null)}>Close</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
