import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../state/auth/useAuth.js"
import { extractAuthError } from "../../api/authService.js"
import { validateLoginForm, validateRegStep1, validateRegStep2 } from "../../utils/validate.js"
import { routes } from "../routes.js"
import { useGoogleLogin } from "@react-oauth/google"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { Check, ArrowRight, Building2, Users2, Workflow, Clock, Banknote, CalendarDays, Sparkles, RefreshCcw, ShieldCheck, AlertCircle } from "lucide-react"

/* ──────────────────────────────────────────────
   REVIEW DATA
   ────────────────────────────────────────────── */
const REVIEWS = [
  {
    quote: "As a remote team lead, QuickTIMS has been a game-changer for attendance and payroll. The real-time tracking and selfie verification give us complete confidence.",
    author: "Priya Mehra",
    role: "HR Manager, TechNova Solutions",
    stars: 5,
  },
  {
    quote: "We switched from a spreadsheet-based system and QuickTIMS cut our payroll processing time in half. The scheduling feature is absolutely top-notch.",
    author: "Arjun Krishnaswamy",
    role: "Operations Director, Apex Industries",
    stars: 5,
  },
  {
    quote: "Finally a time-tracking tool that works for SMEs. Simple, reliable, and the geolocation punch-in keeps everyone accountable. Highly recommended!",
    author: "Sneha Patel",
    role: "CEO, Bright Retail Group",
    stars: 5,
  },
]

/* ──────────────────────────────────────────────
   STAR RATING
   ────────────────────────────────────────────── */
function Stars({ count = 5 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="text-amber-400 text-lg">★</span>
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────
   REVIEW CAROUSEL
   ────────────────────────────────────────────── */
function ReviewCarousel({ lightMode = false }) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  function goTo(idx) {
    setCurrent((idx + REVIEWS.length) % REVIEWS.length)
  }

  function resetTimer() {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent(p => (p + 1) % REVIEWS.length), 5000)
  }

  useEffect(() => {
    resetTimer()
    return () => clearInterval(timerRef.current)
  }, [])

  function handlePrev() { goTo(current - 1); resetTimer() }
  function handleNext() { goTo(current + 1); resetTimer() }
  function handleDot(i) { goTo(i); resetTimer() }

  const review = REVIEWS[current]

  return (
    <div className="w-full max-w-md mt-auto mb-8 animate-in slide-in-from-left-4 duration-500">
      <div className={`rounded-3xl p-8 shadow-2xl backdrop-blur-sm ${lightMode ? 'bg-white/95 border-none' : 'bg-white/10 border border-white/20'}`}>
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-sm">
          <Sparkles size={28} />
        </div>
        <h3 className="text-lg font-black text-slate-900 mb-2 tracking-tight">Trusted by Industry Leaders</h3>
        <p className={`text-sm font-medium leading-relaxed mb-8 ${lightMode ? 'text-slate-500' : 'text-indigo-200'}`}>"{review.quote}"</p>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-black shadow-sm">
              {review.author.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-black text-slate-900">{review.author}</div>
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{review.role}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-8">
        <button className="text-indigo-200 hover:text-white transition-colors" onClick={handlePrev} aria-label="Previous review">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="flex gap-2">
          {REVIEWS.map((_, i) => (
            <button
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white w-6" : "bg-indigo-300/50 hover:bg-indigo-300"}`}
              onClick={() => handleDot(i)}
              aria-label={`Review ${i + 1}`}
            />
          ))}
        </div>
        <button className="text-indigo-200 hover:text-white transition-colors" onClick={handleNext} aria-label="Next review">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  )
}

function GoogleConnectButton({ onLoginWithGoogle, onError, onDone, onNavigate, postLoginRoute }) {
  const googleLoginHandler = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      onDone(false)
      try {
        await onLoginWithGoogle(tokenResponse.access_token)
        onNavigate(postLoginRoute())
      } catch (err) {
        onError(err?.body?.detail || "Google login failed.")
      } finally {
        onDone(true)
      }
    },
    onError: () => onError("Google login failed.")
  })

  return (
    <button 
      className="flex items-center justify-center gap-2 w-full px-3 py-3.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
      type="button" 
      onClick={() => googleLoginHandler()}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z" />
        <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z" />
        <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z" />
      </svg>
      Google
    </button>
  )
}

function GooglePlaceholderButton({ onClick }) {
  return (
    <button 
      className="flex items-center justify-center gap-2 w-full px-3 py-3.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all"
      type="button" 
      onClick={onClick} 
      aria-disabled="true"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.5 1.2 8.9 3.2l6.7-6.7C35.4 2.2 30.1 0 24 0 14.8 0 6.9 5.4 3.1 13.3l7.8 6.1C13 13.1 18 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.6 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3.1-2.4 5.7-5 7.4l7.7 6c4.5-4.1 7.2-10.2 7.2-17.7z" />
        <path fill="#FBBC05" d="M10.9 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6L2.5 13.3A24 24 0 0 0 0 24c0 3.8.9 7.4 2.5 10.7l8.4-6.1z" />
        <path fill="#34A853" d="M24 48c6.1 0 11.2-2 14.9-5.5l-7.7-6c-2 1.4-4.6 2.2-7.2 2.2-5.9 0-11-4-12.8-9.4l-8 6.1C6.9 42.6 14.8 48 24 48z" />
      </svg>
      Google
    </button>
  )
}

/* ──────────────────────────────────────────────
   MAIN LOGIN PAGE
   ────────────────────────────────────────────── */
export function LoginPage() {
  const { login, loginWithGoogle, register } = useAuth()
  const navigate = useNavigate()
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  const postLoginRoute = () => routes.get_started

  const [mode, setMode] = useState("signin")
  const [success, setSuccess] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [organizationName, setOrganizationName] = useState("")
  const [robot, setRobot] = useState(false)
  const [agree1, setAgree1] = useState(true)
  const [agree2, setAgree2] = useState(false)
  const [regStep, setRegStep] = useState(1)
  const [teamSize, setTeamSize] = useState("1 - 10 employees")
  const [selectedModules, setSelectedModules] = useState(["time"])

  function changeMode(m) {
    setMode(m)
    setError("")
    setSuccess("")
    setRegStep(1)
  }

  async function onSubmit(e) {
    if (e) e.preventDefault()
    if (loading) return
    setError("")
    setSuccess("")

    if (mode === "signin") {
      const validationError = validateLoginForm({ identifier: username, password })
      if (validationError) return setError(validationError)
      setLoading(true)
      try {
        await login(username.trim(), password)
        navigate(postLoginRoute(), { replace: true })
      } catch (err) {
        setError(extractAuthError(err, "Login failed. Check your credentials."))
      } finally {
        setLoading(false)
      }
    } else {
      if (!robot) return setError("Please confirm you are not a robot.")
      if (!agree2) return setError("Please agree to the Terms & Privacy Policy.")
      setLoading(true)
      try {
        const [first, ...rest] = fullName.trim().split(" ")
        await register({
          username: username.trim(),
          password,
          email: email.trim(),
          first_name: first || "",
          last_name: rest.join(" ") || "",
          organization_name: organizationName.trim(),
          team_size: teamSize,
          selected_modules: selectedModules,
        })
        navigate(postLoginRoute(), { replace: true })
      } catch (err) {
        setError(extractAuthError(err, "Registration failed."))
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex min-h-screen bg-white font-sans overflow-hidden">
      
      {/* ── LEFT PANEL (Branding) ── */}
      <div className="hidden lg:flex flex-col w-1/2 bg-white p-16 relative border-r border-slate-100">
        <div className="mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <CalTrackLogo size="lg" showTagline={false} />
          <div className="flex items-center gap-3 mt-4">
            <span className="px-3 py-1 bg-slate-100 text-slate-900 text-[10px] font-black uppercase tracking-widest rounded-full border border-slate-200">CHRONOFLOW</span>
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">• Workforce Time Suite</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-1000">
          <div className="w-full max-w-md aspect-video bg-slate-50 rounded-[3rem] flex items-center justify-center mb-12 relative overflow-hidden shadow-inner">
             <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:32px:32px]"></div>
             <div className="relative z-10 w-28 h-28 bg-white rounded-3xl shadow-2xl shadow-indigo-100 flex items-center justify-center animate-bounce duration-[3000ms]">
                <Clock className="text-indigo-600" size={48} />
             </div>
             <div className="absolute right-20 top-12 w-14 h-14 bg-emerald-500 rounded-2xl shadow-xl flex items-center justify-center rotate-12">
                <Check className="text-white" size={28} strokeWidth={4} />
             </div>
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 max-w-md leading-tight mb-4 tracking-tight">
            Track when your staff are at work for payroll, attendance, compliance.
          </h2>
          <p className="text-indigo-600 text-base font-black uppercase tracking-widest">
            Thousands of users worldwide, from SME to Enterprise
          </p>
        </div>

        <div className="mt-auto">
          <ReviewCarousel lightMode={true} />
        </div>
      </div>

      {/* ── RIGHT PANEL (Auth Container) ── */}
      <div className="flex-1 relative flex flex-col justify-center items-center p-8 bg-white">
        <div className="w-full max-w-[480px] relative z-10 animate-in fade-in slide-in-from-right-8 duration-700">
          
          {/* Mode Switcher */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-12 border border-slate-100">
            <button
              onClick={() => changeMode("signin")}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === "signin" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => changeMode("register")}
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === "register" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Create Account
            </button>
          </div>

          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create a new account"}
            </h2>
          </div>

          <div className="text-center mb-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Connect with</span>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-12">
            {googleClientId ? (
              <GoogleConnectButton onLoginWithGoogle={loginWithGoogle} onError={setError} onDone={(done) => setLoading(!done)} onNavigate={navigate} postLoginRoute={postLoginRoute} />
            ) : (
              <GooglePlaceholderButton onClick={() => setError("Identity provider offline.")} />
            )}
            <button className="flex items-center justify-center gap-2 w-full px-3 py-3.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">
              <svg width="16" height="16" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
              Microsoft
            </button>
            <button className="flex items-center justify-center gap-2 w-full px-3 py-3.5 bg-white border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest hover:bg-slate-50 transition-all">
              <svg width="16" height="16" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
              Apple
            </button>
          </div>

          <div className="relative flex items-center mb-12">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink-0 mx-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">or</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {mode === "signin" && (
            <form onSubmit={onSubmit} className="space-y-6">
              <input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 outline-none transition-all" placeholder="Username or Email" value={username} onChange={e => setUsername(e.target.value)} />
              <div className="relative">
                <input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-600 outline-none transition-all" type={showPass ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest" onClick={() => setShowPass(p => !p)}>{showPass ? "Hide" : "Show"}</button>
              </div>
              {error && <div className="p-5 bg-red-50 text-red-600 text-xs font-bold rounded-2xl border border-red-100">{error}</div>}
              <button type="submit" className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-[1.5rem] shadow-2xl shadow-indigo-100 transition-all active:scale-[0.98]" disabled={loading}>{loading ? "Authenticating..." : "Access Workspace"}</button>
            </form>
          )}

          {mode === "register" && (
            <div className="space-y-8">
              <div className="flex items-center justify-center gap-0">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all relative z-10 ${regStep >= s ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>
                      {regStep > s ? <Check size={18} strokeWidth={4} /> : (regStep === s ? <div className="w-2 h-2 bg-white rounded-full" /> : <span className="text-[10px] font-black">{s}</span>)}
                    </div>
                    {s !== 4 && <div className={`flex-1 h-[3px] transition-all ${regStep > s ? 'bg-emerald-500' : 'bg-indigo-100'}`} />}
                  </div>
                ))}
              </div>

              {regStep < 4 ? (
                 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">{regStep === 1 ? "Personal Details" : regStep === 2 ? "Organization Info" : "Platform Credentials"}</h3>
                    {regStep === 1 && <><input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} /><input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold" placeholder="Work Email" value={email} onChange={e => setEmail(e.target.value)} /></>}
                    {regStep === 2 && <><input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold" placeholder="Organization Name" value={organizationName} onChange={e => setOrganizationName(e.target.value)} /><select className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold appearance-none" value={teamSize} onChange={e => setTeamSize(e.target.value)}><option>1 - 10 employees</option><option>11 - 50 employees</option><option>51 - 200 employees</option><option>201+ employees</option></select></>}
                    {regStep === 3 && <><input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} /><input className="w-full px-8 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} /></>}
                    <div className="flex gap-4 mt-10">
                       <button onClick={() => setRegStep(p => p - 1)} className="flex-1 py-5 bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-3xl" disabled={regStep === 1}>Back</button>
                       <button onClick={() => setRegStep(p => p + 1)} className="flex-[2] py-5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-indigo-100">Continue</button>
                    </div>
                 </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                  <div className="text-indigo-600 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-4"><Sparkles size={16} /> FINALIZE</div>
                  <h3 className="text-2xl font-black text-slate-900 mb-8">Almost there!</h3>
                  <div className="space-y-6 mb-10">
                    <label className="flex items-center gap-4 cursor-pointer"><input type="checkbox" checked={agree1} onChange={e => setAgree1(e.target.checked)} className="peer sr-only" /><div className="w-6 h-6 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" /><Check size={14} strokeWidth={4} className="absolute left-1.5 top-1.5 text-white opacity-0 peer-checked:opacity-100" /><span className="text-xs font-bold text-slate-400">Receive updates and tips from Caltrack.</span></label>
                    <label className="flex items-center gap-4 cursor-pointer"><input type="checkbox" checked={agree2} onChange={e => setAgree2(e.target.checked)} className="peer sr-only" /><div className="w-6 h-6 border-2 border-slate-200 rounded-lg bg-white peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-colors" /><Check size={14} strokeWidth={4} className="absolute left-1.5 top-1.5 text-white opacity-0 peer-checked:opacity-100" /><span className="text-xs font-bold text-slate-400">Agree to <a href="#" className="text-indigo-600 hover:underline">Terms</a> &amp; <a href="#" className="text-indigo-600 hover:underline">Privacy</a>.</span></label>
                    <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex items-center justify-between"><span className="text-sm font-black text-slate-700">I'm not a robot</span><label className="relative cursor-pointer"><input type="checkbox" checked={robot} onChange={e => setRobot(e.target.checked)} className="peer sr-only" /><div className="w-7 h-7 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-emerald-500 peer-checked:border-emerald-500" /><Check size={18} strokeWidth={4} className="absolute left-1 top-1 text-white opacity-0 peer-checked:opacity-100" /></label></div>
                  </div>
                  {error && <div className="p-5 bg-red-50 text-red-600 text-xs font-bold rounded-2xl mb-8">{error}</div>}
                  <div className="flex gap-4">
                    <button onClick={() => setRegStep(3)} className="flex-1 py-5 bg-white border border-slate-100 text-slate-400 text-[11px] font-black uppercase tracking-widest rounded-3xl">BACK</button>
                    <button onClick={onSubmit} className="flex-[2] flex justify-center items-center gap-2 py-5 bg-[#818cf8] text-white text-[11px] font-black uppercase tracking-widest rounded-3xl shadow-xl shadow-indigo-100">{loading ? <RefreshCcw className="animate-spin" size={20} /> : <RefreshCcw size={20} />}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-center mt-10">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Need help? <a href="#" className="text-indigo-600 hover:underline">Contact Support</a>
             </span>
          </div>
        </div>
      </div>
    </div>
  )
}
