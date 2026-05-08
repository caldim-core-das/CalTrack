import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"
import { Loader2 } from "lucide-react"
import { fireSparkleFromEl } from "../sparkle.js"

export function EmployeesPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
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
      setSuccessMsg(`Employee "${username}" created. They can log in at ${window.location.origin} with their username and password.`)
      setTimeout(() => setSuccessMsg(""), 8000)
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
      <div className="flex flex-col gap-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Employees</h1>
            <div className="text-slate-500 mt-1">Admin access required.</div>
          </div>
        </div>
        <Card>
          <div className="text-slate-400 italic">You don’t have permission to view this page.</div>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Employees</h1>
          <div className="text-slate-500 mt-1">Create profiles, set rates, and keep the roster clean.</div>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone="neutral">{items.length} total</Pill>
          <Pill tone="good">{activeCount} active</Pill>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium">
          {error}
        </div>
      ) : null}

      {successMsg ? (
        <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium flex items-start gap-3">
          <span className="text-lg">✓</span>
          <span>{successMsg}</span>
        </div>
      ) : null}

      <Card title="Create Employee">
        <form className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4" onSubmit={createEmployee}>
          <Input label="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <div className="flex flex-col gap-1">
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="text-[10px] text-slate-400 mt-1 flex gap-1">
              <span>⚠️</span>
              <span>This becomes the login password at <strong>{window.location.origin}</strong></span>
            </div>
          </div>
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Hourly rate" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 18.50" />
          
          <div className="md:col-span-3 pt-2">
            <Button type="submit" disabled={submitting} ref={submitBtnRef} className="min-w-[160px]">
              {submitting ? "Creating…" : "Create employee"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Roster">
        {loading ? (
          <div className="text-slate-400 flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} />
            Loading…
          </div>
        ) : items.length ? (
          <div className="w-full">
            <div className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr] items-center pb-3 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div>Emp ID</div>
              <div>User</div>
              <div>Title</div>
              <div className="text-right">Rate</div>
              <div className="text-right">Status</div>
            </div>
            {items.map((e) => (
              <div key={e.id} className="grid grid-cols-[1fr_2fr_2fr_1fr_1fr] items-center py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors rounded-lg px-2 -mx-2">
                <div className="font-bold text-slate-900">{e.employee_id}</div>
                <div className="text-slate-500 text-sm">{e.user?.username}</div>
                <div className="text-slate-700 text-sm">{e.title || "—"}</div>
                <div className="text-right font-semibold text-slate-900">${e.hourly_rate}</div>
                <div className="text-right">
                  <Pill tone={e.is_active ? "good" : "bad"}>{e.is_active ? "active" : "inactive"}</Pill>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-slate-400 italic">No employees found.</div>
        )}
      </Card>
    </div>
  )
}

