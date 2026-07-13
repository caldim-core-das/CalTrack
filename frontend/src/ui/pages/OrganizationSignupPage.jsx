import { useState, useEffect } from "react"
import { useNavigate, Link } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, User, Lock, Mail, ArrowRight, Check } from "lucide-react"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { routes } from "../routes.js"
import { apiRegisterAdmin } from "../../api/authService.js"
import { useAuth } from "../../state/auth/useAuth.js"

export function OrganizationSignupPage() {
  const navigate = useNavigate()
  const { setTokens, user } = useAuth()
  
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true })
    }
  }, [user, navigate])

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPass, setShowPass] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!firstName || !lastName || !email || !password) {
      setError("All fields are required.")
      return
    }
    
    setLoading(true)
    setError("")
    try {
      const res = await apiRegisterAdmin({
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password
      })
      
      if (res && res.success) {
        // Force reload to let App.jsx grab the user from the /me endpoint
        // and handle the redirect logic to /onboarding
        window.location.href = import.meta.env.BASE_URL || "/"
      } else {
        setError("Registration failed. Please try again.")
      }
    } catch (err) {
      const msg = err?.body?.detail || "Failed to register. Email might be in use."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-body items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 p-8 sm:p-10 rounded-3xl shadow-xl">
        <div className="flex justify-center mb-8">
          <CalTrackLogo size="md" />
        </div>
        
        <div className="text-center mb-8 space-y-2">
          <h1 className="text-2xl font-display font-black text-slate-900">Create Admin Account</h1>
          <p className="text-sm font-medium text-slate-500">Sign up to configure your organization.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
              <input 
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[13px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                placeholder="First Name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className="relative group">
              <input 
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[13px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
                placeholder="Last Name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input 
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[13px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              placeholder="Work Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={16} />
            <input 
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 rounded-2xl text-[13px] font-medium text-slate-800 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all"
              type={showPass ? "text" : "password"}
              placeholder="Secure Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-bold uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? "Registering..." : (
              <>
                Continue to Setup <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs font-medium text-slate-500">
          Already have an account?{" "}
          <Link to={routes.login} className="text-indigo-600 font-bold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
