import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star, RefreshCw, BarChart3, TrendingUp, ThumbsUp, CheckCircle2,
  Zap, Target, Activity
} from "lucide-react"
import { apiRequest } from "../../api/client.js"

// ── Helpers ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, suffix = "" }) {
  return (
    <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          <Icon size={16} strokeWidth={2.5} />
        </div>
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
        {value}<span style={{ fontSize: "1rem", color: "#94a3b8", fontWeight: 700, marginLeft: 2 }}>{suffix}</span>
      </div>
    </div>
  )
}

function StarRating({ score, max = 5 }) {
  const val = parseFloat(score || 0)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
      {[...Array(max)].map((_, i) => (
        <Star
          key={i}
          size={14}
          style={{ color: i < Math.round(val) ? "#F59E0B" : "#e2e8f0", fill: i < Math.round(val) ? "#F59E0B" : "transparent" }}
        />
      ))}
      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#475569", marginLeft: "0.3rem" }}>{val.toFixed(1)}</span>
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
        if (mounted && pRes?.success) setPerformance(pRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) setPerfLoading(false)
      }
    }
    loadStats()
    return () => { mounted = false }
  }, [])

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Star size={24} style={{ color: "#F59E0B" }} /> My Feedback & Performance
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem", fontWeight: 500 }}>
          View your latest customer feedback scores, satisfaction metrics, and job completion statistics.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {perfLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 0" }}>
            <RefreshCw size={24} style={{ color: "#7C3AED", animation: "spin 0.8s linear infinite" }} />
            <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontWeight: 700, marginTop: "1rem" }}>Loading stats...</span>
          </motion.div>
        ) : !performance || parseInt(performance.feedback_count || 0) === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 0", textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <BarChart3 size={28} style={{ color: "#94A3B8" }} />
            </div>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#475569" }}>No feedback yet</h3>
            <p style={{ fontSize: "0.85rem", color: "#94a3b8", maxWidth: 300, marginTop: "0.5rem" }}>
              Complete jobs and receive customer feedback to populate your performance dashboard.
            </p>
          </motion.div>
        ) : (
          <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <KpiCard label="Jobs Completed" value={performance.jobs_completed_count} icon={CheckCircle2} color="#10B981" />
              <KpiCard label="Avg Rating" value={parseFloat(performance.average_rating || 0).toFixed(1)} icon={Star} color="#F59E0B" suffix="/5" />
              <KpiCard label="Completion Rate" value={parseFloat(performance.completion_rate || 0).toFixed(0)} icon={Target} color="#7C3AED" suffix="%" />
              <KpiCard label="CSAT Score" value={parseFloat(performance.customer_satisfaction_score || 0).toFixed(1)} icon={ThumbsUp} color="#3B82F6" suffix="/5" />
            </div>

            {/* Detailed Stats */}
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0f172a", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Activity size={16} style={{ color: "#7C3AED" }} /> Detailed Metrics
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>Average Rating</span>
                <StarRating score={performance.average_rating} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>Customer Satisfaction</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "#3B82F6" }}>
                  {parseFloat(performance.customer_satisfaction_score || 0).toFixed(2)} / 5.00
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>Feedback Count</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "#0f172a" }}>{performance.feedback_count}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "1rem 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>Completion Rate</span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "#0f172a" }}>{parseFloat(performance.completion_rate || 0).toFixed(1)}%</span>
                </div>
                <div style={{ width: "100%", height: 6, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#7C3AED", borderRadius: 99, width: `${Math.min(parseFloat(performance.completion_rate || 0), 100)}%` }} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#475569" }}>Last Updated</span>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                  {performance.last_updated ? new Date(performance.last_updated).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
            </div>

            {/* Tips */}
            <div style={{ marginTop: "1.5rem", background: "#faf5ff", border: "1px solid #DDD6FE", borderRadius: 16, padding: "1.25rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#7C3AED", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Zap size={14} /> Tips to improve your rating
              </div>
              {[
                "Arrive on time for every scheduled booking",
                "Keep customer informed of progress",
                "Upload completion proof photos after every job",
                "Be professional and courteous at all times",
              ].map(tip => (
                <div key={tip} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8rem", color: "#475569", padding: "0.25rem 0", fontWeight: 500 }}>
                  <span style={{ color: "#10B981", fontWeight: 800, flexShrink: 0 }}>✓</span> {tip}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
