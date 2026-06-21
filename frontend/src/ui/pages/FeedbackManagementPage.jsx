import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, MessageSquare, User, Calendar, ThumbsUp, ThumbsDown, Filter, RefreshCw, AlertCircle, TrendingUp, CheckCircle, BarChart3 } from "lucide-react"
import { apiRequest } from "../../api/client.js"

export function FeedbackManagementPage() {
  const [feedbackList, setFeedbackList] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters
  const [rating, setRating] = useState("")
  const [employeeId, setEmployeeId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const loadFeedbackData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (rating) params.append("rating", rating)
      if (employeeId) params.append("employee_id", employeeId)
      if (dateFrom) params.append("date_from", dateFrom)
      if (dateTo) params.append("date_to", dateTo)

      const [listRes, metricsRes] = await Promise.all([
        apiRequest(`/admin/feedback/?${params.toString()}`),
        apiRequest("/admin/feedback/metrics/"),
      ])

      if (listRes?.success && metricsRes?.success) {
        setFeedbackList(Array.isArray(listRes.data) ? listRes.data : [])
        setMetrics(metricsRes.data)
      } else {
        setError("Failed to fetch feedback logs.")
      }
    } catch (err) {
      console.error(err)
      setError("Failed to load feedback from server.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeedbackData()
    // Load employee assignment picker list
    apiRequest("/admin/service-requests/employees/")
      .then((res) => {
        if (res?.success) setEmployees(res.data)
      })
      .catch((err) => console.error(err))
  }, [rating, employeeId, dateFrom, dateTo])

  const renderStars = (ratingVal) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${
              s <= ratingVal ? "fill-amber-400 text-amber-400" : "text-slate-700"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-950 text-slate-100 min-h-screen">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-white leading-tight">Feedback & Performance Reviews</h1>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-1">
            Monitor overall client satisfaction, technician performance reviews, and ticket resolution feedback.
          </p>
        </div>
        <button
          onClick={loadFeedbackData}
          className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all shadow-sm self-stretch sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Top Banner: Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metric 1: Total Feedback */}
        <div className="p-5 bg-gradient-to-br from-slate-900/60 to-indigo-950/20 border border-slate-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Feedbacks</span>
          <h2 className="text-3xl font-black text-white mt-2">
            {metrics?.total_feedback ?? 0}
          </h2>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Submitted customer reviews</span>
        </div>

        {/* Metric 2: Average Rating */}
        <div className="p-5 bg-gradient-to-br from-slate-900/60 to-amber-950/20 border border-slate-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Average Rating</span>
          <h2 className="text-3xl font-black text-white mt-2 flex items-baseline gap-1.5">
            {metrics?.average_rating ?? "0.00"}
            <span className="text-xs font-semibold text-slate-500">/ 5.00</span>
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            {renderStars(Math.round(metrics?.average_rating ?? 0))}
          </div>
        </div>

        {/* Metric 3: Resolution Rate */}
        <div className="p-5 bg-gradient-to-br from-slate-900/60 to-emerald-950/20 border border-slate-800 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-4 top-4 w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
            <CheckCircle className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Issue Resolution Rate</span>
          <h2 className="text-3xl font-black text-white mt-2">
            {metrics?.issue_resolution_rate ?? "0.0"}%
          </h2>
          <span className="text-[10px] font-bold text-slate-500 block mt-1">Confirmed solved by customers</span>
        </div>

      </div>

      {/* Filter panel */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row flex-wrap gap-4 items-end">
        
        {/* Rating filter */}
        <div className="space-y-1.5 w-full md:w-auto md:flex-1 min-w-[150px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-indigo-400" />
            Rating
          </label>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>

        {/* Technician filter */}
        <div className="space-y-1.5 w-full md:w-auto md:flex-1 min-w-[200px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-indigo-400" />
            Technician
          </label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Technicians</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="space-y-1.5 w-full md:w-auto md:flex-1 min-w-[150px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            From Date
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Date To */}
        <div className="space-y-1.5 w-full md:w-auto md:flex-1 min-w-[150px]">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            To Date
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-1.5 px-3 text-xs font-bold text-slate-300 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Reset button */}
        {(rating || employeeId || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setRating("")
              setEmployeeId("")
              setDateFrom("")
              setDateTo("")
            }}
            className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-600/20 text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl transition-all shadow-sm w-full md:w-auto shrink-0"
          >
            Clear Filters
          </button>
        )}

      </div>

      {/* Main Reviews Board */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            Submitted Reviews & Comments
          </h3>
          <span className="text-[10px] font-black text-slate-500 bg-slate-950 border border-slate-800 px-2.5 py-0.5 rounded-full">
            {feedbackList.length} logs
          </span>
        </div>

        {loading && (!Array.isArray(feedbackList) || feedbackList.length === 0) ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-black uppercase tracking-widest">Loading Reviews...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-red-500/80 mx-auto" />
            <div className="text-xs font-bold text-slate-400">{error}</div>
          </div>
        ) : (!Array.isArray(feedbackList) || feedbackList.length === 0) ? (
          <div className="p-12 text-center text-xs font-bold text-slate-500 uppercase tracking-widest italic">
            No customer feedback logs found matching filters.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {feedbackList.map((fb, idx) => (
              <div key={fb.id || idx} className="p-5 flex flex-col md:flex-row justify-between gap-4 items-start hover:bg-slate-900/10 transition-colors">
                
                {/* Customer, Service request info */}
                <div className="space-y-2 md:max-w-md">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-black text-indigo-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                      {fb.service_request?.request_id}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      {new Date(fb.submitted_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-white">{fb.service_request?.issue_title}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      Customer: <span className="text-slate-300 font-bold">{fb.service_request?.customer_name}</span>
                    </p>
                  </div>
                  {fb.comment ? (
                    <p className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-xs font-medium text-slate-300 leading-relaxed italic">
                      &ldquo;{fb.comment}&rdquo;
                    </p>
                  ) : (
                    <p className="text-[10px] font-semibold text-slate-600 italic">No additional review comment provided.</p>
                  )}
                </div>

                {/* Star rating and Quality badges */}
                <div className="flex flex-col md:items-end gap-3 self-stretch md:self-auto justify-between border-t border-slate-800/60 md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0">
                  <div className="flex items-center gap-3 justify-between md:justify-end">
                    <span className="text-xs font-bold text-slate-400 hidden md:inline">Rating:</span>
                    <div className="flex flex-col items-end gap-1">
                      {renderStars(fb.rating)}
                      <span className="text-[10px] font-black text-amber-400 mt-0.5">{fb.rating} out of 5</span>
                    </div>
                  </div>

                  {/* Technician info */}
                  {fb.technician && (
                    <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 px-3 py-1.5 rounded-xl self-start md:self-auto">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-extrabold text-[9px] border border-indigo-500/20">
                        {fb.technician.full_name?.charAt(0) || "T"}
                      </div>
                      <div className="text-[10px] font-extrabold text-slate-300">
                        {fb.technician.full_name}
                      </div>
                    </div>
                  )}

                  {/* Resolution indicators & Details */}
                  <div className="flex gap-2 items-center text-[10px] font-black uppercase tracking-wider justify-between md:justify-end">
                    <span className="text-slate-500 font-semibold">Quality score:</span>
                    <span className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold">
                      Work: {fb.work_quality}
                    </span>
                    <span className="bg-slate-950 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold">
                      Behavior: {fb.employee_behaviour}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded border flex items-center gap-1 text-[9px] ${
                      fb.issue_resolved
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                    }`}>
                      {fb.issue_resolved ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                      {fb.issue_resolved ? "Solved" : "Unresolved"}
                    </span>
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
