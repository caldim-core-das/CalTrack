import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill, TextArea, formatDateTime } from "../components/kit.jsx"
import { fireSparkleFromEl } from "../sparkle.js"

function toIsoLocal(datetimeLocal) {
  if (!datetimeLocal) return ""
  return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal
}

export function SchedulingPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
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
      <div className="table">
        <div className="tableRow tableHead">
          <div>Start</div>
          <div>End</div>
          <div>Title</div>
          <div className="right">Actions</div>
        </div>
        {list.map((s) => (
          <div key={s.id} className="tableRow">
            <div>{formatDateTime(s.shift_start)}</div>
            <div>{formatDateTime(s.shift_end)}</div>
            <div>{s.title || "Shift"}</div>
            <div className="right">
              {isAdmin ? (
                <Button variant="danger" type="button" disabled={busyId === s.id} onClick={() => removeShift(s.id)}>
                  Delete
                </Button>
              ) : (
                <span className="muted">—</span>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="stackLg">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Scheduling</h1>
          <div className="pageSub">Plan shifts like a timeline, not a spreadsheet.</div>
        </div>
        <div className="row">
          <Pill tone="neutral">{isAdmin ? "Admin" : "Employee"} view</Pill>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      {isAdmin ? (
        <Card title="Create Shift">
          <form className="grid3" onSubmit={createShift}>
            <div className="field">
              <label className="label">Employee</label>
              <select className="qt-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                <option value="">Select Employee...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.user?.first_name || emp.user?.username} ({emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
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
  )
}

