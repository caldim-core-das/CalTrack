import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Star, RefreshCw, Award, BarChart3, TrendingUp, ThumbsUp, CheckCircle2 } from "lucide-react"
import { apiRequest } from "../../api/client.js"

export function EmployeeJobsPage() {
  const [performance, setPerformance] = useState(null)
  const [perfLoading, setPerfLoading] = useState(true)

  const loadPerformance = async () => {
    setPerfLoading(true)
    try {
      const response = await apiRequest("/employee/performance/")
      if (response?.success) {
        setPerformance(response.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setPerfLoading(false)
    }
  }

  useEffect(() => {
    loadPerformance()
  }, [])

  const renderRatingStars = (score) => {
    const num = Math.round(score || 0)
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-4 h-4 ${
              s <= num ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-bg text-fg font-body">
      {/* Page Header */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-stroke dark:border-slate-800 shrink-0 bg-surface/40 backdrop-blur-xl">
        <div>
          <h1 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            My Performance Dashboard
          </h1>
        </div>

        <button
          onClick={loadPerformance}
          className="flex items-center gap-2 px-4 py-2 bg-surface dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 border border-stroke dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-white transition-colors duration-300 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="text-[10px] font-black uppercase tracking-widest">Refresh</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto w-full custom-scrollbar text-slate-800 dark:text-slate-200">
        {perfLoading && !performance ? (
          <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-400 h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <span className="text-xs font-black uppercase tracking-widest">Loading Stats...</span>
          </div>
        ) : !performance ? (
          <div className="p-8 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest border border-dashed border-stroke dark:border-slate-800 rounded-2xl bg-surface/50 dark:bg-slate-900/50">
            Performance metrics not populated yet. Submit customer feedbacks to recalculate.
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* KPI Aggregates layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Jobs Completed Count */}
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="absolute right-4 top-4 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Jobs Completed</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{performance.jobs_completed_count}</h3>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-550 mt-1 block">Finished assignments</span>
              </div>

              {/* Average Customer Rating */}
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="absolute right-4 top-4 w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center border border-amber-100/50 dark:border-amber-900/30 text-amber-600 dark:text-amber-400">
                  <Star className="w-4.5 h-4.5 fill-amber-400 text-amber-400" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Average Rating</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2 flex items-baseline gap-1">
                  {performance.average_rating}
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555">/ 5.0</span>
                </h3>
                <div className="mt-1.5">{renderRatingStars(performance.average_rating)}</div>
              </div>

              {/* Completion rate percentage */}
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="absolute right-4 top-4 w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Completion Rate</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{performance.completion_rate}%</h3>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-550 mt-1 block">Finished vs assigned</span>
              </div>

              {/* Customer satisfaction score */}
              <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
                <div className="absolute right-4 top-4 w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center border border-purple-100/50 dark:border-purple-900/30 text-purple-600 dark:text-purple-400">
                  <ThumbsUp className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Satisfaction Score</span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2 flex items-baseline gap-1">
                  {performance.customer_satisfaction_score}
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555">/ 5.0</span>
                </h3>
                <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-550 mt-1 block">Resolved issue ratio</span>
              </div>

            </div>

            {/* Feedback Log history */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800/65 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-350 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  My Customer Reviews Log
                </h3>
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 px-2.5 py-0.5 rounded-full">
                  {performance.recent_feedback?.length || 0} reviews
                </span>
              </div>

              {!performance.recent_feedback || performance.recent_feedback.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-slate-450 dark:text-slate-500 italic">
                  No customer review comments registered for you yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {performance.recent_feedback.map((fb, idx) => (
                    <div key={fb.id || idx} className="p-5 flex justify-between items-center hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100/40 dark:border-indigo-900/30 px-2 py-0.5 rounded text-[10px]">
                          {fb.request_id}
                        </span>
                        <span className="text-slate-400 dark:text-slate-555">•</span>
                        <span className="text-slate-400 dark:text-slate-500 font-semibold">{new Date(fb.submitted_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {renderRatingStars(fb.rating)}
                        <span className="text-[9px] font-black text-amber-500">{fb.rating} out of 5</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
