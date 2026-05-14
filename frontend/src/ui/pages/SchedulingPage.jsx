import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { Button, Card, Input, Pill, Select, TextArea, formatDateTime } from "../components/kit.jsx"
import { CalendarRange } from "lucide-react"
import { fireSparkleFromEl } from "../sparkle.js"

function toIsoLocal(datetimeLocal) {
  if (!datetimeLocal) return ""
  return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal
}

export function SchedulingPage() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)

  const [employees, setEmployees] = useState([])
  const [employeeId, setEmployeeId] = useState("")
  const [shiftStart, setShiftStart] = useState("")
  const [shiftEnd, setShiftEnd] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submitBtnRef = useRef(null)

  const upcoming = useMemo(() => {
    const now = Date.now()
    return items
      .map((s) => ({ ...s, _startMs: new Date(s.shift_start).getTime() }))
      .filter((s) => s._startMs >= now)
      .sort((a, b) => a._startMs - b._startMs)
  }, [items])

  const past = useMemo(() => {
    const now = Date.now()
    return items
      .map((s) => ({ ...s, _startMs: new Date(s.shift_start).getTime() }))
      .filter((s) => s._startMs < now)
      .sort((a, b) => b._startMs - a._startMs)
  }, [items])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest("/scheduling/shifts/")
      setItems(unwrapResults(res))
    } catch (err) {
      setError(err?.body?.detail || "Failed to load shifts.")
    } finally {
      setLoading(false)
    }
  }

  async function loadEmployees() {
    if (!isAdmin) return
    try {
      const data = await apiRequest("/employees/")
      setEmployees(unwrapResults(data))
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load()
    loadEmployees()
  }, [isAdmin])

  async function createShift(e) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await apiRequest("/scheduling/shifts/", {
        method: "POST",
        json: {
          employee: employeeId,
          shift_start: toIsoLocal(shiftStart),
          shift_end: toIsoLocal(shiftEnd),
          title,
          notes
        }
      })
      setEmployeeId("")
      setShiftStart("")
      setShiftEnd("")
      setTitle("")
      setNotes("")
      fireSparkleFromEl(submitBtnRef.current)
      await load()
    } catch (err) {
      const msg =
        err?.body?.detail ||
        err?.body?.shift_end ||
        (typeof err?.body === "string" ? err.body : "") ||
        "Failed to create shift."
      setError(Array.isArray(msg) ? msg.join(" ") : String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  async function removeShift(id) {
    setBusyId(id)
    setError("")
    try {
      await apiRequest(`/scheduling/shifts/${id}/`, { method: "DELETE" })
      await load()
    } catch (err) {
      setError(err?.body?.detail || "Failed to delete shift.")
    } finally {
      setBusyId(null)
    }
  }

  function renderTable(list) {
    if (!list.length) return <div className="muted">None.</div>
    return (
      <div className="overflow-hidden rounded-2xl border border-stroke dark:border-slate-800 bg-surface dark:bg-slate-900/60 shadow-sm">
        <div className="grid grid-cols-4 bg-surface2 dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-6 py-4">
          <div>Start</div>
          <div>End</div>
          <div>Title</div>
          <div className="text-right">Actions</div>
        </div>
        <div className="divide-y divide-stroke dark:divide-slate-800">
          {list.map((s) => (
            <div key={s.id} className="grid grid-cols-4 items-center px-6 py-4 hover:bg-bg dark:hover:bg-slate-950/40 transition-colors text-sm font-bold text-slate-700 dark:text-slate-300">
              <div>{formatDateTime(s.shift_start)}</div>
              <div>{formatDateTime(s.shift_end)}</div>
              <div className="text-slate-900 dark:text-white">{s.title || "Shift"}</div>
              <div className="text-right">
                {isAdmin ? (
                  <button 
                    disabled={busyId === s.id} 
                    onClick={() => removeShift(s.id)}
                    className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg dark:bg-bg overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-surface dark:bg-slate-900/60 border-b border-stroke dark:border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-[Manrope] flex items-center gap-3">
              <CalendarRange className="text-indigo-600 dark:text-indigo-400" size={24} />
              Scheduling
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest opacity-80">
                Plan shifts like a timeline, not a spreadsheet.
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 px-6 py-3 bg-bg dark:bg-slate-950/40 rounded-2xl border border-stroke dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{isAdmin ? "Admin" : "Employee"} View</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">
        {error ? <div className="errorBox">{error}</div> : null}

      {isAdmin ? (
        <Card title="Create Shift">
          <form className="grid3" onSubmit={createShift}>
            <Select 
              label="Employee" 
              value={employeeId} 
              onChange={(e) => setEmployeeId(e.target.value)} 
              required
              options={[
                { label: "Select Employee...", value: "" },
                ...employees.map(emp => ({
                  label: `${emp.user?.first_name || emp.user?.username} (${emp.employee_id})`,
                  value: emp.id
                }))
              ]}
            />
            <Input label="Start" type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} required />
            <Input label="End" type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} required />
            <div className="gridSpan3">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Front desk" />
            </div>
            <div className="gridSpan3">
              <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
            <div className="gridSpan3 row">
              <Button type="submit" disabled={submitting} ref={submitBtnRef}>
                {submitting ? "Creating…" : "Create shift"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid2">
        <Card title="Upcoming">{loading ? <div className="muted">Loading…</div> : renderTable(upcoming)}</Card>
        <Card title="Past">{loading ? <div className="muted">Loading…</div> : renderTable(past.slice(0, 20))}</Card>
      </div>
      </div>
    </div>
  )
}

