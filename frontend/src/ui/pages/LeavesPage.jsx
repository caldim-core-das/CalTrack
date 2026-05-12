import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill, Select, TextArea } from "../components/kit.jsx"
import { CalendarDays } from "lucide-react"
import { fireSparkleFromEl } from "../sparkle.js"

const LEAVE_TYPES = [
  { label: "Vacation", value: "vacation" },
  { label: "Sick", value: "sick" },
  { label: "Unpaid", value: "unpaid" }
]

function toneForStatus(status) {
  if (status === "approved") return "good"
  if (status === "rejected") return "bad"
  return "warn"
}

function formatEmployeeId(value) {
  if (!value) return ""
  const s = String(value).trim()
  const m = /^EMP(\d+)$/i.exec(s.replace(/\s+/g, ""))
  if (m) return `EMP ${m[1].padStart(3, "0")}`
  return s
}

export function LeavesPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")
  const submitBtnRef = useRef(null)

  const [leaveType, setLeaveType] = useState("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const pendingCount = useMemo(() => items.filter((i) => i.status === "pending").length, [items])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const res = await apiRequest("/leaves/")
      setItems(unwrapResults(res))
    } catch (err) {
      setError(err?.body?.detail || "Failed to load leave requests.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await apiRequest("/leaves/", {
        method: "POST",
        json: { leave_type: leaveType, start_date: startDate, end_date: endDate, reason }
      })
      setStartDate("")
      setEndDate("")
      setReason("")
      fireSparkleFromEl(submitBtnRef.current)
      await load()
    } catch (err) {
      const msg =
        err?.body?.detail ||
        err?.body?.end_date ||
        (typeof err?.body === "string" ? err.body : "") ||
        "Failed to submit leave request."
      setError(Array.isArray(msg) ? msg.join(" ") : String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  async function decide(id, verb) {
    setBusyId(id)
    setError("")
    try {
      await apiRequest(`/leaves/${id}/${verb}/`, { method: "POST" })
      await load()
    } catch (err) {
      setError(err?.body?.detail || "Failed to update request.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-slate-50 overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-white border-b border-slate-100 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl professional-title text-slate-900 flex items-center gap-3">
              <CalendarDays className="text-indigo-600" size={24} />
              Leaves
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] professional-subtitle text-slate-500">
                Request time off, track approvals, keep the team aligned.
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
            <CalendarDays size={18} className="text-slate-400" />
            <span className="text-[13px] font-black text-slate-700 tracking-tight">{pendingCount} Pending</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">

      {error ? <div className="errorBox">{error}</div> : null}

      {user?.role === "employee" ? (
        <Card title="New Leave Request">
          <form className="grid2" onSubmit={submit}>
            <Select label="Type" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} options={LEAVE_TYPES} />
            <div className="grid2Tight">
              <Input label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <Input label="End" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <div className="gridSpan2">
              <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            </div>
            <div className="gridSpan2 row">
              <Button type="submit" disabled={submitting} ref={submitBtnRef}>
                {submitting ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title={user?.role === "admin" ? "All Requests" : "My Requests"}>
        {loading ? (
          <div className="muted">Loading…</div>
        ) : items.length ? (
          <div className="table">
            <div className="tableRow tableHead">
              <div>Employee ID</div>
              <div>Type</div>
              <div>Start</div>
              <div>End</div>
              <div>Status</div>
              <div className="right">Actions</div>
            </div>
            {items.map((i) => (
              <div key={i.id} className="tableRow">
                <div style={{ fontWeight: 600 }}>
                  {i.employee ? formatEmployeeId(i.employee) : "—"}
                  {user?.role === "admin" && i.employee_name ? <div className="muted">{i.employee_name}</div> : null}
                </div>
                <div>{i.leave_type}</div>
                <div>{i.start_date}</div>
                <div>{i.end_date}</div>
                <div>
                  <Pill tone={toneForStatus(i.status)}>{i.status}</Pill>
                </div>
                <div className="right">
                  {user?.role === "admin" && i.status === "pending" ? (
                    <div className="row rowRight">
                      <Button variant="ghost" disabled={busyId === i.id} onClick={() => decide(i.id, "approve")} type="button">
                        Approve
                      </Button>
                      <Button variant="danger" disabled={busyId === i.id} onClick={() => decide(i.id, "reject")} type="button">
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No leave requests.</div>
        )}
      </Card>
      </div>
    </div>
  )
}

