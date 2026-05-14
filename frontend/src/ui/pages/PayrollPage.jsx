import { useEffect, useMemo, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"
import { Banknote } from "lucide-react"

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

  const { isAdmin } = useRole()

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
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg dark:bg-bg overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-surface dark:bg-slate-900/60 border-b border-stroke dark:border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-[Manrope] flex items-center gap-3">
              <Banknote className="text-indigo-600 dark:text-indigo-400" size={24} />
              Payroll
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                Transparent pay: regular, overtime, and leave all reconciled.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">

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
          <div className="overflow-x-auto rounded-2xl border border-stroke dark:border-slate-800 bg-surface dark:bg-slate-900/60 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface2 dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  <th className="p-4">Employee</th>
                  <th className="p-4">Period</th>
                  <th className="p-4">Region</th>
                  <th className="p-4 text-right">Gross</th>
                  <th className="p-4 text-right">Net</th>
                  <th className="p-4 text-right">Regular hrs</th>
                  <th className="p-4 text-right">OT hrs</th>
                  <th className="p-4 text-right">Daily OT</th>
                  <th className="p-4 text-right">Double Time</th>
                  <th className="p-4 text-right">Tax (UK)</th>
                  <th className="p-4 text-right">Emp NI</th>
                  <th className="p-4 text-right">Employer NI</th>
                  <th className="p-4 text-right">Holiday</th>
                  <th className="p-4 text-center">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke dark:divide-slate-800">
                {records.map((r) => {
                  const isUK = r.region && r.region.includes("UK")
                  const curr = isUK ? "£" : "$"
                  return (
                    <tr key={r.id} className="hover:bg-bg dark:hover:bg-slate-950/40 transition-colors">
                      <td className="p-4">
                        <div className="font-black text-slate-900 dark:text-white text-sm">{r.employee ? formatEmployeeId(r.employee) : "—"}</div>
                        {r.employee_name && <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{r.employee_name}</div>}
                      </td>
                      <td className="p-4">
                        <div className="text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                          {r.period?.start_date} → {r.period?.end_date}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{r.region || "—"}</span>
                        {r.is_exempt && <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-0.5">FLSA EXEMPT</div>}
                        {isUK && r.uk_tax_code && <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Tax: {r.uk_tax_code} · NI: {r.uk_ni_category}</div>}
                      </td>
                      <td className="p-4 text-right font-black text-slate-900 dark:text-white">{curr}{r.gross_pay}</td>
                      <td className="p-4 text-right">
                        <Pill tone="good">{curr}{r.net_pay}</Pill>
                      </td>
                      <td className="p-4 text-right text-slate-700 dark:text-slate-300 font-bold">{r.regular_hours}h</td>
                      <td className={`p-4 text-right font-black ${Number(r.overtime_hours) > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-600"}`}>
                        {r.overtime_hours}h
                      </td>
                      <td className={`p-4 text-right font-black ${Number(r.daily_ot_hours) > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400 dark:text-slate-600"}`}>
                        {Number(r.daily_ot_hours) > 0 ? `${r.daily_ot_hours}h` : "—"}
                      </td>
                      <td className={`p-4 text-right font-black ${Number(r.double_time_hours) > 0 ? "text-rose-600 dark:text-rose-500" : "text-slate-400 dark:text-slate-600"}`}>
                        {Number(r.double_time_hours) > 0 ? `${r.double_time_hours}h` : "—"}
                      </td>
                      <td className="p-4 text-right text-slate-500 dark:text-slate-500 font-bold">
                        {isUK && Number(r.uk_income_tax) > 0 ? `£${r.uk_income_tax}` : "—"}
                      </td>
                      <td className="p-4 text-right text-slate-500 dark:text-slate-500 font-bold">
                        {isUK && Number(r.uk_employee_ni) > 0 ? `£${r.uk_employee_ni}` : "—"}
                      </td>
                      <td className="p-4 text-right text-slate-500 dark:text-slate-500 font-bold">
                        {isUK && Number(r.uk_employer_ni) > 0 ? `£${r.uk_employer_ni}` : "—"}
                      </td>
                      <td className={`p-4 text-right font-black ${Number(r.holiday_hours_accrued) > 0 ? "text-emerald-600 dark:text-emerald-500" : "text-slate-400 dark:text-slate-600"}`}>
                        {Number(r.holiday_hours_accrued) > 0 ? `${r.holiday_hours_accrued}h` : "—"}
                      </td>
                      <td className="p-4 text-center">
                        {!r.wage_floor_compliant && (
                          <span className="px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-[9px] font-black uppercase tracking-widest border border-rose-200 dark:border-rose-900/40">
                            MIN WAGE
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="muted">No payroll records yet.</div>
        )}
      </Card>
      </div>
    </div>
  )
}

