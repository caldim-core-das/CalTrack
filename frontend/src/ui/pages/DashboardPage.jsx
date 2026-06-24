import React, { useEffect, useMemo, useState, useRef, lazy, Suspense } from "react"
import { useNavigate } from "react-router-dom"
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion"
import {
  Clock, Users, Briefcase, CalendarDays, DollarSign, Loader2, AlertCircle, Timer,
  Activity, MapPin, ShieldAlert, TrendingUp, FileWarning, BadgeCheck, XCircle,
  CheckCircle2, ClipboardList, UserCheck, ArrowRight, ArrowUpRight, ArrowDownRight,
  Award, BookOpen, Percent, Phone, ShieldCheck, ChevronRight, LogIn, Lock, Trash2,
  Calendar, Eye
} from "lucide-react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { routes } from "../routes.js"
import { BarChart, LineChart, DoughnutChart } from "../components/DashboardCharts.jsx"
import { apiFetchRegistrationDossier, apiSaveRegistrationDossier } from "../../api/authService.js"

// ─── Employee Personal Dashboard ────────────────────────────

function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
    </span>
  )
}

function QuickNavBtn({ icon, label, color, gradient, onClick, badge }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "20px 12px", borderRadius: 20, border: "1.5px solid",
        borderColor: hovered ? `${color}60` : `${color}28`,
        background: hovered ? `linear-gradient(145deg, ${color}18, ${color}0a)` : `${color}0d`,
        cursor: "pointer", transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        transform: hovered ? "translateY(-4px) scale(1.04)" : "none",
        boxShadow: hovered ? `0 12px 32px ${color}28, 0 2px 8px ${color}18` : "0 2px 8px rgba(0,0,0,0.04)",
        position: "relative", flex: 1, minWidth: 90,
      }}
    >
      {badge > 0 && (
        <div style={{
          position: "absolute", top: 10, right: 10, minWidth: 18, height: 18,
          background: "#ef4444", borderRadius: 9, fontSize: 10, fontWeight: 900,
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px", lineHeight: 1, boxShadow: "0 2px 8px rgba(239,68,68,0.4)",
        }}>{badge}</div>
      )}
      <div style={{
        width: 48, height: 48, borderRadius: 16, display: "flex", alignItems: "center",
        justifyContent: "center", background: `linear-gradient(135deg, ${color}30, ${color}15)`,
        border: `1.5px solid ${color}35`, color,
        boxShadow: hovered ? `0 4px 16px ${color}30` : "none",
        transition: "box-shadow 0.22s",
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: hovered ? color : "var(--muted)", letterSpacing: "0.01em", textAlign: "center" }}>
        {label}
      </span>
    </button>
  )
}

function StatPill({ label, value, color, icon, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 20px",
        background: "var(--surface)", borderRadius: 18, border: "1.5px solid",
        borderColor: hovered ? `${color}50` : "var(--stroke)",
        boxShadow: hovered ? `0 8px 24px ${color}20, 0 2px 8px rgba(0,0,0,0.04)` : "0 2px 8px rgba(0,0,0,0.04)",
        cursor: onClick ? "pointer" : "default",
        transform: hovered && onClick ? "translateY(-2px)" : "none",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${color}20, ${color}10)`,
        border: `1.5px solid ${color}30`, display: "flex", alignItems: "center",
        justifyContent: "center", color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "var(--fg)", lineHeight: 1, letterSpacing: "-0.02em" }}>
          {value}
        </div>
      </div>
      {onClick && <ArrowRight size={16} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
    </div>
  )
}

function LeaveStatusBadge({ status }) {
  const cfg = {
    pending: { bg: "var(--warn-bg)", color: "var(--warn-text)", label: "Pending" },
    approved: { bg: "var(--good-bg)", color: "var(--good-text)", label: "Approved" },
    rejected: { bg: "var(--bad-bg)", color: "var(--bad-text)", label: "Rejected" },
  }[status] || { bg: "var(--bg2)", color: "var(--muted)", label: status }
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 20,
      background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 800,
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {cfg.label}
    </span>
  )
}

function EmployeeDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [leaves, setLeaves] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [rateInput, setRateInput] = useState("")
  const [rateSubmitting, setRateSubmitting] = useState(false)
  const [rateError, setRateError] = useState("")

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const greetingEmoji = hour < 12 ? "☀️" : hour < 17 ? "👋" : "🌙"

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [t, l, emp] = await Promise.all([
          apiRequest("/tasks/my/").catch(() => []),
          apiRequest("/leaves/").catch(() => []),
          apiRequest("/employees/me/").catch(() => null),
        ])
        setTasks(Array.isArray(t) ? t : unwrapResults(t))
        setLeaves(Array.isArray(l) ? l : unwrapResults(l))
        setEmployeeProfile(emp)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const [dateFilter, setDateFilter] = useState("all") // "all", "today", "week", "month", "custom"
  const [customDate, setCustomDate] = useState(new Date().toISOString().split("T")[0])
  const [taskStatusTab, setTaskStatusTab] = useState("all") // "all", "pending", "in_progress", "completed", "declined"
  const [leaveStatusTab, setLeaveStatusTab] = useState("all") // "all", "pending", "approved", "rejected"

  const getDateRange = useMemo(() => {
    if (dateFilter === "all") return null;
    
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (dateFilter === "today") {
      return [start, end];
    } else if (dateFilter === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      end.setDate(start.getDate() + 6);
      return [start, end];
    } else if (dateFilter === "month") {
      start.setDate(1);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      return [start, end];
    } else if (dateFilter === "custom") {
      const custom = new Date(customDate);
      custom.setHours(0, 0, 0, 0);
      const customEnd = new Date(customDate);
      customEnd.setHours(23, 59, 59, 999);
      return [custom, customEnd];
    }
    return null;
  }, [dateFilter, customDate]);

  const filteredTasksByDate = useMemo(() => {
    if (!getDateRange) return tasks;
    const [start, end] = getDateRange;
    return tasks.filter(t => {
      if (!t.due_date) return false;
      const tDate = new Date(t.due_date);
      return tDate >= start && tDate <= end;
    });
  }, [tasks, getDateRange]);

  const filteredLeavesByDate = useMemo(() => {
    if (!getDateRange) return leaves;
    const [start, end] = getDateRange;
    return leaves.filter(l => {
      if (!l.start_date) return false;
      const lStart = new Date(l.start_date);
      const lEnd = l.end_date ? new Date(l.end_date) : lStart;
      lStart.setHours(0, 0, 0, 0);
      lEnd.setHours(23, 59, 59, 999);
      return lStart <= end && lEnd >= start;
    });
  }, [leaves, getDateRange]);

  const filteredTasksByStatus = useMemo(() => {
    if (taskStatusTab === "all") return filteredTasksByDate;
    if (taskStatusTab === "pending") {
      return filteredTasksByDate.filter(t => t.acceptance_status === "pending_acceptance" || t.status === "pending");
    }
    if (taskStatusTab === "in_progress") {
      return filteredTasksByDate.filter(t => t.status === "in_progress");
    }
    if (taskStatusTab === "completed") {
      return filteredTasksByDate.filter(t => t.status === "completed");
    }
    if (taskStatusTab === "declined") {
      return filteredTasksByDate.filter(t => t.acceptance_status === "declined");
    }
    return filteredTasksByDate;
  }, [filteredTasksByDate, taskStatusTab]);

  const filteredLeavesByStatus = useMemo(() => {
    if (leaveStatusTab === "all") return filteredLeavesByDate;
    if (leaveStatusTab === "pending") {
      return filteredLeavesByDate.filter(l => l.status === "pending");
    }
    if (leaveStatusTab === "approved") {
      return filteredLeavesByDate.filter(l => l.status === "approved");
    }
    if (leaveStatusTab === "rejected") {
      return filteredLeavesByDate.filter(l => l.status === "rejected" || l.status === "cancelled");
    }
    return filteredLeavesByDate;
  }, [filteredLeavesByDate, leaveStatusTab]);

  const pendingAcceptance = filteredTasksByDate.filter(t => t.acceptance_status === "pending_acceptance").length
  const inProgress = filteredTasksByDate.filter(t => t.status === "in_progress").length
  const completedToday = filteredTasksByDate.filter(t => t.status === "completed").length
  const activeTasks = filteredTasksByDate.filter(t => t.status !== "completed" && t.status !== "cancelled").length

  const pendingLeaves = filteredLeavesByDate.filter(l => l.status === "pending").length
  const approvedLeaves = filteredLeavesByDate.filter(l => l.status === "approved").length
  const recentLeaves = filteredLeavesByDate.slice(0, 3)

  const firstName = user?.firstName || user?.first_name || user?.username || "there"
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="p-6 w-full flex flex-col gap-6 bg-bg dark:bg-bg">

      {/* ── Hero Header ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-3xl"
        style={{
          background: "linear-gradient(135deg, #312e81 0%, #4f46e5 45%, #7c3aed 100%)",
          padding: "32px 32px 80px",
        }}
      >
        {/* Decorative orbs */}
        <div style={{ position: "absolute", top: -60, right: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -80, left: 120, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 20, right: 200, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
              {today}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {greeting}, {firstName} {greetingEmoji}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, fontWeight: 500, marginTop: 8, marginBottom: 0 }}>
              Here's your personal workspace for today.
            </p>
          </div>
        </div>

        {/* Alert pill for pending tasks */}
        {pendingAcceptance > 0 && (
          <div
            onClick={() => navigate(routes.tasks)}
            style={{
              position: "absolute", bottom: 16, right: 32,
              background: "rgba(239,68,68,0.9)", backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.25)", borderRadius: 16,
              padding: "10px 18px", display: "flex", alignItems: "center",
              gap: 10, cursor: "pointer", boxShadow: "0 8px 24px rgba(239,68,68,0.4)",
              zIndex: 10, transition: "transform 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "none"}
          >
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
              {pendingAcceptance} task{pendingAcceptance > 1 ? "s" : ""} awaiting your response
            </span>
            <ArrowRight size={14} style={{ color: "rgba(255,255,255,0.8)" }} />
          </div>
        )}
      </div>

      {/* ── Quick Nav Cards (overlapping hero) ───────────── */}
      <div style={{ padding: "0 32px", marginTop: -52, position: "relative", zIndex: 5 }}>
        <div className="bg-surface dark:bg-slate-900/80 backdrop-blur-xl border border-stroke dark:border-slate-800 shadow-xl shadow-indigo-500/5 rounded-3xl" style={{
          padding: "20px 24px",
        }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <QuickNavBtn
              icon={<Clock size={22} />}
              label="Clock In/Out"
              color="#f59e0b"
              onClick={() => navigate(routes.time)}
            />
            <QuickNavBtn
              icon={<ClipboardList size={22} />}
              label="My Tasks"
              color="#4f46e5"
              onClick={() => navigate(routes.tasks)}
              badge={pendingAcceptance}
            />
            <QuickNavBtn
              icon={<CalendarDays size={22} />}
              label="My Leaves"
              color="#ec4899"
              onClick={() => navigate(routes.leaves)}
              badge={pendingLeaves}
            />
            <QuickNavBtn
              icon={<UserCheck size={22} />}
              label="My Profile"
              color="#10b981"
              onClick={() => navigate(routes.settings_profile)}
            />
            <QuickNavBtn
              icon={<Activity size={22} />}
              label="Time Logs"
              color="#6366f1"
              onClick={() => navigate(routes.time)}
            />
            <QuickNavBtn
              icon={<MapPin size={22} />}
              label="Locations"
              color="#0ea5e9"
              onClick={() => navigate(routes.locations)}
            />
          </div>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────── */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justify: "center", padding: "56px 0", color: "#94a3b8", gap: 12 }}>
          <Loader2 style={{ animation: "spin 0.7s linear infinite" }} size={24} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Loading your workspace…</span>
        </div>
      ) : (
        <>


          {/* ── Productivity Banner ───────────────────── */}
          <div style={{
            background: "linear-gradient(135deg, #312e81 0%, #4338ca 50%, #6d28d9 100%)",
            borderRadius: 24, padding: "24px 32px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
            boxShadow: "0 8px 32px rgba(79,70,229,0.25)",
            position: "relative", overflow: "hidden",
            marginBottom: 20,
          }}>
            <div style={{ position: "absolute", right: -30, top: -30, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Your Progress Today</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4 }}>
                {completedToday > 0 ? `🎉 ${completedToday} task${completedToday > 1 ? "s" : ""} completed!` : activeTasks > 0 ? `💪 ${activeTasks} task${activeTasks > 1 ? "s" : ""} in progress` : "🌟 Ready to start your day?"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                {pendingAcceptance > 0 ? `You have ${pendingAcceptance} task${pendingAcceptance > 1 ? "s" : ""} awaiting your acceptance.` : "You're all caught up on task responses."}
              </div>
            </div>
            <button
              onClick={() => navigate(routes.tasks)}
              style={{
                padding: "12px 28px", borderRadius: 16,
                background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)",
                color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                backdropFilter: "blur(8px)", transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.25)"; e.currentTarget.style.transform = "scale(1.04)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "none" }}
            >
              Open Tasks →
            </button>
          </div>

          {/* ── Global Date Filter Bar ─────────────────────── */}
          <div style={{
            display: "flex", alignItems: "center",
            flexWrap: "wrap", gap: 20, padding: "8px 16px",
            background: "var(--surface)", border: "1px solid var(--stroke)",
            borderRadius: 8,
            marginTop: 8,
            marginBottom: 16,
            width: "fit-content",
            marginLeft: "auto",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Calendar size={18} style={{ color: "#4f46e5" }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--fg)" }}>Date Scope</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {["all", "today", "week", "month", "custom"].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDateFilter(mode)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: "1px solid",
                    borderColor: dateFilter === mode ? "#4f46e5" : "var(--stroke)",
                    background: dateFilter === mode ? "#4f46e5" : "transparent",
                    color: dateFilter === mode ? "#fff" : "var(--muted)",
                    cursor: "pointer", transition: "all 0.2s ease",
                  }}
                >
                  {mode === "all" ? "All Time" : mode === "today" ? "Today" : mode === "week" ? "This Week" : mode === "month" ? "This Month" : "Custom"}
                </button>
              ))}
              {dateFilter === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  style={{
                    padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: "1px solid var(--stroke)", background: "var(--surface)",
                    color: "var(--fg)", outline: "none", cursor: "pointer",
                  }}
                />
              )}
            </div>
          </div>

          {/* ── Stats Row ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatPill
              icon={<ClipboardList size={20} />}
              label="Active Tasks"
              value={activeTasks}
              color="#4f46e5"
              onClick={() => navigate(routes.tasks)}
            />
            <StatPill
              icon={<UserCheck size={20} />}
              label="Needs Response"
              value={pendingAcceptance}
              color={pendingAcceptance > 0 ? "#ef4444" : "#10b981"}
              onClick={pendingAcceptance > 0 ? () => navigate(routes.tasks) : null}
            />
            <StatPill
              icon={<CalendarDays size={20} />}
              label="My Leaves"
              value={filteredLeavesByDate.length}
              color="#ec4899"
              onClick={() => navigate(routes.leaves)}
            />
            <StatPill
              icon={<CheckCircle2 size={20} />}
              label={dateFilter === "all" ? "Completed Tasks" : dateFilter === "today" ? "Completed Today" : "Completed in Range"}
              value={completedToday}
              color="#10b981"
            />
          </div>

          {/* ── Two-column area ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Task Summary */}
            <div
              className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 shadow-sm"
              style={{
                borderRadius: 24, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, minHeight: 460
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #4f46e540, #4f46e515)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #4f46e520" }}>
                    <ClipboardList size={18} style={{ color: "#4f46e5" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "var(--fg)" }}>My Tasks</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{filteredTasksByDate.length} tasks in range</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(routes.tasks)}
                  style={{ fontSize: 11, fontWeight: 800, color: "#4f46e5", background: "linear-gradient(135deg, #ede9fe, #e0e7ff)", border: "1px solid #c7d2fe", borderRadius: 10, padding: "5px 12px", cursor: "pointer" }}
                >
                  View All →
                </button>
              </div>

              {/* Status filter tabs for tasks */}
              <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--stroke)", paddingBottom: 8, overflowX: "auto" }}>
                {[
                  { id: "all", label: "All" },
                  { id: "pending", label: "Pending" },
                  { id: "in_progress", label: "In Progress" },
                  { id: "completed", label: "Completed" },
                  { id: "declined", label: "Declined" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTaskStatusTab(tab.id)}
                    style={{
                      padding: "6px 12px", border: "none", background: "transparent",
                      color: taskStatusTab === tab.id ? "#4f46e5" : "var(--muted)",
                      fontSize: 12, fontWeight: taskStatusTab === tab.id ? 800 : 600,
                      borderBottom: taskStatusTab === tab.id ? "2.5px solid #4f46e5" : "none",
                      cursor: "pointer", transition: "all 0.15s ease", paddingBottom: 6,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tasks List */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 320, paddingRight: 4 }}>
                {filteredTasksByStatus.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", margin: "auto" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>No tasks match this filter.</div>
                  </div>
                ) : (
                  filteredTasksByStatus.map(task => {
                    const statusConfig = {
                      pending: { bg: "#fef3c7", color: "#d97706", label: "Pending" },
                      in_progress: { bg: "#dbeafe", color: "#2563eb", label: "In Progress" },
                      completed: { bg: "#d1fae5", color: "#059669", label: "Completed" },
                      cancelled: { bg: "#f3f4f6", color: "#4b5563", label: "Cancelled" },
                      suspended: { bg: "#f3e8ff", color: "#7c3aed", label: "Suspended" }
                    }[task.status] || { bg: "#f3f4f6", color: "#4b5563", label: task.status };

                    if (task.acceptance_status === "declined") {
                      statusConfig.bg = "#ffe4e6";
                      statusConfig.color = "#e11d48";
                      statusConfig.label = "Declined";
                    } else if (task.acceptance_status === "pending_acceptance") {
                      statusConfig.bg = "#fee2e2";
                      statusConfig.color = "#dc2626";
                      statusConfig.label = "Awaiting Accept";
                    }

                    const priorityConfig = {
                      low: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", color: "#10b981" },
                      medium: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)", color: "#f59e0b" },
                      high: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", color: "#f97316" },
                      urgent: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", color: "#ef4444" }
                    }[task.priority] || { bg: "var(--bg)", border: "var(--stroke)", color: "var(--muted)" };

                    return (
                      <div
                        key={task.id}
                        className="bg-surface2 dark:bg-slate-950/40 border border-stroke dark:border-slate-800 hover:border-indigo-500/30"
                        style={{
                          display: "flex", flexDirection: "column", gap: 10,
                          padding: "14px 18px", borderRadius: 16, cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => navigate(routes.tasks)}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: "var(--fg)", flex: 1 }}>
                            {task.title}
                          </div>
                          <span style={{
                            padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800,
                            background: statusConfig.bg, color: statusConfig.color, textTransform: "uppercase", letterSpacing: "0.04em"
                          }}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>
                            <Calendar size={12} />
                            <span>Due: {task.due_date}</span>
                            {task.category && (
                              <>
                                <span>•</span>
                                <span style={{ textTransform: "capitalize" }}>{task.category}</span>
                              </>
                            )}
                          </div>
                          <span style={{
                            padding: "2px 8px", borderRadius: 8, fontSize: 9, fontWeight: 800,
                            background: priorityConfig.bg, border: `1px solid ${priorityConfig.border}`, color: priorityConfig.color,
                            textTransform: "uppercase", letterSpacing: "0.04em"
                          }}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Leave Summary */}
            <div
              className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 shadow-sm"
              style={{
                borderRadius: 24, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18, minHeight: 460
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, #ec489940, #ec489915)", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #ec489920" }}>
                    <CalendarDays size={18} style={{ color: "#ec4899" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "var(--fg)" }}>My Leaves</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{filteredLeavesByDate.length} requests in range</div>
                  </div>
                </div>
                <button
                  onClick={() => navigate(routes.leaves)}
                  style={{ fontSize: 11, fontWeight: 800, color: "#ec4899", background: "linear-gradient(135deg, #fdf2f8, #fce7f3)", border: "1px solid #fbcfe8", borderRadius: 10, padding: "5px 12px", cursor: "pointer" }}
                >
                  Request Leave →
                </button>
              </div>

              {/* Status filter tabs for leaves */}
              <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--stroke)", paddingBottom: 8, overflowX: "auto" }}>
                {[
                  { id: "all", label: "All" },
                  { id: "pending", label: "Pending" },
                  { id: "approved", label: "Approved" },
                  { id: "rejected", label: "Rejected" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLeaveStatusTab(tab.id)}
                    style={{
                      padding: "6px 12px", border: "none", background: "transparent",
                      color: leaveStatusTab === tab.id ? "#ec4899" : "var(--muted)",
                      fontSize: 12, fontWeight: leaveStatusTab === tab.id ? 800 : 600,
                      borderBottom: leaveStatusTab === tab.id ? "2.5px solid #ec4899" : "none",
                      cursor: "pointer", transition: "all 0.15s ease", paddingBottom: 6,
                      whiteSpace: "nowrap"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Leaves List */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 320, paddingRight: 4 }}>
                {filteredLeavesByStatus.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", margin: "auto" }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🏖️</div>
                    <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>No leave requests match this filter.</div>
                  </div>
                ) : (
                  filteredLeavesByStatus.map((lv, i) => (
                    <div key={lv.id || i}
                      className="bg-surface2 dark:bg-slate-950/40 border border-stroke dark:border-slate-800"
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 18px", borderRadius: 16,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--fg)", textTransform: "capitalize" }}>
                          {lv.leave_type_name || lv.leave_type || lv.type || "Leave Request"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={12} />
                          <span>{lv.start_date} → {lv.end_date || "TBD"}</span>
                        </div>
                      </div>
                      <LeaveStatusBadge status={lv.status} />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>


        </>
      )}
    </div>
  )
}


// Lazy-loaded sub-modules
const DashboardMap = lazy(() => import("./DashboardMap.jsx"))

// ── Shared Chart Defaults ──
const CHART_COLORS = {
  primary: "#6366F1",
  primaryLight: "rgba(99, 102, 241, 0.15)",
  blue: "#3B82F6",
  blueLight: "rgba(59, 130, 246, 0.12)",
  emerald: "#10B981",
  emeraldLight: "rgba(16, 185, 129, 0.12)",
  amber: "#F59E0B",
  amberLight: "rgba(245, 158, 11, 0.12)",
  orange: "#F97316",
  orangeLight: "rgba(249, 115, 22, 0.12)",
  rose: "#F43F5E",
  roseLight: "rgba(244, 63, 94, 0.12)",
  violet: "#8B5CF6",
  violetLight: "rgba(139, 92, 246, 0.12)",
  cyan: "#06B6D4",
  cyanLight: "rgba(6, 182, 212, 0.12)",
  slate: "#64748B",
  slateLight: "rgba(100, 116, 139, 0.12)",
}

const PIE_PALETTE = ["#6366F1", "#3B82F6", "#10B981", "#F59E0B", "#F43F5E", "#8B5CF6", "#06B6D4", "#EC4899", "#14B8A6", "#F97316"]

const sharedTooltip = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  titleColor: "#F8FAFC",
  bodyColor: "#CBD5E1",
  borderColor: "rgba(99, 102, 241, 0.3)",
  borderWidth: 1,
  cornerRadius: 10,
  padding: 12,
  titleFont: { weight: "700", size: 13 },
  bodyFont: { size: 12 },
  boxPadding: 4,
}

const sharedGrid = {
  color: "rgba(148, 163, 184, 0.08)",
  drawBorder: false,
}

const tickOptions = {
  color: "#94A3B8",
  font: { size: 10 },
}

const gridOptions = sharedGrid

function formatHours(h) {
  if (h == null) return "—"
  return `${h.toFixed(1)}h`
}

function formatMoney(n) {
  if (!n && n !== 0) return "$0"
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}


function ChartPlaceholder() {
  return (
    <div className="flex items-center justify-center h-full w-full bg-bg dark:bg-slate-950/40 rounded-xl border border-dashed border-stroke dark:border-slate-800 animate-pulse">
      <Loader2 className="text-slate-200 dark:text-slate-800 animate-spin" size={20} />
    </div>
  )
}

export function DashboardPage() {
  const { isAdmin } = useRole()
  if (!isAdmin) return <EmployeeDashboard />
  return <AdminDashboard />
}

function AdminDashboard() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [analytics, setAnalytics] = useState(null)
  const [otAlerts, setOtAlerts] = useState([])
  const [wageViolations, setWageViolations] = useState([])
  const [rtwExpiring, setRtwExpiring] = useState([])
  const [complianceDismissed, setComplianceDismissed] = useState(false)
  const [employees, setEmployees] = useState([])
  const [notifications, setNotifications] = useState([])

  // Helpers for Presence Monitoring
  const initials = (username) => {
    const s = String(username || "").trim()
    if (!s) return "U"
    const parts = s.split(/\s+/).filter(Boolean)
    const first = (parts[0] || "").slice(0, 1)
    const second = (parts.length > 1 ? parts[1] : parts[0] || "").slice(1, 2)
    return (first + second).toUpperCase()
  }

  const formatRelativeDate = (dateObj) => {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    const timeStr = dateObj.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })

    if (dateObj.toDateString() === today.toDateString()) {
      return `Today at ${timeStr}`
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
      return `Yesterday at ${timeStr}`
    } else {
      const options = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
      return `${dateObj.toLocaleDateString("en-US", options)}`
    }
  }

  const formatLastSeen = (lastLoginStr, lastLogoutStr, isOnline) => {
    if (isOnline) {
      return "🟢 Online Now"
    }
    if (!lastLogoutStr) {
      if (lastLoginStr) {
        const loginDate = new Date(lastLoginStr)
        return `Last seen ${formatRelativeDate(loginDate)}`
      }
      return "🔴 Offline"
    }
    const logoutDate = new Date(lastLogoutStr)
    return `Last seen ${formatRelativeDate(logoutDate)}`
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const [data, empData] = await Promise.all([
          apiRequest("/reports/dashboard-analytics/"),
          apiRequest("/employees/").catch(() => []),
        ])
        if (!cancelled) {
          setAnalytics(data)
          const employeesList = Array.isArray(empData) ? empData : empData?.results || []
          setEmployees(employeesList)
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Dashboard analytics error:", err)
          setError("Failed to load dashboard analytics.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function loadCompliance() {
      try {
        // OT risk
        const otData = await apiRequest("/compliance/ot-risk/")
        if (!cancelled && otData?.data?.alerts) setOtAlerts(otData.data.alerts)
      } catch (_) { }
      try {
        // Wage floor violations
        const wfData = await apiRequest("/compliance/wage-floor/")
        if (!cancelled && wfData?.data?.violations) setWageViolations(wfData.data.violations)
      } catch (_) { }
      try {
        // RTW expiry (UK)
        const rtwData = await apiRequest("/compliance/rtw/expiry-check/")
        if (!cancelled && rtwData?.data) {
          const expiring = [
            ...(rtwData.data.expiring_within_60_days || []),
            ...(rtwData.data.expired || []),
          ]
          setRtwExpiring(expiring)
        }
      } catch (_) { }
    }

    if (user && isAdmin) {
      load()
      loadCompliance()
    }
    return () => { cancelled = true }
  }, [user, isAdmin])

  // WebSocket Live Presence Event Listener
  useEffect(() => {
    function handlePresenceChange(event) {
      const presenceData = event.detail

      setEmployees((prev) =>
        prev.map((emp) =>
          emp.id === presenceData.employee_id
            ? {
              ...emp,
              is_online: presenceData.is_online,
              last_login_at: presenceData.last_login_at,
              last_logout_at: presenceData.last_logout_at,
              last_activity_at: presenceData.last_activity_at,
              current_availability: presenceData.current_availability,
            }
            : emp
        )
      )

      // Add a dynamic toast notification popup
      const timestampStr = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      const dateStr = new Date().toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })

      const newNotification = {
        id: Math.random().toString(36).substr(2, 9),
        title: presenceData.is_online ? "🟢 Employee Online" : "🔴 Employee Offline",
        employeeName: presenceData.employee_name,
        status: presenceData.is_online ? "Online" : "Offline",
        time: `${dateStr} ${timestampStr}`,
        isOnline: presenceData.is_online,
      }

      setNotifications((prev) => [newNotification, ...prev].slice(0, 5))
    }

    window.addEventListener("quicktims:presenceStatusChange", handlePresenceChange)
    return () => window.removeEventListener("quicktims:presenceStatusChange", handlePresenceChange)
  }, [])

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.slice(0, -1))
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [notifications])

  // --- Onboarding & Verification Center interactive states ---
  // --- Onboarding & Verification Center interactive states ---
  const [dossier, setDossier] = useState(() => {
    try {
      const saved = localStorage.getItem("caltrack_activation_dossier")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  // Poll registration dossier from backend
  useEffect(() => {
    let active = true
    async function loadDossier() {
      const data = await apiFetchRegistrationDossier()
      if (data && active) {
        setDossier(data)
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(data))
      }
    }
    loadDossier()
    const interval = setInterval(loadDossier, 3000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const verificationQueue = useMemo(() => {
    const docsPending = (dossier && dossier.regForm?.fullName && !dossier.docForm?.isCompleted) ? 1 : 0
    const trainPending = (dossier && dossier.docForm?.isCompleted && !dossier.academyState?.isCompleted) ? 1 : 0
    const intPending = (dossier && dossier.academyState?.isCompleted && (dossier.interviewState?.status === "Scheduled" || dossier.interviewState?.status === "In Call")) ? 1 : 0
    const rdyApproval = (dossier && dossier.interviewState?.status === "Passed" && dossier.adminClearance?.status === "pending") ? 1 : 0
    return {
      documents: docsPending,
      training: trainPending,
      interview: intPending,
      ready: rdyApproval
    }
  }, [dossier])

  const interviewsToday = useMemo(() => {
    if (!dossier?.regForm?.fullName) return []
    return [
      { id: 1, time: "09:00 AM", name: dossier.regForm.fullName, role: "Field Operations Tech", status: dossier.interviewState?.status || "Scheduled" }
    ]
  }, [dossier])

  const verificationCenterCandidate = useMemo(() => {
    return {
      name: dossier?.regForm?.fullName || "Surya",
      role: "Electrician",
      registration: dossier?.regForm?.fullName ? "Complete" : "Pending",
      documents: dossier?.docForm?.isCompleted ? "Verified" : "Pending",
      training: dossier?.academyState?.isCompleted ? "Completed" : "Pending",
      interview: dossier?.interviewState?.status === "Passed" ? "Passed" : (dossier?.interviewState?.status === "Rejected" ? "Rejected" : "Pending"),
    }
  }, [dossier])

  const approvalCenterReview = useMemo(() => {
    return {
      name: dossier?.regForm?.fullName || "Surya",
      role: "Electrician",
      identity: dossier?.regForm?.isBiometricCompleted ? "Verified" : (dossier?.regForm?.fullName ? "Verified" : "Pending"),
      training: dossier?.academyState?.isCompleted ? "Completed" : "Pending",
      interview: dossier?.interviewState?.status === "Passed" ? "Passed" : (dossier?.interviewState?.status === "Rejected" ? "Rejected" : "Pending"),
      trustScore: dossier?.trustScore || 80,
      status: dossier?.adminClearance?.status === "approved" ? "Approved" : (dossier?.adminClearance?.status === "rejected" ? "Rejected" : "Reviewing")
    }
  }, [dossier])

  const funnelData = useMemo(() => {
    const approvedCount = employees.length
    const hasPassedInt = dossier?.interviewState?.status === "Passed" || dossier?.interviewState?.status === "Rejected"
    const interviewCount = approvedCount + (dossier && hasPassedInt ? 1 : 0)
    const trainingCount = interviewCount + (dossier?.academyState?.isCompleted ? 1 : 0)
    const docsCount = trainingCount + (dossier?.docForm?.isCompleted ? 1 : 0)
    const regCount = docsCount + (dossier?.regForm?.fullName ? 1 : 0)

    return [
      { stage: "Registered", count: regCount, percent: regCount > 0 ? 100 : 0, color: "#3b82f6" },
      { stage: "Documents Verified", count: docsCount, percent: regCount > 0 ? Math.round((docsCount / regCount) * 100) : 0, color: "#6366f1" },
      { stage: "Training Completed", count: trainingCount, percent: regCount > 0 ? Math.round((trainingCount / regCount) * 100) : 0, color: "#8b5cf6" },
      { stage: "Interview Completed", count: interviewCount, percent: regCount > 0 ? Math.round((interviewCount / regCount) * 100) : 0, color: "#ec4899" },
      { stage: "Approved", count: approvedCount, percent: regCount > 0 ? Math.round((approvedCount / regCount) * 100) : 0, color: "#10b981" }
    ]
  }, [employees, dossier])

  const [insightsDismissed, setInsightsDismissed] = useState(false)

  const approvalRate = useMemo(() => {
    const approvedCount = employees.length
    const rejectedCount = dossier?.adminClearance?.status === "rejected" ? 1 : 0
    const total = approvedCount + rejectedCount
    return total > 0 ? Math.round((approvedCount / total) * 100) : 100
  }, [employees, dossier])

  const interviewSuccess = useMemo(() => {
    const approvedCount = employees.length
    const rejectedCount = dossier?.interviewState?.status === "Rejected" ? 1 : 0
    const total = approvedCount + rejectedCount
    return total > 0 ? Math.round((approvedCount / total) * 100) : 100
  }, [employees, dossier])

  const trainingCompletion = useMemo(() => {
    const candidateCompleted = dossier?.academyState?.modules?.filter(m => m.completed).length || 0
    const totalCompleted = (employees.length * 5) + candidateCompleted
    const totalModules = (employees.length + (dossier ? 1 : 0)) * 5
    return totalModules > 0 ? Math.round((totalCompleted / totalModules) * 100) : 100
  }, [employees, dossier])

  const avgApprovalTime = useMemo(() => {
    const validEmps = employees.filter(e => e.hire_date && e.created_at)
    if (validEmps.length === 0) return "1.2 Days"
    const totalDays = validEmps.reduce((acc, emp) => {
      const hire = new Date(emp.hire_date)
      const created = new Date(emp.created_at)
      const diff = Math.abs(hire - created)
      return acc + (diff / (1000 * 60 * 60 * 24))
    }, 0)
    return `${(totalDays / validEmps.length).toFixed(1)} Days`
  }, [employees])

  const aiInsightsRecommendation = useMemo(() => {
    if (insightsDismissed) return ""
    if (!dossier?.regForm?.fullName) {
      return "Awaiting candidate registration on Caltrack app."
    }
    if (!dossier.docForm?.isCompleted) {
      return "Verify candidate's uploaded identity documents (Aadhaar & PAN)."
    }
    if (!dossier.academyState?.isCompleted) {
      return "Candidate is completing the 5 compliance training modules."
    }
    if (dossier.interviewState?.status === "Scheduled" || dossier.interviewState?.status === "In Call") {
      return "Conduct scheduled L1 verification and biometric matching call."
    }
    if (dossier.interviewState?.status === "Passed" && dossier.adminClearance?.status === "pending") {
      return "Approve candidate onboarding dossier to activate portal access."
    }
    return "All candidate pipelines are clear. Roster is fully up to date."
  }, [dossier, insightsDismissed])

  // Recent activities — derived from real dossier state
  const [recentActivities, setRecentActivities] = useState([])

  // Auto-derive timeline from real dossier steps
  useEffect(() => {
    if (!dossier) return
    const items = []
    const name = dossier.regForm?.fullName || "Candidate"
    if (dossier.adminClearance?.status === "approved") {
      items.push({ id: "act-approved", time: "—", event: "Employee Activated", desc: `${name} approved — portal access granted` })
    }
    if (dossier.adminClearance?.status === "rejected") {
      items.push({ id: "act-rejected", time: "—", event: "Application Rejected", desc: `${name} application rejected` })
    }
    if (dossier.interviewState?.status === "Passed") {
      items.push({ id: "act-interview", time: "—", event: "Interview Passed", desc: `${name} L1 verification passed` })
    }
    if (dossier.interviewState?.status === "Rejected") {
      items.push({ id: "act-int-rej", time: "—", event: "Interview Failed", desc: `${name} did not pass interview` })
    }
    if (dossier.academyState?.isCompleted) {
      items.push({ id: "act-training", time: "—", event: "Training Completed", desc: `${name} completed all ${dossier.academyState?.modules?.length || 5} training modules` })
    }
    if (dossier.docForm?.isCompleted) {
      items.push({ id: "act-docs", time: "—", event: "Documents Verified", desc: `${name} identity documents approved` })
    }
    if (dossier.regForm?.fullName) {
      items.push({ id: "act-reg", time: "—", event: "New Registration", desc: `${name} registered on Caltrack app` })
    }
    setRecentActivities(prev => {
      // Preserve dynamically-added items (from approve/reject handlers) at the top
      const dynamic = prev.filter(a => !String(a.id).startsWith("act-"))
      return [...dynamic, ...items]
    })
  }, [dossier])

  const [auditTab, setAuditTab] = useState("login")
  const [hoveredLoc, setHoveredLoc] = useState(null)

  // Audit logs — starts empty, populated by real admin actions only
  const [auditLogs, setAuditLogs] = useState({
    login: [],
    approvals: [],
    rejections: [],
    docs: [],
    interviews: []
  })

  // Handlers
  const handleApproveCandidate = async (name) => {
    if (!dossier) return
    try {
      const updatedClearance = {
        status: "approved",
        remarks: "All validation steps passed. Approved by Admin on Dashboard."
      }
      const nextDossier = { ...dossier, adminClearance: updatedClearance }
      setDossier(nextDossier)
      localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
      await apiSaveRegistrationDossier(nextDossier)

      // Provision employee record in DB
      const [firstNameRaw, ...lastNameParts] = (name || "").trim().split(" ")
      const firstName = firstNameRaw || ""
      const lastName = lastNameParts.join(" ") || "—"
      const payload = {
        employee_id: dossier.id || "EMP-2048",
        username: dossier.regForm?.email?.split("@")[0] || `user_${Math.random().toString(36).slice(2, 7)}`,
        password: "TemporaryPassword123!",
        email: dossier.regForm?.email || "surya@example.com",
        first_name: firstName,
        last_name: lastName,
        title: "Field Operations Tech (L2)",
        hourly_rate: 18.50,
        country: "IN",
        is_active: true
      }
      await apiRequest("/employees/", { method: "POST", json: payload })

      const nowStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      setRecentActivities(prev => [
        { id: Math.random(), time: nowStr, event: "Employee Activated", desc: `${name} approved and activated` },
        ...prev
      ])
      setAuditLogs(prev => ({
        ...prev,
        approvals: [
          { id: Math.random(), time: nowStr, candidate: name, approvedBy: "Admin (Jasmine)", role: "Electrician" },
          ...prev.approvals
        ]
      }))
      alert(`${name} Approved Successfully\n\nPortal Access Enabled\nTask Assignment Enabled\nEmployee Activated`)
    } catch (e) {
      console.error("Failed to approve employee from dashboard", e)
      alert("Error approving employee. Please check logs.")
    }
  }

  const handleRejectCandidate = async (name, reason = "Failed interview criteria") => {
    if (!dossier) return
    try {
      const updatedClearance = {
        status: "rejected",
        remarks: reason
      }
      const nextDossier = { ...dossier, adminClearance: updatedClearance }
      setDossier(nextDossier)
      localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
      await apiSaveRegistrationDossier(nextDossier)

      const nowStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      setRecentActivities(prev => [
        { id: Math.random(), time: nowStr, event: "Application Rejected", desc: `${name} review rejected` },
        ...prev
      ])
      setAuditLogs(prev => ({
        ...prev,
        rejections: [
          { id: Math.random(), time: nowStr, candidate: name, rejectedBy: "Admin (Jasmine)", reason: reason },
          ...prev.rejections
        ]
      }))
      alert(`Employee ${name} Application Rejected`)
    } catch (e) {
      console.error("Failed to reject employee from dashboard", e)
    }
  }

  const handlePassInterview = async (id, name) => {
    if (name === (dossier?.regForm?.fullName || "Surya") && dossier) {
      try {
        const nextDossier = {
          ...dossier,
          interviewState: {
            ...dossier.interviewState,
            status: "Passed",
            isCompleted: true
          }
        }
        setDossier(nextDossier)
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
        await apiSaveRegistrationDossier(nextDossier)
        const nowStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        setAuditLogs(prev => ({
          ...prev,
          interviews: [
            { id: Math.random(), time: nowStr, candidate: name, interviewer: user?.username || "Admin", rating: "Passed", notes: "Interview passed via dashboard action." },
            ...prev.interviews
          ]
        }))
      } catch (e) {
        console.error("Failed to pass interview", e)
      }
    }
  }

  const handleRejectInterview = async (id, name) => {
    if (name === (dossier?.regForm?.fullName || "Surya") && dossier) {
      try {
        const nextDossier = {
          ...dossier,
          interviewState: {
            ...dossier.interviewState,
            status: "Rejected",
            isCompleted: true
          }
        }
        setDossier(nextDossier)
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
        await apiSaveRegistrationDossier(nextDossier)
        const nowStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        setAuditLogs(prev => ({
          ...prev,
          interviews: [
            { id: Math.random(), time: nowStr, candidate: name, interviewer: user?.username || "Admin", rating: "Failed", notes: "Interview failed via dashboard action." },
            ...prev.interviews
          ]
        }))
      } catch (e) {
        console.error("Failed to reject interview", e)
      }
    }
  }

  const handleStartCall = async (id, name) => {
    if (name === (dossier?.regForm?.fullName || "Surya") && dossier) {
      try {
        const nextDossier = {
          ...dossier,
          interviewState: {
            ...dossier.interviewState,
            status: "In Call"
          }
        }
        setDossier(nextDossier)
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
        await apiSaveRegistrationDossier(nextDossier)
      } catch (e) {
        console.error("Failed to start call", e)
      }
    }
  }

  const handleRescheduleInterview = async (id, name) => {
    if (name === (dossier?.regForm?.fullName || "Surya") && dossier) {
      try {
        const nextDossier = {
          ...dossier,
          interviewState: {
            ...dossier.interviewState,
            status: "Scheduled",
            isCompleted: false
          }
        }
        setDossier(nextDossier)
        localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
        await apiSaveRegistrationDossier(nextDossier)
      } catch (e) {
        console.error("Failed to reschedule interview", e)
      }
    } else {
      alert(`Rescheduling ${name}'s interview...`)
    }
  }

  const kpi = analytics?.kpi || {}

  const kpiCards = [
    {
      title: "Active Employees",
      value: kpi.employees_active || 0,
      icon: <Users size={20} />,
      color: CHART_COLORS.emerald,
      bg: CHART_COLORS.emeraldLight,
      sub: `Total personnel: ${kpi.employees_total || 0}`,
    },
    {
      title: "Total Hours",
      value: formatHours(kpi.total_hours_month),
      icon: <Clock size={20} />,
      color: CHART_COLORS.blue,
      bg: CHART_COLORS.blueLight,
      sub: "This month",
    },
    {
      title: "Active Tasks",
      value: kpi.active_tasks || 0,
      icon: <Briefcase size={20} />,
      color: CHART_COLORS.primary,
      bg: CHART_COLORS.primaryLight,
      sub: `Total: ${kpi.total_tasks || 0}`,
    },
    {
      title: "Pending Leaves",
      value: kpi.pending_leaves || 0,
      icon: <CalendarDays size={20} />,
      color: CHART_COLORS.amber,
      bg: CHART_COLORS.amberLight,
      sub: "Awaiting approval",
    },
    {
      title: "Monthly Payroll",
      value: formatMoney(kpi.total_payroll_month),
      icon: <DollarSign size={20} />,
      color: CHART_COLORS.rose,
      bg: CHART_COLORS.roseLight,
      sub: "Total net pay",
    },
    {
      title: "Upcoming Shifts",
      value: kpi.upcoming_shifts || 0,
      icon: <Timer size={20} />,
      color: CHART_COLORS.violet,
      bg: CHART_COLORS.violetLight,
      sub: "Next 7 days",
    },
  ]

  const kpiEmp = kpiCards[0]
  const kpiHrs = kpiCards[1]
  const kpiTsk = kpiCards[2]
  const kpiLvs = kpiCards[3]
  const kpiPay = kpiCards[4]
  const kpiShft = kpiCards[5]

  function ThreeDKpiCard({ children, color, side }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const rotateX = useTransform(y, [-100, 100], [15, -15]);
    const rotateY = useTransform(x, [-100, 100], [-15, 15]);

    const springConfig = { damping: 25, stiffness: 200 };
    const rX = useSpring(rotateX, springConfig);
    const rY = useSpring(rotateY, springConfig);

    function handleMouse(event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      x.set(event.clientX - centerX);
      y.set(event.clientY - centerY);
    }

    function handleMouseLeave() {
      x.set(0);
      y.set(0);
    }

    return (
      <motion.div
        style={{
          perspective: 1200,
          rotateX: rX,
          rotateY: rY,
          transformStyle: "preserve-3d",
        }}
        onMouseMove={handleMouse}
        onMouseLeave={handleMouseLeave}
        className="relative cursor-pointer w-full"
        initial={{ opacity: 0, x: side === 'left' ? -30 : 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
      >
        {/* Dynamic Glow */}
        <motion.div
          className="absolute -inset-6 opacity-0 group-hover:opacity-40 blur-3xl transition-opacity duration-700 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${color}, transparent 70%)`,
            transform: "translateZ(-20px)",
          }}
        />
        <div style={{ transform: "translateZ(40px)" }}>
          {children}
        </div>
      </motion.div>
    );
  }

  function KpiDiagramSide({ card, side }) {
    const desc = (
      <div className={`flex flex-col ${side === 'left' ? 'items-end text-right' : 'items-start text-left'} min-w-[70px] lg:min-w-[85px]`}>
        <div className="professional-title text-[1.4rem] leading-[1.2]" style={{ color: card.color }}>
          {card.value}
        </div>
        <div className="professional-subtitle text-slate-400 text-[0.65rem] mt-1 opacity-70 whitespace-nowrap">
          {card.sub}
        </div>
      </div>
    )

    const pill = (
      <motion.div
        whileHover={{ scale: 1.05, y: -2 }}
        className={`flex items-center rounded-2xl min-h-[58px] shadow-[0_20px_40px_rgba(0,0,0,0.12)] px-3.5 py-1.5 gap-3 border border-white/20 relative overflow-hidden group`}
        style={{
          background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}dd 100%)`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="text-white professional-subtitle text-[0.8rem] whitespace-nowrap">{card.title}</div>
        <div className="w-[36px] h-[36px] rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center flex-none border border-white/20 shadow-inner">
          <span style={{ color: "white", display: "flex" }}>{card.icon}</span>
        </div>
      </motion.div>
    )

    const connector = (
      <div className={`flex items-center ${side === 'left' ? 'justify-end' : 'justify-start'} flex-1`} style={{ minWidth: 32 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          className="h-[2px] relative w-full"
          style={{
            background: `linear-gradient(${side === 'left' ? 'to right' : 'to left'}, transparent, ${card.color}44)`
          }}
        >
          <motion.div
            animate={{ x: side === 'left' ? [0, 80, 0] : [0, -80, 0], opacity: [0, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full"
            style={{ backgroundColor: card.color }}
          />
        </motion.div>
      </div>
    )

    return (
      <ThreeDKpiCard color={card.color} side={side}>
        <div className={`flex items-center gap-2 lg:gap-3 ${side === 'left' ? 'flex-row justify-end' : 'flex-row justify-start'}`}>
          {side === 'left' ? (
            <>
              {desc}
              {pill}
              {connector}
            </>
          ) : (
            <>
              {connector}
              {pill}
              {desc}
            </>
          )}
        </div>
      </ThreeDKpiCard>
    )
  }

  // ── Hours by Employee (Horizontal Bar) ──
  const hoursByEmployee = analytics?.hours_by_employee || []
  const hbeData = {
    labels: hoursByEmployee.map((e) => e.name),
    datasets: [
      {
        label: "Hours",
        data: hoursByEmployee.map((e) => e.hours),
        backgroundColor: hoursByEmployee.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
      },
    ],
  }
  const hbeOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw}h worked` },
      },
    },
    scales: {
      x: {
        grid: sharedGrid,
        ticks: { color: "#94A3B8", font: { size: 11 }, callback: (v) => `${v}h` },
      },
      y: {
        grid: { display: false },
        ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } },
      },
    },
  }

  // ── Daily Hours Trend (Line Chart) ──
  const dailyTrend = analytics?.daily_hours_trend || []
  const trendData = {
    labels: dailyTrend.map((d) => {
      const dt = new Date(d.date)
      return dt.toLocaleDateString([], { month: "short", day: "numeric" })
    }),
    datasets: [
      {
        label: "Hours Worked",
        data: dailyTrend.map((d) => d.hours),
        borderColor: CHART_COLORS.primary,
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: context, chartArea } = chart
          if (!chartArea) return CHART_COLORS.primaryLight
          const gradient = context.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)")
          gradient.addColorStop(1, "rgba(99, 102, 241, 0.01)")
          return gradient
        },
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: CHART_COLORS.primary,
        pointHoverBorderColor: "#fff",
        pointHoverBorderWidth: 2,
        borderWidth: 2.5,
      },
    ],
  }
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw}h worked` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#94A3B8", font: { size: 10 }, maxTicksLimit: 10 },
      },
      y: {
        grid: sharedGrid,
        ticks: { color: "#94A3B8", font: { size: 11 }, callback: (v) => `${v}h` },
        beginAtZero: true,
      },
    },
    interaction: { mode: "index", intersect: false },
  }

  // ── Task Status (Donut Chart) ──
  const taskStatus = analytics?.task_status || {}
  const tsLabels = Object.keys(taskStatus)
  const tsData = {
    labels: tsLabels,
    datasets: [
      {
        data: tsLabels.map((k) => taskStatus[k]),
        backgroundColor: ["#F59E0B", "#3B82F6", "#10B981", "#F43F5E"],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  }
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#94A3B8", font: { size: 12, weight: "600" }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: sharedTooltip,
    },
  }
  const doughnutOptions = donutOptions

  // ── Leave Status (Pie Chart) ──
  const leaveStatus = analytics?.leave_status || {}
  const lsLabels = Object.keys(leaveStatus)
  const lsData = {
    labels: lsLabels,
    datasets: [
      {
        data: lsLabels.map((k) => leaveStatus[k]),
        backgroundColor: ["#F59E0B", "#10B981", "#F43F5E"],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  }
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#94A3B8", font: { size: 12, weight: "600" }, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      tooltip: sharedTooltip,
    },
  }

  // ── Attendance Daily (Bar Chart) ──
  const attendance = analytics?.attendance_daily || []
  const attData = {
    labels: attendance.map((d) => d.day),
    datasets: [
      {
        label: "Clock-ins",
        data: attendance.map((d) => d.count),
        backgroundColor: attendance.map((_, i) => {
          const colors = [CHART_COLORS.primary, CHART_COLORS.blue, CHART_COLORS.emerald, CHART_COLORS.amber, CHART_COLORS.violet, CHART_COLORS.cyan, CHART_COLORS.rose]
          return colors[i % colors.length]
        }),
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 28,
      },
    ],
  }
  const attOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw} clock-ins` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } } },
      y: { grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, stepSize: 1 }, beginAtZero: true },
    },
  }

  // ── Task Categories (Bar Chart) ──
  const taskCategories = analytics?.task_categories || {}
  const tcLabels = Object.keys(taskCategories)
  const tcData = {
    labels: tcLabels,
    datasets: [
      {
        label: "Tasks",
        data: tcLabels.map((k) => taskCategories[k]),
        backgroundColor: tcLabels.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
      },
    ],
  }
  const tcOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw} tasks` },
      },
    },
    scales: {
      x: { grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, stepSize: 1 } },
      y: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 11, weight: "600" } } },
    },
  }

  // ── Payroll Trend (Line + Bar combo) ──
  const payrollTrend = analytics?.payroll_trend || []
  const ptData = {
    labels: payrollTrend.map((p) => p.label),
    datasets: [
      {
        type: "bar",
        label: "Gross Pay",
        data: payrollTrend.map((p) => p.gross_pay),
        backgroundColor: "rgba(99, 102, 241, 0.18)",
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
        order: 2,
      },
      {
        type: "line",
        label: "Net Pay",
        data: payrollTrend.map((p) => p.net_pay),
        borderColor: CHART_COLORS.emerald,
        backgroundColor: "rgba(16, 185, 129, 0.08)",
        pointRadius: 4,
        pointBackgroundColor: CHART_COLORS.emerald,
        borderWidth: 2.5,
        tension: 0.3,
        fill: false,
        order: 1,
      },
    ],
  }
  const ptOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { color: "#94A3B8", font: { size: 11, weight: "600" }, usePointStyle: true, pointStyleWidth: 10, padding: 16 },
      },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: $${ctx.raw.toLocaleString()}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 11 } } },
      y: { grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, callback: (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}` }, beginAtZero: true },
    },
  }

  // ── Location Analysis ──
  const locationAnalysis = analytics?.location_analysis || {}
  const locationSummary = locationAnalysis.summary || []
  const employeesByLoc = locationAnalysis.employees_by_location || []
  const tasksByLoc = locationAnalysis.tasks_by_location || []
  const hoursByLoc = locationAnalysis.hours_by_location || []

  // Employees by Location (Horizontal Bar)
  const empLocData = {
    labels: employeesByLoc.map((e) => e.location),
    datasets: [
      {
        label: "Employees",
        data: employeesByLoc.map((e) => e.employees),
        backgroundColor: employeesByLoc.map((_, i) => PIE_PALETTE[i % PIE_PALETTE.length]),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
      },
    ],
  }
  const empLocOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw} employees` },
      },
    },
    scales: {
      x: { grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, stepSize: 1 } },
      y: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } } },
    },
  }

  // Tasks by Location (Horizontal Stacked Bar)
  const taskLocData = {
    labels: tasksByLoc.map((t) => t.location),
    datasets: [
      {
        label: "Active Tasks",
        data: tasksByLoc.map((t) => t.active_tasks),
        backgroundColor: CHART_COLORS.primary,
        borderRadius: 0,
        borderSkipped: false,
        barThickness: 22,
      },
      {
        label: "Completed / Other",
        data: tasksByLoc.map((t) => t.total_tasks - t.active_tasks),
        backgroundColor: "rgba(99, 102, 241, 0.18)",
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
      },
    ],
  }
  const taskLocOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { color: "#94A3B8", font: { size: 11, weight: "600" }, usePointStyle: true, pointStyleWidth: 10, padding: 16 },
      },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}` },
      },
    },
    scales: {
      x: { stacked: true, grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, stepSize: 1 } },
      y: { stacked: true, grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } } },
    },
  }

  // Hours by Location (Horizontal Bar)
  const hrsLocData = {
    labels: hoursByLoc.map((h) => h.location),
    datasets: [
      {
        label: "Hours",
        data: hoursByLoc.map((h) => h.hours),
        backgroundColor: hoursByLoc.map((_, i) => {
          const colors = [CHART_COLORS.emerald, CHART_COLORS.blue, CHART_COLORS.primary, CHART_COLORS.amber, CHART_COLORS.violet, CHART_COLORS.cyan, CHART_COLORS.rose]
          return colors[i % colors.length]
        }),
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 22,
      },
    ],
  }
  const hrsLocOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.raw}h worked` },
      },
    },
    scales: {
      x: { grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, callback: (v) => `${v}h` } },
      y: { grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } } },
    },
  }

  // Clock-in Status by Location (Horizontal Stacked Bar — clocked in vs clocked out)
  const clockLocData = {
    labels: locationSummary.map((l) => l.name),
    datasets: [
      {
        label: "Clocked In",
        data: locationSummary.map((l) => l.clocked_in_now || 0),
        backgroundColor: "#10B981",
        borderRadius: 0,
        borderSkipped: false,
        barThickness: 26,
      },
      {
        label: "Clocked Out",
        data: locationSummary.map((l) => l.clocked_out_today || 0),
        backgroundColor: "#F43F5E",
        borderRadius: 6,
        borderSkipped: false,
        barThickness: 26,
      },
    ],
  }
  const clockLocOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        align: "end",
        labels: { color: "#94A3B8", font: { size: 11, weight: "600" }, usePointStyle: true, pointStyleWidth: 10, padding: 16 },
      },
      tooltip: {
        ...sharedTooltip,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} employees` },
      },
    },
    scales: {
      x: { stacked: true, grid: sharedGrid, ticks: { color: "#94A3B8", font: { size: 11 }, stepSize: 1 } },
      y: { stacked: true, grid: { display: false }, ticks: { color: "#94A3B8", font: { size: 12, weight: "600" } } },
    },
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto flex flex-col gap-6 bg-bg dark:bg-bg min-h-screen">
      {/* ── Onboarding Progress Banner (Top Simple View) ── */}
      {!complianceDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface dark:bg-slate-900/50 rounded-xl shadow-sm border border-stroke dark:border-slate-800 p-6 flex items-center gap-6 relative group hover:shadow-md transition-shadow cursor-pointer mb-2"
          onClick={() => navigate("/get-started")}
        >
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="text-slate-100 dark:text-slate-800"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <motion.path
                className="text-orange-500"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray="100, 100"
                initial={{ strokeDasharray: "0, 100" }}
                animate={{ strokeDasharray: "20, 100" }}
                transition={{ duration: 1, delay: 0.5 }}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[0.7rem] font-black text-slate-800 dark:text-slate-200">
              20%
            </div>
          </div>
          <div className="flex flex-col">
            <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight">
              Complete setting up your organization
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
              1 of 5 steps completed
            </p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-indigo-600 dark:text-indigo-400 font-bold text-xs bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
              Resume Setup
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setComplianceDismissed(true); }}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 dark:text-slate-600 transition-colors"
            >
              <XCircle size={18} />
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Compliance Risk Banner (admin only) ── */}
      {isAdmin && !complianceDismissed && (otAlerts.length > 0 || wageViolations.length > 0 || rtwExpiring.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-500/50 dark:border-amber-500/30 rounded-2xl p-5 flex flex-col gap-3 relative shadow-sm mb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={20} className="text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-[15px] text-amber-900 dark:text-amber-100">
                Compliance Alerts — Action Required
              </span>
            </div>
            <button
              onClick={() => setComplianceDismissed(true)}
              className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg text-amber-900/60 dark:text-amber-100/60 transition-colors"
            >
              <XCircle size={18} />
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {/* OT Alerts */}
            {otAlerts.map((a, i) => {
              const isUK = a.country === "UK"
              const isExceeded = a.alert_type === "exceeded_40" || a.alert_type === "exceeded_48_uk"
              const isDoubleTime = a.alert_type === "double_time_ca"
              const color = isDoubleTime ? "#dc2626" : isExceeded ? "#d97706" : "#2563eb"
              const bg = isDoubleTime ? "#fef2f2" : isExceeded ? "#fffbeb" : "#eff6ff"
              const border = isDoubleTime ? "#fca5a5" : isExceeded ? "#fcd34d" : "#bfdbfe"
              const labels = {
                approaching_40: "Approaching 40hr limit",
                exceeded_40: "OT Pay Required (>40hrs)",
                daily_ot_ca: "CA Daily OT (>8hrs)",
                double_time_ca: "CA Double Time (>12hrs)",
                daily_ot_ak: "AK Daily OT (>8hrs)",
                approaching_48_uk: "UK WTR: Approaching 48hr avg",
                exceeded_48_uk: "UK WTR: 48hr Limit Breached",
              }
              return (
                <div key={i} style={{
                  background: bg, border: `1.5px solid ${border}`, borderRadius: 8,
                  padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <TrendingUp size={14} color={color} />
                  <span style={{ fontSize: 12, fontWeight: 600, color }}>
                    {labels[a.alert_type] || a.alert_type}
                  </span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {a.employee_name} — {a.hours_this_week != null ? `${a.hours_this_week}h` : a.rolling_17wk_avg != null ? `avg ${a.rolling_17wk_avg}h/wk` : ""}
                    {a.state ? ` (${a.state})` : isUK ? " (UK)" : ""}
                    {a.wtr_opt_out ? " · Opt-out active" : ""}
                  </span>
                </div>
              )
            })}

            {/* Wage floor violations */}
            {wageViolations.map((v, i) => (
              <div key={`wf-${i}`} style={{
                background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: 8,
                padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <FileWarning size={14} color="#dc2626" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>
                  Below Minimum Wage
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {v.employee_name} — ${v.hourly_rate}/hr (floor: ${v.minimum_wage_floor}/hr, shortfall: ${v.shortfall_per_hour.toFixed(2)}/hr)
                  {v.country === "UK" ? " · UK NMW" : v.state ? ` · ${v.state}` : " · Federal"}
                </span>
              </div>
            ))}

            {/* RTW expiry */}
            {rtwExpiring.map((r, i) => (
              <div key={`rtw-${i}`} style={{
                background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 8,
                padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
              }}>
                <BadgeCheck size={14} color="#ea580c" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ea580c" }}>
                  RTW {r.days_until_expiry != null && r.days_until_expiry >= 0 ? `Expiring in ${r.days_until_expiry}d` : "Expired"}
                </span>
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {r.employee_name} — {r.document_type} · {r.expiry_date}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Animated Diagram ── */}
      <div className="bg-surface dark:bg-slate-900/40 rounded-3xl shadow-sm border border-stroke dark:border-slate-800 overflow-hidden transition-all duration-500">
        <div className="px-7 pt-6 pb-1">
          <div className="text-[1.25rem] professional-title text-slate-900 dark:text-white font-extrabold">Key Performance Indicators</div>
          <div className="text-[0.9rem] text-slate-400 dark:text-slate-500 font-semibold mt-1">Strategic overview</div>
        </div>

        <div className="p-8 pb-12 grid grid-cols-1 lg:grid-cols-[1fr_260px_1fr] lg:grid-rows-[repeat(3,minmax(110px,auto))] gap-x-6 gap-y-10 items-center">
          <div className="flex justify-center items-center max-lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:row-span-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1, type: "spring" }}
              className="relative w-[180px] h-[180px] grid place-items-center"
            >
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-400/60 dark:border-slate-700/60 animate-[spin_20s_linear_infinite]">
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] -top-[7px] left-1/2 -translate-x-1/2" style={{ backgroundColor: kpiEmp.color }} />
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] top-[24px] right-[12px]" style={{ backgroundColor: kpiHrs.color }} />
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] top-1/2 -right-[7px] -translate-y-1/2" style={{ backgroundColor: kpiPay.color }} />
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] bottom-[24px] right-[12px]" style={{ backgroundColor: kpiShft.color }} />
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] -bottom-[7px] left-1/2 -translate-x-1/2" style={{ backgroundColor: kpiLvs.color }} />
                <span className="absolute w-[14px] h-[14px] rounded-full border-[3px] border-surface dark:border-slate-800 shadow-[0_0_15px_rgba(0,0,0,0.1)] top-1/2 -left-[7px] -translate-y-1/2" style={{ backgroundColor: kpiTsk.color }} />
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className="w-[96px] h-[96px] rounded-3xl bg-surface dark:bg-slate-800 border border-stroke dark:border-slate-700 shadow-[0_15px_40px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-900 dark:text-white z-10 relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Activity size={32} className="text-indigo-600 dark:text-indigo-400 group-hover:animate-pulse" />
              </motion.div>

              {/* Outer Pulse Rings */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0, 0.1] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute w-[120px] h-[120px] rounded-full border border-indigo-200"
              />
            </motion.div>
          </div>

          <div className="max-lg:col-span-1 lg:col-start-1 lg:row-start-1">
            <KpiDiagramSide card={kpiEmp} side="left" />
          </div>
          <div className="max-lg:col-span-1 lg:col-start-3 lg:row-start-1">
            <KpiDiagramSide card={kpiHrs} side="right" />
          </div>

          <div className="max-lg:col-span-1 lg:col-start-1 lg:row-start-2">
            <KpiDiagramSide card={kpiTsk} side="left" />
          </div>
          <div className="max-lg:col-span-1 lg:col-start-3 lg:row-start-2">
            <KpiDiagramSide card={kpiPay} side="right" />
          </div>

          <div className="max-lg:col-span-1 lg:col-start-1 lg:row-start-3">
            <KpiDiagramSide card={kpiLvs} side="left" />
          </div>
          <div className="max-lg:col-span-1 lg:col-start-3 lg:row-start-3">
            <KpiDiagramSide card={kpiShft} side="right" />
          </div>
        </div>
      </div>

      {/* ── Section 1: Executive Overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: "Total Employees", value: (kpi.employees_total ?? employees.length).toLocaleString(), change: `+${kpi.employees_total ?? employees.length}`, trend: "up", icon: <Users size={20} />, color: "#3b82f6", desc: "Registered + approved roster" },
          { label: "Active Employees", value: (kpi.employees_active ?? employees.filter(e => e.is_online).length).toLocaleString(), change: "+0", trend: "up", icon: <UserCheck size={20} />, color: "#10b981", desc: "Active in system" },
          { label: "Pending Verification", value: `${verificationQueue.documents + verificationQueue.training + verificationQueue.interview + verificationQueue.ready}`, change: "0", trend: "down", icon: <AlertCircle size={20} />, color: "#f59e0b", desc: "Dossiers awaiting admin review" },
          { label: "Interviews Today", value: `${interviewsToday.filter(i => i.status === "Scheduled" || i.status === "In Call").length}`, change: "0", trend: "up", icon: <Phone size={20} />, color: "#8b5cf6", desc: "Scheduled calls today" },
          { label: "Pending Leaves", value: (kpi.pending_leaves ?? 0).toLocaleString(), change: "0", trend: "down", icon: <CheckCircle2 size={20} />, color: "#10b981", desc: "Leave requests awaiting approval" },
          { label: "Active Tasks", value: (kpi.active_tasks ?? 0).toLocaleString(), change: "0", trend: "up", icon: <XCircle size={20} />, color: "#ef4444", desc: "Tasks in pending / in-progress state" },
        ].map((item) => (
          <div
            key={item.label}
            className="p-5 bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border"
                style={{
                  background: `${item.color}15`,
                  borderColor: `${item.color}25`,
                  color: item.color,
                }}
              >
                {item.icon}
              </div>
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${item.trend === "up"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                  }`}
              >
                {item.trend === "up" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {item.change}
              </span>
            </div>
            <div className="mt-4">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                {item.label}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {item.value}
              </div>
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-650 mt-1">
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section 2 & 3: Onboarding Pipeline ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel Chart (2/3 width) */}
        <div className="lg:col-span-2 bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                <TrendingUp size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Employee Activation Funnel
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Candidate drop-off checkpoints across the recruitment pipeline
                </p>
              </div>
            </div>
            {/* Custom Funnel visual rendering */}
            <div className="flex flex-col gap-4 mt-6">
              {funnelData.map((item, idx) => (
                <div key={item.stage} className="flex items-center gap-4">
                  <div className="w-40 text-xs font-bold text-slate-600 dark:text-slate-450 uppercase tracking-wide truncate">{item.stage}</div>
                  <div className="flex-1 h-8 bg-slate-100 dark:bg-slate-850 rounded-lg overflow-hidden relative border border-stroke dark:border-slate-800/80">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percent}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className="h-full rounded-lg"
                      style={{
                        background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`
                      }}
                    />
                    <div className="absolute inset-y-0 left-3 flex items-center text-xs font-black text-white drop-shadow-sm">
                      {item.count.toLocaleString()}
                    </div>
                  </div>
                  <div className="w-12 text-right text-xs font-black text-slate-900 dark:text-white">{item.percent}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Verification Queue (1/3 width) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                <ClipboardList size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Verification Queue
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Onboarding tasks awaiting admin action
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3.5 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-800/80 hover:border-indigo-500/30 transition-all">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Documents Pending</span>
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">{verificationQueue.documents}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-800/80 hover:border-indigo-500/30 transition-all">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Training Pending</span>
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">{verificationQueue.training}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-800/80 hover:border-indigo-500/30 transition-all">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Interview Pending</span>
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-pink-500/10 text-pink-500 border border-pink-500/20">{verificationQueue.interview}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-800/80 hover:border-indigo-500/30 transition-all">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Ready For Approval</span>
                <span className="px-2.5 py-1 text-xs font-black rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">{verificationQueue.ready}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={() => alert("Loading document review wizard...")}
              className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-98"
            >
              Review Docs
            </button>
            <button
              onClick={() => alert("Opening interview scheduler calendar...")}
              className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-98"
            >
              Schedule Interview
            </button>
            <button
              onClick={() => handleApproveCandidate(dossier?.regForm?.fullName || "Surya")}
              disabled={!dossier || dossier.interviewState?.status !== "Passed" || dossier.adminClearance?.status !== "pending"}
              className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-98"
            >
              Approve Employee
            </button>
            <button
              onClick={() => handleRejectCandidate(dossier?.regForm?.fullName || "Surya")}
              disabled={!dossier || dossier.adminClearance?.status !== "pending"}
              className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-98"
            >
              Reject Employee
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 4 & 5: Interview Management & AI Insights ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Interviews */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                <Clock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Today's Interviews
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Onboarding validation calls scheduled for today
                </p>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stroke dark:border-slate-800/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Candidate</th>
                    <th className="pb-3">Role</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke/40 dark:divide-slate-800/40">
                  {interviewsToday.map((int) => (
                    <tr key={int.id} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <td className="py-4 font-mono text-[11px] text-indigo-500">{int.time}</td>
                      <td className="py-4 font-bold text-slate-900 dark:text-white">{int.name}</td>
                      <td className="py-4 text-slate-500">{int.role}</td>
                      <td className="py-4">
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${int.status === "Passed"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : int.status === "Rejected"
                                ? "bg-rose-500/10 text-rose-500"
                                : int.status === "In Call"
                                  ? "bg-indigo-500/15 text-indigo-500 animate-pulse"
                                  : "bg-amber-500/10 text-amber-500"
                            }`}
                        >
                          {int.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleStartCall(int.id, int.name)}
                            disabled={int.status !== "Scheduled" && int.status !== "In Call"}
                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
                            title="Start Call"
                          >
                            <Phone size={11} />
                          </button>
                          <button
                            onClick={() => handlePassInterview(int.id, int.name)}
                            disabled={int.status !== "Scheduled" && int.status !== "In Call"}
                            className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all"
                            title="Pass"
                          >
                            <CheckCircle2 size={11} />
                          </button>
                          <button
                            onClick={() => handleRejectInterview(int.id, int.name)}
                            disabled={int.status !== "Scheduled" && int.status !== "In Call"}
                            className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-all"
                            title="Reject"
                          >
                            <XCircle size={11} />
                          </button>
                          <button
                            onClick={() => handleRescheduleInterview(int.id, int.name)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-all text-[9px] font-black uppercase tracking-wider"
                          >
                            Resched
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI Workforce Insights */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          {/* Neon decorative background glow */}
          <div className="absolute -right-16 -top-16 w-36 h-36 bg-indigo-500/10 blur-3xl rounded-full group-hover:bg-indigo-500/20 transition-all duration-700 pointer-events-none" />

          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-500">
                <Activity size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  AI Workforce Insights
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Real-time analytics metrics with AI analysis
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Approval Rate</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{approvalRate}%</div>
                <div className="w-full bg-slate-150 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${approvalRate}%` }} />
                </div>
              </div>
              <div className="p-4 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Interview Success</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{interviewSuccess}%</div>
                <div className="w-full bg-slate-150 dark:bg-slate-855 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${interviewSuccess}%` }} />
                </div>
              </div>
              <div className="p-4 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Training Completion</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{trainingCompletion}%</div>
                <div className="w-full bg-slate-150 dark:bg-slate-850 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${trainingCompletion}%` }} />
                </div>
              </div>
              <div className="p-4 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Avg Approval Time</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{avgApprovalTime}</div>
                <div className="text-[10px] text-emerald-500 font-bold mt-2">▼ Real duration average</div>
              </div>
            </div>
          </div>

          {aiInsightsRecommendation && (
            <div className="mt-6 p-4 bg-indigo-500/5 border border-indigo-500/25 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black uppercase text-indigo-500 tracking-widest">AI Smart Recommendation</span>
                <div className="text-xs font-bold text-slate-800 dark:text-white mt-1">{aiInsightsRecommendation}</div>
              </div>
              <button
                onClick={() => setInsightsDismissed(true)}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 uppercase tracking-widest px-3 py-1.5 bg-indigo-500/10 rounded-lg"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 6 & 7: Verification & Approval Decision Centers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Verification Center */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                <UserCheck size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Employee Verification Center
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Real-time screening checklist status for active candidates
                </p>
              </div>
            </div>

            <div className="p-5 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-3 border-b border-stroke dark:border-slate-850">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-base uppercase tracking-wider">{verificationCenterCandidate.name}</div>
                  <div className="text-[10px] text-slate-455 font-bold uppercase tracking-widest mt-0.5">{verificationCenterCandidate.role}</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-black uppercase tracking-wider border border-amber-500/20">In Review</span>
              </div>

              <div className="grid grid-cols-2 gap-y-3.5 gap-x-6 text-xs font-semibold mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Registration</span>
                  <span className="font-bold text-emerald-500">✅ Complete</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Documents</span>
                  <span className="font-bold text-emerald-500">✅ Verified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Training</span>
                  <span className="font-bold text-emerald-500">✅ Completed</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Interview</span>
                  <span className={`font-bold ${verificationCenterCandidate.interview === "Passed"
                      ? "text-emerald-500"
                      : verificationCenterCandidate.interview === "Rejected"
                        ? "text-rose-500"
                        : "text-amber-500"
                    }`}>
                    {verificationCenterCandidate.interview === "Passed" ? "✅ Passed" : verificationCenterCandidate.interview === "Rejected" ? "❌ Failed" : "🟡 Pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert(`Navigating to profile detail of ${verificationCenterCandidate.name}...`)}
            className="w-full py-3 mt-6 bg-slate-105 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-800 dark:text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm"
          >
            View Profile
          </button>
        </div>

        {/* Approval Center */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Approval Center
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Onboarding dossier decision panel
                </p>
              </div>
            </div>

            <div className="p-5 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-855 flex flex-col gap-3">
              <div className="text-[10px] font-black uppercase text-slate-455 dark:text-slate-500 tracking-widest">Employee Review</div>

              <div className="flex flex-col gap-2 text-xs font-semibold mt-2">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Identity Status</span>
                  <span className="font-bold text-slate-900 dark:text-white">{approvalCenterReview.identity}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Training Status</span>
                  <span className="font-bold text-slate-900 dark:text-white">{approvalCenterReview.training}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Interview Status</span>
                  <span className={`font-bold ${verificationCenterCandidate.interview === "Passed" ? "text-emerald-500" : verificationCenterCandidate.interview === "Rejected" ? "text-rose-500" : "text-amber-500"
                    }`}>
                    {verificationCenterCandidate.interview === "Passed" ? "Passed" : verificationCenterCandidate.interview === "Rejected" ? "Failed" : "Pending"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Trust Score</span>
                  <span className="font-black text-indigo-500 text-sm">{approvalCenterReview.trustScore}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <button
              onClick={() => handleApproveCandidate(approvalCenterReview.name)}
              disabled={approvalCenterReview.status !== "Reviewing"}
              className="py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-98"
            >
              {approvalCenterReview.status === "Approved" ? "APPROVED" : "APPROVE"}
            </button>
            <button
              onClick={() => handleRejectCandidate(approvalCenterReview.name)}
              disabled={approvalCenterReview.status !== "Reviewing"}
              className="py-3.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm active:scale-98"
            >
              {approvalCenterReview.status === "Rejected" ? "REJECTED" : "REJECT"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 8 & 10: Recent Activity & Audit Security Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Timeline */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Recent Onboarding Activity
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Live stream log of recent verification actions
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
                <span className="text-2xl mb-2">📋</span>
                <span className="text-xs font-semibold text-center">No activity yet — actions taken on candidates will appear here</span>
              </div>
            ) : recentActivities.map((act, idx) => (
              <div key={act.id} className="flex gap-4 relative">
                {/* Timeline vertical connector line */}
                {idx < recentActivities.length - 1 && (
                  <div className="absolute left-[17px] top-6 bottom-[-20px] w-0.5 bg-stroke dark:bg-slate-800/80" />
                )}

                <div className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-850 border border-stroke dark:border-slate-800 flex items-center justify-center text-xs font-black text-indigo-500 shadow-sm flex-shrink-0 z-10">
                  {act.time.split(" ")[0]}
                </div>

                <div className="flex-1 p-3 bg-bg dark:bg-slate-950/20 rounded-2xl border border-stroke dark:border-slate-850">
                  <div className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wide">{act.event}</div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">{act.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit & Security Log Tabs */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
                <Lock size={16} />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Audit & Security
                </h3>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  Historical security logs, application outcomes, and reviewer notes
                </p>
              </div>
            </div>

            {/* Log Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none border-b border-stroke dark:border-slate-800/60">
              {[
                { id: "login", label: "Admin Logins" },
                { id: "approvals", label: "Approvals" },
                { id: "rejections", label: "Rejections" },
                { id: "docs", label: "Doc Changes" },
                { id: "interviews", label: "Interview Notes" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAuditTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${auditTab === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="max-h-[220px] overflow-y-auto pr-1">
              {auditTab === "login" && (
                <div className="flex flex-col gap-2">
                  {auditLogs.login.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No admin login records yet</div>
                  ) : auditLogs.login.map((log) => (
                    <div key={log.id} className="flex justify-between items-center p-3 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-850 text-xs font-semibold">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{log.user}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider ml-2">{log.action}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-550">{log.time} · {log.ip}</span>
                    </div>
                  ))}
                </div>
              )}

              {auditTab === "approvals" && (
                <div className="flex flex-col gap-2">
                  {auditLogs.approvals.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No approvals recorded yet — approve a candidate to see logs here</div>
                  ) : auditLogs.approvals.map((log) => (
                    <div key={log.id} className="flex justify-between items-center p-3 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-850 text-xs font-semibold">
                      <div>
                        <span className="font-bold text-emerald-500">Approved</span>
                        <span className="font-black text-slate-900 dark:text-white ml-2">{log.candidate}</span>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider ml-1">({log.role})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold">{log.approvedBy} · {log.time}</span>
                    </div>
                  ))}
                </div>
              )}

              {auditTab === "rejections" && (
                <div className="flex flex-col gap-2">
                  {auditLogs.rejections.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No rejections recorded yet</div>
                  ) : auditLogs.rejections.map((log) => (
                    <div key={log.id} className="flex flex-col p-3 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-855 text-xs font-semibold gap-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-rose-500">Rejected</span>
                          <span className="font-black text-slate-900 dark:text-white ml-2">{log.candidate}</span>
                        </div>
                        <span className="text-[10px] text-slate-550 font-bold">{log.rejectedBy} · {log.time}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">Reason: {log.reason}</div>
                    </div>
                  ))}
                </div>
              )}

              {auditTab === "docs" && (
                <div className="flex flex-col gap-2">
                  {auditLogs.docs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No document changes recorded yet</div>
                  ) : auditLogs.docs.map((log) => (
                    <div key={log.id} className="flex justify-between items-center p-3 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-850 text-xs font-semibold">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">{log.candidate}</span>
                        <span className="text-[10px] text-slate-450 uppercase tracking-wider ml-2">{log.field}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${log.status === "Approved" ? "bg-emerald-500/10 text-emerald-500" : log.status === "Failed (Mesh <90%)" ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
                        }`}>{log.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {auditTab === "interviews" && (
                <div className="flex flex-col gap-2">
                  {auditLogs.interviews.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs italic">No interview notes recorded yet — pass or reject an interview to see logs here</div>
                  ) : auditLogs.interviews.map((log) => (
                    <div key={log.id} className="flex flex-col p-3 bg-bg dark:bg-slate-950/20 rounded-xl border border-stroke dark:border-slate-850 text-xs font-semibold gap-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-indigo-500">{log.candidate}</span>
                          <span className="text-[10px] text-slate-450 uppercase tracking-wider ml-2">Rating: {log.rating}</span>
                        </div>
                        <span className="text-[10px] text-slate-550 font-bold">Interviewer: {log.interviewer}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 italic mt-0.5">Notes: {log.notes}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Charts Row (Real Data Charts) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily Hours Trend (Real Data - Line Chart) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Daily Hours Trend
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Workforce hours logged over the last 30 days
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            {dailyTrend.length > 0 ? (
              <LineChart data={trendData} options={trendOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic">
                No time log data available yet
              </div>
            )}
          </div>
        </div>

        {/* Task Status Distribution (Real Data - Doughnut) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Task Status
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Task distribution by status
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full relative flex items-center justify-center">
            {tsLabels.length > 0 ? (
              <DoughnutChart data={tsData} options={doughnutOptions} />
            ) : (
              <div className="text-slate-400 dark:text-slate-600 text-sm italic">
                No task data available yet
              </div>
            )}
          </div>
        </div>

        {/* Leave Status Distribution (Real Data - Doughnut) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Leave Status
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Leave requests by approval status
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full relative flex items-center justify-center">
            {lsLabels.length > 0 ? (
              <DoughnutChart data={lsData} options={doughnutOptions} />
            ) : (
              <div className="text-slate-400 dark:text-slate-600 text-sm italic">
                No leave data available yet
              </div>
            )}
          </div>
        </div>

        {/* Attendance Daily (Real Data - Bar Chart) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-500">
              <BookOpen size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Attendance (Last 7 Days)
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Clock-in count per day this week
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            {attendance.length > 0 ? (
              <BarChart data={attData} options={attOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic">
                No attendance data available yet
              </div>
            )}
          </div>
        </div>

        {/* Payroll Trend (Real Data - Line+Bar combo) */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm md:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Payroll Trend
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Gross vs Net pay over recent periods
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            {payrollTrend.length > 0 ? (
              <BarChart data={ptData} options={ptOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic">
                No payroll data available yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Real-Time Presence Monitoring Section (WhatsApp-Style) ── */}
      <div className="bg-surface dark:bg-slate-900/40 rounded-xl shadow-sm border border-stroke dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-5 border-b border-stroke dark:border-slate-800 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </div>
            <span className="text-[1.1rem] font-extrabold text-slate-800 dark:text-slate-200">
              Workforce Presence Monitoring
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/50">
              {employees.filter(e => e.is_online).length} Online
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {employees.filter(e => !e.is_online).length} Offline
            </span>
          </div>
        </div>

        <div className="p-6 grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Online Employees Section */}
          <div className="bg-bg dark:bg-slate-950/40 rounded-xl border border-stroke dark:border-slate-800 p-5 flex flex-col gap-4">
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              Online Employees ({employees.filter(e => e.is_online).length})
            </div>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {employees.filter(e => e.is_online).length > 0 ? (
                employees.filter(e => e.is_online).map((emp) => (
                  <motion.div
                    layout
                    key={emp.id}
                    className="bg-surface dark:bg-slate-900/60 p-4 rounded-xl border border-stroke dark:border-slate-800 flex items-center justify-between hover:shadow-md hover:border-emerald-500/30 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md border-2 border-white dark:border-slate-950">
                          {initials(emp.user?.username || emp.first_name || "E")}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                      </div>

                      <div className="flex flex-col">
                        <div className="font-extrabold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {emp.first_name || emp.user?.username ? `${emp.first_name} ${emp.last_name || ""}`.trim() : "Employee"}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                          {emp.title || emp.role || "Staff"}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                          Login: {emp.last_login_at ? new Date(emp.last_login_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                        {emp.current_availability || "Available"}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        Active: {emp.last_activity_at ? new Date(emp.last_activity_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "just now"}
                      </span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 bg-surface/30 dark:bg-slate-900/30 rounded-xl border border-dashed border-stroke dark:border-slate-800">
                  <span className="text-2xl mb-2 animate-bounce">💤</span>
                  <span className="text-sm font-semibold">All employees are currently offline</span>
                </div>
              )}
            </div>
          </div>

          {/* Offline Employees Section */}
          <div className="bg-bg dark:bg-slate-950/40 rounded-xl border border-stroke dark:border-slate-800 p-5 flex flex-col gap-4">
            <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Offline Employees ({employees.filter(e => !e.is_online).length})
            </div>

            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
              {employees.filter(e => !e.is_online).length > 0 ? (
                employees.filter(e => !e.is_online).map((emp) => (
                  <motion.div
                    layout
                    key={emp.id}
                    className="bg-surface dark:bg-slate-900/60 p-4 rounded-xl border border-stroke dark:border-slate-800 flex items-center justify-between hover:shadow-md hover:border-slate-400/30 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 text-white flex items-center justify-center font-extrabold text-sm border-2 border-white dark:border-slate-950">
                          {initials(emp.user?.username || emp.first_name || "E")}
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-slate-400 border-2 border-white dark:border-slate-950 rounded-full" />
                      </div>

                      <div className="flex flex-col">
                        <div className="font-extrabold text-slate-800 dark:text-white transition-colors">
                          {emp.first_name || emp.user?.username ? `${emp.first_name} ${emp.last_name || ""}`.trim() : "Employee"}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                          {emp.title || emp.role || "Staff"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {formatLastSeen(emp.last_login_at, emp.last_logout_at, false)}
                      </span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600 bg-surface/30 dark:bg-slate-900/30 rounded-xl border border-dashed border-stroke dark:border-slate-800">
                  <span className="text-2xl mb-2">🎉</span>
                  <span className="text-sm font-semibold">Every employee is currently online!</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Real-Time Presence Notification Popups (WhatsApp-Style Toast Overlay) ── */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              layout
              key={n.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-800 p-4 flex items-start gap-3 pointer-events-auto border-l-4"
              style={{ borderLeftColor: n.isOnline ? "#10B981" : "#EF4444" }}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-xs shadow-inner flex-shrink-0 ${n.isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                {initials(n.employeeName)}
              </div>
              <div className="flex-1">
                <div className="font-extrabold text-sm text-slate-800 dark:text-white flex items-center justify-between">
                  <span>{n.title}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{n.time}</span>
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
                  Employee: <span className="font-bold text-slate-800 dark:text-white">{n.employeeName}</span>
                </div>
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                  Status: <span className={`font-bold ${n.isOnline ? 'text-emerald-500' : 'text-rose-500'}`}>{n.status}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Section 9: Location Intelligence & Map ── */}
      <div className="grid gap-6 grid-cols-1">
        <div className="bg-surface dark:bg-slate-900/40 rounded-2xl shadow-sm border border-stroke dark:border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="bg-surface dark:bg-slate-900/60 border-b border-stroke dark:border-slate-800 px-7 py-5 flex justify-between items-center flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 text-[1.15rem] professional-title text-slate-900 dark:text-white">
                <MapPin size={20} className="text-indigo-600 dark:text-indigo-400" />
                <span>Location <span className="text-indigo-600 dark:text-indigo-400 italic">Distribution</span> of Employees</span>
              </div>
              <div className="text-[0.82rem] text-slate-500 dark:text-slate-500 font-medium pl-[30px]">
                {locationSummary.length} locations · {locationSummary.reduce((s, l) => s + (l.employees || 0), 0)} total employees
              </div>
            </div>
            <div className="flex gap-4.5">
              <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-slate-600 dark:text-slate-400 tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                Clocked In
              </div>
              <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-slate-600 dark:text-slate-400 tracking-wide ml-4">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
                Clocked Out
              </div>
              <div className="flex items-center gap-1.5 text-[0.78rem] font-bold text-slate-600 dark:text-slate-400 tracking-wide ml-4">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
                Assigned
              </div>
            </div>
          </div>

          {/* Map + Sidebar Layout */}
          <div className="flex h-[460px]">
            {/* Sidebar location list */}
            <div className="w-[280px] min-w-[280px] bg-bg dark:bg-slate-900/50 border-r border-stroke dark:border-slate-800 flex flex-col overflow-hidden">
              <div className="px-5 pt-4 pb-2.5 text-xs font-black text-slate-500 dark:text-slate-600 uppercase tracking-widest">Locations by Activity</div>
              {locationSummary.length ? (
                <div className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
                  {locationSummary.map((loc) => {
                    const isHovered = hoveredLoc === loc.name
                    return (
                      <div
                        key={loc.name}
                        className={`p-3.5 rounded-xl cursor-pointer transition-all duration-200 mb-1 ${isHovered ? 'bg-surface dark:bg-slate-800 shadow-sm border border-stroke dark:border-slate-700' : 'hover:bg-surface dark:hover:bg-slate-800 hover:shadow-sm border border-transparent hover:border-stroke dark:hover:border-slate-700'}`}
                        onMouseEnter={() => setHoveredLoc(loc.name)}
                        onMouseLeave={() => setHoveredLoc(null)}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="text-[0.88rem] font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">{loc.name}</div>
                          <div className="text-[0.95rem] font-extrabold text-indigo-600 dark:text-indigo-400 min-w-[24px] text-right">{loc.employees || 0}</div>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-500 min-w-[4px]"
                            style={{
                              width: `${Math.min(100, Math.max(4, ((loc.employees || 0) / Math.max(1, ...locationSummary.map(l => l.employees || 0))) * 100))}%`,
                              background: (loc.clocked_in_now || 0) > 0 ? '#10B981' : '#6366F1',
                            }}
                          />
                        </div>
                        <div className="flex gap-2.5 text-[0.72rem] font-semibold">
                          {(loc.clocked_in_now || 0) > 0 && (
                            <span className="text-emerald-500">● {loc.clocked_in_now} in</span>
                          )}
                          {(loc.clocked_out_today || 0) > 0 && (
                            <span className="text-rose-500">● {loc.clocked_out_today} out</span>
                          )}
                          {(loc.clocked_in_now || 0) === 0 && (loc.clocked_out_today || 0) === 0 && (
                            <span className="text-slate-400">No activity today</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-10 text-center text-slate-400 italic">No locations</div>
              )}
            </div>

            {/* Map */}
            <div className="flex-1 relative min-h-[300px]">
              {locationSummary.length ? (
                <Suspense fallback={<ChartPlaceholder />}>
                  <DashboardMap locationSummary={locationSummary} />
                </Suspense>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic bg-bg dark:bg-slate-950/40 rounded-lg border border-dashed border-stroke dark:border-slate-800">No locations configured</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 5b: Clock-in Status Bar Chart (Full Width) ── */}
      <div className="grid gap-6 grid-cols-1">
        <div className="bg-surface dark:bg-slate-900/40 rounded-xl shadow-sm border border-stroke dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-stroke dark:border-slate-800 flex justify-between items-center">
            <span className="text-[1.05rem] font-bold text-slate-800 dark:text-slate-200">Clock-in Status by Location</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">Today</span>
          </div>
          <div className="p-5 h-[320px] relative">
            {locationSummary.length ? (
              <Suspense fallback={<ChartPlaceholder />}>
                <BarChart data={clockLocData} options={clockLocOptions} />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic bg-bg dark:bg-slate-950/40 rounded-lg border border-dashed border-stroke dark:border-slate-800">No location data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5c: Hours by Location ── */}
      <div className="grid gap-6 grid-cols-1">
        <div className="bg-surface dark:bg-slate-900/40 rounded-xl shadow-sm border border-stroke dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-stroke dark:border-slate-800 flex justify-between items-center">
            <span className="text-[1.05rem] font-bold text-slate-800 dark:text-slate-200">Hours by Location</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">Last 30 Days</span>
          </div>
          <div className="p-5 h-[300px] relative">
            {hoursByLoc.length ? (
              <Suspense fallback={<ChartPlaceholder />}>
                <BarChart data={hrsLocData} options={hrsLocOptions} />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-600 text-sm italic bg-bg dark:bg-slate-950/40 rounded-lg border border-dashed border-stroke dark:border-slate-800">No hours data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 6: Location Summary Table ── */}
      <div className="grid gap-6 grid-cols-1">
        <div className="bg-surface dark:bg-slate-900/40 rounded-xl shadow-sm border border-stroke dark:border-slate-800 flex flex-col overflow-hidden">
          <div className="px-6 py-5 border-b border-stroke dark:border-slate-800 flex justify-between items-center">
            <span className="text-[1.05rem] font-bold text-slate-800 dark:text-slate-200">Location Summary</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full flex items-center border border-indigo-100 dark:border-indigo-900/50">
              <MapPin size={14} className="mr-1" />
              {locationSummary.length} Locations
            </span>
          </div>
          <div className="p-0 overflow-x-auto">
            {locationSummary.length ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Location</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Address</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Employees</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Clocked In</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Clocked Out</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800">Tasks</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest bg-bg dark:bg-slate-800/50 border-b border-stroke dark:border-slate-800 text-right">Hours (30d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-slate-800">
                  {locationSummary.map((loc) => (
                    <tr key={loc.name} className="hover:bg-bg dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-semibold shadow-sm">
                            <MapPin size={14} />
                          </div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{loc.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-400 max-w-[180px] truncate">{loc.address || "—"}</td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {loc.employees}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                          {loc.clocked_in_now || 0}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
                          {loc.clocked_out_today || 0}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-slate-700 dark:text-slate-300 font-medium">{loc.total_tasks}</td>
                      <td className="px-6 py-5 text-sm font-bold text-slate-600 dark:text-slate-400 text-right">{loc.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-slate-400 dark:text-slate-600 text-sm italic bg-bg dark:bg-slate-950/40 rounded-lg border border-dashed border-stroke dark:border-slate-800 m-6">No locations configured. Add locations in Settings › Locations.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}