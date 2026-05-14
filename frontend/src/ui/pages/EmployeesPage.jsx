import { useEffect, useMemo, useRef, useState } from "react"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { Button, Card, Input, Pill } from "../components/kit.jsx"
import { Loader2, ShieldCheck, ShieldOff, AlertTriangle, ChevronDown, ChevronUp, Users } from "lucide-react"
import { fireSparkleFromEl } from "../sparkle.js"

// ── Exempt status badge ─────────────────────────────────────────────────────
function ExemptBadge({ status }) {
  if (status === "exempt") return (
    <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
      <ShieldCheck size={11} /> EXEMPT
    </span>
  )
  if (status === "non_exempt") return (
    <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
      <ShieldOff size={11} /> NON-EXEMPT
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
      <AlertTriangle size={11} /> PENDING
    </span>
  )
}

export function EmployeesPage() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const submitBtnRef = useRef(null)

  // Core fields
  const [employeeId, setEmployeeId] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [title, setTitle] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")

  // Compliance fields
  const [country, setCountry] = useState("US")
  const [state, setState] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [exemptStatus, setExemptStatus] = useState("non_exempt")
  const [weeklySalary, setWeeklySalary] = useState("")
  const [ukTaxCode, setUkTaxCode] = useState("1257L")
  const [ukNiCategory, setUkNiCategory] = useState("A")
  const [rolledUpHolidayPay, setRolledUpHolidayPay] = useState(false)
  const [showComplianceFields, setShowComplianceFields] = useState(false)

  const activeCount = useMemo(() => items.filter((e) => e.is_active).length, [items])

  async function load() {
    setLoading(true)
    setError("")
    try {
      if (!isAdmin) { setItems([]); return }
      const res = await apiRequest("/employees/")
      setItems(unwrapResults(res))
    } catch (err) {
      setError(err?.body?.detail || "Failed to load employees.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [isAdmin])

  async function createEmployee(e) {
    e.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const payload = {
        employee_id: employeeId,
        username, password, email,
        first_name: firstName,
        last_name: lastName,
        title,
        hourly_rate: hourlyRate ? Number(hourlyRate) : 0,
        country: country || null,
        state: state || null,
        date_of_birth: dateOfBirth || null,
        exempt_status: exemptStatus,
        weekly_salary: weeklySalary ? Number(weeklySalary) : null,
        uk_tax_code: country === "UK" ? ukTaxCode : null,
        uk_ni_category: country === "UK" ? ukNiCategory : null,
        rolled_up_holiday_pay: country === "UK" ? rolledUpHolidayPay : false,
      }
      await apiRequest("/employees/", { method: "POST", json: payload })

      // Reset form
      setEmployeeId(""); setUsername(""); setPassword(""); setEmail("")
      setFirstName(""); setLastName(""); setTitle(""); setHourlyRate("")
      setCountry("US"); setState(""); setDateOfBirth(""); setExemptStatus("non_exempt")
      setWeeklySalary(""); setUkTaxCode("1257L"); setUkNiCategory("A"); setRolledUpHolidayPay(false)

      fireSparkleFromEl(submitBtnRef.current)
      setSuccessMsg(`Employee "${username}" created. They can log in at ${window.location.origin} with their username and password.`)
      setTimeout(() => setSuccessMsg(""), 8000)
      await load()
    } catch (err) {
      const msg =
        err?.body?.detail ||
        (err?.body && typeof err.body === "object"
          ? Object.entries(err.body).map(([k, v]) => `${k}: ${v}`).join("; ")
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
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Employees</h1>
          <div className="text-slate-500 dark:text-slate-400 mt-1">Admin access required.</div>
        </div>
        <Card><div className="text-slate-400 dark:text-slate-600 italic">You don't have permission to view this page.</div></Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg dark:bg-bg overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-surface dark:bg-slate-900/60 border-b border-stroke dark:border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl professional-title text-slate-900 dark:text-white flex items-center gap-3">
              <Users className="text-indigo-600 dark:text-indigo-400" size={24} />
              Employees
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] professional-subtitle text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                Manage roster, rates, and compliance classification.
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex items-center gap-3 px-6 py-3 bg-bg dark:bg-slate-800/50 rounded-2xl border border-stroke dark:border-slate-700">
            <span className="text-[13px] font-black text-slate-700 dark:text-slate-300 tracking-tight uppercase">{items.length} Total</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">

        {error && <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium">{error}</div>}
        {successMsg && (
          <div className="p-4 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium flex items-start gap-3">
            <span className="text-lg">✓</span><span>{successMsg}</span>
          </div>
        )}

        <Card title="Create Employee">
          <form className="flex flex-col gap-6" onSubmit={createEmployee}>
            {/* Core fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <Input label="Employee ID" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required />
              <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              <div className="flex flex-col gap-1">
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex gap-1">
                  <span>⚠️</span>
                  <span>This becomes the login password at <strong>{window.location.origin}</strong></span>
                </div>
              </div>
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input label="Hourly rate" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 18.50" />
            </div>

            {/* Compliance accordion */}
            <div className="rounded-2xl border border-stroke dark:border-slate-800 overflow-hidden bg-surface dark:bg-slate-950/20 shadow-sm">
              <button
                type="button"
                onClick={() => setShowComplianceFields(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 bg-surface2 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-none cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">⚖️</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Compliance & Payroll Classification</span>
                </div>
                {showComplianceFields ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
              </button>

              {showComplianceFields && (
                <div className="p-6 flex flex-col gap-8 bg-surface dark:bg-slate-900/40">
                  {/* Region */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Country</label>
                      <select
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/60 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                      >
                        <option value="US">🇺🇸 United States</option>
                        <option value="UK">🇬🇧 United Kingdom</option>
                      </select>
                    </div>
                    {country === "US" && (
                      <div className="flex flex-col gap-1">
                        <label className="fieldLabel">State (2-letter code)</label>
                        <input
                          className="input"
                          value={state}
                          onChange={e => setState(e.target.value.toUpperCase())}
                          maxLength={2}
                          placeholder="e.g. CA, NY, TX"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <label className="fieldLabel">Date of Birth</label>
                      <input
                        className="input"
                        type="date"
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* US FLSA classification */}
                  {country === "US" && (
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                      <div className="font-black text-[11px] text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                        🇺🇸 US FLSA Classification
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Exempt Status</label>
                          <select
                            value={exemptStatus}
                            onChange={e => setExemptStatus(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/60 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                          >
                            <option value="non_exempt">Non-Exempt (eligible for OT pay)</option>
                            <option value="exempt">Exempt (no OT pay required)</option>
                            <option value="pending">Pending Classification</option>
                          </select>
                          <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1.5 uppercase font-bold tracking-wider">
                            Exempt threshold: $844/week salary + duties test
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="fieldLabel">Weekly Salary (USD) — for threshold check</label>
                          <input
                            className="input"
                            type="number"
                            value={weeklySalary}
                            onChange={e => setWeeklySalary(e.target.value)}
                            placeholder="e.g. 1200"
                            step="0.01"
                          />
                          {weeklySalary && (
                            <div className={`text-[10px] mt-2 font-black uppercase tracking-wider ${Number(weeklySalary) >= 844 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                              {Number(weeklySalary) >= 844
                                ? "✓ Meets $844/wk FLSA threshold — verify duties test"
                                : "✗ Below $844/wk threshold — likely non-exempt"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* UK payroll */}
                  {country === "UK" && (
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl p-5">
                      <div className="font-black text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-4">
                        🇬🇧 UK PAYE &amp; NI Settings
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <div className="flex flex-col gap-1">
                          <label className="fieldLabel">Tax Code</label>
                          <input className="input" value={ukTaxCode} onChange={e => setUkTaxCode(e.target.value)} placeholder="e.g. 1257L" />
                          <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-1 uppercase font-bold tracking-wider">Standard personal allowance: 1257L</div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">NI Category Letter</label>
                          <select
                            value={ukNiCategory}
                            onChange={e => setUkNiCategory(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/60 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                          >
                            <option value="A">A — Standard (most employees)</option>
                            <option value="B">B — Married women / widows (reduced)</option>
                            <option value="C">C — Over State Pension Age</option>
                            <option value="H">H — Apprentice under 25</option>
                            <option value="J">J — Deferred (another job)</option>
                            <option value="M">M — Under 21</option>
                            <option value="Z">Z — Under 21, deferred</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="fieldLabel">Rolled-up Holiday Pay</label>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, height: 40 }}>
                            <input
                              type="checkbox"
                              id="rolledUp"
                              checked={rolledUpHolidayPay}
                              onChange={e => setRolledUpHolidayPay(e.target.checked)}
                              style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                            <label htmlFor="rolledUp" style={{ fontSize: 13, color: "var(--fg)", cursor: "pointer" }}>
                              Add 12.07% holiday pay to each payslip
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-1">
              <Button type="submit" disabled={submitting} ref={submitBtnRef} className="min-w-[160px]">
                {submitting ? "Creating…" : "Create employee"}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Roster">
          {loading ? (
            <div className="text-slate-400 dark:text-slate-600 flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />Loading…
            </div>
          ) : items.length ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg dark:bg-slate-800/50 border-b-2 border-stroke dark:border-slate-800">
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">ID</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Title</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Rate</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Region</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">Classification</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">UK Payroll</th>
                    <th className="px-6 py-4 text-[11px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke dark:divide-slate-800">
                  {items.map((e) => (
                    <tr key={e.id} className="hover:bg-bg dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-5 font-bold text-slate-900 dark:text-white">{e.employee_id}</td>
                      <td className="px-6 py-5 text-slate-600 dark:text-slate-400">
                        <div className="font-bold">{e.user?.username}</div>
                        {e.user?.email && <div className="text-[11px] opacity-60 font-medium">{e.user.email}</div>}
                      </td>
                      <td className="px-6 py-5 text-slate-700 dark:text-slate-300">{e.title || "—"}</td>
                      <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white">
                        {e.country === "UK" ? "£" : "$"}{e.hourly_rate}/hr
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                          {e.country === "UK" ? "🇬🇧 UK" : e.country === "US" ? "🇺🇸 US" : (e.country || "—")}
                        </div>
                        {e.state && <div className="text-[10px] text-slate-500 dark:text-slate-500 uppercase font-bold">{e.state}</div>}
                      </td>
                      <td className="px-6 py-5">
                        {e.country === "US" ? (
                          <div className="flex flex-col gap-1.5">
                            <ExemptBadge status={e.exempt_status} />
                            {e.weekly_salary && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-tighter">${e.weekly_salary}/wk</span>
                            )}
                            {e.flsa_duties_category && (
                              <span className="text-[9px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-widest">{e.flsa_duties_category}</span>
                            )}
                          </div>
                        ) : <span className="text-slate-400 dark:text-slate-600 italic text-xs">N/A</span>}
                      </td>
                      <td className="px-6 py-5">
                        {e.country === "UK" ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200">Tax: {e.uk_tax_code || "—"}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase">NI Cat: {e.uk_ni_category || "—"}</span>
                            {e.rolled_up_holiday_pay && (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Rolled-up holiday</span>
                            )}
                            {e.wtr_opt_out_active && (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-widest">48hr opt-out</span>
                            )}
                          </div>
                        ) : <span className="text-slate-400 dark:text-slate-600 italic text-xs">N/A</span>}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Pill tone={e.is_active ? "good" : "bad"}>{e.is_active ? "active" : "inactive"}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-slate-400 italic">No employees found.</div>
          )}
        </Card>
      </div>
    </div>
  )
}
