import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults, API_BASE_URL } from "../../api/client.js"
import { getTokens } from "../../state/auth/tokens.js"
import { getAddress } from "../../api/geocoding.js"
import { formatDateTime } from "../components/kit.jsx"
import { useAuth } from "../../state/auth/useAuth.js"
import { verifyFaces, loadFaceModels, hasFace } from "../../utils/faceVerify.js"
import { NotificationService } from "../../utils/notifications.js"

import {
  Camera,
  MapPin,
  CheckCircle2,
  Clock,
  Play,
  Square,
  Coffee,
  Loader2,
  Paperclip,
  Check,
  RotateCcw,
  Edit3,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Calendar,
  Timer,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  ChevronDown,
  BarChart2,
  Clock3,
  FileText,
  Download,
  Trash2,
  LogOut,
  MoreHorizontal
} from "lucide-react"

// ─── GPS helpers ──────────────────────────────────────────────
const DAILY_TARGET_HRS = 8
const GPS_TIMEOUT_MS = 15000
const TARGET_ACCURACY_M = 100

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function findOpenLog(logs) { return logs.find((l) => !l.clock_out) ?? null }
function findOpenBreak(log) {
  if (!log?.breaks) return null
  return log.breaks.find((b) => !b.break_end) ?? null
}

async function downloadLogPdf(id) {
  try {
    const tokens = getTokens()
    const token = tokens?.access
    if (!token) throw new Error("No authentication")

    // Use absolute URL from API_BASE_URL
    const res = await fetch(`${API_BASE_URL}/time/logs/${id}/download_pdf/`, {
      headers: { 'Authorization': `Bearer ${token}` }
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

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "--:--:--"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
}

function formatHrMin(seconds) {
  if (!seconds) return "0h 0m"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

export function getPosition(onProgress) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported.")); return }
    let watchId = null, best = null
    const cleanup = () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId) }
    const timer = setTimeout(() => { cleanup(); best ? resolve(best) : reject(new Error("GPS timed out.")) }, GPS_TIMEOUT_MS)
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }
        if (onProgress) onProgress(fix.accuracy)
        if (!best || fix.accuracy < best.accuracy) best = fix
        if (fix.accuracy <= TARGET_ACCURACY_M) { clearTimeout(timer); cleanup(); resolve(fix) }
      },
      (err) => { clearTimeout(timer); cleanup(); best ? resolve(best) : reject(err) },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_TIMEOUT_MS }
    )
  })
}

// ─── Hooks ─────────────────────────────────────────────────────
function useLiveClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

function useElapsed(clockInStr) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!clockInStr) { setElapsed(0); return }
    const start = new Date(clockInStr).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [clockInStr])
  return elapsed
}

function useBreakTimer(openBreak) {
  const [breakElapsed, setBreakElapsed] = useState(0)
  useEffect(() => {
    if (!openBreak?.break_start) { setBreakElapsed(0); return }
    const start = new Date(openBreak.break_start).getTime()
    const tick = () => setBreakElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [openBreak?.break_start])
  return breakElapsed
}

function useLocationTracker(isClockedIn) {
  useEffect(() => {
    if (!isClockedIn) return;

    const reportLocation = async () => {
      try {
        const pos = await getPosition()
        if (pos) {
          await apiRequest("/live-locations/update/", {
            method: "POST",
            json: { lat: pos.lat, lng: pos.lon }
          })
        }
      } catch (err) {
        console.debug("[LiveTracking] Report failed:", err)
      }
    }

    // Initial report
    reportLocation()

    // Every 2 minutes
    const id = setInterval(reportLocation, 120000)
    return () => clearInterval(id)
  }, [isClockedIn])
}

// ─── Sub-components ────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16, r = 8, style = {} }) {
  return <div className="tp-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

function StatCard({ icon, label, value, sub, color = "#6366F1", pulse }) {
  return (
    <div className="tp-stat-card" style={sub && sub.includes("OT") ? { border: "1px solid #EF444420", background: "#EF444405" } : {}}>
      <div className="tp-stat-icon" style={{ background: color + "18", color }}>
        {icon}
        {pulse && <span className="tp-stat-pulse" style={{ background: color }} />}
      </div>
      <div className="tp-stat-body">
        <div className="tp-stat-value" style={{ color: sub && sub.includes("OT") ? "#EF4444" : "inherit" }}>{value}</div>
        <div className="tp-stat-label">{label}</div>
        {sub && <div className="tp-stat-sub" style={{ color: sub.includes("OT") ? "#EF4444" : "var(--muted)", fontWeight: sub.includes("OT") ? 700 : 400 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─── Selfie Capture Modal ─────────────────────────────────────
export function SelfieCapture({ onCapture, onCancel }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState(null)
  const [capturedFile, setCapturedFile] = useState(null)
  const [camError, setCamError] = useState("")

  useEffect(() => { startCamera(); return () => stopStream() }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => setReady(true) }
    } catch { setCamError("Camera access denied or unavailable.") }
  }
  function stopStream() { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null }
  function captureFrame() {
    const [video, canvas] = [videoRef.current, canvasRef.current]
    if (!video || !canvas) return
    const size = 400; canvas.width = canvas.height = size
    const ctx = canvas.getContext("2d")
    ctx.save(); ctx.translate(size, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, size, size); ctx.restore()
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92)
    setCaptured(dataUrl); stopStream()
    canvas.toBlob(blob => {
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" })
      setCapturedFile(file)
    }, "image/jpeg", 0.92)
  }
  function retake() { setCaptured(null); setCapturedFile(null); setReady(false); startCamera() }
  function submitPhoto() {
    if (capturedFile && captured) onCapture(capturedFile, captured)
  }
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

  return (
    <div className="selfieOverlay">
      <div className="selfieSheet">
        <div className="selfieHeader">
          <button className="selfieClose" onClick={onCancel} type="button">✕</button>
          <div><h2 className="selfieTitle">Verify Identity</h2><div className="selfieSubtitle" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}><Clock size={12} /> {timeStr}, IST</div></div>
        </div>
        <div className="selfieRingWrap">
          <svg className={`selfieRingSvg ${captured ? "ringDone" : ready ? "ringActive" : ""}`} viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="108" className="ringTrack" /><circle cx="120" cy="120" r="108" className="ringFill" />
          </svg>
          <div className="selfieCircle">
            {camError ? <div className="selfieCamError"><Camera size={32} opacity={0.5} /><p>{camError}</p></div>
              : captured ? <img src={captured} alt="selfie" className="selfieImg" />
                : <video ref={videoRef} autoPlay muted playsInline className="selfieVideo" style={{ transform: "scaleX(-1)" }} />}
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
        <div className="selfieInstruction">{captured ? "Kindly, smile 😊" : ready ? "Position your face in the circle" : camError ? "Camera unavailable" : "Opening camera…"}</div>
        <div className="selfieWarning"><span className="selfieWarnDot">ℹ</span>Make sure you are in a well-lit place.</div>
        <div className="selfieActions">
          {captured ? (
            <><button className="selfieBtnOutline" onClick={retake} type="button"><RotateCcw size={16} style={{ marginRight: 6 }} /> Retake</button>
              <button className="selfieBtnPrimary" onClick={submitPhoto} type="button"><Check size={16} strokeWidth={3} style={{ marginRight: 6 }} /> Use this photo</button></>
          ) : <button className="selfieBtnPrimary" onClick={captureFrame} disabled={!ready || !!camError} type="button">Capture Selfie</button>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  ADMIN VIEW
// ═══════════════════════════════════════════════════════════════
function AdminTimePage() {
  const now = useLiveClock()
  const [logs, setLogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Filters
  const todayStr = new Date().toLocaleDateString("en-CA")
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA")
  const [filterFrom, setFilterFrom] = useState(weekAgo)
  const [filterTo, setFilterTo] = useState(todayStr)
  const [filterEmp, setFilterEmp] = useState("")   // employee id
  const [searchQ, setSearchQ] = useState("")
  const [sortField, setSortField] = useState("clock_in")
  const [sortDir, setSortDir] = useState("desc")
  const [logsOpen, setLogsOpen] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all") // all | live | done

  // Real-time month selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

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
    } catch (e) { setError("Failed to load data.") }
    finally { setLoading(false) }
  }, [filterFrom, filterTo])

  useEffect(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1).toLocaleDateString("en-CA")
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).toLocaleDateString("en-CA")
    setFilterFrom(firstDay)
    setFilterTo(lastDay)
  }, [selectedMonth, selectedYear])

  useEffect(() => { load() }, [load])

  // ── Real KPI Calculations ──
  const monthStats = useMemo(() => {
    const uniqueDays = new Set(logs.map(l => l.work_date)).size
    const attendanceEntries = logs.length
    const totalWorkingDays = employees.length > 0 ? employees.length * 22 : 0 // hypothetical target
    
    // Days in current selected month
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    
    // Count weekdays (Mon-Fri) in the month
    let workDaysCount = 0
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const day = new Date(selectedYear, selectedMonth, d).getDay()
      if (day !== 0 && day !== 6) workDaysCount++
    }
    
    const expectedAttendance = workDaysCount * employees.length
    const actualAttendance = logs.filter(l => !!l.clock_in).length
    const attendancePct = expectedAttendance > 0 ? ((actualAttendance / expectedAttendance) * 100).toFixed(1) : "0.0"

    return {
      totalDays: attendanceEntries,
      totalAttendance: new Set(logs.map(l => l.employee)).size,
      totalWorkingDays: expectedAttendance,
      attendancePct,
      daysInMonth: totalDaysInMonth,
      workDaysInMonth: workDaysCount
    }
  }, [logs, employees, selectedMonth, selectedYear])

  // ── Derived stats ──
  const todayLogs = useMemo(() => logs.filter(l => l.work_date === todayStr), [logs, todayStr])
  const liveNow = useMemo(() => todayLogs.filter(l => !l.clock_out), [todayLogs])
  const totalHrs = useMemo(() => logs.reduce((s, l) => s + (l.worked_seconds || 0), 0), [logs])
  const avgHrs = useMemo(() => {
    const uniqueEmps = new Set(logs.map(l => l.employee)).size
    return uniqueEmps > 0 ? Math.round(totalHrs / uniqueEmps) : 0
  }, [logs, totalHrs])

  // Per-employee summary for the "who's in" cards
  const empStatus = useMemo(() => {
    const map = {}
    employees.forEach(e => {
      const name = [e.user?.first_name, e.user?.last_name].filter(Boolean).join(" ") || e.user?.username
      map[e.id] = { id: e.id, name, username: e.user?.username, avatarLetter: (name || "?").charAt(0).toUpperCase(), log: null }
    })
    liveNow.forEach(l => { if (map[l.employee]) map[l.employee].log = l })
    return Object.values(map)
  }, [employees, liveNow])

  // ── Filtered + sorted logs ──
  const filteredLogs = useMemo(() => {
    let arr = [...logs]
    if (filterEmp) arr = arr.filter(l => l.employee === filterEmp)
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
  }, [logs, filterEmp, statusFilter, searchQ, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  return (
    <div className="tp-layout">
      {/* ── Header ── */}
      <div className="tp-header">
        <div>
          <h1 className="tp-title">Attendance Dashboard</h1>
          <div className="tp-secure"><CheckCircle2 size={13} /> Admin Overview — All Employees</div>
        </div>
      </div>

      {error && <div className="tp-error"><AlertCircle size={14} /> {error}</div>}

      {/* ── Attendance Dashboard exact UI ── */}
      <div className="adx-container">
        {/* Left Panel */}
        <div className="adx-left">
          <div className="adx-left-title">{monthStats.attendancePct}% Attendance in {monthNames[selectedMonth]}</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
            <button 
              className="adx-icon-btn" 
              onClick={() => setLogsOpen(!logsOpen)} 
              title="Toggle Detailed Logs"
            >
              <Filter size={14}/>
            </button>
            <button 
              className="adx-icon-btn" 
              onClick={load} 
              title="Refresh Data"
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} />
            </button>
            <button 
              className="adx-icon-btn" 
              onClick={() => alert("Attendance summary exported successfully.")}
              title="More Options"
            >
              <MoreHorizontal size={14}/>
            </button>
          </div>
          <div style={{ fontSize: "12px", fontWeight: "700", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>Emp Card <ChevronDown size={14}/></div>
          
          <div className="adx-left-scroll" style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {empStatus.map((e) => {
              const empLogs = logs.filter(l => l.employee === e.id)
              const presentCount = empLogs.filter(l => !!l.clock_in).length
              const sickCount = 0 // Mocking as system doesn't track these yet, but shows structure
              const vacationCount = 0
              
              return (
                <div key={e.id} className="adx-emp-card">
                  <div className="adx-emp-header">
                    <div className="adx-emp-name" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</div>
                    <div className="adx-emp-avatar">{e.avatarLetter}</div>
                  </div>
                  <div className="adx-emp-stats">
                    <div>Total days: {monthStats.daysInMonth}</div>
                    <div style={{ color: '#10b981', fontWeight: 700 }}>Present: {presentCount}</div>
                    <div>Sick: {sickCount}</div>
                    <div>Vacation: {vacationCount}</div>
                    <div>On call: {e.log ? 1 : 0}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="adx-main">
          {/* Top Nav */}
          <div className="adx-top-nav">
            {monthNames.map((m, idx) => (
              <div 
                key={m} 
                className={`adx-nav-item ${selectedMonth === idx ? 'active' : ''}`}
                onClick={() => setSelectedMonth(idx)}
              >
                {m}
              </div>
            ))}
          </div>

          <div className="adx-body">
            {/* Calendar */}
            <div className="adx-calendar">
              <div className="adx-cal-grid">
                {/* Header */}
                <div className="adx-cal-header-row">
                  <div className="adx-cal-header">Week of Month</div>
                  <div className="adx-cal-header">Sun</div>
                  <div className="adx-cal-header">Mon</div>
                  <div className="adx-cal-header">Tue</div>
                  <div className="adx-cal-header">Wed</div>
                  <div className="adx-cal-header">Thu</div>
                  <div className="adx-cal-header">Fri</div>
                  <div className="adx-cal-header">Sat</div>
                </div>

                {/* Weeks Grid */}
                {(() => {
                  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay()
                  const days = []
                  for (let i = 0; i < firstDayOfMonth; i++) days.push(null)
                  for (let i = 1; i <= monthStats.daysInMonth; i++) days.push(i)
                  
                  const weeks = []
                  for (let i = 0; i < days.length; i += 7) {
                    weeks.push(days.slice(i, i + 7))
                  }

                  return weeks.map((week, wIndex) => (
                    <div className="adx-cal-cell-wrap" key={`week-${wIndex}`}>
                      <div className="adx-cal-row-header">Wk{wIndex + 1}</div>
                      {week.map((day, dIndex) => {
                        const dateStr = day ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
                        const dayLogs = day ? logs.filter(l => l.work_date === dateStr) : []
                        const isWeekend = dIndex === 0 || dIndex === 6
                        const attendancePct = dayLogs.length > 0 && employees.length > 0 ? Math.round((dayLogs.length / employees.length) * 100) : 0

                        return (
                          <div key={`d-${wIndex}-${dIndex}`} className={`adx-cal-cell ${!day ? 'empty' : ''}`}>
                            {day && (
                              <>
                                <div className="adx-cal-date">{day}</div>
                                <div className="adx-cal-bottom">
                                  {dayLogs.length > 0 ? (
                                    <>
                                      <span className="adx-dot" style={{ background: attendancePct > 50 ? '#10b981' : '#f59e0b' }}></span>
                                      <span style={{ fontSize: 9 }}>{attendancePct}%</span>
                                    </>
                                  ) : !isWeekend ? (
                                    <span className="adx-dot" style={{ background: '#ef4444' }}></span>
                                  ) : (
                                    <span className="adx-dot" style={{ background: '#facc15' }}></span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                      {week.length < 7 && [...Array(7 - week.length)].map((_, i) => <div key={`pad-${i}`} className="adx-cal-cell empty"></div>)}
                    </div>
                  ))
                })()}
              </div>
            </div>

            {/* KPIs */}
            <div className="adx-kpi-panel">
              <div className="adx-kpi-title">KPIs — {monthNames[selectedMonth]}</div>
              
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Total Logs (Month)</div>
                <div className="adx-kpi-val">{monthStats.totalDays}</div>
              </div>
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Actual Active Employees</div>
                <div className="adx-kpi-val">{monthStats.totalAttendance}</div>
              </div>
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Target Attendance (Total)</div>
                <div className="adx-kpi-val">{monthStats.totalWorkingDays}</div>
              </div>
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Attendance Score</div>
                <div className="adx-kpi-val">{monthStats.attendancePct}%</div>
              </div>
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Total Days in Month</div>
                <div className="adx-kpi-val">{monthStats.daysInMonth}</div>
              </div>
              <div className="adx-kpi-item">
                <div className="adx-kpi-label">Work Days (Mon-Fri)</div>
                <div className="adx-kpi-val">{monthStats.workDaysInMonth}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Logs table ── */}
      <div className="tp-logs">
        <div className="tp-logs-header">
          <div>
            <h2 className="tp-logs-title">Attendance Logs</h2>
            <div className="tp-logs-subtitle">{filterFrom} – {filterTo} · {filteredLogs.length} records</div>
          </div>
          <div className="tp-logs-meta">
            <button className="tp-logs-refresh" onClick={load} title="Refresh"><RefreshCw size={13} /></button>
            <span className="tp-logs-badge">{filteredLogs.length} entries</span>
            <button className="tp-logs-chevron" onClick={() => setLogsOpen(v => !v)}>
              <ChevronUp size={15} style={{ transform: logsOpen ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.25s ease" }} />
            </button>
          </div>
        </div>

        {/* ── Filters row ── */}
        <div className="adm-filters-row">
          {/* Date range */}
          <div className="tp-date-filter-group">
            <label className="tp-date-label">From</label>
            <input id="adm-date-from" type="date" className="tp-date-input" value={filterFrom} max={filterTo}
              onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div className="tp-date-filter-sep">→</div>
          <div className="tp-date-filter-group">
            <label className="tp-date-label">To</label>
            <input id="adm-date-to" type="date" className="tp-date-input" value={filterTo} min={filterFrom} max={todayStr}
              onChange={e => setFilterTo(e.target.value)} />
          </div>

          {/* Quick presets */}
          <button className="tp-date-preset" onClick={() => { setFilterFrom(todayStr); setFilterTo(todayStr) }}>Today</button>
          <button className="tp-date-preset" onClick={() => { setFilterFrom(weekAgo); setFilterTo(todayStr) }}>This Week</button>
          <button className="tp-date-preset" onClick={() => {
            const m = new Date(); m.setDate(1)
            setFilterFrom(m.toLocaleDateString("en-CA")); setFilterTo(todayStr)
          }}>This Month</button>

          {/* Employee dropdown */}
          <div className="adm-select-wrap">
            <Filter size={13} color="#9CA3AF" />
            <select className="adm-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
              <option value="">All Employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {[e.user?.first_name, e.user?.last_name].filter(Boolean).join(" ") || e.user?.username}
                </option>
              ))}
            </select>
            <ChevronDown size={13} color="#9CA3AF" />
          </div>

          {/* Status filter */}
          <div className="adm-status-tabs">
            {["all", "live", "submitted", "done"].map(s => (
              <button key={s} className={`adm-status-tab ${statusFilter === s ? "adm-status-tab--active" : ""}`}
                onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : s === "live" ? "● Live" : s === "submitted" ? "Pending" : "Completed"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="adm-search-wrap">
            <Search size={13} color="#9CA3AF" />
            <input className="adm-search" placeholder="Search employee…" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          </div>
        </div>

        {logsOpen && (
          <div className="tp-table-wrap">
            {loading ? (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} h={24} />)}
              </div>
            ) : (
              <table className="tp-table adm-table">
                <thead>
                  <tr>
                    <th>EMPLOYEE</th>
                    <th className="adm-sortable" onClick={() => toggleSort("work_date")}>
                      DATE {sortField === "work_date" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="adm-sortable" onClick={() => toggleSort("clock_in")}>
                      CLOCK IN {sortField === "clock_in" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="adm-sortable" onClick={() => toggleSort("clock_out")}>
                      CLOCK OUT {sortField === "clock_out" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th>BREAKS</th>
                    <th>JOB PHOTOS</th>
                    <th>STATUS</th>
                    <th className="right adm-sortable" onClick={() => toggleSort("worked_seconds")}>
                      HOURS {sortField === "worked_seconds" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <AdminLogRow key={l.id} log={l} onAction={load} />
                  ))}
                  {filteredLogs.length === 0 && (
                    <tr><td colSpan={6} className="tp-empty">No records found for the selected filters</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin table row with live elapsed ────────────────────────
function AdminLogRow({ log, onAction }) {
  const elapsed = useElapsed(log.clock_out ? null : log.clock_in)
  const completedBreaks = (log.breaks || []).filter(b => b.break_end)
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

  const statusLabel = log.status || (isLive ? 'live' : 'draft')
  const statusColor = {
    approved: "#10B981",
    rejected: "#EF4444",
    submitted: "#F59E0B",
    draft: "#6B7280",
    live: "#10B981"
  }[statusLabel] || "#6B7280"

  return (
    <tr className={isLive ? "adm-row-live" : ""}>
      <td>
        <div className="tp-emp-cell">
          <div className="tp-emp-avatar"
            style={{ background: isLive ? "linear-gradient(135deg,#10B981,#059669)" : "linear-gradient(135deg,#6366F1,#8B5CF6)" }}>
            {(log.employee_name || log.employee_username || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="tp-emp-name">{log.employee_name || log.employee_username || "Unknown"}</div>
            {log.employee_username && log.employee_name && (
              <div className="tp-emp-username">@{log.employee_username}</div>
            )}
          </div>
        </div>
      </td>
      <td className="tp-td-date">{log.work_date}</td>
      <td>
        <div className="tp-time-cell">
          <span>{formatDateTime(log.clock_in).split(",")[1]?.trim()}</span>
          {log.clock_in_photo && (
            <a href={log.clock_in_photo} target="_blank" rel="noreferrer" className="tp-photo-chip tp-photo-chip--link" title="View verification photo">
              <Camera size={10} />
            </a>
          )}
        </div>
      </td>
      <td>
        {isLive
          ? <span className="tp-pending-badge">● Live</span>
          : <span>{formatDateTime(log.clock_out).split(",")[1]?.trim()}</span>}
      </td>
      <td>
        {completedBreaks.length > 0 ? (
          <div className="adm-break-cell" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {completedBreaks.map((b, idx) => (
              <span key={idx}
                style={{
                  background: b.break_type === "lunch" ? "#DBEAFE" : b.break_type === "short" ? "#ECFDF5" : "#FEF3C7",
                  color: b.break_type === "lunch" ? "#2563EB" : b.break_type === "short" ? "#059669" : "#D97706",
                  padding: "2px 5px", borderRadius: 4, fontSize: 9, fontWeight: 900
                }}
                title={`${b.break_type}: ${formatDuration(b.duration_seconds)}`}>
                {(b.break_type || "break").charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        ) : <span className="adm-no-break">—</span>}
      </td>
      <td>
        {(log.photos || []).length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {log.photos.map((p, idx) => (
              <a key={idx} href={p.photo} target="_blank" rel="noreferrer" title={`${p.photo_type}${p.caption ? ': ' + p.caption : ''}`}>
                <div style={{
                  width: 24, height: 24, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--stroke)',
                  background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <img src={p.photo} alt="job" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </a>
            ))}
          </div>
        ) : <span className="adm-no-break">—</span>}
      </td>
      <td>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{
            padding: "4px 8px", borderRadius: 12, fontSize: 10, fontWeight: 800, textTransform: "uppercase",
            backgroundColor: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`
          }}>
            {statusLabel === 'submitted' ? 'In Review' : statusLabel}
          </span>
          {log.face_match_status && log.face_match_status !== 'skipped' && (
            <span style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 900, textAlign: 'center',
              backgroundColor: log.face_match_status === 'matched' ? "#10B98115" : "#EF444415",
              color: log.face_match_status === 'matched' ? "#10B981" : "#EF4444",
              border: `1px solid ${log.face_match_status === 'matched' ? "#10B98130" : "#EF444430"}`
            }}>
              {log.face_match_status === 'matched' ? "✓ Identity Verified" : "⚠ Identity Mismatch"}
            </span>
          )}
        </div>
      </td>
      <td className="right">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span className={`tp-hours-pill ${isLive ? "tp-hours-pill--live" : ""}`}
            style={(isLive ? elapsed : log.worked_seconds) > 8 * 3600 ? { color: "#EF4444", fontWeight: 800, background: "#EF444410", border: "1px solid #EF444430" } : {}}>
            {isLive ? formatDuration(elapsed) : formatDuration(log.worked_seconds)}
          </span>
          {log.manual_hours_correction && (
            <span style={{ fontSize: 9, fontWeight: 700, color: "#6366F1" }}>Adjusted: {log.manual_hours_correction}h</span>
          )}
        </div>
      </td>
      <td className="right">
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          {log.status === 'submitted' ? (
            <>
              <button disabled={busy} onClick={() => handleApprove("approve")}
                style={{ background: "#10B981", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                APPROVE
              </button>
              <button disabled={busy} onClick={() => {
                const reason = window.prompt("Rejection reason?");
                if (reason !== null) handleApprove("reject", reason);
              }} style={{ background: "#EF4444", color: "#fff", border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                REJECT
              </button>
            </>
          ) : (
            <>
              {isLive && (
                <button disabled={busy} onClick={() => {
                  if (window.confirm("Force clock out this employee?")) handleApprove("force_clock_out");
                }} title="Force Clock Out"
                  style={{ background: "none", border: "1px solid #F59E0B", color: "#F59E0B", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", display: 'flex', alignItems: 'center', gap: 4 }}>
                  <LogOut size={12} /> OUT
                </button>
              )}
              {log.clock_out && (
                <button onClick={() => downloadLogPdf(log.id)} title="Download PDF Summary"
                  style={{ background: "none", border: "1px solid var(--stroke)", color: "var(--accent)", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer", display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Download size={12} /> PDF
                </button>
              )}
              <button onClick={() => {
                const corr = window.prompt("Enter manual hours correction (e.g. 8.5):", log.manual_hours_correction || "");
                if (corr !== null) handleApprove("edit", corr);
              }} style={{ background: "none", border: "1px solid var(--stroke)", color: "var(--muted)", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
                EDIT
              </button>
            </>
          )}
          <button disabled={busy} onClick={() => {
            if (window.confirm("Permanently delete this clock-in record?")) handleApprove("delete");
          }} title="Delete Log"
            style={{ background: "none", border: "1px solid #EF444430", color: "#EF4444", borderRadius: 6, padding: "4px 8px", fontSize: 10, cursor: "pointer" }}>
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════
//  EMPLOYEE VIEW (same as before)
// ═══════════════════════════════════════════════════════════════
function EmployeeTimePage() {
  const { user } = useAuth()
  const displayName = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : "Employee"

  const [logs, setLogs] = useState([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [logsOpen, setLogsOpen] = useState(true)
  const [gpsStatus, setGpsStatus] = useState("locating")

  const todayStr = new Date().toLocaleDateString("en-CA")
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString("en-CA")
  const [filterFrom, setFilterFrom] = useState(weekAgo)
  const [filterTo, setFilterTo] = useState(todayStr)

  const [resolvedAddr, setResolvedAddr] = useState("")
  const [currentGPS, setCurrentGPS] = useState(null)
  const [gpsAccuracy, setGpsAccuracy] = useState(null)

  const [sessionNotes, setSessionNotes] = useState("")
  const [sessionPhoto, setSessionPhoto] = useState(null)
  const [selfieFile, setSelfieFile] = useState(null)
  const [selfiePreview, setSelfiePreview] = useState(null)
  const [showSelfie, setShowSelfie] = useState(false)

  // Job Site Photos
  const [jobPhotoFile, setJobPhotoFile] = useState(null)
  const [jobPhotoPreview, setJobPhotoPreview] = useState(null)
  const [jobPhotoType, setJobPhotoType] = useState("progress")
  const [jobPhotoCaption, setJobPhotoCaption] = useState("")
  const [showJobPhotoCamera, setShowJobPhotoCamera] = useState(false)

  const [geofenceStatus, setGeofenceStatus] = useState(null)
  const [breakType, setBreakType] = useState("lunch")
  const [faceVerifyStatus, setFaceVerifyStatus] = useState(null) // null | 'verifying' | 'matched' | 'mismatch' | 'no_face'
  const [faceVerifyScore, setFaceVerifyScore] = useState(null)

  const now = useLiveClock()
  const openLog = useMemo(() => findOpenLog(logs), [logs])
  const openBreak = useMemo(() => findOpenBreak(openLog), [openLog])
  const elapsed = useElapsed(openLog?.clock_in)
  const breakElapsed = useBreakTimer(openBreak)

  // Start live location reporting if clocked in
  useLocationTracker(!!openLog && !openBreak)

  // Preload face models when clocked in
  useEffect(() => {
    if (openLog) loadFaceModels()
  }, [openLog])

  const completedBreaks = useMemo(() => (openLog?.breaks || []).filter(b => b.break_end), [openLog])
  const totalBreakSecs = useMemo(() => completedBreaks.reduce((s, b) => s + (b.duration_seconds || 0), 0), [completedBreaks])

  const weekStats = useMemo(() => {
    const total = logs.reduce((s, l) => s + (l.worked_seconds || 0), 0)
    const days = new Set(logs.map(l => l.work_date)).size
    const otSeconds = Math.max(0, total - (40 * 3600))
    return { total, days, otSeconds, avg: days > 0 ? Math.round(total / days) : 0 }
  }, [logs])

  const todayLog = useMemo(() => logs.find(l => l.work_date === todayStr), [logs, todayStr])
  const todaySeconds = useMemo(() => {
    if (!todayLog) return 0
    return todayLog.clock_out ? (todayLog.worked_seconds || 0) : elapsed
  }, [todayLog, elapsed])
  const todayOtSeconds = Math.max(0, todaySeconds - (8 * 3600))
  const todayPct = Math.min(100, Math.round((todaySeconds / (DAILY_TARGET_HRS * 3600)) * 100))

  useEffect(() => {
    async function initGPS() {
      try {
        const pos = await getPosition(acc => { setGpsAccuracy(acc); setGpsStatus("locating") })
        setCurrentGPS(pos); setGpsAccuracy(pos.accuracy); setGpsStatus("ok")
        const addr = await getAddress(pos.lat, pos.lon)
        setResolvedAddr(addr)
      } catch { setGpsStatus("error") }
    }
    initGPS()
  }, [])

  useEffect(() => {
    async function fetchGeofence() {
      try {
        const res = await apiRequest("/time/geofence-status/")
        const data = unwrapResults(res)
        setGeofenceStatus(data)
      } catch (e) {
        console.error("Failed to fetch geofence status", e)
      }
    }
    fetchGeofence()
  }, [])

  const distanceToSite = useMemo(() => {
    if (!currentGPS || !geofenceStatus?.job_site) return null
    return calculateDistance(
      currentGPS.lat, currentGPS.lon,
      geofenceStatus.job_site.lat, geofenceStatus.job_site.lng
    )
  }, [currentGPS, geofenceStatus])

  const geofencePassed = useMemo(() => {
    if (!geofenceStatus?.geofence_enabled) return true
    if (distanceToSite === null) return false
    const radius = geofenceStatus.job_site?.radius_override || geofenceStatus.org_radius || 200
    return distanceToSite <= radius
  }, [distanceToSite, geofenceStatus])

  const geofenceError = useMemo(() => {
    if (openLog) return null // Hide errors if already clocked in
    if (!geofenceStatus?.geofence_enabled) return null
    if (distanceToSite === null) return "Waiting for GPS lock…"
    const radius = geofenceStatus.job_site?.radius_override || geofenceStatus.org_radius || 200
    if (distanceToSite > radius) {
      const distStr = distanceToSite > 1000 ? `${(distanceToSite / 1000).toFixed(1)} km` : `${distanceToSite}m`
      return `You are ${distStr} from job site. Move closer to clock in.`
    }
    return null
  }, [distanceToSite, geofenceStatus, openLog])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams()
      if (filterFrom) params.set("date_from", filterFrom)
      if (filterTo) params.set("date_to", filterTo)
      const [logsRes] = await Promise.allSettled([apiRequest(`/time/logs/?${params}`)])
      if (logsRes.status === "fulfilled") setLogs(unwrapResults(logsRes.value))
    } finally { setLoading(false) }
  }, [filterFrom, filterTo])
  useEffect(() => { load() }, [load])

  async function action(path, overridePhoto = null) {
    setBusy(true); setError("")
    try {
      const fd = new FormData()
      if (path.includes("clock-in") || path.includes("clock-out")) {
        let gps = currentGPS
        try {
          const fresh = await getPosition(acc => setGpsAccuracy(acc))
          gps = fresh; setCurrentGPS(fresh); setGpsAccuracy(fresh.accuracy); setGpsStatus("ok")
          const addr = await getAddress(fresh.lat, fresh.lon)
          if (addr) setResolvedAddr(addr)
        } catch { }
        if (gps) { fd.append("lat", gps.lat); fd.append("lon", gps.lon) }
        if (resolvedAddr) fd.append("address", resolvedAddr)
        if (sessionNotes) fd.append("notes", sessionNotes)

        const photoToSend = overridePhoto || selfieFile || sessionPhoto
        if (photoToSend) fd.append("photo", photoToSend)

        // Attach face verification result for clock-out
        if (path.includes("clock-out") && faceVerifyStatus) {
          fd.append("face_match_status", faceVerifyStatus)
          if (faceVerifyScore !== null) fd.append("face_match_score", faceVerifyScore)
        }
      }
      if (path.includes("break/start")) {
        fd.append("break_type", breakType)
      }
      await apiRequest(path, { method: "POST", body: fd })

      // Send Windows Notifications
      if (path.includes("clock-in")) {
        NotificationService.send("Shift Started", "You are now clocked in at " + (resolvedAddr || "current location"))
      } else if (path.includes("clock-out")) {
        NotificationService.send("Shift Ended", "You have successfully clocked out. Have a great day!")
      }

      setSessionNotes(""); setSessionPhoto(null); setSelfieFile(null); setSelfiePreview(null)
      setFaceVerifyStatus(null); setFaceVerifyScore(null)
      await load()
    } catch (err) {
      const msg = err?.body?.message || err?.body?.detail || "Action failed. Please try again."
      setError(msg)
    }
    finally { setBusy(false) }
  }

  async function uploadJobPhoto() {
    if (!jobPhotoFile) return
    setBusy(true); setError("")
    try {
      const fd = new FormData()
      fd.append("photo", jobPhotoFile)
      fd.append("photo_type", jobPhotoType)
      fd.append("caption", jobPhotoCaption)
      await apiRequest("/time/photos/upload/", { method: "POST", body: fd })
      setJobPhotoFile(null); setJobPhotoPreview(null); setJobPhotoCaption(""); setJobPhotoType("progress")
      await load()
    } catch (err) {
      setError(err?.body?.message || "Failed to upload photo.")
    } finally { setBusy(false) }
  }

  async function submitLog(id) {
    if (!window.confirm("Submit this timesheet for approval? You won't be able to edit it after submission.")) return;
    setBusy(true);
    try {
      await apiRequest(`/time/logs/${id}/submit/`, { method: "POST" });
      await load();
    } catch (e) { setError(e?.body?.detail || "Failed to submit timesheet."); }
    finally { setBusy(false); }
  }

  // ─── Right panel state ──────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [moodRating, setMoodRating] = useState(null)
  const [showMoodSurvey, setShowMoodSurvey] = useState(false)
  const [moodNote, setMoodNote] = useState("")

  function handleClockOut() {
    setShowMoodSurvey(true)
  }

  function submitMoodAndClockOut() {
    const moodText = moodRating ? `[Mood: ${moodRating}] ` : ""
    const finalNote = moodText + (moodNote || sessionNotes)
    setSessionNotes(finalNote)
    setShowMoodSurvey(false)
    setShowSelfie(true)
  }

  return (
    <>
      {showSelfie && (
        <SelfieCapture
          onCapture={async (file, preview) => {
            if (openLog) {
              // Clock-out: verify face first
              setSelfieFile(file);
              setSelfiePreview(preview);
              setShowSelfie(false);
              setFaceVerifyStatus('verifying');
              setError('');

              // Get clock-in photo URL
              const clockInPhoto = openLog.clock_in_photo;
              if (clockInPhoto && preview) {
                try {
                  const result = await verifyFaces(clockInPhoto, preview);
                  setFaceVerifyScore(result.score);
                  if (result.status === 'mismatch') {
                    setFaceVerifyStatus('mismatch');
                    setError('⚠️ Identity Verification Failed: Your clock-out selfie does not match your clock-in photo. Please contact your manager or administrator to manually clock you out if you are trapped.');
                    return; // BLOCK clock-out
                  }
                  if (result.status === 'no_face') {
                    setFaceVerifyStatus('no_face');
                    setError('⚠️ No face detected in the photos! If your original clock-in photo was blurry or faceless, you cannot verify your identity to clock out. Please contact your admin to manually log or reset your shift.');
                    return; // BLOCK clock-out
                  }
                  setFaceVerifyStatus('matched');
                } catch (err) {
                  console.error('Face verify error', err);
                  setFaceVerifyStatus(null); // allow clock-out on error
                }
              }
              // Proceed with clock-out
              setTimeout(() => action("/time/clock-out/", file), 100);
            } else {
              // Clock-in photo
              setShowSelfie(false);
              setFaceVerifyStatus('verifying');
              setError('');

              const faceExists = await hasFace(preview);
              if (!faceExists) {
                setFaceVerifyStatus('no_face');
                setError('⚠️ No face detected! Please ensure your face is clearly visible, well-lit, and fully within the frame to successfully clock in.');
                return; // BLOCK clock-in, do not keep the photo
              }

              // Proceed
              setFaceVerifyStatus(null);
              setSelfieFile(file);
              setSelfiePreview(preview);
            }
          }}
          onCancel={() => setShowSelfie(false)}
        />
      )}
      {showJobPhotoCamera && (
        <SelfieCapture
          onCapture={(file, preview) => { setJobPhotoFile(file); setJobPhotoPreview(preview); setShowJobPhotoCamera(false) }}
          onCancel={() => setShowJobPhotoCamera(false)}
        />
      )}


      {/* ═══ MOOD SURVEY OVERLAY ═══ */}
      {showMoodSurvey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '40px 36px 32px', width: 420, maxWidth: '90vw', textAlign: 'center', boxShadow: '0 32px 64px rgba(0,0,0,0.15)', animation: 'fadeUp 0.3s ease both' }}>
            <h2 style={{ fontSize: 22, fontWeight: 850, color: 'var(--fg)', marginBottom: 32, letterSpacing: '-0.02em' }}>How was work today?</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
              {[
                { key: 'tough', emoji: '😞', label: 'Tough' },
                { key: 'normal', emoji: '😐', label: 'Normal' },
                { key: 'great', emoji: '😄', label: 'Great' },
              ].map(m => (
                <button key={m.key} onClick={() => setMoodRating(m.key)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  background: 'none', border: moodRating === m.key ? '3px solid #F97316' : '3px solid transparent',
                  borderRadius: 20, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s ease',
                  transform: moodRating === m.key ? 'scale(1.1)' : 'scale(1)'
                }}>
                  <span style={{ fontSize: 48 }}>{m.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: moodRating === m.key ? '#F97316' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</span>
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'left', marginBottom: 20 }}>
              <label style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg)', display: 'block', marginBottom: 8 }}>Add a note (optional)</label>
              <textarea value={moodNote} onChange={e => setMoodNote(e.target.value)} placeholder="It was too busy..." rows={3}
                style={{ width: '100%', border: '1px solid var(--stroke2)', borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--fg)', background: 'var(--bg)', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setShowMoodSurvey(false); setMoodRating(null); setMoodNote("") }}
                style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid var(--stroke2)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
              <button onClick={submitMoodAndClockOut}
                style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: '#F97316', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(249,115,22,0.35)' }}>Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN PAGE ═══ */}
      <div className="tp-new-layout">

        {/* Header Row */}
        <div className="tp-new-header">
          <h1 style={{ fontSize: 28, fontWeight: 850, color: 'var(--fg)', margin: 0, letterSpacing: '-0.02em' }}>Timesheets</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Floating Timer Bar */}
            {openLog && (
              <div className="tp-timer-bar">
                <span className="tp-timer-display">{formatDuration(elapsed)}</span>
                {!openBreak ? (
                  <>
                    <button className="tp-timer-icon tp-timer-icon--yellow" title="Take Break" onClick={() => action("/time/break/start/")}><Coffee size={16} /></button>
                    <button className="tp-timer-icon tp-timer-icon--green" title="Add Photo" onClick={() => setPanelOpen(true)}><Camera size={16} /></button>
                    <button className="tp-timer-icon tp-timer-icon--red" title="Clock Out" onClick={handleClockOut}><Square size={12} fill="currentColor" /></button>
                  </>
                ) : (
                  <button className="tp-timer-icon tp-timer-icon--green" title="Resume Work" onClick={() => action("/time/break/end/")}><Play size={16} /></button>
                )}
                <button className="tp-timer-icon tp-timer-icon--outline" title="Details" onClick={() => setPanelOpen(true)}><Edit3 size={14} /></button>
              </div>
            )}
            {!openLog && (
              <button className="tp-clock-in-btn" onClick={() => setPanelOpen(true)} disabled={busy}><Clock size={16} /> Clock In</button>
            )}
          </div>
        </div>

        {error && <div className="tp-error" style={{ marginBottom: 20 }}><AlertCircle size={14} /> {error}</div>}

        {/* Face Verification Banners */}
        {faceVerifyStatus === 'verifying' && (
          <div style={{ background: "#EFF6FF", border: "1px solid #3B82F6", borderRadius: 12, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <Loader2 size={18} className="spin" color="#3B82F6" /><span style={{ color: "#1E40AF", fontWeight: 700, fontSize: 13 }}>🔍 Verifying identity...</span>
          </div>
        )}
        {faceVerifyStatus === 'mismatch' && (
          <div style={{ background: "#FEE2E2", border: "2px solid #EF4444", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertCircle size={18} color="#EF4444" />
            <div style={{ flex: 1, color: "#991B1B", fontWeight: 700, fontSize: 13 }}>⚠️ Identity verification failed. <button onClick={() => { setFaceVerifyStatus(null); setError(''); setShowSelfie(true) }} style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontWeight: 800, cursor: 'pointer', fontSize: 11, marginLeft: 8 }}>Retake</button></div>
          </div>
        )}
        {faceVerifyStatus === 'matched' && (
          <div style={{ background: "#ECFDF5", border: "1px solid #10B981", borderRadius: 12, padding: "12px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={16} color="#10B981" /><span style={{ color: "#065F46", fontWeight: 700, fontSize: 13 }}>✅ Identity Verified{faceVerifyScore && ` • Score: ${faceVerifyScore}%`}</span>
          </div>
        )}

        {/* Stats */}
        {!loading && (
          <div className="tp-stats-row" style={{ marginBottom: 32 }}>
            <StatCard icon={<TrendingUp size={16} />} label="Hours This Week" value={formatHrMin(weekStats.total)} color={weekStats.otSeconds > 0 ? "#EF4444" : "#6366F1"} sub={weekStats.otSeconds > 0 ? `+${formatHrMin(weekStats.otSeconds)} OT ⚠️` : null} />
            <StatCard icon={<Calendar size={16} />} label="Days Worked" value={`${weekStats.days} days`} color="#10B981" />
            <StatCard icon={<Timer size={16} />} label="Daily Average" value={formatHrMin(weekStats.avg)} color="#F59E0B" />
            {openLog && <StatCard icon={<Clock size={16} />} label="Current Session" value={formatDuration(elapsed)} color="#EF4444" pulse />}
          </div>
        )}

        {/* Full-Width Logs Table */}
        <div className="tp-logs-section">
          <div className="tp-logs-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 850, margin: 0, color: 'var(--fg)' }}>Recent Entries</h2>
              <span style={{ background: 'var(--bg2)', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>{logs.length}</span>
            </div>
            <div className="tp-date-filter" style={{ margin: 0 }}>
              <div className="tp-date-filter-group"><label className="tp-date-label">From</label><input type="date" className="tp-date-input" value={filterFrom} max={filterTo} onChange={e => setFilterFrom(e.target.value)} /></div>
              <div className="tp-date-filter-sep">→</div>
              <div className="tp-date-filter-group"><label className="tp-date-label">To</label><input type="date" className="tp-date-input" value={filterTo} min={filterFrom} max={todayStr} onChange={e => setFilterTo(e.target.value)} /></div>
              <div style={{ width: 1, height: 20, background: 'var(--stroke2)', margin: '0 4px' }} />
              <button className="tp-date-preset tp-btn-pill" onClick={() => { setFilterFrom(todayStr); setFilterTo(todayStr) }}>Today</button>
              <button className="tp-date-preset tp-btn-pill" onClick={() => { setFilterFrom(weekAgo); setFilterTo(todayStr) }}>Week</button>
              <button className="tp-date-preset tp-btn-pill" onClick={() => { const m = new Date(); m.setDate(1); setFilterFrom(m.toLocaleDateString("en-CA")); setFilterTo(todayStr) }}>Month</button>
            </div>
          </div>

          <div className="tp-table-wrap">
            {loading ? (
              <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 16 }}>{[1, 2, 3].map(i => <Skeleton key={i} h={40} r={8} />)}</div>
            ) : (
              <table className="tp-table tp-table-modern">
                <thead><tr><th>EMPLOYEE</th><th>DATE</th><th>CLOCK IN</th><th>CLOCK OUT</th><th>STATUS</th><th>PHOTOS</th><th className="right">HOURS</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id} className={!l.clock_out ? "tp-tr-active" : ""}>
                      <td><div className="tp-emp-cell"><div className="tp-emp-avatar">{(l.employee_name || l.employee_username || "?").charAt(0).toUpperCase()}</div><div><div className="tp-emp-name tp-name-bold">{l.employee_name || l.employee_username || "Unknown"}</div>{l.employee_username && l.employee_name && <div className="tp-emp-username">@{l.employee_username}</div>}</div></div></td>
                      <td className="tp-td-date">{l.work_date}</td>
                      <td><div className="tp-time-cell tp-bold"><span>{formatDateTime(l.clock_in).split(",")[1]?.trim()}</span>{l.clock_in_photo && <a href={l.clock_in_photo} target="_blank" rel="noreferrer" className="tp-photo-chip tp-photo-chip--link" title="View photo"><Camera size={12} /></a>}</div></td>
                      <td>{l.clock_out ? <div className="tp-time-cell tp-bold"><span className="tp-muted">{formatDateTime(l.clock_out).split(",")[1]?.trim()}</span>{l.clock_out_photo && <a href={l.clock_out_photo} target="_blank" rel="noreferrer" className="tp-photo-chip tp-photo-chip--link" title="View photo"><Camera size={12} /></a>}</div> : <span className="tp-pending-badge">● Active</span>}</td>
                      <td>{l.clock_out ? (<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ padding: "4px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800, textTransform: "uppercase", backgroundColor: l.status === 'approved' ? "#10B98115" : l.status === 'rejected' ? "#EF444415" : l.status === 'submitted' ? "#F59E0B15" : "#6B728015", color: l.status === 'approved' ? "#10B981" : l.status === 'rejected' ? "#EF4444" : l.status === 'submitted' ? "#F59E0B" : "#6B7280" }}>{l.status === 'submitted' ? 'In Review' : (l.status || 'Draft')}</span>{l.status === 'draft' && <button style={{ padding: "4px 8px", fontSize: 9, background: "#6366f1", color: "#fff", cursor: 'pointer', border: 'none', fontWeight: 800, borderRadius: 8 }} onClick={() => submitLog(l.id)}>Submit</button>}<button onClick={() => downloadLogPdf(l.id)} title="Download" style={{ background: "none", border: "none", color: "#6366F1", cursor: "pointer", display: 'flex', padding: "4px" }}><FileText size={14} /></button></div>) : <span className="tp-muted">—</span>}</td>
                      <td>{(l.photos || []).length > 0 ? (<div style={{ display: 'flex', gap: 4 }}>{l.photos.map((p, idx) => <a key={idx} href={p.photo} target="_blank" rel="noreferrer"><div style={{ width: 24, height: 24, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--stroke)' }}><img src={p.photo} alt="job" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div></a>)}</div>) : <span className="tp-muted">—</span>}</td>
                      <td className="right"><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}><span className={`tp-hours-pill ${!l.clock_out ? "tp-hours-pill--live" : ""}`} style={(!l.clock_out ? elapsed : l.worked_seconds) > 8 * 3600 ? { color: "#EF4444", fontWeight: 800, background: "#EF444410", border: "1px solid #EF444430" } : {}}>{!l.clock_out ? formatDuration(elapsed) : formatDuration(l.worked_seconds)}</span>{(!l.clock_out ? elapsed : l.worked_seconds) > 8 * 3600 && <span style={{ fontSize: 9, fontWeight: 900, color: "#EF4444" }}>OT +{formatDuration((!l.clock_out ? elapsed : l.worked_seconds) - 8 * 3600)}</span>}</div></td>
                    </tr>
                  ))}
                  {logs.length === 0 && <tr><td colSpan={7} className="tp-empty">No records found</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ═══ RIGHT SLIDE-OUT PANEL ═══ */}
      {panelOpen && <div className="tp-panel-overlay" onClick={() => setPanelOpen(false)} />}
      <div className={`tp-slide-panel ${panelOpen ? 'tp-slide-panel--open' : ''}`}>
        <div className="tp-slide-panel-inner">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 20px', borderBottom: '1px solid var(--stroke)' }}>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 850, margin: 0, color: 'var(--fg)' }}>{openLog ? 'Confirm Clock Out' : 'Clock In'}</h3>
              {openLog && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>Clocking from GMT+5:30 • Started {formatDateTime(openLog.clock_in).split(",")[1]?.trim()}</div>}
            </div>
            <button onClick={() => setPanelOpen(false)} style={{ width: 32, height: 32, background: 'var(--bg)', border: '1px solid var(--stroke)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
          </div>

          {/* User Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid var(--stroke)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #F97316, #FBBF24)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{displayName.charAt(0)}</div>
            <div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg)' }}>{displayName}</div><div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{resolvedAddr || "Locating..."}</div></div>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Time & Date */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Time</label>
                <div style={{ padding: '12px 14px', border: '1px solid var(--stroke2)', borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span><Clock size={14} color="var(--muted)" />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Date</label>
                <div style={{ padding: '12px 14px', border: '1px solid var(--stroke2)', borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>Today</span><Calendar size={14} color="var(--muted)" />
                </div>
              </div>
            </div>

            {/* GPS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--stroke)' }}>
              <MapPin size={16} color="#6366F1" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolvedAddr || "Waiting for GPS lock…"}</div>
                {currentGPS && <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, marginTop: 2 }}>{Number(currentGPS.lat).toFixed(5)}, {Number(currentGPS.lon).toFixed(5)}</div>}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: gpsStatus === 'ok' ? '#10B98115' : gpsStatus === 'error' ? '#EF444415' : '#F59E0B15', color: gpsStatus === 'ok' ? '#10B981' : gpsStatus === 'error' ? '#EF4444' : '#F59E0B' }}>
                {gpsStatus === 'ok' ? '● Live' : gpsStatus === 'error' ? '✕ Off' : '◌ ...'}
              </div>
            </div>

            {geofenceError && geofenceStatus?.strict_mode && (
              <div style={{ fontSize: 12, color: "#EF4444", fontWeight: 600, padding: "10px 14px", background: "#EF444410", borderRadius: 10, border: '1px solid #EF444420' }}>{geofenceError}</div>
            )}

            {/* Selfie (clock-in only) */}
            {!openLog && (
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Verification Selfie</label>
                <div onClick={() => setShowSelfie(true)} style={{ width: '100%', height: 110, background: 'var(--bg)', border: '2px dashed var(--stroke2)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {selfiePreview
                    ? <img src={selfiePreview} alt="selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                    : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: 'var(--muted)' }}><Camera size={22} opacity={0.5} /><span style={{ fontSize: 11, fontWeight: 700 }}>Tap to capture selfie</span></div>}
                </div>
                {selfiePreview && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#10B981', marginTop: 6 }}><Check size={12} /> Photo captured</div>}
                {!selfieFile && <div style={{ fontSize: 11, color: 'var(--warn-text)', fontWeight: 600, marginTop: 4 }}>⚠ Selfie is required</div>}
              </div>
            )}

            {/* Notes */}
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Add a note</label>
              <textarea placeholder={openLog ? "End of day summary..." : "What will you work on?"} value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={3}
                style={{ width: '100%', border: '1px solid var(--stroke2)', borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--fg)', background: 'var(--bg)', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
            </div>

            {/* Attachment (clock-in only) */}
            {!openLog && (
              <label htmlFor="tp-file-panel" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', border: '1px solid var(--stroke2)', borderRadius: 12, background: 'var(--bg)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: sessionPhoto ? '#6366F1' : 'var(--muted)' }}>
                <input id="tp-file-panel" type="file" style={{ display: "none" }} onChange={e => setSessionPhoto(e.target.files[0])} /><Paperclip size={14} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sessionPhoto ? sessionPhoto.name : "Attach starting photo (optional)"}</span>
              </label>
            )}

            {/* Job Site Photos (clocked-in only) */}
            {openLog && (
              <div style={{ padding: 14, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--stroke)' }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg)' }}><Camera size={13} color="#6366F1" /> Job Site Photo</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {["before", "progress", "after"].map(t => (<button key={t} onClick={() => setJobPhotoType(t)} style={{ flex: 1, padding: "6px 4px", borderRadius: 6, fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", background: jobPhotoType === t ? "#6366F1" : "var(--surface)", color: jobPhotoType === t ? "#fff" : "var(--muted)", border: jobPhotoType === t ? "1px solid #6366F1" : "1px solid var(--stroke)" }}>{t}</button>))}
                </div>
                {!jobPhotoPreview ? (
                  <button style={{ width: '100%', height: 40, borderRadius: 10, border: '1px dashed var(--stroke2)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--muted)' }} onClick={() => setShowJobPhotoCamera(true)}><Camera size={14} /> Capture {jobPhotoType} photo</button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ position: 'relative', width: 56, height: 56 }}><img src={jobPhotoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /><button onClick={() => { setJobPhotoFile(null); setJobPhotoPreview(null) }} style={{ position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button></div>
                    <input placeholder="Caption..." value={jobPhotoCaption} onChange={e => setJobPhotoCaption(e.target.value)} style={{ height: 34, fontSize: 12, border: '1px solid var(--stroke)', borderRadius: 8, padding: '0 12px', background: 'var(--surface)', color: 'var(--fg)', outline: 'none' }} />
                    <button onClick={uploadJobPhoto} disabled={busy} style={{ height: 34, borderRadius: 8, background: '#10B981', color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Upload</button>
                  </div>
                )}
              </div>
            )}

            {/* Break Controls */}
            {openLog && !openBreak && (
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Take a break</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {["lunch", "short", "personal"].map(t => (<button key={t} onClick={() => setBreakType(t)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: "pointer", background: breakType === t ? "#6366F1" : "var(--surface2)", color: breakType === t ? "#fff" : "var(--muted)", border: breakType === t ? "1px solid #6366F1" : "1px solid var(--stroke)" }}>{t}</button>))}
                </div>
              </div>
            )}
            {openBreak && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13, color: '#D97706' }}>{(openBreak.break_type || 'Break').charAt(0).toUpperCase() + (openBreak.break_type || 'Break').slice(1)} Break</div><div style={{ fontSize: 11, color: '#B45309' }}>{formatDuration(breakElapsed)}</div></div>
              </div>
            )}
            {openLog && completedBreaks.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}><Coffee size={12} /> {completedBreaks.length} break(s) • {formatDuration(totalBreakSecs)}</div>}
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--stroke)', display: 'flex', gap: 12 }}>
            <button onClick={() => setPanelOpen(false)} style={{ flex: 1, padding: '14px', borderRadius: 14, border: '1px solid var(--stroke2)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
            {openLog ? (
              <button onClick={handleClockOut} disabled={busy} style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: '#EF4444', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 20px rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? <Loader2 size={16} className="spin" /> : <Square size={12} fill="currentColor" />} {openLog.task ? "Complete & Clock Out" : "Clock Out"}
              </button>
            ) : (
              <button onClick={() => { setPanelOpen(false); action("/time/clock-in/") }} disabled={busy || (!resolvedAddr && gpsStatus !== "error") || !selfieFile || (!geofencePassed && geofenceStatus?.geofence_enabled && geofenceStatus?.strict_mode)} style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: (!selfieFile || (!resolvedAddr && gpsStatus !== "error")) ? '#9ca3af' : '#10B981', color: '#fff', fontSize: 14, fontWeight: 800, cursor: (!selfieFile || (!resolvedAddr && gpsStatus !== "error")) ? 'not-allowed' : 'pointer', boxShadow: selfieFile ? '0 6px 20px rgba(16,185,129,0.3)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {busy ? <Loader2 size={16} className="spin" /> : <Clock size={16} />} Save
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}


// ═══════════════════════════════════════════════════════════════
//  ROUTER: admin vs employee
// ═══════════════════════════════════════════════════════════════
export function TimePage() {
  const { user } = useAuth()
  return user?.role === "admin" ? <AdminTimePage /> : <EmployeeTimePage />
}
