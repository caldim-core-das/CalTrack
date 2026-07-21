import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { apiRequest } from "../../api/client"
import { Check, ArrowRight, Building2, Users2, Workflow, Clock, Banknote, CalendarDays, Sparkles, RefreshCcw } from "lucide-react"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { routes } from "../routes.js"
import { useAuth } from "../../state/auth/useAuth.js"

// ── Region config (mirrors backend Region seed data) ─────────────────────────
const REGIONS = [
  {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    currency: "USD ($)",
    payroll: "Bi-weekly payroll",
    leave: "No statutory leave",
    compliance: "FLSA overtime rules",
    defaultState: "NY",
  },
  {
    code: "UK",
    name: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP (£)",
    payroll: "Monthly payroll",
    leave: "28 days statutory leave",
    compliance: "WTR 48-hr cap + NI/PAYE",
    defaultState: null,
  },
  {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    currency: "INR (₹)",
    payroll: "Monthly payroll",
    leave: "15 days statutory leave",
    compliance: "EPF + Gratuity + ESIC",
    defaultState: "MH",
  },
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Step 1
  const [orgName, setOrgName] = useState("")
  const [teamSize, setTeamSize] = useState("1 - 10 employees")
  const [region, setRegion] = useState(null)      // "US" | "UK"
  const [defaultState, setDefaultState] = useState("")

  // Step 2
  const [modules, setModules] = useState(["time"])

  // Step 3
  const [startTrial, setStartTrial] = useState(true)

  // Step 4
  const [adminEmails, setAdminEmails] = useState([""])
  const [employeeBulkEmails, setEmployeeBulkEmails] = useState("")

  const selectedRegion = REGIONS.find(r => r.code === region)

  const step1Valid = orgName.trim() && region && (!["US", "IN"].includes(region) || defaultState.trim())

  const handleCreateCompany = async () => {
    setLoading(true)
    setError("")
    try {
      const validAdmins = adminEmails.map(e => e.trim()).filter(e => e)
      const validEmployees = employeeBulkEmails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e && e.includes("@"))

      if (validAdmins.length > 10) {
        throw new Error("You can invite a maximum of 10 administrators.")
      }
      if (validEmployees.length > 200) {
        throw new Error("You can invite a maximum of 200 employees.")
      }

      const formattedInvites = [
        ...validAdmins.map(email => ({ email, role: "admin" })),
        ...validEmployees.map(email => ({ email, role: "employee" }))
      ]

      const payload = {
        company_name: orgName.trim(),
        primary_country: region,
        team_size: teamSize,
        selected_modules: modules,
        invites: formattedInvites,
        start_trial: startTrial,
      }
      if (["US", "IN"].includes(region) && defaultState.trim()) {
        payload.default_state = defaultState.trim()
      }
      await apiRequest("/company/create", { method: "POST", json: payload })
      window.location.href = import.meta.env.BASE_URL || "/"
    } catch (err) {
      setLoading(false)
      const msg =
        err?.message ||
        err?.body?.detail ||
        (err?.body && typeof err.body === "object" ? Object.values(err.body).flat()[0] : null) ||
        "Failed to create organization."
      setError(msg)
    }
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Left Pane */}
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, #0e1116 0%, #1e1b4b 100%)",
        color: "#fff",
        padding: "64px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
      }}>
        <div style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, background: "#5d5fef", opacity: 0.15, filter: "blur(100px)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, right: 0, width: 300, height: 300, background: "#ec4899", opacity: 0.1, filter: "blur(100px)", borderRadius: "50%", pointerEvents: "none" }} />

        <div style={{ zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 64 }}>
            <CalTrackLogo size="md" showTagline />
            <button
              onClick={async () => {
                await logout()
                navigate(routes.login)
              }}
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "bold",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(255, 255, 255, 0.2)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(255, 255, 255, 0.1)"}
            >
              Sign Out
            </button>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, lineHeight: 1.1, marginBottom: 24 }}>
            Smarter teams.<br />
            <span style={{ color: "#a5a6f6", fontStyle: "italic" }}>Seamless work.</span>
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", maxWidth: 400, lineHeight: 1.6 }}>
            Set up your organization in just three steps and unlock automated workforce management — built for US, UK &amp; India compliance.
          </p>
        </div>

        {/* Region preview (shown after selection) */}
        {selectedRegion && (
          <div style={{ zIndex: 10, padding: "20px 24px", borderRadius: 16, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", animation: "fadeUp 0.3s ease both" }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{selectedRegion.flag} {selectedRegion.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[selectedRegion.currency, selectedRegion.payroll, selectedRegion.leave, selectedRegion.compliance].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  <Check size={12} color="#a5a6f6" /> {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedRegion && (
          <div style={{ zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users2 size={24} color="#fff" style={{ margin: "auto" }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>Join 10,000+ organizations</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>managing millions of hours daily.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Pane */}
      <div style={{ flex: 1.3, background: "var(--surface)", display: "flex", flexDirection: "column", padding: "64px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 500, margin: "auto" }}>

          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, flex: s !== 4 ? 1 : 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800,
                  background: step > s ? "#059669" : step === s ? "#5d5fef" : "var(--bg)",
                  color: step >= s ? "#fff" : "var(--muted)",
                  transition: "all 0.3s ease",
                }}>
                  {step > s ? <Check size={16} /> : s}
                </div>
                {s !== 4 && <div style={{ flex: 1, height: 2, background: step > s ? "#059669" : "var(--stroke2)", borderRadius: 2 }} />}
              </div>
            ))}
          </div>

          {/* ── Step 1: Org Details + Region ── */}
          {step === 1 && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 20, background: "#eff0fe", color: "#5d5fef", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 24 }}>
                <Building2 size={14} style={{ marginRight: 6 }} /> GETTING STARTED
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, margin: "0 0 12px 0", color: "var(--fg)" }}>
                Tell us about your organization
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                This is the official name that will appear on reports, invoices, and your team's dashboard.
              </p>

              <div className="field" style={{ marginBottom: 20 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1 }}>ORGANIZATION NAME</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Acme Corporation"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  style={{ fontSize: 16, padding: "14px 16px", borderRadius: 12 }}
                />
              </div>

              <div className="field" style={{ marginBottom: 28 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1 }}>TEAM SIZE</label>
                <select
                  className="input"
                  value={teamSize}
                  onChange={e => setTeamSize(e.target.value)}
                  style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }}
                >
                  <option>1 - 10 employees</option>
                  <option>11 - 50 employees</option>
                  <option>51 - 200 employees</option>
                  <option>201+ employees</option>
                </select>
              </div>

              {/* ── Region Selector ── */}
              <div className="field" style={{ marginBottom: ["US", "IN"].includes(region) ? 16 : 28 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1 }}>OPERATING REGION</label>
                <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 12, marginTop: 4 }}>
                  Sets your compliance rules, currency, payroll cycle, and statutory leave.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                  {REGIONS.map(r => {
                    const selected = region === r.code
                    return (
                      <div
                        key={r.code}
                        onClick={() => { setRegion(r.code); if (r.code !== "US" && r.code !== "IN") setDefaultState("") }}
                        style={{
                          border: selected ? "2px solid #5d5fef" : "1.5px solid var(--stroke2)",
                          background: selected ? "#eff0fe" : "var(--surface)",
                          padding: "16px 18px",
                          borderRadius: 14,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          position: "relative",
                        }}
                      >
                        {selected && (
                          <div style={{ position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: "50%", background: "#5d5fef", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={11} color="#fff" strokeWidth={3} />
                          </div>
                        )}
                        <div style={{ fontSize: 26, marginBottom: 6 }}>{r.flag}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: selected ? "#5d5fef" : "var(--fg)" }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{r.currency} · {r.payroll}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* State (only shown when US or IN is selected) */}
              {["US", "IN"].includes(region) && (
                <div className="field" style={{ marginBottom: 28, animation: "fadeUp 0.25s ease both" }}>
                  <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1 }}>
                    {region === "US" ? "DEFAULT STATE" : "DEFAULT STATE / UNION TERRITORY"}
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder={region === "US" ? "e.g. California, New York" : "e.g. Maharashtra, Karnataka"}
                    value={defaultState}
                    onChange={e => setDefaultState(e.target.value)}
                    style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }}
                  />
                </div>
              )}

              <button
                className="btn btnPrimary"
                onClick={() => {
                  const name = orgName.trim()
                  if (name) {
                    localStorage.setItem("quicktims.orgName", name)
                    window.dispatchEvent(new CustomEvent("quicktims:orgName"))
                  }
                  setStep(2)
                }}
                disabled={!step1Valid}
                style={{ width: "100%", padding: 16, background: "#5d5fef", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none" }}
              >
                CONTINUE <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* ── Step 2: Modules ── */}
          {step === 2 && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 20, background: "#eff0fe", color: "#5d5fef", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 24 }}>
                <Workflow size={14} style={{ marginRight: 6 }} /> ORGANIZATION MOTIVE / PRIORITY IDENTIFICATION
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, margin: "0 0 12px 0", color: "var(--fg)" }}>
                Identify your organization's motive &amp; priorities
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                Select the modules that align with your business objectives. You can customize them anytime in settings.
              </p>

              <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
                {[
                  { id: "time", label: "Time Tracking", sub: "Clock in/out, timesheets, and approvals.", icon: <Clock size={20} /> },
                  { id: "leaves", label: "Leave Management", sub: region === "UK" ? "28 days statutory leave, holidays, accruals." : region === "IN" ? "15 days statutory leave, holidays, accruals." : "Time-off tracking, holidays, accruals.", icon: <CalendarDays size={20} /> },
                  { id: "payroll", label: "Payroll Engine", sub: region === "UK" ? "PAYE, NI, payslips, monthly runs." : region === "IN" ? "EPF, Gratuity & ESIC, payslips, monthly runs." : "FLSA-compliant OT, payslips, bi-weekly runs.", icon: <Banknote size={20} /> },
                ].map(mod => {
                  const isSel = modules.includes(mod.id)
                  return (
                    <div
                      key={mod.id}
                      onClick={() => isSel ? setModules(modules.filter(m => m !== mod.id)) : setModules([...modules, mod.id])}
                      style={{
                        border: isSel ? "2px solid #5d5fef" : "1px solid var(--stroke2)",
                        background: isSel ? "#eff0fe" : "var(--surface)",
                        padding: "16px 20px",
                        borderRadius: 12,
                        display: "flex", alignItems: "center", gap: 16,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ color: isSel ? "#5d5fef" : "var(--muted)" }}>{mod.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--fg)", marginBottom: 2 }}>{mod.label}</div>
                        <div style={{ fontSize: 13, color: "var(--muted)" }}>{mod.sub}</div>
                      </div>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", border: isSel ? "none" : "2px solid var(--stroke)", background: isSel ? "#5d5fef" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isSel && <Check size={12} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <button className="btn btnGhost" onClick={() => setStep(1)} style={{ padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 800 }}>BACK</button>
                <button
                  className="btn btnPrimary"
                  onClick={() => setStep(3)}
                  disabled={modules.length === 0}
                  style={{ flex: 1, padding: 16, background: "#5d5fef", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none" }}
                >
                  CONTINUE <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Trial Selection ── */}
          {step === 3 && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 20, background: "#eff0fe", color: "#5d5fef", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 24 }}>
                <Sparkles size={14} style={{ marginRight: 6 }} /> PREMIUM FEATURES
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, margin: "0 0 12px 0", color: "var(--fg)" }}>
                Get Started with a Free 14-Day Trial
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                Enjoy full access to premium features for 14 days at no cost. No credit card required.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                <div
                  onClick={() => setStartTrial(true)}
                  style={{
                    border: startTrial ? "2px solid #5d5fef" : "1px solid var(--stroke2)",
                    background: startTrial ? "#eff0fe" : "var(--surface)",
                    padding: "20px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex", alignItems: "center", gap: 16
                  }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: startTrial ? "none" : "2px solid var(--stroke)", background: startTrial ? "#5d5fef" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {startTrial && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg)" }}>Start Free Trial</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Access all premium modules and analytics instantly.</div>
                  </div>
                </div>

                <div
                  onClick={() => setStartTrial(false)}
                  style={{
                    border: !startTrial ? "2px solid #5d5fef" : "1px solid var(--stroke2)",
                    background: !startTrial ? "#eff0fe" : "var(--surface)",
                    padding: "20px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex", alignItems: "center", gap: 16
                  }}
                >
                  <div style={{ width: 24, height: 24, borderRadius: "50%", border: !startTrial ? "none" : "2px solid var(--stroke)", background: !startTrial ? "#5d5fef" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!startTrial && <Check size={14} color="#fff" strokeWidth={3} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "var(--fg)" }}>Skip for Now</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>Continue with basic features. You can activate your trial later.</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <button className="btn btnGhost" onClick={() => setStep(2)} style={{ padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 800 }}>BACK</button>
                <button
                  className="btn btnPrimary"
                  onClick={() => setStep(4)}
                  style={{ flex: 1, padding: 16, background: "#5d5fef", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none" }}
                >
                  CONTINUE <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Invite Team ── */}
          {step === 4 && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 20, background: "#eff0fe", color: "#5d5fef", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 24 }}>
                <Users2 size={14} style={{ marginRight: 6 }} /> BRING YOUR TEAM
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, margin: "0 0 12px 0", color: "var(--fg)" }}>
                Invite a few colleagues
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                QuickTIMS works best when your team is united in one place. Add their emails, or skip and do it later.
              </p>

              {/* Invite Admins */}
              <div style={{ marginBottom: 28 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1, marginBottom: 8, display: "block" }}>
                  INVITE ADMINISTRATORS (MAX 10)
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {adminEmails.map((email, i) => (
                    <input
                      key={i}
                      type="email"
                      className="input"
                      placeholder={`e.g. admin${i + 1}@example.com`}
                      value={email}
                      onChange={e => {
                        const newEmails = [...adminEmails]
                        newEmails[i] = e.target.value
                        setAdminEmails(newEmails)
                      }}
                      style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }}
                    />
                  ))}
                </div>
                {adminEmails.length < 10 && (
                  <button 
                    className="btn btnGhost" 
                    onClick={() => setAdminEmails([...adminEmails, ""])}
                    style={{ fontSize: 12, fontWeight: 800, color: "#5d5fef", marginTop: 10, padding: 0, border: "none", background: "none", cursor: "pointer" }}
                  >
                    + ADD ADMINISTRATOR
                  </button>
                )}
              </div>

              {/* Invite Employees */}
              <div style={{ marginBottom: 32 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1, marginBottom: 8, display: "block" }}>
                  INVITE EMPLOYEES (MAX 200)
                </label>
                <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
                  Enter emails separated by commas or newlines.
                </p>
                <textarea
                  className="input"
                  placeholder="e.g. employee1@example.com, employee2@example.com"
                  value={employeeBulkEmails}
                  onChange={e => setEmployeeBulkEmails(e.target.value)}
                  style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12, minHeight: 120, fontFamily: "sans-serif", resize: "vertical" }}
                />
              </div>

              {/* Summary strip */}
              <div style={{ padding: "14px 18px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--stroke2)", marginBottom: 24, display: "flex", gap: 20, fontSize: 12, color: "var(--muted)" }}>
                <span><strong style={{ color: "var(--fg)" }}>{selectedRegion?.flag} {selectedRegion?.name}</strong></span>
                <span>{selectedRegion?.currency}</span>
                <span>{selectedRegion?.payroll}</span>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <button
                  className="btn btnGhost"
                  onClick={() => setStep(3)}
                  style={{ padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 800 }}
                  disabled={loading}
                >
                  BACK
                </button>
                <button
                  className="btn btnPrimary"
                  onClick={handleCreateCompany}
                  disabled={loading}
                  style={{ flex: 1, padding: 16, background: "#059669", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {loading
                    ? <RefreshCcw size={18} style={{ animation: "spin 1s linear infinite" }} />
                    : <><Sparkles size={18} /> COMPLETE SETUP</>
                  }
                </button>
              </div>

              {error && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: 8, fontSize: 13, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
