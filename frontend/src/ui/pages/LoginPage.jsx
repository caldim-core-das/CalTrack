import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "../../state/auth/useAuth.js"
import { extractAuthError, apiDeleteRegistrationDossier, API_BASE_URL } from "../../api/authService.js"

import { validateLoginForm } from "../../utils/validate.js"
import { routes } from "../routes.js"
import { useGoogleLogin } from "@react-oauth/google"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { RefreshCcw, AlertCircle, Eye, EyeOff, Mail, Lock, X, ArrowRight, Check, User, ShieldCheck, CheckCircle2, ExternalLink } from "lucide-react"
import IntroAnimation from "../../components/ui/scroll-morph-hero"


/* ─── Card dimensions ─── */
const CW = 220
const CH = 140

/* ─── Card grid layout — 4 columns x 3 rows, centered in visible area ─── */
const CARDS = [
  // Row 1 (top)
  {
    id: 1, src: "/mockups/caltrack_dashboard_mockup_1778231495839.png", x: -250, y: -150, z: 80, r: -6,
    title: "Executive Dashboard",
    desc: "1. Real-time KPI overview with productivity scores\n2. Total labor cost tracking across departments\n3. Employee engagement metrics with trend analysis\n4. Active headcount monitoring per location\n5. Monthly labor cost trend with bar & line charts\n6. Productivity score distribution (donut chart)\n7. AI-driven anomaly detection alerts\n8. Top productive teams ranking table\n9. Department-wise cost breakdown\n10. One-click drill-down into any metric"
  },
  {
    id: 2, src: "/mockups/caltrack_scheduling_mockup_1778231584856.png", x: -80, y: -160, z: 50, r: 4,
    title: "Smart Scheduling",
    desc: "1. Drag-and-drop shift assignment calendar\n2. Auto-fill shifts based on availability rules\n3. Overtime threshold alerts & compliance flags\n4. Shift swap requests with manager approval\n5. Break scheduling with labor law compliance\n6. Multi-location coverage visualization\n7. Skills-based shift matching engine\n8. Recurring schedule templates\n9. Real-time understaffing notifications\n10. Export schedules to PDF or calendar sync"
  },
  {
    id: 3, src: "/mockups/caltrack_live_map_mockup_1778231560076.png", x: 80, y: -145, z: 70, r: -3,
    title: "Live Tracking Map",
    desc: "1. Real-time GPS tracking of field employees\n2. Geofenced work zones with entry/exit alerts\n3. Route history playback for each worker\n4. Active employee count per zone\n5. Speed and movement status indicators\n6. Site boundary polygon editor\n7. Employee activity feed with timestamps\n8. Satellite and road map toggle views\n9. Restricted zone violation notifications\n10. Multi-site dashboard with zone summaries"
  },
  {
    id: 4, src: "/mockups/caltrack_mobile_app_mockup_1778231517495.png", x: 250, y: -155, z: 40, r: 8,
    title: "Mobile Field App",
    desc: "1. Geolocation-based punch in/out\n2. Selfie verification at clock-in\n3. Weekly timesheet with daily hours\n4. Current week total and pending approvals\n5. Geolocation map with red pin for HQ\n6. Face verification capture & validation\n7. Activity feed with task assignments\n8. Break timer with auto-deduction\n9. Push notifications for schedule changes\n10. Offline mode with auto-sync on reconnect"
  },
  // Row 2 (middle)
  {
    id: 5, src: "/mockups/caltrack_analytics_mockup_1778231608789.png", x: -220, y: 0, z: 60, r: 5,
    title: "Workforce Analytics",
    desc: "1. Attendance trend analysis over 12 months\n2. Department-level productivity heatmap\n3. Overtime distribution across teams\n4. Late arrival pattern detection\n5. Leave utilization rate by category\n6. Cost-per-employee benchmarking\n7. Predictive staffing recommendations\n8. Custom date range filtering\n9. Export reports to Excel/PDF\n10. Scheduled report email delivery"
  },
  {
    id: 6, src: "/mockups/caltrack_payroll_mockup_1778231538875.png", x: -60, y: 10, z: 90, r: -4,
    title: "Payroll Processing",
    desc: "1. Automated payroll calculation from timesheets\n2. Tax deduction and compliance engine\n3. Overtime rate multiplier configuration\n4. Department-wise salary breakdown\n5. Bonus and incentive management\n6. Payslip generation with PDF export\n7. Bank transfer file generation\n8. Year-to-date earnings summary\n9. Multi-currency support for global teams\n10. Audit trail for all payroll changes"
  },
  {
    id: 7, src: "/mockups/caltrack_dashboard_mockup_1778231495839.png", x: 100, y: -5, z: 30, r: 3,
    title: "Performance Overview",
    desc: "1. Individual employee performance scores\n2. Team comparison leaderboards\n3. Goal tracking with progress bars\n4. Performance review cycle management\n5. 360-degree feedback collection\n6. Skill gap analysis visualization\n7. Training completion tracking\n8. Monthly performance trend lines\n9. Manager notes and action items\n10. Integration with HR systems"
  },
  {
    id: 8, src: "/mockups/caltrack_live_map_mockup_1778231560076.png", x: 260, y: 5, z: 55, r: -7,
    title: "Zone Management",
    desc: "1. Custom geofence zone creation\n2. Multi-polygon boundary drawing\n3. Zone-based attendance rules\n4. Entry/exit time logging per zone\n5. Restricted area access control\n6. Zone capacity monitoring\n7. Historical zone activity reports\n8. Alert configuration per zone\n9. Integration with access control systems\n10. Zone-wise labor cost allocation"
  },
  // Row 3 (bottom)
  {
    id: 9, src: "/mockups/caltrack_mobile_app_mockup_1778231517495.png", x: -240, y: 150, z: 35, r: 6,
    title: "Employee Self-Service",
    desc: "1. Personal profile and document management\n2. Leave request submission with calendar\n3. Timesheet review and approval status\n4. Expense claim submission with receipts\n5. Team directory with org chart\n6. Company announcements feed\n7. Benefits enrollment dashboard\n8. Training module access\n9. Helpdesk ticket creation\n10. Personal analytics and hours summary"
  },
  {
    id: 10, src: "/mockups/caltrack_scheduling_mockup_1778231584856.png", x: -70, y: 155, z: 65, r: -5,
    title: "Shift Planning",
    desc: "1. Weekly and monthly shift calendar views\n2. Employee availability preferences\n3. Conflict detection and resolution\n4. Minimum rest period enforcement\n5. Holiday and leave integration\n6. Cost optimization suggestions\n7. Bulk shift assignment tools\n8. Notification to employees on changes\n9. Coverage gap highlighting\n10. Historical shift pattern analytics"
  },
  {
    id: 11, src: "/mockups/caltrack_payroll_mockup_1778231538875.png", x: 90, y: 145, z: 45, r: 4,
    title: "Compensation Reports",
    desc: "1. Comprehensive salary reports by department\n2. Overtime cost analysis and trends\n3. Benefits cost per employee tracking\n4. Tax liability forecasting\n5. Budget vs actual labor cost comparison\n6. Compensation band analysis\n7. Equal pay audit reports\n8. Contractor vs employee cost analysis\n9. Annual compensation review tools\n10. Custom report builder with filters"
  },
  {
    id: 12, src: "/mockups/caltrack_analytics_mockup_1778231608789.png", x: 240, y: 160, z: 75, r: -8,
    title: "Insights Engine",
    desc: "1. AI-powered workforce trend predictions\n2. Attrition risk scoring per employee\n3. Engagement survey result analysis\n4. Absenteeism pattern recognition\n5. Seasonal demand forecasting\n6. Cost saving opportunity identification\n7. Benchmark against industry standards\n8. Custom KPI dashboard builder\n9. Real-time data pipeline monitoring\n10. Automated insight notifications"
  },
].map(card => ({
  ...card,
  src: card.src.startsWith("http") ? card.src : `${import.meta.env.BASE_URL || "/"}${card.src.replace(/^\//, "")}`
}))

/* ─── FLOATING CYBER CARD ─── */
function HoloCard({ card, index, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -10 - (index % 3) * 4, 0],
      }}
      transition={{
        opacity: { duration: 0.8, delay: 0.05 + index * 0.04, ease: [0.16, 1, 0.3, 1] },
        scale: { duration: 0.8, delay: 0.05 + index * 0.04, ease: [0.16, 1, 0.3, 1] },
        y: {
          duration: 4.5 + (index % 4) * 0.7,
          repeat: Infinity,
          ease: "easeInOut"
        }
      }}
      style={{
        position: "absolute",
        width: CW,
        height: CH,
        left: `calc(50% - ${CW / 2}px)`,
        top: `calc(50% - ${CH / 2}px)`,
        x: card.x * 1.05,
        y: card.y,
        zIndex: card.z + 300,
        rotate: card.r,
        contain: "layout style paint",
        willChange: "transform",
      }}
      className="cursor-pointer group"
      onClick={() => onSelect(card)}
      whileHover={{
        scale: 1.15,
        zIndex: 999,
        rotate: 0,
        transition: { type: "spring", stiffness: 450, damping: 20 },
      }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden bg-slate-950/40 backdrop-blur-md border border-cyan-500/15 group-hover:border-cyan-400/50 shadow-[0_4px_30px_rgba(0,0,0,0.4)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] transition-all duration-300 relative flex items-center justify-center p-1">
        <img
          src={card.src}
          alt=""
          draggable={false}
          loading="lazy"
          className="w-full h-full object-cover rounded-xl select-none pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-300"
        />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-2.5 left-3.5 text-[8px] font-mono text-cyan-400/60 group-hover:text-cyan-400 tracking-widest uppercase transition-colors">SYS // 0{card.id}</div>
        <div className="absolute bottom-2.5 right-3.5 text-[8px] font-mono text-cyan-500/50 group-hover:text-cyan-400/80 transition-colors">COORD-{12 + card.id}</div>
      </div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN — LoginPage
   ═══════════════════════════════════════════════════════════════════ */
export function LoginPage() {
  const { login, loginWithGoogle, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState("signin")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [orgName, setOrgName] = useState("")
  const [numEmployees, setNumEmployees] = useState("1 - 10 employees")
  const [regStep, setRegStep] = useState(1)
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [agreedUpdates, setAgreedUpdates] = useState(true)
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [employeeStatus, setEmployeeStatus] = useState(null)
  const [dossierInfo, setDossierInfo] = useState(null)
  const [resetLink, setResetLink] = useState("")
  const [linkSent, setLinkSent] = useState(false)
  const [showFailedLogin, setShowFailedLogin] = useState(false)
  const [failedIdentity, setFailedIdentity] = useState("")
  const [failedReason, setFailedReason] = useState("")
  const [identityInput, setIdentityInput] = useState("")
  const [identityScanning, setIdentityScanning] = useState(false)
  const [identityVerified, setIdentityVerified] = useState(false)
  const [verifiedEmployeeId, setVerifiedEmployeeId] = useState("")
  const [verifiedName, setVerifiedName] = useState("")
  const [verifiedDepartment, setVerifiedDepartment] = useState("")
  const [verifiedEmailMasked, setVerifiedEmailMasked] = useState("")
  const [verifiedEmail, setVerifiedEmail] = useState("")
  const [generationPhase, setGenerationPhase] = useState(0) // 0: idle, 1: scanning/animating, 2: link generated
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationLog, setGenerationLog] = useState("")

  const ONBOARDING_DISMISSED_KEY = "caltrack.onboarding.dismissed"
  const postLoginRoute = (usr) => {
    const role = usr?.role
    const isAdmin = role === "admin" || role === "manager"
    if (!isAdmin) return routes.dashboard
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true"
    return dismissed ? routes.dashboard : routes.get_started
  }

  const googleLoginHandler = useGoogleLogin({
    onSuccess: async (tr) => {
      setLoading(true)
      try { 
        const u = await loginWithGoogle(tr.access_token)
        navigate(postLoginRoute(u), { replace: true }) 
      }
      catch (err) { setError(extractAuthError(err, "Google login failed.")) }
      finally { setLoading(false) }
    },
    onError: () => setError("Google login failed.")
  })

  const handleRetryAuth = () => {
    setShowFailedLogin(false)
    setError("")
    setPassword("")
  }

  const handleStartRecovery = () => {
    setShowFailedLogin(false)
    setError("")
    setIdentityInput(failedIdentity || username || "")
    setIdentityVerified(false)
    setGenerationPhase(0)
    setGenerationProgress(0)
    setLinkSent(false)
    setResetLink("")
    setMode("forgot_password")
  }

  const handleScanIdentity = async (e) => {
    if (e) e.preventDefault()
    if (!identityInput.trim()) {
      setError("Workforce Identity is required")
      return
    }
    setError("")
    setIdentityScanning(true)
    
    await new Promise(r => setTimeout(r, 1500))
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset/verify-identity/`, {
        method: "POST",

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity: identityInput.trim() })
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Workforce identity validation failed.")
      }
      const data = await response.json()
      setVerifiedEmployeeId(data.employee_id)
      setVerifiedName(data.name)
      setVerifiedDepartment(data.department)
      setVerifiedEmail(data.email)
      setVerifiedEmailMasked(data.email_masked)
      setIdentityVerified(true)
    } catch (err) {
      setError(err.message || "Failed to verify identity.")
    } finally {
      setIdentityScanning(false)
    }
  }

  const handleInitiateRecoverySequence = () => {
    setGenerationPhase(1)
    setGenerationProgress(0)
    setGenerationLog("Initializing quantum reset telemetry...")
    
    const logs = [
      { progress: 15, log: "Performing digital AI scan..." },
      { progress: 40, log: "Blue particle flow calibration..." },
      { progress: 70, log: "Security shield activation active..." },
      { progress: 90, log: "Mail transmission beam configured..." },
      { progress: 100, log: "Encrypted recovery token generated." }
    ]
    
    let currentProgress = 0
    const interval = setInterval(() => {
      currentProgress += 5
      setGenerationProgress(currentProgress)
      
      const matchingLog = logs.find(l => currentProgress === l.progress || (currentProgress > l.progress && currentProgress - 5 < l.progress))
      if (matchingLog) {
        setGenerationLog(matchingLog.log)
      }
      
      if (currentProgress >= 100) {
        clearInterval(interval)
        setGenerationPhase(2)
      }
    }, 120)
  }

  const handleTransmitRecovery = async () => {
    setLoading(true)
    setError("")
    try {
      const { apiPasswordResetRequest } = await import("../../api/authService.js")
      const res = await apiPasswordResetRequest(verifiedEmail)
      if (res.reset_url) {
        setResetLink(res.reset_url)
      } else {
        setResetLink("")
      }
      setLinkSent(true)
    } catch (err) {
      setError(extractAuthError(err, "Failed to transmit recovery sequence."))
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(e) {
    if (e) e.preventDefault()
    if (loading) return
    setError("")
    if (mode === "signin") {
      const ve = validateLoginForm({ identifier: username, password })
      if (ve) return setError(ve)
      setLoading(true)

      try { 
        const u = await login(username.trim(), password)
        if (!u) {
          setError("Login failed. Please check your credentials and try again.")
          setFailedIdentity(username)
          setFailedReason("Unable to retrieve user profile after successful login.")
          setShowFailedLogin(true)
          return
        }
        const savedDossier = localStorage.getItem("caltrack_activation_dossier")
        if (savedDossier && u.role === "employee") {
          try {
            const parsed = JSON.parse(savedDossier)
            const dossierEmail = (parsed.regForm?.email || "").trim().toLowerCase()
            const inputEmail = (u.email || "").trim().toLowerCase()
            const inputUsername = (u.username || "").trim().toLowerCase()
            const isMatch = inputEmail === dossierEmail || inputUsername === dossierEmail.split("@")[0]
            
            if (isMatch) {
              const status = parsed.adminClearance?.status
              if (status === "approved" || status === "rejected") {
                setEmployeeStatus(status)
                setDossierInfo(parsed)
                setLoading(false)
                return
              }
            }
          } catch (e) {
            console.error("Dossier parse error", e)
          }
        }
        navigate(postLoginRoute(u), { replace: true }) 
      }
      catch (err) { 
        const errMsg = extractAuthError(err, "Login failed.")
        setError(errMsg) 
        setFailedIdentity(username)
        setFailedReason(errMsg)
        setShowFailedLogin(true)
      }
      finally { setLoading(false) }
    } else {
      setLoading(true)
      try {
        const [first, ...rest] = fullName.trim().split(" ")
        const u = await register({ username: username.trim(), password, email: email.trim(), first_name: first || "", last_name: rest.join(" ") || "", organization_name: orgName.trim() })
        navigate(postLoginRoute(u), { replace: true })
      } catch (err) { setError(extractAuthError(err, "Registration failed.")) }
      finally { setLoading(false) }
    }
  }

  return (
    <div className="flex min-h-screen bg-[#03050d] text-slate-100 font-body overflow-hidden relative w-full">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 99px; }
      `}</style>

      {/* ═══════════════════ LEFT PANEL — 60 % ═══════════════════ */}
      <div className="hidden lg:flex flex-col w-[60%] bg-[#FAFAFA] relative overflow-hidden">
        {/* Logo Overlay */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="absolute top-6 left-0 right-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto">
            <CalTrackLogo size="lg" showTagline={false} />
          </div>
        </motion.div>        {/* Intro Animation / Scroll Morph Hero */}
        {mode === "forgot_password" ? (
          <div className="flex-1 flex flex-col justify-center items-center p-12 text-slate-800 z-10 select-none relative h-full w-full">
            {/* Holographic grids and scanline */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#4f46e5 2px, transparent 2px)", backgroundSize: "40px 40px" }} />
            <div className="absolute w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
            
            {/* HUD Scanline */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-40 animate-pulse pointer-events-none" style={{ animationDuration: '3s' }} />

            <div className="max-w-md text-center space-y-8 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-6"
              >
                <div className="w-20 h-20 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-600 shadow-md">
                  <ShieldCheck size={40} className="animate-pulse" />
                </div>

                <div className="space-y-3">
                  <h1 className="text-3xl md:text-4xl font-display font-black text-slate-900 leading-tight tracking-tight">
                    Recover Your Workforce Identity
                  </h1>
                  <p className="text-xs font-mono uppercase text-indigo-600 font-bold tracking-widest">
                    Secure. Encrypted. Intelligent.
                  </p>
                  <p className="text-sm font-semibold text-slate-600 leading-relaxed max-w-sm mx-auto">
                    Restore access to your CALtrack account through our AI-powered recovery system.
                  </p>
                </div>
              </motion.div>


            </div>
          </div>
        ) : (
          <div className="flex-1 w-full h-full relative z-10">
            <IntroAnimation
              cards={CARDS}
              onSelectCard={setSelected}
            />
          </div>
        )}




        {/* ── Full-screen Preview Modal ── */}
        <AnimatePresence>
          {selected && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute inset-0 z-[1999] bg-slate-950/60 backdrop-blur-xl"
                onClick={() => setSelected(null)}
              />

              {/* Preview — fills entire left panel */}
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 z-[2000] flex flex-col bg-slate-950 border border-slate-900 shadow-2xl"
                onClick={() => setSelected(null)}
              >
                {/* Title bar */}
                <div className="px-8 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0" onClick={(e) => e.stopPropagation()}>
                  <h2 className="text-white text-base font-display font-bold tracking-tight">{selected.title}</h2>
                  <button
                    onClick={() => setSelected(null)}
                    className="bg-slate-800 hover:bg-slate-700 rounded-full p-2 text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Image */}
                <div className="flex-1 min-h-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <img
                    src={selected.src}
                    alt={selected.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Workflow description — compact glass overlay */}
                <div className="absolute bottom-0 inset-x-0 px-8 py-6 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 shrink-0 overflow-y-auto max-h-[35%]" onClick={(e) => e.stopPropagation()}>
                  <h3 className="text-cyan-400 text-[9px] font-mono uppercase tracking-[0.2em] mb-3">Workflow Systems</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {selected.desc.split("\n").map((line, i) => (
                      <p key={i} className="flex gap-2 text-slate-300 text-[11px] leading-tight font-medium">
                        <span className="text-cyan-400 font-bold shrink-0">{line.split('. ')[0]}.</span>
                        <span>{line.split('. ').slice(1).join('. ')}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════ RIGHT PANEL — 40 % ═══════════════════ */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 bg-slate-50 overflow-y-auto relative">
        <div className="absolute w-[450px] h-[450px] rounded-full bg-indigo-500/5 blur-[90px] pointer-events-none" />

        <div className="w-full max-w-[420px] bg-white border border-slate-200/80 p-8 sm:p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative z-10 text-slate-800">

          {showFailedLogin ? (
            <div className="text-center py-4 space-y-6">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-500 mb-4 shadow-lg animate-pulse">
                <AlertCircle size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-display font-black text-rose-600 tracking-wider uppercase text-center">
                ⚠ ACCESS DENIED
              </h2>
              
              <div className="p-5 rounded-2xl bg-rose-50/20 border border-rose-100/80 text-left space-y-4">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Identity Detected</div>
                  <div className="text-sm font-bold text-slate-800 font-mono">
                    {failedIdentity || "UNKNOWN"}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Authentication Status</div>
                  <div className="text-xs font-semibold text-rose-600 leading-relaxed">
                    Authentication Failed
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Reason</div>
                  <div className="text-xs font-semibold text-slate-700 leading-relaxed">
                    {failedReason || "Password verification mismatch."}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Security Status: No account compromise detected
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleRetryAuth}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  Retry Authentication
                </button>
                
                <button
                  type="button"
                  onClick={handleStartRecovery}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  Recover Access
                </button>
              </div>
            </div>
          ) : employeeStatus === "approved" ? (
            <div className="text-center py-4 space-y-6">
              <div className="w-20 h-20 rounded-full bg-emerald-550/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-550 shadow-lg shadow-emerald-500/5">
                <Check size={40} strokeWidth={2} />
              </div>
              
              <div className="space-y-2">
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest border bg-emerald-550/10 text-emerald-600 border-emerald-500/20">
                  Status : APPROVED
                </span>
                <h1 className="text-2xl font-display font-black text-slate-900 leading-tight tracking-tight">
                  Congratulations
                </h1>
                <p className="text-xs font-semibold text-slate-600 leading-relaxed max-w-sm mx-auto">
                  Your account has been activated. <br />
                  You can now access tasks and start working.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  setEmployeeStatus(null)
                  localStorage.removeItem("caltrack_activation_dossier")
                  await apiDeleteRegistrationDossier()
                  navigate(routes.dashboard, { replace: true })
                }}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/10 transition-all active:scale-[0.98] cursor-pointer"
              >
                Confirm
              </button>
            </div>
          ) : employeeStatus === "rejected" ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-550 mb-4 shadow-lg shadow-rose-500/5">
                  <X size={32} strokeWidth={2.5} />
                </div>
                <h1 className="text-xl font-display font-black text-rose-550 tracking-wide uppercase">
                  APPLICATION REJECTED
                </h1>
              </div>

              <div className="p-5 rounded-2xl bg-rose-50/20 border border-rose-100/80 space-y-4">
                <div>
                  <div className="text-[9px] font-mono uppercase text-slate-600 tracking-wider">Reason Category</div>
                  <div className="text-xs font-bold text-slate-700">
                    {dossierInfo?.adminClearance?.reasonCategory || "Document Verification Failed"}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-mono uppercase text-slate-600 tracking-wider">Admin Comments</div>
                  <div className="text-xs font-semibold text-rose-600 leading-relaxed">
                    {dossierInfo?.adminClearance?.remarks || "Please upload a clearer Aadhaar image."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-[10px] font-mono text-slate-600">
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 mb-0.5">Rejected By</span>
                    {dossierInfo?.adminClearance?.rejectedBy || "Admin Team"}
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 mb-0.5">Rejected On</span>
                    {dossierInfo?.adminClearance?.rejectedOn || "02 Jun 2026"}
                  </div>
                </div>
              </div>

              {/* Resubmission Panel */}
              <div className="p-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 space-y-4">
                <div className="text-[11px] font-mono uppercase text-slate-600">Required Action</div>
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  {(dossierInfo?.adminClearance?.requiredActions || ["Re-upload Aadhaar", "Re-upload PAN"]).map((action, aIdx) => (
                    <div key={aIdx} className="flex items-center gap-2">
                      <Check className="text-emerald-550 w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    localStorage.removeItem("caltrack_activation_dossier")
                    await apiDeleteRegistrationDossier()
                    setEmployeeStatus(null)
                    navigate(routes.activation_journey)
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer"
                >
                  Upload New Documents
                </button>
              </div>
            </div>
          ) : mode === "forgot_password" ? (
            <div className="space-y-6">
              {!identityVerified ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-indigo-550/10 text-indigo-500 border border-indigo-500/20 mb-3 animate-pulse">
                      Phase 01 — Identity Verification
                    </span>
                    <div className="flex justify-center mb-3">
                      <pre className="font-mono text-[9px] font-bold text-indigo-600 leading-normal text-left select-none bg-slate-50 border border-slate-200 p-3 rounded-2xl shadow-inner">
{`╔══════════════════════════════════╗
║   ACCESS RECOVERY TERMINAL       ║
╚══════════════════════════════════╝`}
                      </pre>
                    </div>
                    <h1 className="text-lg font-display font-black text-slate-900 leading-tight">
                      Enter Workforce Identity
                    </h1>
                  </div>

                  <form onSubmit={handleScanIdentity} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block ml-1">Username / Email</label>
                      <div className="relative group">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" size={18} />
                        <input
                          className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400 font-mono"
                          placeholder="e.g. EMP1025"
                          value={identityInput}
                          onChange={e => setIdentityInput(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="p-4 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                        <AlertCircle size={15} /> {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={identityScanning}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {identityScanning ? (
                        <>
                          <RefreshCcw className="animate-spin" size={18} />
                          <span>Scanning Core Registries...</span>
                        </>
                      ) : (
                        <span>Scan Identity</span>
                      )}
                    </button>
                  </form>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError("")
                        setMode("signin")
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors duration-300"
                    >
                      Cancel Recovery
                    </button>
                  </div>
                </div>
              ) : !linkSent ? (
                <div className="space-y-6">
                  {generationPhase === 0 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100/50 mb-3 animate-pulse">
                          ✓ IDENTITY VERIFIED
                        </span>
                        <h2 className="text-xl font-display font-black text-slate-900 mb-4 text-center">Workforce Profile Resolved</h2>
                      </div>

                      <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-left space-y-4">
                        <div>
                          <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Employee Name</div>
                          <div className="text-sm font-bold text-slate-800">{verifiedName}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Department</div>
                          <div className="text-xs font-semibold text-slate-700">{verifiedDepartment}</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Registered Recovery Channel</div>
                          <div className="text-xs font-mono font-semibold text-slate-600">{verifiedEmailMasked}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleInitiateRecoverySequence}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Initiate Recovery Sequence
                      </button>
                    </div>
                  )}

                  {generationPhase === 1 && (
                    <div className="text-center py-4 space-y-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100/50 mb-1">
                        Phase 02 — Secure Link Generation
                      </span>
                      
                      <div className="flex justify-center py-2 relative">
                        <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ShieldCheck className="text-indigo-600 animate-pulse" size={24} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-mono uppercase text-indigo-600 font-bold tracking-widest text-center">
                          CALTRACK SECURITY ENGINE
                        </div>
                        <div className="text-xs text-slate-600 font-semibold h-6 text-center leading-normal">
                          {generationLog}
                        </div>
                      </div>

                      {/* Cyber Progress Bar */}
                      <div className="space-y-1.5 max-w-xs mx-auto">
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200">
                          <div 
                            className="bg-indigo-600 h-full rounded-full transition-all duration-100 ease-out" 
                            style={{ width: `${generationProgress}%` }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 flex justify-between px-1">
                          <span>TOKEN GENERATION</span>
                          <span className="font-bold">{generationProgress}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {generationPhase === 2 && (
                    <div className="space-y-6">
                      <div className="text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100/50 mb-3">
                          ✓ TOKEN READY
                        </span>
                        <h2 className="text-xl font-display font-black text-slate-900 mb-1 text-center">CALTRACK SECURITY ENGINE</h2>
                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider text-center">Secure reset link created</p>
                      </div>

                      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                          <ShieldCheck size={20} />
                        </div>
                        <div className="text-left">
                          <div className="text-[9px] font-mono uppercase text-slate-500 tracking-wider">Encryption Mode</div>
                          <div className="text-xs font-bold text-slate-700">AES-256 Protected Session</div>
                        </div>
                      </div>

                      {error && (
                        <div className="p-4 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                          <AlertCircle size={15} /> {error}
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleTransmitRecovery}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-550 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {loading ? (
                          <RefreshCcw className="animate-spin" size={18} />
                        ) : (
                          <span>Transmit to Registered Email</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 space-y-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100/50 mb-1">
                    Phase 03 — Mail Sent Success
                  </span>
                  
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-sm text-emerald-500 animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  
                  <div className="space-y-2">
                    <h1 className="text-2xl font-display font-black text-slate-900 leading-tight tracking-tight text-center">
                      🚀 RECOVERY LINK DEPLOYED
                    </h1>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-4">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-slate-500 tracking-wider">Destination</div>
                      <div className="text-xs font-mono font-bold text-slate-800">{verifiedEmailMasked}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                      <div>
                        <span className="block text-[8px] uppercase text-slate-400 mb-0.5">Encryption</span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">AES-256 Protected</span>
                      </div>
                      <div>
                        <span className="block text-[8px] uppercase text-slate-400 mb-0.5">Validity</span>
                        <span className="text-[10px] font-mono font-bold text-slate-700">15 Minutes</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        Status: Delivered Successfully
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <a
                      href="https://mail.google.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
                    >
                      <span>Open Mail App</span> <ExternalLink size={14} />
                    </a>

                    {resetLink && (
                      <div className="p-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/20 text-left space-y-2.5">
                        <div className="text-[9px] font-mono uppercase text-indigo-600 font-bold tracking-wider">🛠️ Developer Test Portal</div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Testing locally? Bypass checking your email and test the recovery confirm screen directly:
                        </p>
                        <a
                          href={resetLink}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-xl transition-all shadow-sm"
                        >
                          Bypass to Password Creation <ExternalLink size={10} />
                        </a>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setLinkSent(false)
                        setResetLink("")
                        setIdentityVerified(false)
                        setGenerationPhase(0)
                        setGenerationProgress(0)
                        setMode("signin")
                      }}
                      className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-[0.98]"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Toggle Sign In / Create Account */}
              <div className="flex bg-slate-100 p-1 rounded-2xl mb-8 border border-slate-200 max-w-[320px] mx-auto">
                <button
                  onClick={() => { setMode("signin"); setError(""); setRegStep(1) }}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${mode === "signin" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10" : "text-slate-600 hover:text-slate-900"}`}
                >
                  Sign In
                </button>
                <button
                  onClick={async () => {
                    localStorage.removeItem("caltrack_activation_dossier")
                    try {
                      const { apiDeleteRegistrationDossier } = await import("../../api/authService.js")
                      await apiDeleteRegistrationDossier()
                    } catch (e) {}
                    navigate(routes.activation_journey)
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-slate-600 hover:text-slate-900"
                >
                  Create Account
                </button>
              </div>

              <div className="text-center mb-8">
                <h1 className="text-3xl font-display font-black text-slate-900 leading-tight tracking-tight text-center">
                  {mode === "signin" ? "Welcome Back" : "Create Account"}
                </h1>
              </div>

              {/* Connect With Buttons */}
              <div className="mb-6">
                <p className="text-center text-[9px] font-mono text-slate-600 uppercase tracking-[0.25em] mb-4">Connect With</p>
                <button type="button" onClick={() => googleLoginHandler()} className="flex items-center justify-center w-full py-3.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-2xl transition-all duration-300 group shadow-md active:scale-[0.98] cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z" />
                    <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z" />
                    <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z" />
                  </svg>
                  <span className="ml-3 text-[13px] font-bold uppercase tracking-wider text-slate-700 group-hover:text-slate-900 transition-colors">Google</span>
                </button>
              </div>

              <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-4 text-[9px] font-mono text-slate-600 tracking-[0.25em]">OR</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {mode === "register" && (
                <div className="mb-10 flex items-center justify-between relative px-2">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0 mx-8" />
                  <div
                    className="absolute top-1/2 left-0 h-0.5 bg-indigo-600 -translate-y-1/2 z-0 transition-all duration-500 mx-8"
                    style={{ width: `calc(${(regStep - 1) / 3 * 100}%)` }}
                  />
                  {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-black transition-all duration-300 border-2 ${
                          regStep > s ? "bg-emerald-500 border-emerald-450 text-white" :
                          regStep === s ? "bg-indigo-600 border-indigo-450 text-white" :
                          "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                      >
                        {regStep > s ? <Check size={16} strokeWidth={3} /> : s}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={onSubmit} className="space-y-5">
                {mode === "signin" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="relative group">
                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" size={18} />
                        <input
                          className="w-full pl-14 pr-5 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                          placeholder="Username"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300" size={18} />
                        <input
                          className="w-full pl-14 pr-14 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-400"
                          type={showPass ? "text" : "password"}
                          placeholder="Password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                        />
                        <button type="button" className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setShowPass(p => !p)}>
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-1 pr-1">
                      <button type="button" onClick={() => setMode("forgot_password")} className="text-[11px] font-bold text-slate-600 hover:text-indigo-600 transition-colors duration-300">
                        Forgot Password?
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[220px]">
                    {regStep === 1 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h2 className="text-lg font-display font-black text-slate-900 mb-4">Personal Details</h2>
                        <div className="relative">
                          <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white outline-none transition-all duration-300 placeholder:text-slate-400" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} />
                        </div>
                        <div className="relative">
                          <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white outline-none transition-all duration-300 placeholder:text-slate-400" placeholder="Work Email" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                      </motion.div>
                    )}
                    {regStep === 2 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h2 className="text-lg font-display font-black text-slate-900 mb-4">Organization Info</h2>
                        <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white outline-none transition-all duration-300 placeholder:text-slate-400" placeholder="Organization Name" value={orgName} onChange={e => setOrgName(e.target.value)} />
                        <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-700 focus:bg-white outline-none transition-all duration-300 appearance-none cursor-pointer" value={numEmployees} onChange={e => setNumEmployees(e.target.value)}>
                          <option>1 - 10 employees</option>
                          <option>11 - 50 employees</option>
                          <option>51 - 200 employees</option>
                          <option>201+ employees</option>
                        </select>
                      </motion.div>
                    )}
                    {regStep === 3 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                        <h2 className="text-lg font-display font-black text-slate-900 mb-4">Platform Credentials</h2>
                        <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white outline-none transition-all duration-300 placeholder:text-slate-400" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
                        <input className="w-full px-6 py-4 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[14px] font-medium text-slate-800 focus:bg-white outline-none transition-all duration-300 placeholder:text-slate-400" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                      </motion.div>
                    )}
                    {regStep === 4 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-[9px] uppercase tracking-widest mb-1">
                          <ShieldCheck size={14} /> Finalize Security
                        </div>
                        <h2 className="text-[24px] font-display font-black text-slate-900 leading-tight">Almost there!</h2>

                        <div className="space-y-4 pt-1">
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className={`mt-0.5 w-4.5 h-4.5 rounded-md flex items-center justify-center transition-all border ${agreedUpdates ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-200 bg-slate-50 group-hover:border-indigo-400"}`}>
                              {agreedUpdates && <Check size={12} strokeWidth={4} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreedUpdates} onChange={() => setAgreedUpdates(!agreedUpdates)} />
                            <span className="text-[12px] font-medium text-slate-600 leading-tight">Receive updates and tips from Caltrack.</span>
                          </label>
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <div className={`mt-0.5 w-4.5 h-4.5 rounded-md flex items-center justify-center transition-all border ${agreedTerms ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-200 bg-slate-50 group-hover:border-indigo-400"}`}>
                              {agreedTerms && <Check size={12} strokeWidth={4} />}
                            </div>
                            <input type="checkbox" className="hidden" checked={agreedTerms} onChange={() => setAgreedTerms(!agreedTerms)} />
                            <span className="text-[12px] font-medium text-slate-600 leading-tight">Agree to <span className="text-indigo-400 font-bold">Terms</span> & <span className="text-indigo-400 font-bold">Privacy</span>.</span>
                          </label>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">I'm not a robot</span>
                          <div className="w-5 h-5 border-2 border-slate-200 rounded-md" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                    <AlertCircle size={15} /> {error}
                  </div>
                )}

                <div className="flex gap-3">
                  {mode === "register" && regStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setRegStep(p => p - 1)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 text-[12px] font-bold uppercase tracking-widest rounded-2xl border border-slate-250 hover:bg-slate-200 hover:text-slate-800 transition-all cursor-pointer"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type={mode === "register" && regStep < 4 ? "button" : "submit"}
                    disabled={loading || (mode === "register" && regStep === 4 && !agreedTerms)}
                    onClick={() => {
                      if (mode === "register" && regStep < 4) setRegStep(p => p + 1)
                    }}
                    className={`flex-[2] py-4 bg-indigo-600 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40 disabled:shadow-none cursor-pointer`}
                  >
                    {loading ? <RefreshCcw className="animate-spin" size={18} /> :
                      mode === "signin" ? "Sign In" :
                      regStep === 4 ? (agreedTerms ? "Continue" : <RefreshCcw size={18} />) : "Continue"}
                  </button>
                </div>
              </form>

              <div className="mt-8 text-center space-y-4">
                <Link to={routes.organization_signup} className="block text-[11px] font-bold uppercase tracking-widest text-indigo-600 hover:text-indigo-500 transition-colors">
                  Setup New Organization
                </Link>
                <button className="text-[10px] font-mono uppercase tracking-widest text-slate-600 hover:text-indigo-600 transition-colors">
                  Need Help? <span className="text-slate-400">Contact Support</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
