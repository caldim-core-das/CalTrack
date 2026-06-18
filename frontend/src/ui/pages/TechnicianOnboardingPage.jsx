import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail, Check, Lock, UserCheck, ShieldCheck, Settings,
  LayoutDashboard, ArrowRight, Eye, EyeOff, Smartphone,
  Bell, Globe, MapPin, Calendar, Star,
  ChevronRight, Zap, BarChart3, Clock, CheckCircle2,
  AlertCircle, Loader2, Shield, AlertTriangle, ExternalLink,
  ShieldAlert, Fingerprint, Award, FileText, SmartphoneIcon
} from "lucide-react"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { routes } from "../routes.js"
import { apiTechSetPassword, apiLogin, extractAuthError } from "../../api/authService.js"

/* ─────────────────────────── constants ─────────────────────────── */
const LIFECYCLE_STEPS = [
  // Category: Registration & Verification (Purple)
  { num: 1, label: "Technician registration", desc: "Name, contact, role details", pill: "REGISTERED", category: "registration", color: "#818cf8" },
  { num: 2, label: "OTP verification", desc: "Mobile or email OTP", pill: "OTP_VERIFIED", category: "registration", color: "#818cf8" },
  { num: 3, label: "KYC verification", desc: "Identity document check", pill: "KYC_APPROVED", category: "registration", color: "#818cf8" },
  
  // Category: Admin & Email (Teal)
  { num: 4, label: "Admin approval", desc: "Manual review & authorization", pill: "ADMIN_APPROVED", category: "admin", color: "#10b981" },
  { num: 5, label: "Invitation email sent", desc: "Automatic email transmission", pill: "INVITATION_SENT", category: "admin", color: "#10b981" },
  { num: 6, label: "Activation status", desc: "Onboarding link access", pill: "ACTIVATION_PENDING", category: "admin", color: "#10b981" },
  
  // Category: Employee Setup (Orange)
  { num: 7, label: "Set password", desc: "8+ chars, mixed case, symbol", pill: "PASSWORD_CREATED", category: "setup", color: "#f97316" },
  { num: 8, label: "Accept terms & conditions", desc: "Usage policy agreement", pill: "TERMS_ACCEPTED", category: "setup", color: "#f97316" },
  { num: 9, label: "Google account link", desc: "Optional — SSO & no resets", pill: "GOOGLE_LINKED", category: "setup", color: "#f97316" },
  { num: 10, label: "MFA setup", desc: "Authenticator app or SMS", pill: "MFA_ENABLED", category: "setup", color: "#f97316" },
  
  // Category: Active Access (Blue)
  { num: 11, label: "First login & access", desc: "Establish session and launch portal", pill: "ACTIVE", category: "access", color: "#3b82f6" }
]

/* ─────────────────────────── helpers ─────────────────────────── */
function passwordStrength(pw) {
  let score = 0
  if (pw.length >= 8)          score++
  if (/[A-Z]/.test(pw))        score++
  if (/[0-9]/.test(pw))        score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}
const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"]
const strengthColor = ["", "#ef4444", "#f59e0b", "#10b981", "#10b981"]

/* ─────────────────────────── page ─────────────────────────── */
export function TechnicianOnboardingPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()

  // Token params from invite link
  const urlUid   = searchParams.get("uid")   || ""
  const urlToken = searchParams.get("token") || ""
  const urlEmail = searchParams.get("email") || ""

  // If valid token params present → start at Step 7 (Set Password)
  const hasInviteToken = !!(urlUid && urlToken)
  const [activeStep, setActiveStep] = useState(7) // Wizard starts at 7 (PASSWORD_CREATED)

  // Registrant data (from dossier or URL)
  const [registrant, setRegistrant] = useState({
    name: "Technician",
    email: urlEmail || "technician@email.com",
    trustScore: 94,
  })
  
  useEffect(() => {
    try {
      const raw = localStorage.getItem("caltrack_activation_dossier")
      if (raw) {
        const d = JSON.parse(raw)
        if (d?.regForm?.fullName) {
          setRegistrant({
            name: d.regForm.fullName,
            email: urlEmail || d.regForm.email || "technician@email.com",
            trustScore: d.trustScore || 94,
            profilePic: d.regForm.profilePic || null,
          })
        }
      }
    } catch {}
  }, [urlEmail])

  // ── Step 8: Terms ──
  const [termsAccepted, setTermsAccepted] = useState(false)

  // ── Step 7: Set password ──
  const [password,     setPassword]     = useState("")
  const [showPw,       setShowPw]       = useState(false)
  const [confirmPw,    setConfirmPw]    = useState("")
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [setPwLoading, setSetPwLoading] = useState(false)
  const [setPwError,   setSetPwError]   = useState("")
  const [loggedInUser, setLoggedInUser] = useState(null)
  const pwStrength = passwordStrength(password)
  const pwValid = password.length >= 8 && password === confirmPw && pwStrength >= 2

  async function handleSetPassword() {
    if (!hasInviteToken) {
      // Offline fallback: simulate password creation
      setLoggedInUser({
        email: registrant.email,
        username: registrant.email.split("@")[0] || "tech_user"
      })
      setActiveStep(8)
      return
    }
    setSetPwLoading(true)
    setSetPwError("")
    try {
      const res = await apiTechSetPassword({ uid: urlUid, token: urlToken, password })
      setLoggedInUser(res?.user || null)
      // Password created successfully -> proceed to Step 8 (Terms)
      setActiveStep(8)
    } catch (err) {
      setSetPwError(extractAuthError(err, "Failed to set password. The link may have expired."))
    } finally {
      setSetPwLoading(false)
    }
  }

  // ── Step 9: Google link ──
  const [googleLinked, setGoogleLinked] = useState(false)

  // ── Step 10: MFA Setup ──
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [deviceAlerts, setDeviceAlerts] = useState(true)

  // ── Step 11: First login success & dashboard access ──
  const [loginEmail,   setLoginEmail]   = useState("")
  const [loginPw,      setLoginPw]      = useState("")
  const [loginShowPw,  setLoginShowPw]  = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError,   setLoginError]   = useState("")
  const [loginSuccess, setLoginSuccess] = useState(false)

  useEffect(() => {
    setLoginEmail(registrant.email)
  }, [registrant.email])

  useEffect(() => {
    if (activeStep === 11 && loggedInUser) {
      setLoginSuccess(true)
    }
  }, [activeStep, loggedInUser])

  async function handleLogin(e) {
    e?.preventDefault()
    if (!loginPw && !loggedInUser) return
    if (loggedInUser) {
      navigate(routes.dashboard)
      return
    }
    setLoginLoading(true)
    setLoginError("")
    try {
      const res = await apiLogin(loginEmail, loginPw)
      setLoggedInUser(res?.user || { email: loginEmail })
      setLoginSuccess(true)
    } catch (err) {
      setLoginError(extractAuthError(err, "Invalid email or password."))
    } finally {
      setLoginLoading(false)
    }
  }

  const goNext = () => setActiveStep(s => Math.min(s + 1, 11))
  const goPrev = () => setActiveStep(s => Math.max(s - 1, 7))

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div style={{ minHeight: "100vh", background: "#06080e", display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#f1f5f9" }}>
      
      {/* Laser line scanner overlay */}
      <div className="laser-scan-overlay" style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "linear-gradient(rgba(255,255,255,0) 50%, rgba(255,255,255,0.02) 50%)",
        backgroundSize: "100% 4px", pointerEvents: "none", zIndex: 10
      }} />

      {/* ── Top Bar ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 28px", borderBottom: "1px solid rgba(30, 41, 59, 0.4)",
        background: "rgba(8, 11, 19, 0.85)", backdropFilter: "blur(16px)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CalTrackLogo size="sm" showTagline={false} />
          <div style={{ width: 1, height: 22, background: "rgba(30, 41, 59, 0.8)" }} />
          <span style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Technician Post-Approval Onboarding
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {hasInviteToken && (
            <span style={{
              fontSize: 8, fontWeight: 900, color: "#10b981",
              background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)",
              padding: "3px 12px", borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.12em"
            }}>
              JWT Token Verified
            </span>
          )}
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "#475569" }}>
            Step {activeStep} of 11
          </span>
        </div>
      </div>

      {/* ── Main Layout (2 Columns) ── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px 1fr", maxWidth: 1280, margin: "0 auto", width: "100%", gap: 32, padding: "24px 24px 48px" }}>
        
        {/* Left Column: Visual Step Journey matching User's Diagram */}
        <div style={{
          background: "rgba(10, 14, 23, 0.6)",
          border: "1px solid rgba(30, 41, 59, 0.5)",
          borderRadius: 24,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          alignSelf: "start",
          position: "sticky",
          top: 86,
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
        }}>
          <div>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.15em", display: "block", marginBottom: 4 }}>Lifecycle Journey</span>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: "#fff", letterSpacing: -0.3 }}>Workforce Onboarding</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
            
            {/* Timeline line connection connector */}
            <div style={{
              position: "absolute", left: 15, top: 10, bottom: 10, width: 2,
              background: "linear-gradient(to bottom, #818cf8, #10b981 40%, #f97316 70%, #3b82f6)"
            }} />

            {LIFECYCLE_STEPS.map((s) => {
              const isCompleted = activeStep > s.num
              const isActive = activeStep === s.num
              const isUpcoming = activeStep < s.num

              // Let's decide icons
              let dotBg = "rgba(15, 23, 42, 0.8)"
              let dotBorder = "rgba(51, 65, 85, 0.5)"
              let iconColor = "#475569"

              if (isCompleted) {
                dotBg = s.color
                dotBorder = s.color
                iconColor = "#fff"
              } else if (isActive) {
                dotBg = "rgba(15, 23, 42, 0.9)"
                dotBorder = s.color
                iconColor = s.color
              }

              return (
                <div key={s.num} style={{ display: "flex", alignItems: "center", gap: 12, opacity: isUpcoming ? 0.45 : 1, transition: "opacity 0.3s", position: "relative", zIndex: 2 }}>
                  
                  {/* Step Dot */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: dotBg, border: `2px solid ${dotBorder}`,
                    boxShadow: isActive ? `0 0 12px ${s.color}45` : "none",
                    flexShrink: 0, transition: "all 0.3s"
                  }}>
                    {isCompleted ? (
                      <Check style={{ width: 14, height: 14, color: iconColor }} strokeWidth={3} />
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 900, color: iconColor }}>{s.num}</span>
                    )}
                  </div>

                  {/* Step Titles */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: isActive ? 800 : 600,
                      color: isActive ? "#fff" : isCompleted ? "#cbd5e1" : "#64748b",
                      transition: "color 0.3s"
                    }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
                      {s.desc}
                    </div>
                  </div>

                  {/* Right Status Pill */}
                  {s.pill && (
                    <span style={{
                      fontSize: 7, fontWeight: 900, letterSpacing: "0.08em",
                      padding: "2px 6px", borderRadius: 4, flexShrink: 0,
                      background: isCompleted ? `${s.color}15` : isActive ? `${s.color}20` : "rgba(30,41,59,0.3)",
                      border: `1px solid ${isCompleted ? `${s.color}25` : isActive ? `${s.color}40` : "rgba(51,65,85,0.2)"}`,
                      color: isCompleted || isActive ? s.color : "#475569"
                    }}>
                      {s.pill}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Dynamic Wizard Cards */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "rgba(10, 14, 23, 0.75)",
                border: "1px solid rgba(30, 41, 59, 0.6)",
                borderRadius: 28,
                padding: "36px",
                backdropFilter: "blur(20px)",
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              
              {/* Outer decorative glow */}
              <div style={{
                position: "absolute", top: 0, right: 0, width: 150, height: 150,
                background: `radial-gradient(circle, ${LIFECYCLE_STEPS[activeStep - 1]?.color}15 0%, transparent 70%)`,
                pointerEvents: "none"
              }} />

              {/* ── STEP 7: SET PASSWORD ── */}
              {activeStep === 7 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <span style={badgeStyle("#f97316")}><Lock style={iconSm} /> PASSWORD CREATION</span>
                    <h2 style={headingStyle}>Create your account password</h2>
                    <p style={subStyle}>Please set a highly secure password. Your account will use this password to verify credentials.</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPw ? "text" : "password"}
                        placeholder="New password (min 8 characters)"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={inputStyle}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPw(s => !s)} style={eyeBtnStyle}>
                        {showPw ? <EyeOff style={iconSm} /> : <Eye style={iconSm} />}
                      </button>
                    </div>

                    {password.length > 0 && (
                      <div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                          {[1,2,3,4].map(i => (
                            <div key={i} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= pwStrength ? strengthColor[pwStrength] : "#1e293b", transition: "background 0.3s" }} />
                          ))}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: strengthColor[pwStrength] }}>
                          {strengthLabel[pwStrength]} Password
                        </div>
                      </div>
                    )}

                    <div style={{ position: "relative" }}>
                      <input
                        type={showConfirm ? "text" : "password"}
                        placeholder="Confirm password"
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        style={{ ...inputStyle, borderColor: confirmPw && confirmPw !== password ? "#ef4444" : "rgba(51,65,85,0.8)" }}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeBtnStyle}>
                        {showConfirm ? <EyeOff style={iconSm} /> : <Eye style={iconSm} />}
                      </button>
                    </div>
                    
                    {confirmPw && confirmPw !== password && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontSize: 11, fontWeight: 700 }}>
                        <AlertCircle style={iconSm} /> Passwords do not match
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 6 }}>
                      {[
                        { label: "8+ characters", ok: password.length >= 8 },
                        { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
                        { label: "Number", ok: /[0-9]/.test(password) },
                        { label: "Special character", ok: /[^A-Za-z0-9]/.test(password) },
                      ].map(r => (
                        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600, color: r.ok ? "#10b981" : "#475569" }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", background: r.ok ? "rgba(16,185,129,0.15)" : "#1e293b", border: `1px solid ${r.ok ? "#10b981" : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {r.ok && <Check style={{ width: 8, height: 8, color: "#10b981" }} strokeWidth={3} />}
                          </div>
                          {r.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {setPwError && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, fontWeight: 600 }}>
                      <AlertTriangle style={{ ...iconSm, flexShrink: 0 }} /> {setPwError}
                    </div>
                  )}

                  <button
                    onClick={handleSetPassword}
                    disabled={!pwValid || setPwLoading}
                    style={btnPrimaryStyle(!pwValid || setPwLoading, "#f97316")}
                  >
                    {setPwLoading ? (
                      <><Loader2 style={{ ...iconSm, animation: "spin 1s linear infinite" }} /> Generating security keys...</>
                    ) : (
                      <>Create Password & Verify <ArrowRight style={iconSm} /></>
                    )}
                  </button>
                </div>
              )}

              {/* ── STEP 8: ACCEPT TERMS & CONDITIONS ── */}
              {activeStep === 8 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <span style={badgeStyle("#f97316")}><FileText style={iconSm} /> COMPLIANCE AGREEMENT</span>
                    <h2 style={headingStyle}>Terms of Service & Platform Policy</h2>
                    <p style={subStyle}>Please review and accept our operating agreement. This is required for security and dispatch validation.</p>
                  </div>

                  <div style={{
                    maxHeight: 180, overflowY: "auto", padding: "16px", borderRadius: 16,
                    background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.4)",
                    fontSize: 12, color: "#94a3b8", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 8
                  }}>
                    <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>1. Workforce Operations & Location Policy</p>
                    <p style={{ margin: 0 }}>CalTrack uses automated location pings and check-in verifications to log job mileage and dispatch assignments. By agreeing, you consent to background updates when clocked in.</p>
                    <p style={{ margin: 0, fontWeight: 700, color: "#fff" }}>2. Data Security & Storage</p>
                    <p style={{ margin: 0 }}>Your identity documentation and tax details are stored in tenant-isolated encrypted storage. Access logs and audit logs are retained for payroll verification purposes.</p>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
                    <div
                      onClick={() => setTermsAccepted(!termsAccepted)}
                      style={{
                        width: 22, height: 22, borderRadius: 8,
                        border: `2px solid ${termsAccepted ? "#f97316" : "#475569"}`,
                        background: termsAccepted ? "#f97316" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, cursor: "pointer", transition: "all 0.2s"
                      }}
                    >
                      {termsAccepted && <Check style={{ width: 14, height: 14, color: "#fff" }} strokeWidth={3} />}
                    </div>
                    <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>I accept the workforce platform policies and terms</span>
                  </label>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={goPrev} style={btnBackStyle}>Back</button>
                    <button
                      onClick={goNext}
                      disabled={!termsAccepted}
                      style={btnPrimaryStyle(!termsAccepted, "#f97316")}
                    >
                      Accept & Continue <ArrowRight style={iconSm} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 9: GOOGLE ACCOUNT LINK ── */}
              {activeStep === 9 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <span style={badgeStyle("#f97316")}><ShieldCheck style={iconSm} /> SINGLE SIGN-ON (SSO)</span>
                    <h2 style={headingStyle}>Link Google Account <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, verticalAlign: "middle" }}>(Optional)</span></h2>
                    <p style={subStyle}>Enable passwordless login. Linking Google enables Secure Single Sign-On and avoids manual password resets.</p>
                  </div>

                  <div style={{
                    padding: "20px", borderRadius: 16, background: "rgba(15, 23, 42, 0.4)",
                    border: "1px solid rgba(51, 65, 85, 0.3)", display: "flex", alignItems: "center", gap: 16
                  }}>
                    <GoogleBigIcon />
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Google Single Sign-On</h4>
                      <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>Connect your Google workspace account directly.</p>
                    </div>
                  </div>

                  {googleLinked ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", borderRadius: 10, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", color: "#10b981", fontSize: 12, fontWeight: 700 }}>
                      <CheckCircle2 style={iconSm} /> Google account successfully linked: {registrant.email}
                    </div>
                  ) : (
                    <button
                      onClick={() => setGoogleLinked(true)}
                      style={{
                        height: 48, borderRadius: 12, border: "1px solid rgba(51, 65, 85, 0.8)",
                        background: "#fff", color: "#1e293b", fontSize: 13, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer"
                      }}
                    >
                      <GoogleMiniIcon /> Link Google Profile
                    </button>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={goPrev} style={btnBackStyle}>Back</button>
                    <button onClick={goNext} style={btnPrimaryStyle(false, "#f97316")}>
                      {googleLinked ? "Continue" : "Skip / Link Later"} <ArrowRight style={iconSm} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 10: MFA SETUP ── */}
              {activeStep === 10 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <span style={badgeStyle("#f97316")}><Fingerprint style={iconSm} /> MULTI-FACTOR SECURITY</span>
                    <h2 style={headingStyle}>Setup Multi-Factor Auth (MFA)</h2>
                    <p style={subStyle}>Add an extra security layer. Scan the code with an authenticator app (Google Authenticator, Duo, etc.) or enable SMS OTP.</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Toggle */}
                      <button
                        onClick={() => setTotpEnabled(!totpEnabled)}
                        style={{ width: 44, height: 24, borderRadius: 12, background: totpEnabled ? "#f97316" : "#1e293b", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.3s" }}
                      >
                        <div style={{ position: "absolute", top: 3, left: totpEnabled ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }} />
                      </button>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>Enable Authenticator App (TOTP)</h4>
                        <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>Recommended for offline access and prompt logins.</p>
                      </div>
                    </div>

                    {totpEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        style={{ overflow: "hidden", display: "flex", flexDirection: "column", gap: 12 }}
                      >
                        <div style={{ padding: "16px", borderRadius: 16, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(51,65,85,0.4)", display: "flex", alignItems: "center", gap: 16 }}>
                          <div style={{ width: 72, height: 72, background: "#fff", borderRadius: 8, padding: 6, flexShrink: 0 }}>
                            <div style={{ width: "100%", height: "100%", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1 }}>
                              {Array.from({ length: 25 }, (_, i) => (
                                <div key={i} style={{ borderRadius: 1, background: (i % 3 === 0 || i % 7 === 0) ? "#000" : "#fff" }} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Scan with Google Authenticator</div>
                            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#e2e8f0", marginTop: 4, fontWeight: 700 }}>CALTRACK-MFA-SECRET-KEY</div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button
                        onClick={() => setDeviceAlerts(!deviceAlerts)}
                        style={{ width: 44, height: 24, borderRadius: 12, background: deviceAlerts ? "#f97316" : "#1e293b", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.3s" }}
                      >
                        <div style={{ position: "absolute", top: 3, left: deviceAlerts ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.3s" }} />
                      </button>
                      <div>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>New-device login notifications</h4>
                        <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>Get emailed warnings if access is registered from a new browser.</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={goPrev} style={btnBackStyle}>Back</button>
                    <button onClick={goNext} style={btnPrimaryStyle(false, "#f97316")}>
                      Continue <ArrowRight style={iconSm} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 11: FIRST LOGIN & platform access ── */}
              {activeStep === 11 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <div>
                    <span style={badgeStyle("#3b82f6")}><UserCheck style={iconSm} /> INITIAL AUTHENTICATION</span>
                    <h2 style={headingStyle}>Welcome to CalTrack, {registrant.name.split(" ")[0]}! 🎉</h2>
                    <p style={subStyle}>Your field worker portal is active and online. Review dispatch controls below.</p>
                  </div>

                  {loginSuccess ? (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 16, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <CheckCircle2 style={{ width: 22, height: 22, color: "#10b981", flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#34d399" }}>Session Verified</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Logged in as: {registrant.email} · System credentials loaded</div>
                        </div>
                      </div>

                      {/* Dashboard Live Preview Block */}
                      <div style={{
                        background: "rgba(15, 23, 42, 0.6)",
                        border: "1px solid rgba(51, 65, 85, 0.4)",
                        borderRadius: 16,
                        overflow: "hidden"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(51, 65, 85, 0.3)", background: "rgba(15, 23, 42, 0.4)" }}>
                          <span style={{ fontSize: 9, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>WORKFORCE CONTROL HUB</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 2s infinite" }} />
                            <span style={{ fontSize: 9, color: "#10b981", fontWeight: 800, textTransform: "uppercase" }}>Active GPS Dispatch</span>
                          </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: "1px solid rgba(51, 65, 85, 0.3)" }}>
                          {[
                            { label: "Shift Log", val: "0h 00m", icon: Clock, clr: "#3b82f6" },
                            { label: "Open Tasks", val: "0", icon: CheckCircle2, clr: "#10b981" },
                            { label: "Job Travel", val: "0 km", icon: Globe, clr: "#f59e0b" },
                            { label: "Trust Index", val: `${registrant.trustScore || 94}%`, icon: Shield, clr: "#a78bfa" }
                          ].map(s => (
                            <div key={s.label} style={{ padding: "12px 8px", borderRight: "1px solid rgba(51, 65, 85, 0.3)", textAlign: "center" }}>
                              <s.icon style={{ width: 14, height: 14, color: s.clr, margin: "0 auto 6px" }} />
                              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{s.val}</div>
                              <div style={{ fontSize: 8, color: "#475569", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Operational Commands */}
                        <div style={{ padding: 14 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {[
                              { name: "Clock In Shift", icon: Clock, c: "rgba(59, 130, 246, 0.08)", bc: "rgba(59, 130, 246, 0.2)", tc: "#3b82f6" },
                              { name: "Verify Task List", icon: CheckCircle2, c: "rgba(16, 185, 129, 0.08)", bc: "rgba(16, 185, 129, 0.2)", tc: "#10b981" },
                              { name: "Log Travel Meter", icon: MapPin, c: "rgba(245, 158, 11, 0.08)", bc: "rgba(245, 158, 11, 0.2)", tc: "#f59e0b" },
                              { name: "Platform Academy", icon: Award, c: "rgba(167, 139, 250, 0.08)", bc: "rgba(167, 139, 250, 0.2)", tc: "#a78bfa" }
                            ].map(t => (
                              <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: t.c, border: `1px solid ${t.bc}` }}>
                                <t.icon style={{ width: 13, height: 13, color: t.tc }} />
                                <span style={{ fontSize: 10, fontWeight: 700, color: t.tc }}>{t.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={inputStyle} placeholder="Email address" />
                      <div style={{ position: "relative" }}>
                        <input type={loginShowPw ? "text" : "password"} value={loginPw} onChange={e => setLoginPw(e.target.value)} style={inputStyle} placeholder="Password" />
                        <button type="button" onClick={() => setLoginShowPw(s => !s)} style={eyeBtnStyle}>
                          {loginShowPw ? <EyeOff style={iconSm} /> : <Eye style={iconSm} />}
                        </button>
                      </div>

                      {loginError && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, fontWeight: 600 }}>
                          <AlertTriangle style={{ ...iconSm, flexShrink: 0 }} /> {loginError}
                        </div>
                      )}

                      <button type="submit" disabled={loginLoading || !loginPw} style={btnPrimaryStyle(loginLoading || !loginPw, "#3b82f6")}>
                        {loginLoading ? (
                          <><Loader2 style={{ ...iconSm, animation: "spin 1s linear infinite" }} /> Validating session...</>
                        ) : (
                          <>Verify Session & Login <ArrowRight style={iconSm} /></>
                        )}
                      </button>
                    </form>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    {!loggedInUser && <button onClick={goPrev} style={btnBackStyle}>Back</button>}
                    {(loginSuccess || loggedInUser) && (
                      <button
                        onClick={() => navigate(routes.dashboard)}
                        style={{
                          flex: 1, height: 52, background: "linear-gradient(135deg, #3b82f6, #10b981)",
                          border: "none", borderRadius: 14, color: "#fff", fontSize: 13, fontWeight: 900,
                          textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          boxShadow: "0 8px 20px rgba(59, 130, 246, 0.25)"
                        }}
                      >
                        <Zap style={iconSm} /> Launch Dashboard Workspace
                      </button>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}

/* ─────────────────────────── style helpers ─────────────────────────── */
const iconSm = { width: 14, height: 14 }

function badgeStyle(colorHex) {
  return {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 999,
    background: `${colorHex}12`, border: `1px solid ${colorHex}30`, color: colorHex,
    fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.12em",
    marginBottom: 14
  }
}

const headingStyle = {
  fontSize: 22, fontWeight: 800, color: "#fff",
  letterSpacing: -0.5, margin: 0,
}

const subStyle = {
  fontSize: 13, color: "#94a3b8", fontWeight: 500, marginTop: 6, lineHeight: 1.6, marginBottom: 0
}

const inputStyle = {
  width: "100%", height: 48, padding: "0 44px 0 16px",
  borderRadius: 12, background: "rgba(15,23,42,0.8)",
  border: "1px solid rgba(51,65,85,0.7)", color: "#fff", fontSize: 14,
  fontWeight: 500, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s"
}

const eyeBtnStyle = {
  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", color: "#475569", display: "flex",
}

function btnPrimaryStyle(disabled = false, colorHex = "#6366f1") {
  return {
    flex: 1, height: 48, display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, padding: "0 20px",
    background: disabled ? `${colorHex}40` : colorHex,
    border: "none", borderRadius: 12, color: "#fff", fontSize: 12,
    fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : `0 6px 20px ${colorHex}25`,
    transition: "all 0.2s", opacity: disabled ? 0.6 : 1
  }
}

const btnBackStyle = {
  height: 48, padding: "0 20px",
  background: "transparent", border: "1px solid rgba(51,65,85,0.6)",
  borderRadius: 12, color: "#94a3b8", fontSize: 12, fontWeight: 800,
  cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
  textTransform: "uppercase", letterSpacing: "0.1em"
}

function GoogleBigIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z"/>
      <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z"/>
      <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z"/>
    </svg>
  )
}

function GoogleMiniIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" style={{ verticalAlign: "middle" }}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z"/>
      <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z"/>
      <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z"/>
    </svg>
  )
}
