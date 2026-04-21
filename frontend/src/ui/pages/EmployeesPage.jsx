import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"
import { fireSparkleFromEl } from "../sparkle.js"

export function EmployeesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submitBtnRef = useRef(null)

  const [employeeId, setEmployeeId] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [title, setTitle] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")

  const activeCount = useMemo(() => items.filter((e) => e.is_active).length, [items])

  async function load() {
    setLoading(true)
    setError("")
    try {
      if (!isAdmin) {
        setItems([])
        return
      }
      const res = await apiRequest("/employees/")
      setItems(unwrapResults(res))
    } catch (err) {
      setError(err?.body?.detail || "Failed to load employees.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [isAdmin])

  async function createEmployee(e) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      await apiRequest("/employees/", {
        method: "POST",
        json: {
          employee_id: employeeId,
          username,
          password,
          email,
          first_name: firstName,
          last_name: lastName,
          title,
          hourly_rate: hourlyRate ? Number(hourlyRate) : 0
        }
      })
      setEmployeeId("")
      setUsername("")
      setPassword("")
      setEmail("")
      setFirstName("")
      setLastName("")
      setTitle("")
      setHourlyRate("")
      fireSparkleFromEl(submitBtnRef.current)
      await load()
    } catch (err) {
      const msg =
        err?.body?.detail ||
        (err?.body && typeof err.body === "object"
          ? Object.entries(err.body)
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")
          : "") ||
        "Failed to create employee."
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="stackLg">
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Employees</h1>
            <div className="pageSub">Admin access required.</div>
          </div>
        </div>
        <Card>
          <div className="muted">You don’t have permission to view this page.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="stackLg">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Employees</h1>
          <div className="pageSub">Create profiles, set rates, and keep the roster clean.</div>
        </div>
        <div className="row">
          <Pill tone="neutral">{items.length} total</Pill>
          <Pill tone="good">{activeCount} active</Pill>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <Card title="Create Employee">
        <form className="grid3" onSubmit={createEmployee}>
          <Input label="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Hourly rate" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 18.50" />
          <div className="gridSpan3 row">
            <Button type="submit" disabled={submitting} ref={submitBtnRef}>
              {submitting ? "Creating…" : "Create employee"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Roster">
        {loading ? (
          <div className="muted">Loading…</div>
        ) : items.length ? (
          <div className="table">
            <div className="tableRow tableHead">
              <div>Emp ID</div>
              <div>User</div>
              <div>Title</div>
              <div className="right">Rate</div>
              <div className="right">Status</div>
            </div>
            {items.map((e) => (
              <div key={e.id} className="tableRow">
                <div>{e.employee_id}</div>
                <div className="muted">{e.user?.username}</div>
                <div>{e.title || "—"}</div>
                <div className="right">${e.hourly_rate}</div>
                <div className="right">
                  <Pill tone={e.is_active ? "good" : "bad"}>{e.is_active ? "active" : "inactive"}</Pill>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No employees.</div>
        )}
      </Card>
    </div>
  )
}

