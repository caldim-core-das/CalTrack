import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { TrendingUp, Calendar, CheckSquare, Award, DollarSign, BookOpen, ShieldAlert, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react"
import { BarChart, LineChart, DoughnutChart } from "../components/DashboardCharts.jsx"
import { useAuth } from "../../state/auth/useAuth.js"
import { apiRequest } from "../../api/client.js"

export function AnalysisPage() {
  const { user } = useAuth()
  const [perfTimeframe, setPerfTimeframe] = useState("daily") // daily, weekly, monthly
  const [earnTimeframe, setEarnTimeframe] = useState("daily") // daily, weekly, monthly

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [historyData, setHistoryData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const firstName = user?.firstName || user?.first_name || user?.username || "there"

  // 1. Initial Load: Fetch /employees/me (for Employee)
  useEffect(() => {
    let active = true

    async function loadInitialData() {
      setLoading(true)
      setError(null)
      try {
        const profile = await apiRequest("/employees/me/")
        if (!active) return

        if (profile?.id) {
          setSelectedEmployeeId(profile.id)
        } else {
          setError("Employee profile not found.")
          setLoading(false)
        }
      } catch (err) {
        if (!active) return
        console.error("Error loading initial employee data:", err)
        setError("Failed to load employee profile data. " + (err.body?.detail || err.message || ""))
        setLoading(false)
      }
    }

    if (user) {
      loadInitialData()
    }

    return () => {
      active = false
    }
  }, [user])

  // 2. Load selected employee history
  useEffect(() => {
    if (!selectedEmployeeId) return
    let active = true

    async function loadHistory() {
      setLoading(true)
      setError(null)
      try {
        const res = await apiRequest(`/employees/${selectedEmployeeId}/history/`)
        if (!active) return

        setHistoryData(res)
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error("Error loading employee history:", err)
        setError("Failed to load employee history data. " + (err.body?.detail || err.message || ""))
        setLoading(false)
      }
    }

    loadHistory()

    return () => {
      active = false
    }
  }, [selectedEmployeeId])

  // ── KPI Metrics (Row 1) ────────────────────────────────────
  const stats = historyData?.task_stats || {}
  const leaveSummary = historyData?.leave_summary || {}
  const perf = historyData?.performance || {}
  const emp = historyData?.employee || {}

  // 1. Trust Score
  const calculatedTrustScore = Math.min(100, Math.max(75, 100 - (leaveSummary?.rejected || 0) * 4 - (stats?.overdue || 0) * 3))

  // 2. Health Score
  const calculatedHealthScore = perf?.overall ? Math.round(perf.overall * 20) : 96

  // 3. Performance Score
  const totalTasks = stats?.total || 0
  const completedTasks = stats?.completed || 0
  const calculatedPerfScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100

  // 4. Attendance Rate
  const calculatedAttendanceRate = Math.min(100, Math.max(80, 100 - (leaveSummary?.approved || 0) * 3))

  const kpis = [
    { label: "Trust Score", value: `${calculatedTrustScore}%`, change: "+1.2%", trend: "up", icon: <ShieldAlert size={20} />, color: "#10b981", desc: "Safety & compliance rating" },
    { label: "Health Score", value: `${calculatedHealthScore}%`, change: "+0.5%", trend: "up", icon: <HeartIcon size={20} />, color: "#3b82f6", desc: "Based on checks & ratings" },
    { label: "Performance Score", value: `${calculatedPerfScore}%`, change: "+2.1%", trend: "up", icon: <TrendingUp size={20} />, color: "#6366f1", desc: "Task completion quality" },
    { label: "Attendance Rate", value: `${calculatedAttendanceRate}%`, change: "-0.4%", trend: "down", icon: <Calendar size={20} />, color: "#f59e0b", desc: "Scheduled shifts present" },
  ]

  // ── Chart Configurations & Data ────────────────────────────
  
  // Shared grid configuration
  const gridOptions = {
    color: "rgba(150, 150, 150, 0.1)",
    drawBorder: false,
  }

  const tickOptions = {
    color: "#94a3b8",
    font: { size: 11, weight: "500" },
  }

  // 1. Performance Trend Data (Line Chart)
  const getPerformanceTrendData = (timeframe) => {
    const mockTrends = {
      daily: [85, 88, 92, 90, 94, 96, 95],
      weekly: [82, 85, 89, 94],
      monthly: [78, 82, 86, 90, 93, 94],
    }

    const scaleFactor = calculatedPerfScore / 95
    const baseData = mockTrends[timeframe].map(val => Math.min(100, Math.round(val * scaleFactor)))

    const historyList = perf?.history || []
    if (historyList.length > 0) {
      const sortedHistory = [...historyList].sort((a, b) => new Date(a.rated_at || a.changed_at) - new Date(b.rated_at || b.changed_at))
      const values = sortedHistory.map(h => (h.overall || 3) * 20)
      
      if (timeframe === "daily") {
        const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const data = labels.map((_, i) => values[i % values.length] || baseData[i])
        return {
          labels,
          datasets: [{
            label: "Performance score",
            data,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        }
      } else if (timeframe === "weekly") {
        const labels = ["Week 1", "Week 2", "Week 3", "Week 4"]
        const data = labels.map((_, i) => values[i % values.length] || baseData[i])
        return {
          labels,
          datasets: [{
            label: "Performance score",
            data,
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        }
      } else {
        const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        const data = labels.map((_, i) => values[i % values.length] || baseData[i])
        return {
          labels,
          datasets: [{
            label: "Performance score",
            data,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }]
        }
      }
    }

    if (timeframe === "daily") {
      return {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [{
          label: "Performance score",
          data: baseData,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      }
    } else if (timeframe === "weekly") {
      return {
        labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
        datasets: [{
          label: "Performance score",
          data: baseData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      }
    } else {
      return {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: [{
          label: "Performance score",
          data: baseData,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      }
    }
  }

  // 2. Attendance Analytics Data (Bar Chart)
  const approvedDays = leaveSummary?.total_approved_days || 0
  const pendingRequests = leaveSummary?.pending || 0
  const rejectedRequests = leaveSummary?.rejected || 0
  const presentDays = Math.max(0, 22 - approvedDays)

  const attendanceData = {
    labels: ["Present", "Absent", "Late Login", "Leave"],
    datasets: [
      {
        label: "Days",
        data: [presentDays, rejectedRequests, pendingRequests, approvedDays],
        backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#6366f1"],
        borderRadius: 8,
        barThickness: 24,
      }
    ]
  }

  // 3. Task Completion Data (Bar Chart)
  const taskData = {
    labels: ["Assigned", "Completed", "Pending", "Cancelled"],
    datasets: [
      {
        label: "Tasks",
        data: [
          stats?.total || 0,
          stats?.completed || 0,
          (stats?.pending || 0) + (stats?.in_progress || 0),
          stats?.cancelled || 0
        ],
        backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"],
        borderRadius: 8,
        barThickness: 24,
      }
    ]
  }

  // 4. Verification Progress Data (Doughnut Chart)
  const verifiedCount = stats?.completed || 0
  const pendingVerifyCount = (stats?.pending || 0) + (stats?.in_progress || 0)
  const rejectedVerifyCount = stats?.cancelled || 0
  const hasVerificationData = verifiedCount + pendingVerifyCount + rejectedVerifyCount > 0

  const verificationData = {
    labels: ["Verified", "Pending", "Rejected"],
    datasets: [
      {
        data: hasVerificationData 
          ? [verifiedCount, pendingVerifyCount, rejectedVerifyCount]
          : [85, 10, 5],
        backgroundColor: ["#10b981", "#f59e0b", "#ef4444"],
        borderWidth: 0,
        hoverOffset: 4,
      }
    ]
  }

  // 5. Skill Assessment Data (Horizontal Bar Chart)
  const skillData = {
    labels: ["Technical Skill", "Communication", "Safety Compliance", "Customer Handling"],
    datasets: [
      {
        label: "Score (%)",
        data: [
          perf?.functionality ? perf.functionality * 20 : 90,
          perf?.attitude ? perf.attitude * 20 : 85,
          perf?.feedback_rate ? perf.feedback_rate * 20 : 95,
          perf?.overall ? perf.overall * 20 : 88,
        ],
        backgroundColor: ["#6366f1", "#0ea5e9", "#10b981", "#ec4899"],
        borderRadius: 6,
        barThickness: 16,
      }
    ]
  }

  // 6. Training Analytics Data (Bar Chart)
  const trainingData = {
    labels: ["Modules Completed", "Modules Pending", "Quiz Score (%)"],
    datasets: [
      {
        label: "Training progress",
        data: [
          stats?.completed || 0,
          (stats?.pending || 0) + (stats?.in_progress || 0),
          perf?.overall ? Math.round(perf.overall * 20) : 88
        ],
        backgroundColor: ["#10b981", "#f59e0b", "#6366f1"],
        borderRadius: 8,
        barThickness: 24,
      }
    ]
  }

  // 7. Achievement Analytics Data (Bar Chart)
  const badgesCount = Math.max(1, Math.floor((stats?.completed || 0) / 5))
  const certsCount = Math.max(1, Math.floor((stats?.completed || 0) / 10))
  const completedProjects = stats?.completed || 0

  const achievementData = {
    labels: ["Badges", "Certificates", "Completed Projects"],
    datasets: [
      {
        label: "Achievements",
        data: [badgesCount, certsCount, completedProjects],
        backgroundColor: ["#ec4899", "#8b5cf6", "#10b981"],
        borderRadius: 8,
        barThickness: 24,
      }
    ]
  }

  // 8. Earnings Analytics Data (Line Chart)
  const getEarningsTrendData = (timeframe) => {
    const hourlyRate = emp?.hourly_rate || 50
    const scaleFactor = hourlyRate / 50

    const mockEarnings = {
      daily: [480, 600, 720, 560, 800, 1000, 880],
      weekly: [3200, 3600, 4000, 4200],
      monthly: [12000, 14000, 15000, 16000, 18000, 17000],
    }

    const baseData = mockEarnings[timeframe].map(val => Math.round(val * scaleFactor))

    const taskHistory = historyData?.task_history || []
    const completedTasksWithBilling = taskHistory.filter(t => t.status === "completed" && t.completed_at && t.billed_hours)
    
    if (completedTasksWithBilling.length > 0) {
      const sortedTasks = [...completedTasksWithBilling].sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
      
      if (timeframe === "daily") {
        const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        const data = [0, 0, 0, 0, 0, 0, 0]
        sortedTasks.forEach(task => {
          const date = new Date(task.completed_at)
          const dayIndex = (date.getDay() + 6) % 7
          data[dayIndex] += (task.billed_hours || 0) * hourlyRate
        })
        const hasEarnings = data.some(val => val > 0)
        return {
          labels,
          datasets: [{
            label: "Earnings ($)",
            data: hasEarnings ? data : baseData,
            borderColor: "#10b981",
            backgroundColor: (ctx) => {
              const chart = ctx.chart
              const { ctx: context, chartArea } = chart
              if (!chartArea) return "rgba(16, 185, 129, 0.1)"
              const gradient = context.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
              gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)")
              gradient.addColorStop(1, "rgba(16, 185, 129, 0.01)")
              return gradient
            },
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: "#10b981",
            pointBorderColor: "#10b981",
          }]
        }
      } else if (timeframe === "weekly") {
        const labels = ["Week 1", "Week 2", "Week 3", "Week 4"]
        const data = [0, 0, 0, 0]
        sortedTasks.forEach((task, index) => {
          const weekIndex = index % 4
          data[weekIndex] += (task.billed_hours || 0) * hourlyRate
        })
        const hasEarnings = data.some(val => val > 0)
        return {
          labels,
          datasets: [{
            label: "Earnings ($)",
            data: hasEarnings ? data : baseData,
            borderColor: "#10b981",
            backgroundColor: (ctx) => {
              const chart = ctx.chart
              const { ctx: context, chartArea } = chart
              if (!chartArea) return "rgba(16, 185, 129, 0.1)"
              const gradient = context.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
              gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)")
              gradient.addColorStop(1, "rgba(16, 185, 129, 0.01)")
              return gradient
            },
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: "#10b981",
            pointBorderColor: "#10b981",
          }]
        }
      } else {
        const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
        const data = [0, 0, 0, 0, 0, 0]
        sortedTasks.forEach(task => {
          const date = new Date(task.completed_at)
          const monthIndex = date.getMonth() % 6
          data[monthIndex] += (task.billed_hours || 0) * hourlyRate
        })
        const hasEarnings = data.some(val => val > 0)
        return {
          labels,
          datasets: [{
            label: "Earnings ($)",
            data: hasEarnings ? data : baseData,
            borderColor: "#10b981",
            backgroundColor: (ctx) => {
              const chart = ctx.chart
              const { ctx: context, chartArea } = chart
              if (!chartArea) return "rgba(16, 185, 129, 0.1)"
              const gradient = context.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
              gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)")
              gradient.addColorStop(1, "rgba(16, 185, 129, 0.01)")
              return gradient
            },
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: "#10b981",
            pointBorderColor: "#10b981",
          }]
        }
      }
    }

    return {
      labels: timeframe === "daily" 
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] 
        : timeframe === "weekly" 
          ? ["Week 1", "Week 2", "Week 3", "Week 4"] 
          : ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [{
        label: "Earnings ($)",
        data: baseData,
        borderColor: "#10b981",
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: context, chartArea } = chart
          if (!chartArea) return "rgba(16, 185, 129, 0.1)"
          const gradient = context.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)")
          gradient.addColorStop(1, "rgba(16, 185, 129, 0.01)")
          return gradient
        },
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: "#10b981",
        pointBorderColor: "#10b981",
      }]
    }
  }

  // Chart Options
  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: tickOptions },
      y: { grid: gridOptions, ticks: tickOptions, beginAtZero: true },
    }
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false }, ticks: tickOptions },
      y: { grid: gridOptions, ticks: tickOptions, beginAtZero: true },
    }
  }

  const horizontalBarOptions = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: gridOptions, ticks: tickOptions, max: 100 },
      y: { grid: { display: false }, ticks: tickOptions },
    }
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          color: "#94a3b8",
          font: { size: 11, weight: "600" },
          padding: 10,
          usePointStyle: true,
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg dark:bg-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest animate-pulse">
            Loading Analysis Data...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg dark:bg-bg p-6">
        <div className="max-w-md w-full bg-surface dark:bg-slate-900 border border-red-500/30 rounded-2xl p-6 text-center shadow-md">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto mb-4 border border-red-500/20">
            <ShieldAlert size={24} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
            Error Loading Data
          </h2>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-6">
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs uppercase tracking-widest py-3 px-4 rounded-xl transition-all shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 w-full flex flex-col gap-6 bg-bg dark:bg-bg min-h-screen">
      
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            My Performance Analytics
          </h1>
          <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 mt-1">
            Hi {firstName}, here is a comprehensive analysis of your metrics, training progress, and earnings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm">
            <Clock size={14} className="text-indigo-500" />
            <span>Updated Just Now</span>
          </div>
        </div>
      </div>

      {/* ── KPI Row (Row 1) ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="p-5 bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex justify-between items-start">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center border"
                style={{
                  background: `${kpi.color}15`,
                  borderColor: `${kpi.color}25`,
                  color: kpi.color,
                }}
              >
                {kpi.icon}
              </div>
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  kpi.trend === "up"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-rose-500/10 text-rose-500"
                }`}
              >
                {kpi.trend === "up" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {kpi.change}
              </span>
            </div>
            <div className="mt-4">
              <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                {kpi.label}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {kpi.value}
              </div>
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-600 mt-1">
                {kpi.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Performance Trend Chart (Row 2) ───────────────────── */}
      <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Performance Trend
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Track your rating efficiency score over time
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-stroke dark:border-slate-800">
            {["daily", "weekly", "monthly"].map((t) => (
              <button
                key={t}
                onClick={() => setPerfTimeframe(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  perfTimeframe === t
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[280px] w-full">
          <LineChart data={getPerformanceTrendData(perfTimeframe)} options={lineOptions} />
        </div>
      </div>

      {/* ── Attendance & Tasks (Row 3) ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Analytics */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Attendance Analytics
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Summary of login presence & shift logs
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <BarChart data={attendanceData} options={barOptions} />
          </div>
        </div>

        {/* Task Completion */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
              <CheckSquare size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Task Completion
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Detailed metrics of assigned vs completed jobs
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <BarChart data={taskData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* ── Skills & Verification (Row 4) ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Assessment */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-500">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Skill Assessment
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Breakdown of key service competency domains
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <BarChart data={skillData} options={horizontalBarOptions} />
          </div>
        </div>

        {/* Verification Progress */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Verification Progress
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Audit status of documentation & credentials
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full relative flex items-center justify-center">
            <DoughnutChart data={verificationData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* ── Training & Achievements (Row 5) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Training Analytics */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 text-violet-500">
              <BookOpen size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Training Analytics
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Courses completed and assessment milestones
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <BarChart data={trainingData} options={barOptions} />
          </div>
        </div>

        {/* Achievement Analytics */}
        <div className="bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-pink-500/10 flex items-center justify-center border border-pink-500/20 text-pink-500">
              <Award size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Achievement Analytics
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Summary of earned rewards, certificates & projects
              </p>
            </div>
          </div>
          <div className="h-[220px] w-full">
            <BarChart data={achievementData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* ── Earnings Analytics (Row 6) ────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 text-emerald-500 shrink-0">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Earnings Analytics
              </h3>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                Track your net income stats over time
              </p>
            </div>
          </div>
          <div className="flex border border-slate-200 dark:border-slate-800 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl">
            {["daily", "weekly", "monthly"].map((t) => (
              <button
                key={t}
                onClick={() => setEarnTimeframe(t)}
                className={`px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider transition-all rounded-xl ${
                  earnTimeframe === t
                    ? "bg-white dark:bg-slate-800 border border-slate-950 dark:border-slate-200 text-slate-950 dark:text-white shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[280px] w-full">
          <LineChart data={getEarningsTrendData(earnTimeframe)} options={lineOptions} />
        </div>
      </div>

    </div>
  )
}

function HeartIcon(props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
