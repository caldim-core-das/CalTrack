import { useEffect, useMemo, useRef, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"

import { isOffline } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { routes } from "../routes.js"
import { ThemeToggle } from "./ThemeToggle.jsx"
import { CommandPalette } from "./CommandPalette.jsx"
import { NotificationCenter } from "./NotificationCenter.jsx"
import { CalTrackLogo } from "../components/CalTrackLogo.jsx"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { NotificationService } from "../../utils/notifications.js"

import {
  Home,
  Clock,
  CheckSquare,
  CalendarDays,
  Banknote,
  CalendarRange,
  Users,
  BarChart3,
  MapPin,
  Settings,
  Search,
  LogOut,
  User,
  SlidersHorizontal,
  MoreHorizontal,
  CreditCard,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  History,
  Sun,
  Briefcase,
  Tag,
  Plug,
  Timer,
  Rocket
} from "lucide-react"

const NAV = [
  { label: "Get Started", to: routes.get_started, icon: <Rocket size={18} strokeWidth={2.5} color="#8B5CF6" /> },
  { label: "Dashboard", to: routes.dashboard, icon: <Home size={18} strokeWidth={2.5} color="#2563EB" /> },
  { label: "Locations", to: routes.locations, icon: <MapPin size={18} strokeWidth={2.5} color="#6366F1" /> },
  { label: "Live Tracking", to: routes.live_locations, icon: <MapPin size={18} strokeWidth={3} color="#F97316" />, adminOnly: true },
  { label: "Time", to: routes.time, icon: <Clock size={18} strokeWidth={2.5} color="#06B6D4" /> },
  { label: "Tasks", to: routes.tasks, icon: <CheckSquare size={18} strokeWidth={2.5} color="#10B981" /> },
  { label: "Leaves", to: routes.leaves, icon: <CalendarDays size={18} strokeWidth={2.5} color="#F43F5E" /> },
  { label: "Payroll", to: routes.payroll, icon: <Banknote size={18} strokeWidth={2.5} color="#EAB308" /> },
  { label: "Scheduling", to: routes.scheduling, icon: <CalendarRange size={18} strokeWidth={2.5} color="#EC4899" /> },
  { label: "Employees", to: routes.employees, icon: <Users size={18} strokeWidth={2.5} color="#A855F7" />, adminOnly: true },
  { label: "Reports", to: routes.reports, icon: <BarChart3 size={18} strokeWidth={2.5} color="#F59E0B" />, adminOnly: true },
  {
    label: "Settings",
    to: routes.settings,
    icon: <Settings size={18} strokeWidth={2.5} color="#64748B" />,
    children: [
      { label: "People", to: routes.settings_people, icon: <Users size={17} strokeWidth={2.2} color="#A855F7" /> },
      { label: "Time Tracking", to: routes.settings_timetracking, icon: <Timer size={17} strokeWidth={2.2} color="#06B6D4" /> },
      { label: "Work Schedules", to: routes.settings_schedules, icon: <Sun size={17} strokeWidth={2.2} color="#F59E0B" /> },
      { label: "Time Off & Holidays", to: routes.settings_holidays, icon: <Briefcase size={17} strokeWidth={2.2} color="#F43F5E" /> },
      { label: "Locations", to: routes.settings_locations, icon: <MapPin size={17} strokeWidth={2.2} color="#6366F1" /> },
      { label: "Activities & Projects", to: routes.settings_projects, icon: <Tag size={17} strokeWidth={2.2} color="#10B981" /> },
      { label: "Organization", to: routes.settings_organization, icon: <Settings size={17} strokeWidth={2.2} color="#64748B" /> },
      { label: "Integrations", to: routes.settings_integrations, icon: <Plug size={17} strokeWidth={2.2} color="#2563EB" /> },
    ],
  },
]

const THEME_STORAGE_KEY = "quicktims.theme"


function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  window.dispatchEvent(new CustomEvent("quicktims:theme", { detail: theme }))
}

function getInitialTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === "dark" || stored === "light") return stored
  const ds = document.documentElement.dataset.theme
  if (ds === "dark" || ds === "light") return ds
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function initials(username) {
  const s = String(username || "").trim()
  if (!s) return "U"
  const parts = s.split(/\s+/).filter(Boolean)
  const first = (parts[0] || "").slice(0, 1)
  const second = (parts.length > 1 ? parts[1] : parts[0] || "").slice(1, 2)
  return (first + second).toUpperCase()
}

function displayName(username) {
  const s = String(username || "").trim()
  if (!s) return ""
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ── Sidebar Tooltip (JS portal, never clipped) ──────────────── */
function SidebarTooltip({ tooltip }) {
  if (!tooltip) return null
  const style = {
    position: "fixed",
    top: tooltip.y,
    left: tooltip.x + 12,
    transform: "translateY(-50%)",
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(8px)",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 999999,
    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.4)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
  }
  return <div style={style}>{tooltip.label}</div>
}

/* ── Submenu Flyout ────────────────────────────────────────── */
function SubmenuFlyout({ flyout, onMouseEnter, onMouseLeave }) {
  if (!flyout) return null
  const style = {
    position: "fixed",
    top: flyout.y !== null ? flyout.y : "auto",
    bottom: flyout.bottom !== null ? flyout.bottom : "auto",
    left: flyout.x - 12, // Larger overlap with sidebar
    background: "transparent",
    paddingLeft: "20px", // Larger bridge area to "catch" the mouse
    zIndex: 999998,
    pointerEvents: "auto", // Ensure it catches events
  }

  const innerStyle = {
    background: "#fff",
    color: "#0f172a",
    padding: "8px",
    borderRadius: "12px",
    minWidth: "200px",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
    border: "1px solid rgba(0, 0, 0, 0.05)",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  }

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="submenuFlyout"
    >
      <div style={innerStyle} onMouseEnter={onMouseEnter}>
        <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {flyout.label}
        </div>
        {flyout.children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: "13.5px",
              fontWeight: 600,
              color: isActive ? "#2563eb" : "#475569",
              background: isActive ? "#f1f5f9" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s ease",
            })}
            className="flyoutItem"
            onClick={() => setFlyout(null)}
          >
            {child.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}


export function AppShell() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [offline, setOffline] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [accountView, setAccountView] = useState(null)
  const [prefTab, setPrefTab] = useState("general")
  const [theme, setTheme] = useState(() => getInitialTheme())
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [orgName, setOrgName] = useState(() => localStorage.getItem("quicktims.orgName") || "")
  const [settingsExpanded, setSettingsExpanded] = useState(true)
  const [tooltip, setTooltip] = useState(null) // { label, x, y }
  const [flyout, setFlyout] = useState(null) // { label, children, x, y }
  const flyoutTimerRef = useRef(null)

  const showTooltip = (label, e) => {
    if (!sidebarCollapsed) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ label, x: rect.right, y: rect.top + rect.height / 2 })
  }
  const hideTooltip = () => setTooltip(null)

  const showFlyout = (item, e) => {
    if (!sidebarCollapsed || !item.children) return
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const isBottomHalf = rect.top > window.innerHeight / 2

    setFlyout({
      label: item.label,
      children: item.children,
      x: rect.right,
      y: isBottomHalf ? null : rect.top,
      bottom: isBottomHalf ? window.innerHeight - rect.bottom : null,
    })
  }

  const hideFlyout = () => {
    flyoutTimerRef.current = setTimeout(() => {
      setFlyout(null)
    }, 1200)
  }

  const cancelHideFlyout = () => {
    if (flyoutTimerRef.current) clearTimeout(flyoutTimerRef.current)
  }

  useEffect(() => {
    const name = (localStorage.getItem("quicktims.orgName") || "").trim()
    if (!name) navigate(routes.onboarding, { replace: true })
  }, [location.pathname, navigate])

  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("quicktims.prefs")
      const obj = raw ? JSON.parse(raw) : {}
      return {
        language: obj.language || "English",
        groupTimeEntries: obj.groupTimeEntries ?? true,
        compactProjectList: obj.compactProjectList || "Collapse if too many projects",
        compactProjectLimit: obj.compactProjectLimit || 50,
        taskFilter: obj.taskFilter ?? false,
        dateFormat: obj.dateFormat || "DD/MM/YYYY",
        timeFormat: obj.timeFormat || "24-hour",
        dayStart: obj.dayStart || "09:00",
      }
    } catch {
      return {
        language: "English",
        groupTimeEntries: true,
        compactProjectList: "Collapse if too many projects",
        compactProjectLimit: 50,
        taskFilter: false,
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24-hour",
        dayStart: "09:00",
      }
    }
  })

  const [emailPrefs, setEmailPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("quicktims.emailPrefs")
      const obj = raw ? JSON.parse(raw) : {}
      return {
        newsletter: !!obj.newsletter,
        onboarding: obj.onboarding ?? true,
        weeklyReport: !!obj.weeklyReport,
        longRunningTimer: !!obj.longRunningTimer,
        scheduledReports: obj.scheduledReports ?? true,
        approval: obj.approval ?? true,
        timeOff: obj.timeOff ?? true,
        alerts: obj.alerts ?? true,
        reminders: obj.reminders ?? true,
        schedule: obj.schedule ?? true,
        invoices: !!obj.invoices,
      }
    } catch {
      return {
        newsletter: false,
        onboarding: true,
        weeklyReport: false,
        longRunningTimer: false,
        scheduledReports: true,
        approval: true,
        timeOff: true,
        alerts: true,
        reminders: true,
        schedule: true,
        invoices: false,
      }
    }
  })

  const [apiKeys, setApiKeys] = useState(() => {
    try {
      const raw = localStorage.getItem("quicktims.apiKeys")
      const xs = raw ? JSON.parse(raw) : []
      return Array.isArray(xs) ? xs : []
    } catch {
      return []
    }
  })
  const [webhooks, setWebhooks] = useState(() => {
    try {
      const raw = localStorage.getItem("quicktims.webhooks")
      const xs = raw ? JSON.parse(raw) : []
      return Array.isArray(xs) ? xs : []
    } catch {
      return []
    }
  })
  const [workspace, setWorkspace] = useState(() => localStorage.getItem("quicktims.orgName") || "ok")

  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false)
  const [apiKeyName, setApiKeyName] = useState("")
  const [apiKeyNameErr, setApiKeyNameErr] = useState("")

  const [webhookModalOpen, setWebhookModalOpen] = useState(false)
  const [webhookName, setWebhookName] = useState("")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [webhookEvent, setWebhookEvent] = useState("")
  const [webhookErr, setWebhookErr] = useState("")

  useEffect(() => {
    const t = setInterval(() => setOffline(isOffline()), 1500)
    return () => clearInterval(t)
  }, [])

  // Auto-logout when JWT expires and refresh fails
  useEffect(() => {
    function handleSessionExpired() {
      logout()
      navigate("/login", { replace: true })
    }
    window.addEventListener("quicktims:session-expired", handleSessionExpired)
    return () => window.removeEventListener("quicktims:session-expired", handleSessionExpired)
  }, [logout, navigate])

  useEffect(() => {
    function syncOrg() {
      const name = localStorage.getItem("quicktims.orgName") || ""
      setOrgName(name)
      setWorkspace(name || "ok")
    }
    window.addEventListener("storage", syncOrg)
    window.addEventListener("quicktims:orgName", syncOrg)
    return () => {
      window.removeEventListener("storage", syncOrg)
      window.removeEventListener("quicktims:orgName", syncOrg)
    }
  }, [])

  // --- GPS Auto Clock-in/out & Reminders ---
  useEffect(() => {
    if (!user) return

    NotificationService.requestPermission()

    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // metres
      const p1 = lat1 * Math.PI / 180;
      const p2 = lat2 * Math.PI / 180;
      const dp = (lat2 - lat1) * Math.PI / 180;
      const dl = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c);
    }

    let lastReminderDate = null
    let autoClockedInToday = false
    let autoClockedOutToday = false

    const checkGeofence = async () => {
      try {
        const now = new Date()
        const currentHour = now.getHours()
        const todayStr = now.toDateString()

        // 1. Get current session
        const sessionRes = await apiRequest("/time/current-session/")
        const isActive = sessionRes && sessionRes.active

        // 2. Get locations
        let locations = []
        try {
          locations = await apiRequest("/time/locations/")
        } catch (e) { }

        // Filter valid auto-locations (radius >= 300)
        const validLocations = (locations || []).filter(l => l.geofence_radius >= 300)

        // Reset daily flags
        if (lastReminderDate !== todayStr) {
          lastReminderDate = todayStr
          autoClockedInToday = false
          autoClockedOutToday = false
        }

        // 3. Time-based evening reminder (fallback)
        if (currentHour >= 18 && isActive && !autoClockedOutToday) {
          NotificationService.sendClockOutReminder()
          autoClockedOutToday = true
        }

        // 4. GPS Auto Clock / Reminders
        if (navigator.geolocation && validLocations.length > 0) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const { latitude, longitude } = pos.coords

              let insideAny = false
              for (const loc of validLocations) {
                const dist = calculateDistance(latitude, longitude, parseFloat(loc.lat), parseFloat(loc.lng))
                if (dist <= loc.geofence_radius) {
                  insideAny = true
                  break
                }
              }

              if (insideAny && !isActive && !autoClockedInToday) {
                // Entered Geofence - Auto Clock In
                try {
                  await apiRequest("/time/clock-in/", { method: "POST", json: { notes: "Auto clock-in via Geofence" } })
                  NotificationService.send("Auto Clock-in", "You entered the workplace geofence. Clocked in successfully.")
                  autoClockedInToday = true
                } catch (e) {
                  NotificationService.send("GPS Reminder", "You are at work. Remember to clock in!")
                }
              } else if (!insideAny && isActive && !autoClockedOutToday) {
                // Exited Geofence - Auto Clock Out
                try {
                  await apiRequest("/time/clock-out/", { method: "POST" })
                  NotificationService.send("Auto Clock-out", "You left the workplace geofence. Clocked out successfully.")
                  autoClockedOutToday = true
                  // Reset autoClockedInToday so they can auto clock back in later if they return
                  autoClockedInToday = false
                } catch (e) {
                  NotificationService.send("GPS Reminder", "You left work. Remember to clock out!")
                }
              }
            },
            (err) => console.debug("GPS Check failed", err),
            { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
          )
        }
      } catch (err) {
        console.error("Geofence check failed", err)
      }
    }

    // Check every 2 minutes for geofence entry/exit
    const timer = setInterval(checkGeofence, 120000)
    checkGeofence() // Initial check

    return () => clearInterval(timer)
  }, [user])


  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem("quicktims.prefs", JSON.stringify(prefs))
  }, [prefs])

  useEffect(() => {
    localStorage.setItem("quicktims.emailPrefs", JSON.stringify(emailPrefs))
  }, [emailPrefs])

  useEffect(() => {
    localStorage.setItem("quicktims.apiKeys", JSON.stringify(apiKeys))
  }, [apiKeys])

  useEffect(() => {
    localStorage.setItem("quicktims.webhooks", JSON.stringify(webhooks))
  }, [webhooks])

  useEffect(() => {
    setWorkspaceMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!workspaceMenuOpen) return

    function onKeyDown(e) {
      if (e.key === "Escape") {
        setWorkspaceMenuOpen(false)
      }
    }

    function onPointerDown(e) {
      const t = e.target
      if (!(t instanceof Element)) return
      if (t.closest(".workspaceMenuWrap")) return
      setWorkspaceMenuOpen(false)
    }

    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("pointerdown", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("pointerdown", onPointerDown)
    }
  }, [workspaceMenuOpen])

  if (!user) return null

  const items = NAV.filter((i) => !i.adminOnly || user.role === "admin")
  const email = `${user.username}@caldim.com`

  function closeAccount() {
    setAccountView(null)
  }

  function openMyProfile() {
    setProfileOpen(false)
    setAccountView("profile")
  }

  function openPreferences() {
    setProfileOpen(false)
    setPrefTab("general")
    setAccountView("preferences")
  }

  function randKey(len = 32) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const arr = new Uint8Array(len)
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(arr)
    else {
      for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 256)
    }
    let out = ""
    for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length]
    return out
  }

  function openApiKeyModal() {
    setApiKeyName("")
    setApiKeyNameErr("")
    setApiKeyModalOpen(true)
  }

  function generateApiKey() {
    const name = apiKeyName.trim()
    if (!name) {
      setApiKeyNameErr("Name is mandatory")
      return
    }
    const createdAt = new Date().toISOString()
    const item = { id: `${Date.now()}`, name, createdAt, key: randKey(36) }
    setApiKeys((xs) => [item, ...xs])
    setApiKeyModalOpen(false)
  }

  function openWebhookModal() {
    setWebhookName("")
    setWebhookUrl("")
    setWebhookEvent("")
    setWebhookErr("")
    setWebhookModalOpen(true)
  }

  function createWebhook() {
    const name = webhookName.trim()
    const url = webhookUrl.trim()
    const event = webhookEvent.trim()
    if (!name) return setWebhookErr("Name is mandatory")
    if (!url) return setWebhookErr("Endpoint URL is mandatory")
    if (!event) return setWebhookErr("Event is mandatory")
    const createdAt = new Date().toISOString()
    const item = { id: `${Date.now()}`, workspace, name, url, event, createdAt }
    setWebhooks((xs) => [item, ...xs])
    setWebhookModalOpen(false)
  }

  return (
    <div className={["app", sidebarCollapsed ? "app-collapsed" : ""].filter(Boolean).join(" ")}>
      <CommandPalette open={cmdOpen} setOpen={setCmdOpen} />
      {/* ── Topbar ───────────────────────────── */}
      <header className="topbar">
        {/* Left: Brand */}
        <div className="topbarLeft">
          <div className="brand">
            <CalTrackLogo size="sm" />
            <span className="brandOrgName" title={orgName || workspace}>
              {orgName || workspace}
            </span>
            <div className="workspaceMenuWrap">
              <button
                type="button"
                className="workspaceDotsBtn"
                aria-label="Workspace menu"
                title="Workspace menu"
                onClick={() => setWorkspaceMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={18} strokeWidth={2.5} />
              </button>
              {workspaceMenuOpen && (
                <div className="workspaceDropdown" role="menu" aria-label="Workspace actions" style={{ zIndex: 99999 }}>
                  <button
                    type="button"
                    className="wsMenuRow"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      navigate(`${routes.settings}?section=organization`)
                    }}
                  >
                    <span className="wsMenuIcon"><Settings size={18} /></span>
                    <span>Workspace settings</span>
                  </button>
                  <button
                    type="button"
                    className="wsMenuRow"
                    onClick={() => {
                      setWorkspaceMenuOpen(false)
                      navigate(`${routes.settings}?section=plan`)
                    }}
                  >
                    <span className="wsMenuIcon"><CreditCard size={18} /></span>
                    <span>Subscription</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions & Profile */}
        <div className="topbarRight">
          {offline && (
            <span className="topbarBadge warnPulse" title="Backend unreachable — showing demo data">
              <span className="pulseDot"></span> Demo Mode
            </span>
          )}

          <button
            type="button"
            className="topbar-search-btn"
            onClick={() => setCmdOpen(true)}
            title="Search command palette (⌘K)"
          >
            <Search size={15} className="searchIcon" />
            <span className="searchText">Search everywhere...</span>
            <span className="searchKbd">⌘K</span>
          </button>

          <div className="topbarDivider"></div>

          <div className="topbarActions">
            <NotificationCenter />
            <ThemeToggle />
          </div>

          <div className="topbarDivider"></div>

          <div
            className="profileMenuWrap"
            onMouseEnter={() => setProfileOpen(true)}
            onMouseLeave={() => setProfileOpen(false)}
          >
            <button className="userIconBtn" type="button" aria-label="Account menu" title="Account">
              <div className="userAvatarWrap">
                <div className="userAvatar">{user.username.charAt(0).toUpperCase()}</div>
                <div className="activeStatus"></div>
              </div>
            </button>

            {profileOpen && (
              <div className="acctDropdown" role="menu">
                <div className="acctDropTop">
                  <div className="acctAvatarSq">{initials(user.username)}</div>
                  <div className="acctDropName">{displayName(user.username)}</div>
                  <div className="acctDropEmail">{email}</div>
                  <button type="button" className="acctManageBtn" onClick={openMyProfile}>
                    Manage CALDIM.com account
                  </button>
                </div>

                <div className="acctMenuList">
                  <button type="button" className="acctMenuRow" onClick={openMyProfile}>
                    <span className="acctMenuIcon"><User size={18} /></span>
                    <span>My profile</span>
                  </button>
                  <button type="button" className="acctMenuRow" onClick={openPreferences}>
                    <span className="acctMenuIcon"><SlidersHorizontal size={18} /></span>
                    <span>Preferences</span>
                  </button>
                  <button
                    type="button"
                    className="acctMenuRow danger"
                    onClick={() => {
                      setProfileOpen(false)
                      logout()
                    }}
                  >
                    <span className="acctMenuIcon"><LogOut size={18} /></span>
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {accountView && (
        <div className="acctOverlay" onMouseDown={(e) => e.target === e.currentTarget && closeAccount()}>
          <div className="acctModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="acctModalTop">
              <div className="acctModalTitle">
                {accountView === "profile" ? "My profile" : "Preferences"}
              </div>
              <button type="button" className="acctCloseBtn" onClick={closeAccount} aria-label="Close">
                <X size={16} />
              </button>
            </div>

            {accountView === "profile" ? (
              <div className="acctBody">
                <div className="acctCard">
                  <div className="acctCardHead">
                    <div className="acctCardTitle">Personal info</div>
                    <div className="acctCardSub">Your log-in credentials and the name that is displayed in reports.</div>
                  </div>
                  <div className="acctProfileGrid">
                    <div className="acctProfileLeft">
                      <div className="acctAvatarBig">{initials(user.username)}</div>
                    </div>
                    <div className="acctProfileRight">
                      <div className="acctField">
                        <div className="acctLabel">Name</div>
                        <div className="acctValue">{displayName(user.username)}</div>
                      </div>
                      <div className="acctField">
                        <div className="acctLabel">Email</div>
                        <div className="acctValue">{email}</div>
                      </div>
                      <button type="button" className="acctPrimaryBtn">
                        Manage CALDIM.com account
                      </button>
                      <button
                        type="button"
                        className="acctLogoutInline"
                        onClick={() => {
                          closeAccount()
                          logout()
                        }}
                      >
                        <LogOut size={16} /> Log out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="acctBody">
                <div className="prefTabs">
                  <button
                    type="button"
                    className={["prefTab", prefTab === "general" ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setPrefTab("general")}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    className={["prefTab", prefTab === "email" ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setPrefTab("email")}
                  >
                    Email notifications
                  </button>
                  <button
                    type="button"
                    className={["prefTab", prefTab === "advanced" ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setPrefTab("advanced")}
                  >
                    Advanced
                  </button>
                </div>

                {prefTab === "general" && (
                  <div className="prefPanel">
                    <div className="prefSection">
                      <div className="prefSectionTitle">Themes</div>
                      <div className="prefSectionSub">Choose your theme to suit your mood.</div>
                      <div className="prefRadioRow">
                        <label className="prefRadio">
                          <input type="radio" name="theme" checked={theme === "light"} onChange={() => setTheme("light")} />
                          <span>Light</span>
                        </label>
                        <label className="prefRadio">
                          <input type="radio" name="theme" checked={theme === "dark"} onChange={() => setTheme("dark")} />
                          <span>Dark</span>
                        </label>
                      </div>
                    </div>

                    <div className="prefDivider" />

                    <div className="prefSection">
                      <div className="prefSectionTitle">Language</div>
                      <div className="prefSectionSub">Set language in which Clockify is displayed in all your workspaces.</div>
                      <select
                        className="prefSelect"
                        value={prefs.language}
                        onChange={(e) => setPrefs((p) => ({ ...p, language: e.target.value }))}
                      >
                        <option value="English">English</option>
                      </select>
                    </div>

                    <div className="prefDivider" />

                    <div className="prefSection">
                      <div className="prefSectionTitle">Group time entries</div>
                      <div className="prefSectionSub">Entries for the same activity are grouped for easier overview.</div>
                      <label className="prefCheck">
                        <input
                          type="checkbox"
                          checked={prefs.groupTimeEntries}
                          onChange={(e) => setPrefs((p) => ({ ...p, groupTimeEntries: e.target.checked }))}
                        />
                        <span>Group similar time entries</span>
                      </label>
                    </div>

                    <div className="prefDivider" />

                    <div className="prefSection">
                      <div className="prefSectionTitle">Compact Project list</div>
                      <div className="prefSectionSub">Make project selection easier when you have hundreds of projects.</div>
                      <div className="prefRow2">
                        <select
                          className="prefSelect"
                          value={prefs.compactProjectList}
                          onChange={(e) => setPrefs((p) => ({ ...p, compactProjectList: e.target.value }))}
                        >
                          <option value="Collapse if too many projects">Collapse if too many projects</option>
                          <option value="Always collapse">Always collapse</option>
                          <option value="Never collapse">Never collapse</option>
                        </select>
                        <input
                          className="prefInput"
                          type="number"
                          min="1"
                          value={prefs.compactProjectLimit}
                          onChange={(e) => setPrefs((p) => ({ ...p, compactProjectLimit: Number(e.target.value) }))}
                        />
                      </div>
                    </div>

                    <div className="prefDivider" />

                    <div className="prefSection">
                      <div className="prefSectionTitle">Task filter</div>
                      <div className="prefSectionSub">Quickly find the right task in project picker by using the Task@Project syntax.</div>
                      <label className="prefCheck">
                        <input
                          type="checkbox"
                          checked={prefs.taskFilter}
                          onChange={(e) => setPrefs((p) => ({ ...p, taskFilter: e.target.checked }))}
                        />
                        <span>Activate Task filter</span>
                      </label>
                    </div>

                    <div className="prefDivider" />

                    <div className="prefSection">
                      <div className="prefSectionTitle">Time settings</div>
                      <div className="prefSectionSub">Change time zone, your day starts, and your preferred date and time format.</div>


                      <div className="prefRow2">
                        <div className="prefFieldBlock">
                          <div className="prefFieldLabel">Date format</div>
                          <select
                            className="prefSelect"
                            value={prefs.dateFormat}
                            onChange={(e) => setPrefs((p) => ({ ...p, dateFormat: e.target.value }))}
                          >
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                        <div className="prefFieldBlock">
                          <div className="prefFieldLabel">Time format</div>
                          <select
                            className="prefSelect"
                            value={prefs.timeFormat}
                            onChange={(e) => setPrefs((p) => ({ ...p, timeFormat: e.target.value }))}
                          >
                            <option value="24-hour">24-hour</option>
                            <option value="12-hour">12-hour</option>
                          </select>
                        </div>
                      </div>

                      <div className="prefFieldBlock">
                        <div className="prefFieldLabel">Day start</div>
                        <input
                          className="prefInput"
                          value={prefs.dayStart}
                          onChange={(e) => setPrefs((p) => ({ ...p, dayStart: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {prefTab === "email" && (
                  <div className="prefPanel">
                    <div className="prefSection">
                      <div className="prefSectionTitle">Manage notifications</div>
                      <div className="prefSectionSub">Choose what types of email notifications you wish to receive.</div>
                    </div>
                    <div className="prefDivider" />
                    <div className="prefCheckList">
                      {[
                        { k: "newsletter", label: "Newsletter", sub: "Receive a monthly email about new features in Clockify." },
                        { k: "onboarding", label: "Onboarding", sub: "Receive an email series about key features and activities upon joining Clockify." },
                        { k: "weeklyReport", label: "Weekly report", sub: "Receive a weekly email about your time tracking activities." },
                        { k: "longRunningTimer", label: "Long-running timer", sub: "Receive an email when a time entry is running more than 8 hours." },
                        { k: "scheduledReports", label: "Scheduled reports", sub: "Receive shared reports you've scheduled to email." },
                        { k: "approval", label: "Approval", sub: "Receive an email when a timesheet is submitted, rejected, withdrawn, or approved." },
                        { k: "timeOff", label: "Time off", sub: "Receive an email when balance is updated, or a time off request is submitted, approved, or rejected." },
                        { k: "alerts", label: "Alerts", sub: "Receive an email when a project or task reaches a certain percentage of its budget or estimated time." },
                        { k: "reminders", label: "Reminders", sub: "Receive an email when you or your team members miss or exceed tracking targets." },
                        { k: "schedule", label: "Schedule", sub: "Receive an email about your scheduled assignments." },
                        { k: "invoices", label: "Invoices", sub: "Receive an email when a recurring invoice is created or when an invoice becomes overdue." },
                      ].map((it) => (
                        <label key={it.k} className="prefCheckRow">
                          <input
                            type="checkbox"
                            checked={!!emailPrefs[it.k]}
                            onChange={(e) => setEmailPrefs((p) => ({ ...p, [it.k]: e.target.checked }))}
                          />
                          <span className="prefCheckText">
                            <span className="prefCheckTitle">{it.label}</span>
                            <span className="prefCheckSub">{it.sub}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {prefTab === "advanced" && (
                  <div className="advWrap">
                    <div className="advHeaderRow">
                      <div className="advBreadcrumb">Preferences / Advanced</div>
                    </div>

                    <div className="advCard">
                      <div className="advTitleRow">
                        <div className="advTitle">Manage API keys</div>
                        <button type="button" className="advPrimaryBtn" onClick={openApiKeyModal}>
                          GENERATE NEW
                        </button>
                      </div>

                      <div className="advTableWrap">
                        <div className="advTableHead">API Keys</div>
                        <div className="advTable">
                          <div className="advTr advTh">
                            <div>NAME</div>
                            <div>CREATED</div>
                            <div>KEY</div>
                          </div>
                          {apiKeys.length ? (
                            apiKeys.map((k) => (
                              <div key={k.id} className="advTr">
                                <div className="advTd">{k.name}</div>
                                <div className="advTd">{new Date(k.createdAt).toLocaleDateString()}</div>
                                <div className="advTd advMono">{k.key}</div>
                              </div>
                            ))
                          ) : (
                            <div className="advEmptyRow"> </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="advCard" style={{ marginTop: 18 }}>
                      <div className="advTitleRow">
                        <div className="advTitle">Webhooks</div>
                        <button type="button" className="advPrimaryBtn solid" onClick={openWebhookModal}>
                          CREATE NEW
                        </button>
                      </div>

                      <div className="advTableWrap">
                        <div className="advWebRow">
                          <div className="advWebLabel">Workspace</div>
                          <select className="advSelect" value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
                            <option value="ok">ok</option>
                          </select>
                          <div className="advWebCount">Webhooks created: {webhooks.length} out of 100</div>
                        </div>

                        <div className="advTableHead muted">Your webhooks - {webhooks.length} out of 10</div>
                        <div className="advTable">
                          {webhooks.length ? (
                            webhooks.slice(0, 10).map((w) => (
                              <div key={w.id} className="advWebhookRow">
                                <div className="advWebhookName">{w.name}</div>
                                <div className="advWebhookMeta">{w.event} · {w.url}</div>
                              </div>
                            ))
                          ) : (
                            <div className="advEmptyRow"> </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {apiKeyModalOpen && (
                      <div className="advModalOverlay" onMouseDown={(e) => e.target === e.currentTarget && setApiKeyModalOpen(false)}>
                        <div className="advModal" onMouseDown={(e) => e.stopPropagation()}>
                          <div className="advModalTop">
                            <div className="advModalTitle">Generate API key</div>
                            <button type="button" className="advModalClose" onClick={() => setApiKeyModalOpen(false)} aria-label="Close">
                              <X size={16} />
                            </button>
                          </div>
                          <div className="advModalBody">
                            <div className="advField">
                              <div className="advFieldLabel">Name *</div>
                              <input
                                className="advInput"
                                placeholder="Enter name"
                                value={apiKeyName}
                                onChange={(e) => { setApiKeyName(e.target.value); setApiKeyNameErr("") }}
                              />
                              {apiKeyNameErr && <div className="advErr">{apiKeyNameErr}</div>}
                            </div>
                            <div className="advModalActions">
                              <button type="button" className="advTextBtn" onClick={() => setApiKeyModalOpen(false)}>Cancel</button>
                              <button type="button" className="advSolidBtn" onClick={generateApiKey}>GENERATE</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {webhookModalOpen && (
                      <div className="advModalOverlay" onMouseDown={(e) => e.target === e.currentTarget && setWebhookModalOpen(false)}>
                        <div className="advModal" onMouseDown={(e) => e.stopPropagation()}>
                          <div className="advModalTop">
                            <div className="advModalTitle">Create webhook on {workspace}</div>
                            <button type="button" className="advModalClose" onClick={() => setWebhookModalOpen(false)} aria-label="Close">
                              <X size={16} />
                            </button>
                          </div>
                          <div className="advModalBody">
                            <div className="advField">
                              <div className="advFieldLabel">Name</div>
                              <input className="advInput" placeholder="Enter webhook name" value={webhookName} onChange={(e) => { setWebhookName(e.target.value); setWebhookErr("") }} />
                            </div>
                            <div className="advField">
                              <div className="advFieldLabel">Endpoint URL</div>
                              <input className="advInput" placeholder="https://example.com/endpoint" value={webhookUrl} onChange={(e) => { setWebhookUrl(e.target.value); setWebhookErr("") }} />
                            </div>
                            <div className="advField">
                              <div className="advFieldLabel">Event</div>
                              <select className="advSelect" value={webhookEvent} onChange={(e) => { setWebhookEvent(e.target.value); setWebhookErr("") }}>
                                <option value="">Find event</option>
                                <option value="time_entry.created">time_entry.created</option>
                                <option value="time_entry.updated">time_entry.updated</option>
                                <option value="leave.requested">leave.requested</option>
                                <option value="task.completed">task.completed</option>
                              </select>
                            </div>
                            {webhookErr && <div className="advErr">{webhookErr}</div>}
                            <div className="advModalActions">
                              <button type="button" className="advTextBtn" onClick={() => setWebhookModalOpen(false)}>Cancel</button>
                              <button type="button" className="advSolidBtn" onClick={createWebhook}>CREATE</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Body ─────────────────────────────── */}
      <div className="layout">
        <aside className="sidebar" onMouseLeave={() => { hideTooltip(); hideFlyout(); }}>
          <nav className="nav">
            {items.map((item) => (
              <div key={item.label} className="navGroup">
                {item.children ? (
                  <>
                    <button
                      type="button"
                      className={["navItem", location.pathname.startsWith(item.to) ? "active" : ""].filter(Boolean).join(" ")}
                      onClick={(e) => {
                        if (sidebarCollapsed) {
                          if (flyout) setFlyout(null)
                          else showFlyout(item, e)
                        } else {
                          setSettingsExpanded(!settingsExpanded)
                        }
                      }}
                      onMouseEnter={(e) => {
                        showTooltip(item.label, e)
                        showFlyout(item, e)
                      }}
                      onMouseLeave={() => {
                        hideTooltip()
                        hideFlyout()
                      }}
                    >
                      <span className="navIcon">
                        {item.icon}
                        {sidebarCollapsed && <span className="submoduleIndicator"></span>}
                      </span>
                      <span className="navLabel">{item.label}</span>
                      {!sidebarCollapsed && (
                        <span className="navChevron">
                          {settingsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      )}
                    </button>
                    {!sidebarCollapsed && settingsExpanded && (
                      <div className="navChildren">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            className={({ isActive }) =>
                              ["navItem subItem", isActive ? "active" : ""].filter(Boolean).join(" ")
                            }
                          >
                            <span className="navIcon">{child.icon}</span>
                            <span className="navLabel">{child.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      ["navItem", isActive || (item.to !== "/" && location.pathname.startsWith(item.to)) ? "active" : ""]
                        .filter(Boolean)
                        .join(" ")
                    }
                    end={item.to === "/"}
                    onMouseEnter={(e) => showTooltip(item.label, e)}
                    onMouseLeave={hideTooltip}
                  >
                    <span className="navIcon">{item.icon}</span>
                    <span className="navLabel">{item.label}</span>
                  </NavLink>
                )}
              </div>
            ))}
          </nav>
          <div className="sidebarFooter">
            <button
              className="sidebarToggleBtn"
              onClick={() => { setSidebarCollapsed(!sidebarCollapsed); hideTooltip() }}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {!sidebarCollapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
      <SidebarTooltip tooltip={tooltip} />
      <SubmenuFlyout
        flyout={flyout}
        onMouseEnter={cancelHideFlyout}
        onMouseLeave={hideFlyout}
      />
    </div>
  )
}
