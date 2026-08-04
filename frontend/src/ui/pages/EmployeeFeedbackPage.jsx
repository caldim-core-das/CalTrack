import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star, RefreshCw, BarChart3, TrendingUp, ThumbsUp, CheckCircle2,
  Zap, Target, Activity, ShieldCheck, Clock, MessageSquare, Award,
  Sparkles, UserCheck, Inbox
} from "lucide-react"
import { apiRequest } from "../../api/client.js"

// ── Helpers ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, suffix = "", subtitle }) {
  return (
    <div style={{ background: "white", borderRadius: 18, border: "1px solid #e2e8f0", padding: "1.25rem", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
        {value}<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 700, marginLeft: 2 }}>{suffix}</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: "0.72rem", color: color, fontWeight: 700, marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <TrendingUp size={12} /> {subtitle}
        </div>
      )}
    </div>
  )
}

function StarRating({ score, max = 5, size = 14 }) {
  const val = parseFloat(score || 0)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          size={size}
          style={{ color: i < Math.round(val) ? "#F59E0B" : "#cbd5e1", fill: i < Math.round(val) ? "#F59E0B" : "transparent" }}
        />
      ))}
      <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", marginLeft: "0.3rem" }}>{val.toFixed(1)}</span>
    </div>
  )
}

export function EmployeeFeedbackPage() {
  const [performance, setPerformance] = useState(null)
  const [perfLoading, setPerfLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const loadStats = async () => {
      setPerfLoading(true)
      try {
        const pRes = await apiRequest("/employee/performance/")
        if (mounted && pRes?.success) {
          setPerformance(pRes.data)
        }
      } catch (err) {
        console.error("Failed to load performance:", err)
      } finally {
        if (mounted) setPerfLoading(false)
      }
    }
    loadStats()
    return () => { mounted = false }
  }, [])

  // Real Database Metrics
  const jobsCompleted = performance?.jobs_completed_count ?? performance?.jobs_completed ?? 0
  const avgRatingVal = parseFloat(performance?.average_rating || 0)
  const avgRating = avgRatingVal > 0 ? avgRatingVal.toFixed(1) : "0.0"
  const completionRateVal = parseFloat(performance?.completion_rate || 0)
  const completionRate = completionRateVal.toFixed(1)
  const csatScoreVal = parseFloat(performance?.customer_satisfaction_score || 0)
  const csatScore = csatScoreVal.toFixed(1)
  const feedbackCount = parseInt(performance?.feedback_count || 0)

  // All records from backend: split by source
  const allRecords = (performance?.recent_feedback || performance?.feedback_list || [])
  // Rated by customer (ServiceFeedback)
  const ratedFeedbacks = allRecords.filter(f => f.source === "service_feedback" || (f.rating !== null && f.rating !== undefined))
  // Completed tasks not yet rated
  const taskHistory = allRecords.filter(f => f.source === "task" && (f.rating === null || f.rating === undefined))

  // Calculate real distribution only from rated entries
  const totalReviews = ratedFeedbacks.length
  const distCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let resolvedCount = 0

  ratedFeedbacks.forEach(f => {
    if (f.rating !== null && f.rating !== undefined) {
      const r = Math.min(5, Math.max(1, Math.round(f.rating)))
      distCounts[r] = (distCounts[r] || 0) + 1
    }
    if (f.issue_resolved) resolvedCount += 1
  })

  const avgBehaviour = avgRatingVal > 0 ? avgRatingVal.toFixed(1) : "—"
  const avgQuality = avgRatingVal > 0 ? avgRatingVal.toFixed(1) : "—"
  const issueResolutionRate = totalReviews > 0 ? Math.round((resolvedCount / totalReviews) * 100) : (jobsCompleted > 0 ? 100 : 0)

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1.5rem" }}>
      {/* Header Banner */}
      <div style={{ marginBottom: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.75rem", margin: 0 }}>
            <Star size={24} style={{ color: "#F59E0B", fill: "#F59E0B" }} /> My Feedback & Performance
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem", fontWeight: 500 }}>
            Real-time customer satisfaction metrics and performance history from verified completed jobs.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F1F5F9", padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 800, color: "#475569" }}>
          <Sparkles size={14} style={{ color: "#7C3AED" }} /> Verified Database Sync
        </div>
      </div>

      <AnimatePresence mode="wait">
        {perfLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
            <RefreshCw size={24} style={{ color: "#7C3AED", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700, marginTop: "1rem" }}>Loading performance data from server...</span>
          </motion.div>
        ) : (
          <motion.div key="perf" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Real KPI Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <KpiCard label="Jobs Completed" value={jobsCompleted} icon={CheckCircle2} color="#10B981" subtitle={`${jobsCompleted} verified jobs`} />
              <KpiCard label="Average Rating" value={avgRating} icon={Star} color="#F59E0B" suffix="/5" subtitle={feedbackCount > 0 ? `Based on ${feedbackCount} reviews` : "No ratings yet"} />
              <KpiCard label="Completion Rate" value={completionRate} icon={Target} color="#7C3AED" suffix="%" subtitle="Real job completion" />
              <KpiCard label="CSAT Score" value={csatScore} icon={ThumbsUp} color="#3B82F6" suffix="/5" subtitle="Customer satisfaction" />
            </div>

            {/* Real Operational Stats */}
            <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: 20, padding: "1.5rem", color: "#fff", marginBottom: "2rem", boxShadow: "0 10px 25px -5px rgba(15,23,42,0.15)" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
                <Award size={16} style={{ color: "#F59E0B" }} /> Real Work Execution Summary
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
                    <CheckCircle2 size={15} style={{ color: "#10B981" }} /> {jobsCompleted} Work Orders Completed
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Total assigned tasks executed in system.</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={15} style={{ color: "#3B82F6" }} /> Real Photo Verification
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Before & After facial verification active.</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 14, padding: "1rem", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#f8fafc", display: "flex", alignItems: "center", gap: 6 }}>
                    <MessageSquare size={15} style={{ color: "#A855F7" }} /> {feedbackCount} Feedback Submissions
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>Customer reviews recorded in database.</div>
                </div>
              </div>
            </div>

            {/* Ratings Breakdown & Customer Reviews Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "1.5rem", marginBottom: "2rem" }}>
              {/* Real Rating Breakdown */}
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "1.5rem", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <BarChart3 size={16} style={{ color: "#7C3AED" }} /> Rating Distribution
                </div>

                {[5, 4, 3, 2, 1].map(stars => {
                  const count = distCounts[stars] || 0
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
                  return (
                    <div key={stars} style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#475569", width: 45 }}>{stars} Stars</span>
                      <div style={{ flex: 1, height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: stars >= 4 ? "#F59E0B" : "#cbd5e1", borderRadius: 99, width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#64748b", width: 35, textAlign: "right" }}>{pct}%</span>
                    </div>
                  )
                })}

                <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                    <span>Avg Customer Rating</span>
                    <span style={{ color: "#10B981", fontWeight: 900 }}>{avgBehaviour !== "—" ? `${avgBehaviour} / 5.0 ⭐` : "No ratings yet"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                    <span>Feedback Received</span>
                    <span style={{ color: "#3B82F6", fontWeight: 900 }}>{feedbackCount} reviews</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "#475569" }}>
                    <span>Issue Resolution Rate</span>
                    <span style={{ color: "#7C3AED", fontWeight: 900 }}>{issueResolutionRate}% ✅</span>
                  </div>
                </div>
              </div>

              {/* Customer Feedback & Work History Panel */}
              <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "1.5rem", boxShadow: "0 2px 10px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                {/* ── Rated Customer Reviews ── */}
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <MessageSquare size={16} style={{ color: "#3B82F6" }} /> Customer Ratings
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>{ratedFeedbacks.length} feedback received</span>
                  </div>
                  {ratedFeedbacks.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "1.5rem 1rem", background: "#F8FAFC", borderRadius: 14, border: "1px dashed #cbd5e1" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#64748b" }}>No customer ratings yet</div>
                      <div style={{ fontSize: "0.73rem", color: "#94a3b8", marginTop: 4 }}>Customer ratings are submitted by customers after service completion via feedback link</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {ratedFeedbacks.map((item, idx) => (
                        <div key={item.id || idx} style={{ background: "#F8FAFC", borderRadius: 14, padding: "1rem", border: "1px solid #e2e8f0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>
                              {item.customer_name || item.request_id || `Feedback #${idx + 1}`}
                            </div>
                            <StarRating score={item.rating} />
                          </div>
                          {item.service_type && (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, marginBottom: "0.35rem" }}>{item.service_type}</div>
                          )}
                          {item.comment && (
                            <p style={{ fontSize: "0.78rem", color: "#334155", margin: 0, fontWeight: 500, lineHeight: 1.5 }}>"{item.comment}"</p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.6rem", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>
                            <span style={{ color: "#059669", fontWeight: 800 }}>✓ Verified Customer Feedback</span>
                            <span>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Completed Tasks (Work History, Pending Rating) ── */}
                {taskHistory.length > 0 && (
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <CheckCircle2 size={16} style={{ color: "#10B981" }} /> Completed Work History
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700 }}>{taskHistory.length} tasks</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                      {taskHistory.map((item, idx) => (
                        <div key={item.id || idx} style={{ background: "#F0FDF4", borderRadius: 14, padding: "1rem", border: "1px solid #BBF7D0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a" }}>
                              {item.customer_name && item.customer_name !== "Customer" ? item.customer_name : item.request_id || `Task #${idx + 1}`}
                            </div>
                            <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#D97706", background: "#FEF3C7", padding: "3px 8px", borderRadius: 20, border: "1px solid #FDE68A" }}>
                              ⏳ Pending Rating
                            </span>
                          </div>
                          {item.service_type && item.service_type !== item.customer_name && (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", fontWeight: 700, marginBottom: "0.35rem" }}>{item.service_type}</div>
                          )}
                          {item.comment && (
                            <p style={{ fontSize: "0.78rem", color: "#334155", margin: 0, fontWeight: 500, lineHeight: 1.5 }}>Notes: {item.comment}</p>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.6rem", fontSize: "0.7rem", color: "#94a3b8", fontWeight: 600 }}>
                            <span style={{ color: "#10B981", fontWeight: 800 }}>✓ Work Completed</span>
                            <span>{item.completed_at || item.submitted_at ? new Date(item.completed_at || item.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Recent"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* Proactive Improvement Tips */}
            <div style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)", border: "1.5px solid #DDD6FE", borderRadius: 20, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#7C3AED", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Zap size={16} /> Best Practices for Top Performance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                {[
                  "Arrive on time for every scheduled booking slot",
                  "Explain repair/service steps clearly to the customer",
                  "Capture crisp Before & After photos to unlock quick verification",
                  "Maintain a clean work area before leaving the client premises",
                ].map(tip => (
                  <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.78rem", color: "#4c1d95", fontWeight: 600 }}>
                    <span style={{ color: "#10B981", fontWeight: 900, flexShrink: 0 }}>✓</span> {tip}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
