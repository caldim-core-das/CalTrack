import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
    CalendarRange, Clock, MapPin, Tag, Users,
    CheckCircle2, ArrowRight, X
} from "lucide-react"
import { useAuth } from "../../state/auth/useAuth.js"
import { routes } from "../routes.js"

/* ── Setup steps data ─────────────────────────────────────────── */
const STEPS = [
    {
        id: "schedule",
        title: "Create a work schedule",
        desc: "Plan your team's work hours and breaks.",
        icon: <CalendarRange size={28} strokeWidth={1.5} />,
        time: "3 min",
        color: "#6366f1",
        to: routes.settings_schedules,
    },
    {
        id: "timetracking",
        title: "Define rules for time tracking",
        desc: "Take control of how your team members clock in and out.",
        icon: <Clock size={28} strokeWidth={1.5} />,
        time: "5 min",
        color: "#f97316",
        to: routes.settings_timetracking,
    },
    {
        id: "projects",
        title: "Add activities and projects",
        desc: "Add a few activities and projects that you want to track time against.",
        icon: <Tag size={28} strokeWidth={1.5} />,
        time: "2 min",
        color: "#8b5cf6",
        to: routes.settings_projects,
    },
    {
        id: "locations",
        title: "List work locations",
        desc: "Add your locations where your team members will be clocking in and out.",
        icon: <MapPin size={28} strokeWidth={1.5} />,
        time: "2 min",
        color: "#10b981",
        to: routes.settings_locations,
    },
    {
        id: "people",
        title: "Invite your team",
        desc: "Add your first team members to get started.",
        icon: <Users size={28} strokeWidth={1.5} />,
        time: "5 min",
        color: "#3b82f6",
        to: routes.settings_people,
    },
]

/* ── Circular progress ring ───────────────────────────────────── */
function ProgressRing({ pct, size = 80, stroke = 7 }) {
    const r = (size - stroke) / 2
    const circ = 2 * Math.PI * r
    const offset = circ - (pct / 100) * circ
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke="#f97316"
                strokeWidth={stroke}
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
        </svg>
    )
}

export function GetStartedPage() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [completed, setCompleted] = useState(new Set(["people"])) // demo: last step already done
    const [dismissed, setDismissed] = useState(false)

    const username = user?.username || "there"
    const displayName = username.charAt(0).toUpperCase() + username.slice(1)

    const doneCount = completed.size
    const total = STEPS.length
    const pct = Math.round((doneCount / total) * 100)

    function markDone(id) {
        setCompleted(prev => new Set([...prev, id]))
    }

    if (dismissed) {
        navigate(routes.dashboard)
        return null
    }

    return (
        <div className="gs-page">
            {/* ── HERO BANNER ── */}
            <div className="gs-hero">
                {/* Decorative background logos */}
                <div className="gs-hero-bg-text" aria-hidden>
                    CALTIMS CALTIMS CALTIMS
                </div>

                {/* Person illustration circle */}
                <div className="gs-hero-person">
                    <div className="gs-hero-person-circle" />
                    <div className="gs-hero-avatar">
                        <Users size={64} strokeWidth={1} color="rgba(255,255,255,0.45)" />
                    </div>
                </div>

                {/* Greeting card */}
                <div className="gs-hero-card">
                    <div className="gs-hero-greeting">
                        Hi <strong>{displayName}!</strong> 👋 <em>Welcome to CalTrack</em>
                    </div>
                    <p className="gs-hero-sub">
                        Let's quickly set things up so you can start tracking time like a pro.
                    </p>
                    <button
                        className="gs-start-btn"
                        onClick={() => document.querySelector(".gs-steps")?.scrollIntoView({ behavior: "smooth" })}
                    >
                        Start onboarding
                    </button>
                </div>

                {/* Brand watermark */}
                <div className="gs-hero-brand">
                    <span className="gs-brand-mark">⊠</span> CalTrack
                </div>
            </div>

            {/* ── PROGRESS ── */}
            <div className="gs-progress-row">
                <div className="gs-progress-ring-wrap">
                    <ProgressRing pct={pct} size={72} stroke={8} />
                    <span className="gs-progress-pct">{pct}%</span>
                </div>
                <div className="gs-progress-text">
                    <div className="gs-progress-title">Complete setting up your organization</div>
                    <div className="gs-progress-sub">{doneCount} of {total} steps completed</div>
                </div>
            </div>

            {/* ── SETUP CARDS ── */}
            <div className="gs-steps">
                {STEPS.map((step) => {
                    const done = completed.has(step.id)
                    return (
                        <div key={step.id} className={`gs-step-card${done ? " done" : ""}`}>
                            <div className="gs-step-icon" style={{ color: step.color, background: `${step.color}15` }}>
                                {step.icon}
                            </div>
                            <div className="gs-step-body">
                                <div className="gs-step-title">{step.title}</div>
                                <p className="gs-step-desc">{step.desc}</p>
                                <div className="gs-step-meta">
                                    <span className="gs-step-time">⏱ {step.time}</span>
                                </div>
                            </div>
                            <div className="gs-step-action">
                                {done ? (
                                    <div className="gs-step-done-badge">
                                        <CheckCircle2 size={16} /> Completed
                                    </div>
                                ) : (
                                    <button
                                        className="gs-step-btn"
                                        onClick={() => { markDone(step.id); navigate(step.to) }}
                                    >
                                        Start <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* ── DISMISS ── */}
            <div className="gs-dismiss-row">
                <span>Want to skip the onboarding and hide this page?</span>
                <button className="gs-dismiss-btn" onClick={() => setDismissed(true)}>
                    <X size={13} /> Dismiss onboarding
                </button>
            </div>
        </div>
    )
}
