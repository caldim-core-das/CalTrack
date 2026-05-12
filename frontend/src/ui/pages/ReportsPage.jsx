import { useRef, useEffect, useMemo, useState } from "react"

import { apiRequest } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"
import { BarChart3, Users, UserCheck, Clock, CalendarCheck, Activity, Banknote } from "lucide-react"

const METRIC_CONFIG = {
  "Employees (total)": { icon: Users, color: "from-blue-500 to-indigo-600" },
  "Employees (active)": { icon: UserCheck, color: "from-emerald-400 to-teal-500" },
  "Leaves pending": { icon: Clock, color: "from-amber-400 to-orange-500" },
  "Leaves approved (range)": { icon: CalendarCheck, color: "from-purple-500 to-fuchsia-600" },
  "Time logs (range)": { icon: Activity, color: "from-pink-500 to-rose-600" },
  "Payroll runs (range)": { icon: Banknote, color: "from-cyan-400 to-blue-500" },
}

function Report3DCard({ label, value }) {
  const cardRef = useRef(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    // Calculate rotation (-12 to 12 degrees)
    const rotateX = ((y - centerY) / centerY) * -12
    const rotateY = ((x - centerX) / centerX) * 12
    
    setRotation({ x: rotateX, y: rotateY })
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotation({ x: 0, y: 0 })
  }

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const config = METRIC_CONFIG[label] || { icon: Activity, color: "from-slate-400 to-slate-500" }
  const Icon = config.icon

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{ perspective: "1000px" }}
      className="relative group cursor-default w-full h-[240px]"
    >
      <div
        className="relative h-full w-full rounded-3xl p-8 bg-white border border-slate-100/50 shadow-xl overflow-hidden transition-all duration-200 ease-out"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: "preserve-3d",
          boxShadow: isHovered ? "0 40px 80px -12px rgba(0,0,0,0.15)" : "0 20px 40px -12px rgba(0,0,0,0.05)"
        }}
      >
        {/* Glossy Reflection Overlay */}
        <div 
          className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/60 to-white/0 opacity-0 transition-opacity duration-300 pointer-events-none"
          style={{ opacity: isHovered ? 0.9 : 0 }}
        />
        
        {/* Background gradient blur */}
        <div className={`absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-gradient-to-br ${config.color} opacity-[0.15] blur-3xl group-hover:opacity-30 transition-opacity duration-500`} />

        <div className="flex flex-col h-full relative z-10" style={{ transform: "translateZ(40px)" }}>
          <div className="flex justify-between items-start mb-6">
            <div className={`p-4 rounded-2xl bg-gradient-to-br ${config.color} text-white shadow-xl shadow-indigo-500/10`}>
              <Icon size={28} />
            </div>
          </div>
          
          <div className="mt-auto">
            <div className="text-6xl professional-title text-slate-900 leading-none mb-1">
              {value ?? "—"}
            </div>
            <div className="text-[13px] professional-subtitle text-slate-500">
              {label}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 30)
    return { start: isoDate(start), end: isoDate(end) }
  })
  const [data, setData] = useState(null)

  const summary = useMemo(() => {
    if (!data) return []
    return [
      { label: "Employees (total)", value: data.employees?.total },
      { label: "Employees (active)", value: data.employees?.active },
      { label: "Leaves pending", value: data.leaves?.pending },
      { label: "Leaves approved (range)", value: data.leaves?.approved_in_range },
      { label: "Time logs (range)", value: data.time_tracking?.time_logs_in_range },
      { label: "Payroll runs (range)", value: data.payroll?.records_generated_in_range }
    ]
  }, [data])

  async function load(nextRange = range) {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest(`/reports/overview/?start=${encodeURIComponent(nextRange.start)}&end=${encodeURIComponent(nextRange.end)}`)
      setData(res)
    } catch (err) {
      setError(err?.body?.detail || "Failed to load reports.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 overflow-hidden">
        <div className="h-24 bg-white border-b border-slate-100 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-[Manrope] flex items-center gap-3">
                <BarChart3 className="text-indigo-600" size={24} />
                Reports
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Admin access required.
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          <Card>
            <div className="text-slate-400 italic">You don't have permission to view this page.</div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-white border-b border-slate-100 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl professional-title text-slate-900 flex items-center gap-3">
              <BarChart3 className="text-indigo-600" size={24} />
              Reports
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] professional-subtitle text-slate-500">
                A clean overview for decision-making.
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          {data?.range?.start && data?.range?.end && (
            <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[13px] font-black text-slate-700 tracking-tight uppercase">{data.range.start} → {data.range.end}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">

      {error ? <div className="errorBox">{error}</div> : null}

      <Card
        title="Range"
        actions={
          <Button variant="ghost" type="button" onClick={() => load(range)} disabled={loading}>
            Refresh
          </Button>
        }
      >
        <div className="grid2Tight">
          <Input label="Start" type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
          <Input label="End" type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full flex justify-center py-20 text-slate-400">
            Fetching metrics…
          </div>
        ) : (
          summary.map((s) => (
            <Report3DCard key={s.label} label={s.label} value={s.value} />
          ))
        )}
      </div>
      </div>
    </div>
  )
}

