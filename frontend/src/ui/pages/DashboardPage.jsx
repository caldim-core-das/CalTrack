import React, { useEffect, useMemo, useState, useRef } from "react"
import { Clock, Users, Briefcase, CalendarDays, DollarSign, Loader2, AlertCircle, Timer, Activity, MapPin } from "lucide-react"
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from "chart.js"
import { Bar, Line, Doughnut, Pie } from "react-chartjs-2"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import "./DashboardPage.css"

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

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

function formatHours(h) {
  if (h == null) return "—"
  return `${h.toFixed(1)}h`
}

function formatMoney(n) {
  if (!n && n !== 0) return "$0"
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}


export function DashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")
      try {
        const data = await apiRequest("/reports/dashboard-analytics/")
        if (!cancelled) setAnalytics(data)
      } catch (err) {
        if (!cancelled) {
          console.error("Dashboard analytics error:", err)
          setError("Failed to load dashboard analytics.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (user) load()
    return () => { cancelled = true }
  }, [user])

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

  function KpiDiagramSide({ card, side }) {
    const desc = (
      <div className={`anl-kpi-di-desc anl-kpi-di-desc-${side}`}>
        <div className="anl-kpi-di-descTitle" style={{ color: card.color }}>
          {card.value}
        </div>
        <div className="anl-kpi-di-descText">{card.sub}</div>
      </div>
    )

    const pill = (
      <div className={`anl-kpi-di-pill anl-kpi-di-pill-${side}`} style={{ backgroundColor: card.color }}>
        <div className="anl-kpi-di-pillInner">
          <div className="anl-kpi-di-pillLabel">{card.title}</div>
        </div>
        <div className="anl-kpi-di-pillIcon">
          <span style={{ color: card.color, display: "flex" }}>{card.icon}</span>
        </div>
      </div>
    )

    const connector = (
      <div className={`anl-kpi-di-connector anl-kpi-di-connector-${side}`}>
        <span className="anl-kpi-di-connectorLine" />
        <span className="anl-kpi-di-connectorDot" style={{ backgroundColor: card.color }} />
      </div>
    )

    if (side === "left") {
      return (
        <div className="anl-kpi-di-side anl-kpi-di-side-left">
          {desc}
          {pill}
          {connector}
        </div>
      )
    }

    return (
      <div className="anl-kpi-di-side anl-kpi-di-side-right">
        {connector}
        {pill}
        {desc}
      </div>
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

  // Map center: compute average of location coords or fallback
  const mapCenter = useMemo(() => {
    const locs = locationSummary.filter((l) => l.lat && l.lng)
    if (locs.length === 0) return [20.5937, 78.9629] // India fallback
    const avgLat = locs.reduce((s, l) => s + l.lat, 0) / locs.length
    const avgLng = locs.reduce((s, l) => s + l.lng, 0) / locs.length
    return [avgLat, avgLng]
  }, [locationSummary])

  // Fit map bounds to all locations + fix grey tiles
  function FitBounds({ locations }) {
    const map = useMap()
    useEffect(() => {
      // Force Leaflet to recalculate container size (fixes grey tiles in flex layouts)
      const t1 = setTimeout(() => map.invalidateSize(), 100)
      const t2 = setTimeout(() => map.invalidateSize(), 400)
      const t3 = setTimeout(() => {
        map.invalidateSize()
        const valid = locations.filter((l) => l.lat && l.lng)
        if (valid.length === 0) return
        if (valid.length === 1) {
          map.setView([valid[0].lat, valid[0].lng], 13)
          return
        }
        const bounds = L.latLngBounds(valid.map((l) => [l.lat, l.lng]))
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
      }, 600)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    }, [locations, map])
    return null
  }

  // Build custom Leaflet DivIcon markers
  function createLocationDotIcon(loc) {
    const clockedIn = loc.clocked_in_now || 0
    const clockedOut = loc.clocked_out_today || 0
    const total = clockedIn + clockedOut
    const employees = loc.employees || 0

    // Size proportional to employee count (min 36, max 72)
    const size = Math.max(36, Math.min(72, employees * 8 + 28))
    const half = size / 2

    // Color: green if people clocked in, blue if assigned but none active, grey if empty
    let color = "#6366F1" // default indigo
    let glow  = "rgba(99,102,241,0.35)"
    let pulse = false
    if (clockedIn > 0) {
      color = "#10B981"
      glow  = "rgba(16,185,129,0.35)"
      pulse = true
    } else if (clockedOut > 0) {
      color = "#F43F5E"
      glow  = "rgba(244,63,94,0.25)"
    } else if (employees === 0 && total === 0) {
      color = "#94A3B8"
      glow  = "rgba(148,163,184,0.2)"
    }

    const label = employees > 0 ? employees : (total > 0 ? total : "")

    return L.divIcon({
      className: "anl-loc-dot-icon",
      iconSize: [size, size],
      iconAnchor: [half, half],
      popupAnchor: [0, -half - 4],
      html: `
        <div class="anl-loc-dot ${pulse ? 'anl-loc-dot--pulse' : ''}" style="
          width:${size}px; height:${size}px;
          background: ${color};
          box-shadow: 0 0 0 6px ${glow}, 0 4px 14px rgba(0,0,0,0.18);
        ">
          <span class="anl-loc-dot-label">${label}</span>
        </div>
      `,
    })
  }

  const [hoveredLoc, setHoveredLoc] = useState(null)

  if (loading) {
    return (
      <div className="anl-layout">
        <div className="anl-loading">
          <Loader2 className="spin" size={24} />
          <span>Loading analytics…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="anl-layout">
      {error && (
        <div className="anl-error">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="anl-kpi-diagram-card">
        <div className="anl-kpi-diagram-header">
          <div className="anl-kpi-diagram-title">Key Performance Indicators</div>
          <div className="anl-kpi-diagram-subtitle">Strategic overview</div>
        </div>

        <div className="anl-kpi-diagram">
          <div className="anl-kpi-pos-center">
            <div className="anl-kpi-di-center">
              <div className="anl-kpi-di-ring">
                <span className="anl-kpi-di-dot anl-kpi-di-dot-1" style={{ backgroundColor: kpiEmp.color }} />
                <span className="anl-kpi-di-dot anl-kpi-di-dot-2" style={{ backgroundColor: kpiHrs.color }} />
                <span className="anl-kpi-di-dot anl-kpi-di-dot-3" style={{ backgroundColor: kpiPay.color }} />
                <span className="anl-kpi-di-dot anl-kpi-di-dot-4" style={{ backgroundColor: kpiShft.color }} />
                <span className="anl-kpi-di-dot anl-kpi-di-dot-5" style={{ backgroundColor: kpiLvs.color }} />
                <span className="anl-kpi-di-dot anl-kpi-di-dot-6" style={{ backgroundColor: kpiTsk.color }} />
              </div>
              <div className="anl-kpi-di-core">
                <Activity size={26} />
              </div>
            </div>
          </div>

          <div className="anl-kpi-pos-l1">
            <KpiDiagramSide card={kpiEmp} side="left" />
          </div>
          <div className="anl-kpi-pos-r1">
            <KpiDiagramSide card={kpiHrs} side="right" />
          </div>

          <div className="anl-kpi-pos-l2">
            <KpiDiagramSide card={kpiTsk} side="left" />
          </div>
          <div className="anl-kpi-pos-r2">
            <KpiDiagramSide card={kpiPay} side="right" />
          </div>

          <div className="anl-kpi-pos-l3">
            <KpiDiagramSide card={kpiLvs} side="left" />
          </div>
          <div className="anl-kpi-pos-r3">
            <KpiDiagramSide card={kpiShft} side="right" />
          </div>
        </div>
      </div>

      {/* ── Row 1: Hours by Employee + Task Status Donut + Leave Status Pie ── */}
      <div className="anl-row anl-row-3">
        <div className="anl-card anl-card-wide">
          <div className="anl-card-header">
            <span className="anl-card-title">Hours by Employee</span>
            <span className="anl-card-badge">Last 30 days</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {hoursByEmployee.length ? (
              <Bar data={hbeData} options={hbeOptions} />
            ) : (
              <div className="anl-empty">No time data available</div>
            )}
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Task Status</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {tsLabels.length ? (
              <Doughnut data={tsData} options={donutOptions} />
            ) : (
              <div className="anl-empty">No tasks</div>
            )}
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Leave Status</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {lsLabels.length ? (
              <Doughnut data={lsData} options={pieOptions} />
            ) : (
              <div className="anl-empty">No leave data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Daily Hours Trend (full width) ── */}
      <div className="anl-row anl-row-1">
        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Daily Hours Trend</span>
            <span className="anl-card-badge">Last 30 days</span>
          </div>
          <div className="anl-card-body anl-chart-h280">
            <Line data={trendData} options={trendOptions} />
          </div>
        </div>
      </div>

      {/* ── Row 3: Attendance + Task Category + Payroll Trend ── */}
      <div className="anl-row anl-row-3">
        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Daily Attendance</span>
            <span className="anl-card-badge">Last 7 days</span>
          </div>
          <div className="anl-card-body anl-chart-h280">
            <Bar data={attData} options={attOptions} />
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Tasks by Category</span>
          </div>
          <div className="anl-card-body anl-chart-h280">
            {tcLabels.length ? (
              <Bar data={tcData} options={tcOptions} />
            ) : (
              <div className="anl-empty">No categorized tasks</div>
            )}
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Payroll Trend</span>
          </div>
          <div className="anl-card-body anl-chart-h280">
            {payrollTrend.length ? (
              <Bar data={ptData} options={ptOptions} />
            ) : (
              <div className="anl-empty">No payroll data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: Location-wise Analysis ── */}
      <div className="anl-row anl-row-3">
        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Employees by Location</span>
            <span className="anl-card-badge">{employeesByLoc.length} locations</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {employeesByLoc.length ? (
              <Bar data={empLocData} options={empLocOptions} />
            ) : (
              <div className="anl-empty">No locations configured</div>
            )}
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Tasks by Location</span>
            <span className="anl-card-badge">Active vs Total</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {tasksByLoc.length ? (
              <Bar data={taskLocData} options={taskLocOptions} />
            ) : (
              <div className="anl-empty">No location task data</div>
            )}
          </div>
        </div>

        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Hours by Location</span>
            <span className="anl-card-badge">Last 30 days</span>
          </div>
          <div className="anl-card-body anl-chart-h300">
            {hoursByLoc.length ? (
              <Bar data={hrsLocData} options={hrsLocOptions} />
            ) : (
              <div className="anl-empty">No location hours data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 5: Location Map — Innovative Full-Width ── */}
      <div className="anl-row anl-row-1">
        <div className="anl-locmap-card">
          {/* Dark Gradient Header */}
          <div className="anl-locmap-header">
            <div className="anl-locmap-header-left">
              <div className="anl-locmap-title">
                <MapPin size={20} />
                <span>Location <span className="anl-locmap-title-accent">Distribution</span> of Employees</span>
              </div>
              <div className="anl-locmap-subtitle">
                {locationSummary.length} locations · {locationSummary.reduce((s, l) => s + (l.employees || 0), 0)} total employees
              </div>
            </div>
            <div className="anl-locmap-legend">
              <div className="anl-locmap-legend-item">
                <span className="anl-locmap-legend-dot" style={{ background: "#10B981" }} />
                Clocked In
              </div>
              <div className="anl-locmap-legend-item">
                <span className="anl-locmap-legend-dot" style={{ background: "#F43F5E" }} />
                Clocked Out
              </div>
              <div className="anl-locmap-legend-item">
                <span className="anl-locmap-legend-dot" style={{ background: "#6366F1" }} />
                Assigned
              </div>
            </div>
          </div>

          {/* Map + Sidebar Layout */}
          <div className="anl-locmap-body">
            {/* Sidebar location list */}
            <div className="anl-locmap-sidebar">
              <div className="anl-locmap-sidebar-title">Locations by Activity</div>
              {locationSummary.length ? (
                <div className="anl-locmap-sidebar-list">
                  {locationSummary.map((loc) => {
                    const isHovered = hoveredLoc === loc.name
                    return (
                      <div
                        key={loc.name}
                        className={`anl-locmap-sidebar-item ${isHovered ? 'anl-locmap-sidebar-item--active' : ''}`}
                        onMouseEnter={() => setHoveredLoc(loc.name)}
                        onMouseLeave={() => setHoveredLoc(null)}
                      >
                        <div className="anl-locmap-sidebar-item-top">
                          <div className="anl-locmap-sidebar-item-name">{loc.name}</div>
                          <div className="anl-locmap-sidebar-item-count">{loc.employees || 0}</div>
                        </div>
                        <div className="anl-locmap-sidebar-item-bar">
                          <div
                            className="anl-locmap-sidebar-item-fill"
                            style={{
                              width: `${Math.min(100, Math.max(4, ((loc.employees || 0) / Math.max(1, ...locationSummary.map(l => l.employees || 0))) * 100))}%`,
                              background: (loc.clocked_in_now || 0) > 0 ? '#10B981' : '#6366F1',
                            }}
                          />
                        </div>
                        <div className="anl-locmap-sidebar-item-meta">
                          {(loc.clocked_in_now || 0) > 0 && (
                            <span style={{ color: '#10B981' }}>● {loc.clocked_in_now} in</span>
                          )}
                          {(loc.clocked_out_today || 0) > 0 && (
                            <span style={{ color: '#F43F5E' }}>● {loc.clocked_out_today} out</span>
                          )}
                          {(loc.clocked_in_now || 0) === 0 && (loc.clocked_out_today || 0) === 0 && (
                            <span style={{ color: '#94A3B8' }}>No activity today</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="anl-locmap-sidebar-empty">No locations</div>
              )}
            </div>

            {/* Map */}
            <div className="anl-locmap-map-wrap">
              {locationSummary.length ? (
                <MapContainer
                  center={mapCenter}
                  zoom={11}
                  style={{ width: "100%", height: "100%" }}
                  scrollWheelZoom={true}
                  zoomControl={false}
                >
                  <FitBounds locations={locationSummary} />
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OSM &copy; CARTO'
                  />
                  {locationSummary.map((loc) => (
                    <Marker
                      key={loc.name}
                      position={[loc.lat, loc.lng]}
                      icon={createLocationDotIcon(loc)}
                    >
                      <Popup className="anl-locmap-popup" offset={[0, -4]}>
                        <div className="anl-locmap-popup-inner">
                          <div className="anl-locmap-popup-title">{loc.name}</div>
                          {loc.address && <div className="anl-locmap-popup-addr">{loc.address}</div>}
                          <div className="anl-locmap-popup-stats">
                            <div className="anl-locmap-popup-stat">
                              <span className="anl-locmap-popup-stat-num" style={{ color: '#6366F1' }}>{loc.employees || 0}</span>
                              <span>Employees</span>
                            </div>
                            <div className="anl-locmap-popup-stat">
                              <span className="anl-locmap-popup-stat-num" style={{ color: '#10B981' }}>{loc.clocked_in_now || 0}</span>
                              <span>Clocked In</span>
                            </div>
                            <div className="anl-locmap-popup-stat">
                              <span className="anl-locmap-popup-stat-num" style={{ color: '#F43F5E' }}>{loc.clocked_out_today || 0}</span>
                              <span>Clocked Out</span>
                            </div>
                          </div>
                          <div className="anl-locmap-popup-hours">{loc.hours}h worked (30d)</div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <div className="anl-empty" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No locations configured</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 5b: Clock-in Status Bar Chart (Full Width) ── */}
      <div className="anl-row anl-row-1">
        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Clock-in Status by Location</span>
            <span className="anl-card-badge">Today</span>
          </div>
          <div className="anl-card-body" style={{ height: 320, position: 'relative' }}>
            {locationSummary.length ? (
              <Bar data={clockLocData} options={clockLocOptions} />
            ) : (
              <div className="anl-empty">No location data</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 6: Location Summary Table ── */}
      <div className="anl-row anl-row-1">
        <div className="anl-card">
          <div className="anl-card-header">
            <span className="anl-card-title">Location Summary</span>
            <span className="anl-card-badge">
              <MapPin size={14} style={{ marginRight: 4 }} />
              {locationSummary.length} Locations
            </span>
          </div>
          <div className="anl-card-body anl-table-wrap">
            {locationSummary.length ? (
              <table className="anl-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Address</th>
                    <th>Employees</th>
                    <th>Clocked In</th>
                    <th>Clocked Out</th>
                    <th>Tasks</th>
                    <th>Hours (30d)</th>
                  </tr>
                </thead>
                <tbody>
                  {locationSummary.map((loc) => (
                    <tr key={loc.name}>
                      <td>
                        <div className="anl-emp-cell">
                          <div className="anl-emp-avatar" style={{ background: "rgba(99, 102, 241, 0.15)", color: "#6366F1" }}>
                            <MapPin size={14} />
                          </div>
                          <div>
                            <div className="anl-emp-name">{loc.name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loc.address || "—"}</td>
                      <td>
                        <span className="anl-status-pill" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                          {loc.employees}
                        </span>
                      </td>
                      <td>
                        <span className="anl-status-pill" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#10B981", marginRight: 4 }} />
                          {loc.clocked_in_now || 0}
                        </span>
                      </td>
                      <td>
                        <span className="anl-status-pill" style={{ background: "rgba(244, 63, 94, 0.12)", color: "#F43F5E", borderColor: "rgba(244, 63, 94, 0.3)" }}>
                          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#F43F5E", marginRight: 4 }} />
                          {loc.clocked_out_today || 0}
                        </span>
                      </td>
                      <td>{loc.total_tasks}</td>
                      <td className="anl-hours-cell">{loc.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="anl-empty">No locations configured. Add locations in Settings › Locations.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
