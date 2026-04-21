import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill, Select, TextArea } from "../components/kit.jsx"
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
    <div className="stackLg leaves-module">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Leaves</h1>
          <div className="pageSub">Request time off, track approvals, keep the team aligned.</div>
        </div>
        <div className="row">
          <Pill tone={pendingCount ? "warn" : "good"}>{pendingCount} pending</Pill>
        </div>
      </div>

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
  )
}

