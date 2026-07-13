import { useEffect, useState } from "react"
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, ArcElement, Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

import { apiRequest } from "../../api/client.js"
import { useRole } from "../../state/auth/useRole.js"
import { Card, Button } from "../components/kit.jsx"
import { BarChart3, Users, Clock, CheckSquare, Banknote, MapPin, Activity } from "lucide-react"

// Register Chart.js plugins
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement, Filler)

// A dark-mode aware chart options generator
function getChartOptions(isDark) {
  const textColor = isDark ? "#cbd5e1" : "#475569";
  const gridColor = isDark ? "#334155" : "#e2e8f0";
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: textColor, font: { family: 'Inter', weight: '600', size: 11 } } },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: 'Inter', size: 13 },
        bodyFont: { family: 'Inter', size: 12 },
        displayColors: true,
        cornerRadius: 8,
      }
    },
    scales: {
      x: { ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, grid: { display: false } },
      y: { ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, grid: { color: gridColor, drawBorder: false } }
    }
  }
}

export function ReportsPage() {
  const { isAdmin } = useRole()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  
  const isDark = document.documentElement.dataset.theme === "dark" || 
                 window.matchMedia?.("(prefers-color-scheme: dark)").matches;
                 
  const [themeTick, setThemeTick] = useState(0);

  // Re-render charts on theme change
  useEffect(() => {
    const handleTheme = () => setThemeTick(t => t + 1);
    window.addEventListener("quicktims:theme", handleTheme);
    return () => window.removeEventListener("quicktims:theme", handleTheme);
  }, []);

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest(`/reports/dashboard-analytics/`)
  const load = async (force = false) => {
    setLoading(true)
    setError("")
    try {
      const url = force ? `/reports/dashboard-analytics/?refresh=true` : `/reports/dashboard-analytics/`
      const res = await apiRequest(url)
      setData(res)
    } catch (err) {
      setError(err?.body?.detail || "Failed to load comprehensive reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg overflow-hidden">
        <div className="flex-1 p-10">
          <Card><div className="text-slate-400 italic">Admin access required.</div></Card>
        </div>
      </div>
    )
  }

  const kpi = data?.kpi || {};
  const opts = getChartOptions(isDark);

  // 1. Line Chart: Daily Hours Trend
  const dailyTrendData = {
    labels: data?.daily_hours_trend?.map(d => d.date.slice(5)) || [], // MM-DD
    datasets: [{
      label: 'Hours Worked',
      data: data?.daily_hours_trend?.map(d => d.hours) || [],
      borderColor: '#3b82f6',
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointRadius: 2,
      pointBackgroundColor: '#3b82f6',
    }]
  };

  // 2. Bar Chart: Payroll Trend
  const payrollTrendData = {
    labels: data?.payroll_trend?.map(p => p.label) || [],
    datasets: [
      {
        label: 'Net Pay ($)',
        data: data?.payroll_trend?.map(p => p.net_pay) || [],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Gross Pay ($)',
        data: data?.payroll_trend?.map(p => p.gross_pay) || [],
        backgroundColor: '#6366f1',
        borderRadius: 4,
      }
    ]
  };

  // 3. Doughnut: Task Status
  const taskStatusLabels = Object.keys(data?.task_status || {});
  const taskStatusValues = Object.values(data?.task_status || {});
  const taskDoughnutData = {
    labels: taskStatusLabels,
    datasets: [{
      data: taskStatusValues,
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  // 4. Doughnut: Leave Status
  const leaveStatusLabels = Object.keys(data?.leave_status || {});
  const leaveStatusValues = Object.values(data?.leave_status || {});
  const leaveDoughnutData = {
    labels: leaveStatusLabels,
    datasets: [{
      data: leaveStatusValues,
      backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: { position: 'bottom', labels: { color: opts.plugins.legend.labels.color, font: { family: 'Inter', size: 10 }, usePointStyle: true, boxWidth: 6 } },
      tooltip: opts.plugins.tooltip
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
      
      {/* ── HEADER ── */}
      <div className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Reports & Analytics</h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Comprehensive Dashboard Engine</p>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={load} disabled={loading}>
          <Button variant="secondary" onClick={() => load(true)} disabled={loading}>
            <Activity size={14} className={loading ? "animate-spin mr-2" : "mr-2"} /> 
            {loading ? "Syncing..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-bold text-sm">{error}</div>}

        {/* ── KPI STRIP ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[
            { label: "Total Payroll (Month)", val: `$${kpi.total_payroll_month?.toLocaleString() || 0}`, icon: Banknote, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Total Hours (Month)", val: `${kpi.total_hours_month || 0}h`, icon: Clock, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
            { label: "Active Employees", val: kpi.employees_active || 0, icon: Users, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" },
            { label: "Pending Tasks", val: kpi.active_tasks || 0, icon: CheckSquare, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
            { label: "Pending Leaves", val: kpi.pending_leaves || 0, icon: MapPin, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.label}</span>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.bg} ${item.color}`}>
                  <item.icon size={14} />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{item.val}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Workforce Hours Trend (Last 30 Days)</h3>
            <div className="h-[280px]">
              {loading ? <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">Loading chart...</div> : 
               <Line data={dailyTrendData} options={opts} />
              }
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Task Status Distribution</h3>
            <div className="flex-1 relative min-h-[220px]">
              {loading ? <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">Loading...</div> : 
               <Doughnut data={taskDoughnutData} options={doughnutOpts} />
              }
            </div>
          </div>
        </div>

        {/* ── SECONDARY CHARTS & LISTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6">Payroll Expenditure Trend</h3>
            <div className="h-[250px]">
              {loading ? <div className="h-full flex items-center justify-center text-slate-400 text-sm font-semibold">Loading chart...</div> : 
               <Bar data={payrollTrendData} options={{...opts, plugins: { ...opts.plugins, legend: { position: 'top', labels: opts.plugins.legend.labels }}}} />
              }
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top 10 Employees (Hrs)</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide">
              {loading ? <div className="text-slate-400 text-sm font-semibold text-center mt-10">Loading...</div> : 
               (data?.hours_by_employee?.length ? data.hours_by_employee.map((emp, i) => (
                 <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400">
                        #{i+1}
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{emp.name}</span>
                    </div>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{emp.hours}h</span>
                 </div>
               )) : <div className="text-slate-400 text-xs text-center mt-10">No data available</div>)
              }
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
