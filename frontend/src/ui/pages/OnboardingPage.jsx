import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Check, ArrowRight, Building2, Users2, Workflow, Clock, Banknote, CalendarDays, Sparkles } from "lucide-react"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"

import { routes } from "../routes.js"

export function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1: Organization
  const [orgName, setOrgName] = useState("")

  // Step 2: Modules
  const [modules, setModules] = useState(["time"]) // default selected

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* Left Pane: Branding & Motivation */}
      <div style={{
        flex: 1,
        background: "linear-gradient(135deg, #0e1116 0%, #1e1b4b 100%)",
        color: "#fff",
        padding: "64px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative"
      }}>
        {/* Background Decorative Pattern */}
        <div style={{ position: "absolute", top: -100, left: -100, width: 400, height: 400, background: "#5d5fef", opacity: 0.15, filter: "blur(100px)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -50, right: 0, width: 300, height: 300, background: "#ec4899", opacity: 0.1, filter: "blur(100px)", borderRadius: "50%", pointerEvents: "none" }} />

        <div style={{ zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 64 }}>
            <CalTrackLogo size="md" showTagline />
          </div>

          <h1 style={{ fontSize: 48, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, lineHeight: 1.1, marginBottom: 24 }}>
            Smarter teams.<br />
            <span style={{ color: "#a5a6f6", fontStyle: "italic" }}>Seamless work.</span>
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", maxWidth: 400, lineHeight: 1.6 }}>
            Set up your organization in just three simple steps and unlock the power of automated workforce management.
          </p>
        </div>

        <div style={{ zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyItems: "center" }}>
              {/* Tiny avatars grid purely for aesthetics */}
              <Users2 size={24} color="#fff" style={{ margin: "auto" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Join 10,000+ organizations</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>managing millions of hours daily.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Wizard Form */}
      <div style={{
        flex: 1.3,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        padding: "64px"
      }}>
        <div style={{ width: "100%", maxWidth: 500, margin: "auto" }}>

          {/* Progress Indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            {[1, 2, 3].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, flex: s !== 3 ? 1 : 0 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800,
                  background: step > s ? "#059669" : step === s ? "#5d5fef" : "var(--bg)",
                  color: step >= s ? "#fff" : "var(--muted)",
                  transition: "all 0.3s ease"
                }}>
                  {step > s ? <Check size={16} /> : s}
                </div>
                {s !== 3 && <div style={{ flex: 1, height: 2, background: step > s ? "#059669" : "var(--stroke2)", borderRadius: 2 }} />}
              </div>
            ))}
          </div>

          {/* Step 1 Content */}
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

              <div className="field" style={{ marginBottom: 24 }}>
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

              <div className="field" style={{ marginBottom: 32 }}>
                <label className="fieldLabel" style={{ fontSize: 11, letterSpacing: 1 }}>TEAM SIZE</label>
                <select className="input" style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }}>
                  <option>1 - 10 employees</option>
                  <option>11 - 50 employees</option>
                  <option>51 - 200 employees</option>
                  <option>201+ employees</option>
                </select>
              </div>

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
                disabled={!orgName.trim()}
                style={{ width: "100%", padding: 16, background: "#5d5fef", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none" }}
              >
                CONTINUE <ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* Step 2 Content */}
          {step === 2 && (
            <div style={{ animation: "fadeUp 0.4s ease both" }}>
              <div style={{ display: "inline-flex", padding: "6px 12px", borderRadius: 20, background: "#eff0fe", color: "#5d5fef", fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 24 }}>
                <Workflow size={14} style={{ marginRight: 6 }} /> MODULE SELECTION
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: -1, margin: "0 0 12px 0", color: "var(--fg)" }}>
                What are you looking to solve?
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 32 }}>
                Select the modules you want to enable initially. You can always turn them on later from Settings.
              </p>

              <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
                {[
                  { id: "time", label: "Time Tracking", sub: "Clock in/out, timesheets, and approvals.", icon: <Clock size={20} /> },
                  { id: "leaves", label: "Leave Management", sub: "Time-off tracking, holidays, accruals.", icon: <CalendarDays size={20} /> },
                  { id: "payroll", label: "Payroll Engine", sub: "Automated calculations, payslips, exports.", icon: <Banknote size={20} /> }
                ].map(mod => {
                  const isSel = modules.includes(mod.id)
                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        if (isSel) setModules(modules.filter(m => m !== mod.id))
                        else setModules([...modules, mod.id])
                      }}
                      style={{
                        border: isSel ? "2px solid #5d5fef" : "1px solid var(--stroke2)",
                        background: isSel ? "#eff0fe" : "var(--surface)",
                        padding: "16px 20px",
                        borderRadius: 12,
                        display: "flex", alignItems: "center", gap: 16,
                        cursor: "pointer",
                        transition: "all 0.2s ease"
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

          {/* Step 3 Content */}
          {step === 3 && (
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

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <input type="email" className="input" placeholder="alice@example.com" style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }} />
                <input type="email" className="input" placeholder="bob@example.com" style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }} />
                <input type="email" className="input" placeholder="charlie@example.com" style={{ fontSize: 15, padding: "14px 16px", borderRadius: 12 }} />
              </div>

              <button className="btn btnGhost" style={{ fontSize: 13, fontWeight: 800, color: "#5d5fef", marginBottom: 32 }}>+ ADD MORE</button>

              <div style={{ display: "flex", gap: 16 }}>
                <button className="btn btnGhost" onClick={() => navigate(routes.dashboard)} style={{ padding: 16, borderRadius: 12, fontSize: 14, fontWeight: 800 }}>SKIP FOR NOW</button>
                <button
                  className="btn btnPrimary"
                  onClick={() => navigate(routes.dashboard)}
                  style={{ flex: 1, padding: 16, background: "#059669", fontSize: 14, fontWeight: 800, borderRadius: 12, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <Sparkles size={18} /> COMPLETE SETUP
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
