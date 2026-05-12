import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    CalendarRange, Clock, MapPin, Tag, Users,
    CheckCircle2, ArrowRight, X, Sparkles, Rocket,
    Target, Layout, Zap, ChevronRight, Plus
} from "lucide-react"
import { useAuth } from "../../state/auth/useAuth.js"
import { routes } from "../routes.js"
import { Card, Button, Pill } from "../components/kit.jsx"
import { BauhausCard } from "../components/ui/bauhaus-card.jsx"

/* ── Setup steps data ─────────────────────────────────────────── */
const STEPS = [
    {
        id: "schedule",
        title: "Mission Timeline",
        desc: "Configure team operational hours and tactical break intervals.",
        icon: <CalendarRange size={24} />,
        time: "3m",
        color: "primary",
        to: routes.settings_schedules,
    },
    {
        id: "timetracking",
        title: "Operational Rules",
        desc: "Define the protocols for deployment and retrieval sequences.",
        icon: <Clock size={24} />,
        time: "5m",
        color: "orange-500",
        to: routes.settings_timetracking,
    },
    {
        id: "projects",
        title: "Project Matrix",
        desc: "Initialize the activity clusters and strategic project nodes.",
        icon: <Tag size={24} />,
        time: "2m",
        color: "indigo-500",
        to: routes.settings_projects,
    },
    {
        id: "locations",
        title: "Work Geofences",
        desc: "Map out the precise coordinates for mission deployment.",
        icon: <MapPin size={24} />,
        time: "2m",
        color: "emerald-500",
        to: routes.settings_locations,
    },
    {
        id: "people",
        title: "Personnel Influx",
        desc: "Authorize and onboard the initial workforce contingent.",
        icon: <Users size={24} />,
        time: "5m",
        color: "sky-500",
        to: routes.settings_people,
    },
]

/* ── Progress Component ───────────────────────────────────────── */
function CircularProgress({ pct }) {
    const r = 32, circ = 2 * Math.PI * r
    return (
        <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform">
                <circle cx="40" cy="40" r={r} fill="transparent" stroke="currentColor" strokeWidth="6" className="text-border/20" />
                <motion.circle 
                    cx="40" cy="40" r={r} fill="transparent" stroke="currentColor" strokeWidth="6" 
                    strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="text-primary" strokeLinecap="round"
                />
            </svg>
            <span className="absolute text-sm font-black text-fg font-sans select-none">{pct}%</span>
        </div>
    )
}

export function GetStartedPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [completed, setCompleted] = useState(new Set(["people"]))
    const [dismissed, setDismissed] = useState(false)

    const username = user?.username || "Commander"
    const displayName = username.charAt(0).toUpperCase() + username.slice(1)

    const doneCount = completed.size
    const total = STEPS.length
    const pct = Math.round((doneCount / total) * 100)

    const containerVars = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
    }

    const itemVars = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 }
    }

    if (dismissed) {
        navigate(routes.dashboard)
        return null
    }

    return (
        <div className="min-h-screen bg-[#F6F8FA] p-8 flex flex-col gap-12 overflow-x-hidden font-sans">
            {/* ── CINEMATIC HERO ── */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative h-[440px] rounded-[3.5rem] overflow-hidden group border border-slate-200 shadow-2xl"
            >
                {/* Dynamic Background (Darker & More Vibrant) */}
                <div className="absolute inset-0 bg-[#0E1116]">
                    <div className="absolute inset-0 opacity-15 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                    
                    {/* Animated Blobs */}
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.2, 1],
                            rotate: [0, 90, 0],
                            x: [0, 100, 0],
                            y: [0, 50, 0] 
                        }} 
                        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -top-40 -right-20 w-[40rem] h-[40rem] bg-indigo-600/40 blur-[140px] rounded-full" 
                    />
                    <motion.div 
                        animate={{ 
                            scale: [1, 1.1, 1],
                            rotate: [0, -45, 0],
                            x: [0, -120, 0],
                            y: [0, 80, 0] 
                        }} 
                        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute -bottom-60 -left-40 w-[50rem] h-[50rem] bg-blue-500/30 blur-[160px] rounded-full" 
                    />
                    
                    {/* Glass Overlay for Depth */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E1116] via-transparent to-transparent opacity-80" />
                </div>



                {/* Unique Background Watermark (Full Cover Outline) */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none overflow-hidden">
                    <h1 
                        className="text-[22vw] font-black leading-none whitespace-nowrap tracking-[-0.05em] text-transparent font-sans uppercase"
                        style={{ WebkitTextStroke: '1.5px white' }}
                    >
                        INITIATE
                    </h1>
                </div>

                {/* Hero Card Content */}
                <div className="absolute inset-0 flex items-center px-20">
                    <motion.div 
                        initial={{ x: -60, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
                        className="max-w-2xl space-y-10"
                    >
                        <div className="space-y-6">

                            
                            <div className="space-y-3">
                                <h1 className="text-7xl font-black text-white tracking-tighter leading-[1.1] font-sans">
                                    Welcome, <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">{displayName}.</span>
                                </h1>
                                <p className="text-xl text-slate-300 font-medium leading-relaxed max-w-lg italic opacity-90 font-sans">
                                    "Your mission intelligence is ready. Complete the initial protocols to synchronize workforce operations."
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                            <Button 
                                variant="primary" 
                                className="!bg-white !text-slate-900 hover:bg-slate-50 px-14 py-6 text-base font-black rounded-2xl shadow-2xl shadow-black/50 tracking-tight font-sans"
                                onClick={() => document.getElementById('onboarding-grid')?.scrollIntoView({ behavior: 'smooth' })}
                            >
                                Initialize Sequence <ArrowRight className="ml-3" size={20} />
                            </Button>
                        </div>
                    </motion.div>
                </div>

                {/* Relocated Social Stack (Bottom-Right Corner) */}
                <div className="absolute bottom-12 right-12 flex flex-col items-end gap-3 pointer-events-none select-none">
                    <div className="flex -space-x-3">
                        <div className="w-10 h-10 rounded-full border-2 border-[#0E1116] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white shadow-xl z-30 font-sans">JD</div>
                        <div className="w-10 h-10 rounded-full border-2 border-[#0E1116] bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-black text-white shadow-xl z-20 font-sans">RK</div>
                        <div className="w-10 h-10 rounded-full border-2 border-[#0E1116] bg-slate-800 flex items-center justify-center text-[10px] font-black text-blue-400 border-dashed z-10 font-sans">
                            <Plus size={12} />
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-tight font-sans">12+ Lead Sync</span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest opacity-60 font-sans">Verified</span>
                    </div>
                </div>
            </motion.div>

            {/* ── PROGRESS TERMINAL ── */}
            <motion.div 
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="max-w-6xl mx-auto w-full flex flex-col md:flex-row items-center gap-12 p-10 bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-200 shadow-xl relative group"
            >
                <div className="relative">
                    <CircularProgress pct={pct} />
                    <div className="absolute -inset-2 bg-primary/5 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                <div className="flex-1 space-y-4 w-full">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-[#0E1116] tracking-tight flex items-center gap-3 font-sans uppercase">
                            Organization Neural Sync
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                        </h3>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-sans">{doneCount} / {total} Nodes Synchronized</span>
                    </div>
                    
                    <div className="relative h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${pct}%` }} 
                            transition={{ duration: 2, delay: 1, ease: "circOut" }}
                            className="h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full" 
                        />
                    </div>
                </div>

                {/* Simplified Right-Side Social View */}
                <div className="hidden lg:flex items-center gap-6 pl-10 border-l border-slate-100">
                    <div className="flex -space-x-3">
                        <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[9px] font-black text-white shadow-md z-30 font-sans">JD</div>
                        <div className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[9px] font-black text-white shadow-md z-20 font-sans">RK</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</div>
                        <Pill tone={pct > 50 ? "good" : "neutral"} className="px-3 py-1 rounded-lg text-[9px] font-black font-sans uppercase">
                            {pct === 100 ? "Active" : "Syncing"}
                        </Pill>
                    </div>
                </div>
            </motion.div>

            {/* ── LINEAR PROTOCOL TIMELINE (Bauhaus Edition) ── */}
            <div className="relative max-w-[98vw] mx-auto w-full px-8 overflow-x-auto custom-scrollbar pb-16">
                {/* Global Connection Line */}
                <div className="absolute top-[180px] left-32 right-32 h-[1px] bg-slate-300 z-0 opacity-20 hidden xl:block" />
                
                <motion.div 
                    id="onboarding-grid"
                    variants={containerVars}
                    initial="hidden"
                    animate="show"
                    className="flex flex-nowrap lg:grid lg:grid-cols-5 gap-8 min-w-[1400px] lg:min-w-0"
                >
                    {STEPS.map((step, idx) => {
                        const done = completed.has(step.id)
                        const stepNum = (idx + 1).toString().padStart(2, '0')
                        
                        return (
                            <motion.div key={step.id} variants={itemVars} className="relative flex-shrink-0 w-[320px] lg:w-auto h-full">
                                <BauhausCard
                                    id={step.id}
                                    accentColor={done ? "#10b981" : "#156ef6"}
                                    backgroundColor="var(--bauhaus-card-bg)"
                                    separatorColor="var(--bauhaus-card-separator)"
                                    topInscription={`Protocol Node ${stepNum}`}
                                    mainText={step.title}
                                    subMainText={step.desc}
                                    progressBarInscription="Network Sync Status:"
                                    progress={done ? 100 : 0}
                                    progressValue={done ? "Synchronized" : `Queue: ${step.time}`}
                                    filledButtonInscription={done ? "Initialized" : "Begin"}
                                    onFilledButtonClick={() => !done && navigate(step.to)}
                                    onMoreOptionsClick={() => console.log('Options for', step.id)}
                                    textColorTop="var(--bauhaus-card-inscription-top)"
                                    textColorMain="var(--bauhaus-card-inscription-main)"
                                    textColorSub="var(--bauhaus-card-inscription-sub)"
                                    textColorProgressLabel="var(--bauhaus-card-inscription-progress-label)"
                                    textColorProgressValue="var(--bauhaus-card-inscription-progress-value)"
                                    progressBarBackground="var(--bauhaus-card-progress-bar-bg)"
                                    chronicleButtonBg="var(--bauhaus-chronicle-bg)"
                                    chronicleButtonFg="var(--bauhaus-chronicle-fg)"
                                    chronicleButtonHoverFg="var(--bauhaus-chronicle-hover-fg)"
                                />
                            </motion.div>
                        )
                    })}
                </motion.div>
            </div>

            {/* ── FOOTER ACTIONS ── */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="flex flex-col items-center gap-6 py-16 border-t border-slate-100"
            >
                <div className="flex items-center gap-3 text-slate-400 text-sm font-bold uppercase tracking-[0.2em] opacity-60">
                    Deployment Safeguard Active
                </div>
                <button 
                    onClick={() => setDismissed(true)}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-black text-slate-500 hover:text-[#0E1116] uppercase tracking-widest border border-transparent hover:border-slate-200"
                >
                    <X size={16} /> Bypass Onboarding Process
                </button>
            </motion.div>
        </div>
    )
}
