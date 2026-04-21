import { useEffect, useMemo, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"

function formatEmployeeId(value) {
  if (!value) return ""
  const s = String(value).trim()
  const m = /^EMP(\d+)$/i.exec(s.replace(/\s+/g, ""))
  if (m) return `EMP ${m[1].padStart(3, "0")}`
  return s
}

export function PayrollPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [employeeId, setEmployeeId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  const isAdmin = user?.role === "admin"

  const employeeOptions = useMemo(() => {
    return employees.map((e) => ({ id: e.id, label: `${e.employee_id} (${e.user?.username ?? "user"})` }))
  }, [employees])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const [recordsRes, employeesRes] = await Promise.all([
        apiRequest("/payroll/records/"),
        isAdmin ? apiRequest("/employees/") : Promise.resolve({ results: [] })
      ])
      setRecords(unwrapResults(recordsRes))
      setEmployees(isAdmin ? unwrapResults(employeesRes) : [])
    } catch (err) {
      setError(err?.body?.detail || "Failed to load payroll.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isAdmin])

  async function generate(e) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await apiRequest("/payroll/generate/", {
        method: "POST",
        json: { employee: employeeId, start, end }
      })
      await load()
    } catch (err) {
      const msg = err?.body?.detail || "Failed to generate payroll."
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="stackLg">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Payroll</h1>
          <div className="pageSub">Transparent pay: regular, overtime, and leave all reconciled.</div>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      {isAdmin ? (
        <Card title="Generate Payroll">
          <form className="grid3" onSubmit={generate}>
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
            <Input label="Start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            <Input label="End" type="date" value={end} onChange={(e) => setEnd(e.target.value)} required />
            <div className="gridSpan3 row">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Generating…" : "Generate"}
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card title="Records">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : records.length ? (
          <div className="table">
            <div className="tableRow tableHead">
              <div>Employee</div>
              <div>Period</div>
              <div className="right">Net</div>
              <div className="right">Regular</div>
              <div className="right">OT</div>
            </div>
            {records.map((r) => (
              <div key={r.id} className="tableRow">
                <div style={{ fontWeight: 600 }}>
                  {r.employee ? formatEmployeeId(r.employee) : "—"}
                  {r.employee_name ? <div className="muted">{r.employee_name}</div> : null}
                  {!r.employee && !r.employee_name ? <div className="muted">{r.id}</div> : null}
                </div>
                <div>
                  <span className="muted">
                    {r.period?.start_date} → {r.period?.end_date}
                  </span>
                </div>
                <div className="right">
                  <Pill tone="good">${r.net_pay}</Pill>
                </div>
                <div className="right">{r.regular_hours}</div>
                <div className="right">{r.overtime_hours}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No payroll records yet.</div>
        )}
      </Card>
    </div>
  )
}

