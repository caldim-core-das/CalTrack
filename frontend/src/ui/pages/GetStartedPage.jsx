import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion"
import {
  MapPin, Clock, CalendarRange,
  CheckCircle2, ArrowRight, X,
  Building2, Users, LayoutGrid,
  Briefcase
} from "lucide-react"
import { useAuth } from "../../state/auth/useAuth.js"
import { routes } from "../routes.js"
import { apiRequest } from "../../api/client.js"

/* ── Design System ───────────────────────────────────────────── */
const COLORS = {
  primary: "#ff7020",      // CalTrack Orange
  primaryLight: "#fff7ed",
  primaryHover: "#ea580c",
  success: "#22c55e",
  successLight: "#f0fdf4",
  text: "#1e293b",
  textMuted: "#64748b",
  border: "#e2e8f0",
  bg: "#f8fafc",
  white: "#ffffff",
}

const STEPS = [
  {
    id: "schedule",
    icon: <CalendarRange size={22} />,
    title: "Create a work schedule",
    desc: "Plan your team's work hours and breaks.",
    est: "3 min",
    to: routes.settings_schedules,
    color: "#4f46e5",
    bg: "#f5f3ff",
  },
  {
    id: "rules",
    icon: <Clock size={22} />,
    title: "Define rules for time tracking",
    desc: "Take control of how your team members clock in and out.",
    est: "5 min",
    to: routes.settings_timetracking,
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  {
    id: "activities",
    icon: <Briefcase size={22} />,
    title: "Add activities and projects",
    desc: "Add a few activities and projects that you want to track time against.",
    est: "2 min",
    to: routes.tasks,
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    id: "locations",
    icon: <MapPin size={22} />,
    title: "List work locations",
    desc: "Add your locations where your team members will be clocking in and out.",
    est: "2 min",
    to: routes.locations,
    color: "#10b981",
    bg: "#ecfdf5",
  },
  {
    id: "employees",
    icon: <Users size={22} />,
    title: "Invite your team",
    desc: "Add your first team members to get started.",
    est: "5 min",
    to: routes.settings_team,
    color: "#3b82f6",
    bg: "#eff6ff",
  },
]

const STORAGE_KEY = "caltrack.onboarding.dismissed"

/* ── Components ─────────────────────────────────────────────── */

export function GetStartedPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const completed = new Set()

        // 1. Check Schedule (shifts)
        try {
          const res = await apiRequest("/scheduling/shifts/")
          const shifts = res?.data || res?.results || res || []
          if (shifts.length > 0) {
            completed.add("schedule")
          }
        } catch (e) {
          console.error("Error checking schedules:", e)
        }

        // 2. Check Tasks / Activities
        try {
          const res = await apiRequest("/tasks/admin/")
          const tasks = res?.data || res?.results || res || []
          if (tasks.length > 0) {
            completed.add("activities")
          }
        } catch (e) {
          console.error("Error checking tasks:", e)
        }

        // 3. Check Locations
        try {
          const res = await apiRequest("/time/locations/")
          const locations = res?.data || res?.results || res || []
          if (locations.length > 0) {
            completed.add("locations")
          }
        } catch (e) {
          console.error("Error checking locations:", e)
        }

        // 4. Check Team Invites and Members
        try {
          const invRes = await apiRequest("/settings/team/invites/")
          const memRes = await apiRequest("/settings/team/members/")
          const invites = invRes?.data || invRes?.results || invRes || []
          const members = memRes?.data || memRes?.results || memRes || []
          if (invites.length > 0 || members.length > 1) {
            completed.add("employees")
          }
        } catch (e) {
          console.error("Error checking team status:", e)
        }

        // 5. Check Rules (Time tracking rules)
        try {
          const res = await apiRequest("/company/me/")
          const companyRes = res?.data || res || {}
          if (companyRes.shift_enforcement_mode && companyRes.shift_enforcement_mode !== "warn" || localStorage.getItem("caltrack.onboarding.rules.completed") === "true") {
            completed.add("rules")
          }
        } catch (e) {
          console.error("Error checking company settings:", e)
        }

        setCompletedSteps(completed)
      } catch (err) {
        console.error("Error checking onboarding status:", err)
      } finally {
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [])

  const getGreetingName = () => {
    if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1)
    }
    const baseName = user?.username || "Rohit"
    if (baseName.includes("@")) {
      const parts = baseName.split("@")
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    }
    return baseName.charAt(0).toUpperCase() + baseName.slice(1)
  }
  const displayName = getGreetingName()
  const totalSteps = STEPS.length
  const doneCount = completedSteps.size
  
  let profileScore = 0
  if (user?.firstName) profileScore++
  if (user?.lastName) profileScore++
  if (user?.phone) profileScore++
  if (user?.avatar_url) profileScore++

  // Profile completion contributes 20%, Setup steps contribute 80%
  const percentage = Math.round(
    (profileScore / 4) * 20 + (doneCount / totalSteps) * 80
  )

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    navigate(routes.dashboard)
  }

  return (
    <div className="min-h-screen bg-bg dark:bg-bg flex flex-col">

      {/* ── Hero Section ─────────────────────────────────────── */}
      <div className="bg-orange-600 dark:bg-slate-900 h-[420px] px-10 md:px-20 py-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20">
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full bg-white/10 dark:bg-indigo-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-50px] right-[100px] w-[200px] h-[200px] rounded-full bg-white/5 dark:bg-orange-500/5 blur-2xl pointer-events-none" />

        {/* Big Background Text */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-black text-white/5 dark:text-white/[0.02] whitespace-nowrap pointer-events-none uppercase tracking-tighter select-none">
          CALTRACK CALTRACK CALTRACK
        </div>

        {/* Greeting Card (Left) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface dark:bg-slate-900 border border-white/20 dark:border-slate-800 rounded-[2.5rem] p-10 flex-1 max-w-[520px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.2)] dark:shadow-none relative z-10 flex flex-col gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 flex items-center justify-center mb-2">
            <LayoutGrid size={32} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight m-0" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
            Hi {displayName}! 👋 <br/>Welcome to CalTrack
          </h1>
          <p className="text-base font-medium text-slate-500 dark:text-slate-400 m-0 max-w-[380px] leading-relaxed">
            Your enterprise portal is ready. Let's finish the setup and start managing your workspace.
          </p>
        </motion.div>

        {/* Progress Card (Right) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 dark:bg-slate-950/40 backdrop-blur-2xl rounded-[2.5rem] p-8 flex items-center gap-8 max-w-[420px] flex-1 border border-white/20 dark:border-slate-800 z-10"
        >
          <div className="bg-white dark:bg-slate-900 rounded-full p-1.5 shadow-xl">
            <ProgressCircle percentage={percentage} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white dark:text-white mb-1 tracking-tight">
              Setup Progress
            </h2>
            <p className="text-sm text-white/80 dark:text-slate-400 font-bold m-0 uppercase tracking-widest">
              {doneCount} of {totalSteps} steps completed
            </p>
            <div className="mt-4 px-3 py-1 bg-white/20 dark:bg-slate-800 rounded-full text-[10px] font-black text-white dark:text-indigo-400 uppercase tracking-widest w-fit">
              Keep going!
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Content Section ──────────────────────────────────── */}
      <div className="flex-1 px-10 md:px-20 py-16 relative z-20">

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {STEPS.map((step, index) => (
            <SetupCard
              key={step.id}
              step={step}
              isCompleted={completedSteps.has(step.id)}
              onStart={(s) => navigate(s.to)}
            />
          ))}
        </div>

        {/* Footer Link */}
        <div className="mt-20 flex justify-center">
          <button
            onClick={handleDismiss}
            className="bg-transparent border-none text-slate-400 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-400 text-sm font-black uppercase tracking-widest cursor-pointer flex items-center gap-3 transition-colors group"
          >
            Want to skip the onboarding?
            <span className="text-orange-600 dark:text-orange-500 font-black flex items-center gap-1 group-hover:underline">
              <X size={14} /> Dismiss onboarding
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const SetupCard = ({ step, isCompleted, onStart }) => (
  <motion.div
    whileHover={{ y: -6 }}
    className="relative p-[1px] rounded-[2rem] overflow-hidden group/card"
  >
    {/* Border Animation Layer */}
    <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0deg,transparent_120deg,rgba(93,95,239,0.5)_180deg,transparent_240deg)] animate-[spin_4s_linear_infinite] opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
    
    <div
      className={`relative bg-surface dark:bg-slate-900 border ${isCompleted ? 'border-emerald-500/20 dark:border-emerald-500/10' : 'border-stroke dark:border-slate-800'} rounded-[2rem] p-8 h-full flex flex-col gap-6 transition-all duration-300 group-hover/card:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.1)] dark:group-hover/card:shadow-none`}
    >
      <div 
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm`}
        style={{ 
          background: isCompleted ? '#ecfdf5' : step.bg,
          color: isCompleted ? '#10b981' : step.color 
        }}
      >
        {step.icon}
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 leading-tight tracking-tight">
          {step.title}
        </h3>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
          {step.desc}
        </p>
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
          <Clock size={12} /> {step.est}
        </div>
      </div>

      <div className="mt-4">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 text-xs font-black uppercase tracking-widest">
            <CheckCircle2 size={16} /> Completed
          </div>
        ) : (
          <button
            onClick={() => onStart(step)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-bg dark:bg-slate-950/40 border border-stroke dark:border-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest hover:bg-orange-600 hover:text-white dark:hover:bg-orange-600 hover:border-orange-600 transition-all duration-300 group"
          >
            Start <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  </motion.div>
)

const ProgressCircle = ({ percentage }) => {
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const count = useMotionValue(0)
  const rounded = useTransform(count, Math.round)

  useEffect(() => {
    const controls = animate(count, percentage, { duration: 1, ease: "easeOut" })
    return controls.stop
  }, [percentage, count])

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg className="w-full h-full" viewBox="0 0 84 84">
        <circle
          cx="42" cy="42" r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth="8"
          className="dark:stroke-slate-800"
        />
        <motion.circle
          cx="42" cy="42" r={radius}
          fill="none" stroke="#ea580c" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-black text-slate-900 dark:text-white">
        <motion.span>{rounded}</motion.span>%
      </div>
    </div>
  )
}
