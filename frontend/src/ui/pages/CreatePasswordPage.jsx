import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { apiVerifyActivationToken, apiActivateDossierAccount, extractAuthError } from "../../api/authService.js"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { Lock, Eye, EyeOff, RefreshCcw, AlertCircle, ShieldCheck, Check, UserCheck, ShieldAlert, Cpu } from "lucide-react"

export function CreatePasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const [verifyingToken, setVerifyingToken] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState("")
  const [employeeDetails, setEmployeeDetails] = useState({ fullName: "", email: "", employeeId: "" })

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  // Validate token on mount
  useEffect(() => {
    async function verify() {
      if (!token) {
        setTokenError("Missing activation token in URL. Please use the original link from your invitation email.")
        setTokenValid(false)
        setVerifyingToken(false)
        return
      }

      try {
        const res = await apiVerifyActivationToken(token)
        if (res && res.valid) {
          setEmployeeDetails({
            fullName: res.fullName,
            email: res.email,
            employeeId: res.employeeId
          })
          setTokenValid(true)
        } else {
          setTokenError(res.error || "Invalid or expired activation token.")
          setTokenValid(false)
        }
      } catch (err) {
        setTokenError(extractAuthError(err, "Verification failed. The link may have expired or is invalid."))
        setTokenValid(false)
      } finally {
        setVerifyingToken(false)
      }
    }
    verify()
  }, [token])

  // Redirect to login page 4 seconds after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/login")
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [success, navigate])

  // Password requirements real-time checks
  const hasEightChars = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  // Compute password strength bar & percentage
  const criteriaCount = [hasEightChars, hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  let strengthPercent = 0
  let strengthBar = "░░░░░░░░░░"
  if (criteriaCount === 1) {
    strengthPercent = 25
    strengthBar = "██░░░░░░░░"
  } else if (criteriaCount === 2) {
    strengthPercent = 50
    strengthBar = "█████░░░░░"
  } else if (criteriaCount === 3) {
    strengthPercent = 75
    strengthBar = "████████░░"
  } else if (criteriaCount === 4) {
    strengthPercent = 100
    strengthBar = "██████████"
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    
    if (!tokenValid || !token) {
      setError("Activation link is not valid.")
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await apiActivateDossierAccount(token, password)
      setSuccess(true)
    } catch (err) {
      setError(extractAuthError(err, "Failed to activate account. The link may be expired or used."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#03050d] text-slate-100 font-body overflow-hidden relative w-full justify-center items-center p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        .font-display { font-family: 'Outfit', sans-serif; }
        .font-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
      `}</style>

      {/* Holographic grid scanner overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#4f46e5 2px, transparent 2px)", backgroundSize: "40px 40px" }} />
      <div className="absolute w-[600px] h-[600px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-40 animate-pulse pointer-events-none" style={{ animationDuration: '3s' }} />

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Brand logo top-center */}
        <div className="flex justify-center mb-8">
          <CalTrackLogo size="lg" showTagline={false} />
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] p-8 sm:p-10 border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {verifyingToken ? (
            <div className="text-center py-10 space-y-4">
              <RefreshCcw className="animate-spin text-indigo-500 mx-auto w-8 h-8" />
              <p className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                VERIFYING WORKFORCE TOKEN...
              </p>
            </div>
          ) : !tokenValid ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-6"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-450 shadow-[0_0_20px_rgba(239,68,68,0.2)] mx-auto">
                <ShieldAlert size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-display font-black text-rose-500 tracking-wider uppercase">
                  ✕ ACTIVATION FAILED
                </h2>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  Invalid Security Handshake
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/50 border border-slate-800 text-left text-xs font-semibold text-slate-400 leading-relaxed">
                {tokenError}
              </div>

              <button
                onClick={() => navigate("/login")}
                className="w-full py-4 bg-slate-850 hover:bg-slate-800 text-slate-300 text-[11px] font-black uppercase tracking-widest rounded-2xl border border-slate-700 shadow-sm transition-all"
              >
                Return to Login
              </button>
            </motion.div>
          ) : success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-6"
            >
              <div className="relative flex justify-center py-4">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-32 h-32 rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: "3s" }} />
                  <div className="w-24 h-24 rounded-full border border-cyan-500/25 animate-pulse" style={{ animationDuration: "2s" }} />
                </div>

                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-450 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <UserCheck size={38} className="animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-display font-black text-emerald-450 tracking-wider uppercase">
                  ✓ IDENTITY ACTIVATED
                </h2>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Workforce Credentials Synced
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-4 font-mono">
                <div>
                  <div className="text-[9px] uppercase text-slate-500 tracking-wider">EMPLOYEE:</div>
                  <div className="text-xs font-bold text-slate-300">{employeeDetails.fullName}</div>
                </div>

                <div className="border-t border-slate-800/80 pt-3">
                  <div className="text-[9px] uppercase text-slate-500 tracking-wider">WORKPLACE ID:</div>
                  <div className="text-xs font-bold text-slate-350">{employeeDetails.employeeId}</div>
                </div>

                <div className="border-t border-slate-800/80 pt-3 flex items-center justify-between">
                  <span className="text-[9px] uppercase text-slate-500 font-bold">PORTAL STATUS:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/25">
                    ACTIVE
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 animate-pulse pt-2 font-mono uppercase tracking-widest">
                Loading Caltrack Dashboard...
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
                  Phase 05 — Account Activation
                </span>
                <h1 className="text-lg font-display font-black text-slate-200 tracking-wider uppercase">
                  Sync Security Profile
                </h1>
                <p className="text-xs text-slate-500 mt-2">
                  Welcome to Caltrack, <span className="font-bold text-indigo-400">{employeeDetails.fullName}</span>. Please configure your master account password below.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block ml-1">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type={showPassword ? "text" : "password"}
                      className="w-full pl-14 pr-12 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-[14px] font-medium text-slate-350 focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-650 font-mono"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setShowPassword(p => !p)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block ml-1">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="w-full pl-14 pr-12 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-[14px] font-medium text-slate-350 focus:bg-slate-950 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all placeholder:text-slate-650 font-mono"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors" onClick={() => setShowConfirmPassword(p => !p)}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Strength display and list */}
              <div className="p-4 rounded-2xl bg-slate-950/30 border border-slate-800 space-y-3 font-mono">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 uppercase tracking-wider">Security strength</span>
                  <span className={`font-bold ${
                    strengthPercent >= 75 ? "text-emerald-400" :
                    strengthPercent >= 50 ? "text-amber-400" :
                    password ? "text-rose-450" : "text-slate-600"
                  }`}>
                    {strengthBar} {strengthPercent}%
                  </span>
                </div>

                <div className="border-t border-slate-800/80 my-2" />

                <div className="space-y-2">
                  <span className="text-[9px] uppercase text-slate-600 tracking-wider block mb-1">Complexity Requirements</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-semibold">
                    <div className="flex items-center gap-2">
                      <Check size={14} className={hasEightChars ? "text-emerald-400" : "text-slate-650"} strokeWidth={3} />
                      <span className={hasEightChars ? "text-slate-300" : "text-slate-500"}>8+ Characters</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className={hasUpper ? "text-emerald-400" : "text-slate-650"} strokeWidth={3} />
                      <span className={hasUpper ? "text-slate-300" : "text-slate-500"}>Uppercase</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className={hasNumber ? "text-emerald-400" : "text-slate-650"} strokeWidth={3} />
                      <span className={hasNumber ? "text-slate-300" : "text-slate-500"}>Number</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className={hasSymbol ? "text-emerald-400" : "text-slate-650"} strokeWidth={3} />
                      <span className={hasSymbol ? "text-slate-300" : "text-slate-500"}>Symbol</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-2xl border border-rose-500/20 flex items-center gap-3">
                  <AlertCircle size={15} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || strengthPercent < 100}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
              >
                {loading ? <RefreshCcw className="animate-spin" size={18} /> : <>Activate workforce ID <Check size={16} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
