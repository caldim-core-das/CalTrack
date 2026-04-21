import { useState, useRef, useCallback, useEffect } from "react"
import { useLocation } from "react-router-dom"
import {
  Building2, Palette, CreditCard, Users2, History, ScrollText,
  Clock, CalendarDays, Banknote, FileText, ShieldCheck, BarChart3,
  Bell, Workflow, Search, Globe, Image as ImageIcon, Settings,
  Sun, Moon, Monitor, RefreshCcw, Zap, Shield, Crown, Check, Minus,
  Star, ArrowRight, Plus, ChevronDown, Lock, Activity, Info,
  Save, X, CheckCircle2, AlertTriangle, Upload, Eye, EyeOff,
  Smartphone, Mail, MessageSquare, LogOut, Key, Wifi, Clock3,
  Edit3, MapPin, DollarSign, Calendar, TrendingUp, User,
  ChevronRight, Home
} from "lucide-react"

/* ── Helpers ─────────────────────────────────────────────────── */
function Toast({ message, type = "success", onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div className="stToast" data-type={type}>
      {type === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      <span>{message}</span>
      <button onClick={onDismiss} className="stToastClose"><X size={13} /></button>
    </div>
  )
}

function SaveBar({ dirty, onSave, onDiscard, saving }) {
  if (!dirty) return null
  return (
    <div className="stSaveBar">
      <div className="stSaveBarLeft"><span className="stSaveBarDot" />Unsaved changes</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btnGhost" style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }} onClick={onDiscard}>Discard</button>
        <button className="stSaveBtn" onClick={onSave} disabled={saving}>
          {saving ? <RefreshCcw size={13} style={{ animation: "stSpin .7s linear infinite" }} /> : <Save size={13} />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, accent = "#1A56DB" }) {
  return (
    <div className={`stToggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} style={{ "--acc": accent }}>
      <div className="stToggleKnob" />
    </div>
  )
}

/* ── Main Page ───────────────────────────────────────────────── */
const TABS = [
  {
    id: "general", label: "General",
    subs: [
      { id: "profile", label: "Profile", icon: <User size={14} /> },
      { id: "organization", label: "Organization", icon: <Building2 size={14} /> },
      { id: "logo", label: "Company Logo", icon: <ImageIcon size={14} /> },
      { id: "localization", label: "Localization", icon: <Globe size={14} /> },
      { id: "pace", label: "Operational Pace", icon: <TrendingUp size={14} /> },
    ]
  },
  {
    id: "notifications", label: "Notifications",
    subs: [
      { id: "notif-prefs", label: "Preferences", icon: <Bell size={14} /> },
      { id: "activity", label: "Activity Logs", icon: <ScrollText size={14} /> },
    ]
  },
  {
    id: "members", label: "Members",
    subs: [
      { id: "users", label: "Users & Roles", icon: <Users2 size={14} /> },
      { id: "permissions", label: "Permission History", icon: <History size={14} /> },
    ]
  },
  {
    id: "billings", label: "Billings",
    subs: [
      { id: "plan", label: "Plans & Subscription", icon: <CreditCard size={14} /> },
      { id: "invoices", label: "Invoices", icon: <FileText size={14} /> },
    ]
  },
  {
    id: "language", label: "Language & Region",
    subs: [
      { id: "localization", label: "Timezone & Format", icon: <Globe size={14} /> },
      { id: "fiscal", label: "Fiscal Calendar", icon: <Calendar size={14} /> },
    ]
  },
  {
    id: "security", label: "Security",
    subs: [
      { id: "security-sessions", label: "Active Sessions", icon: <Wifi size={14} /> },
      { id: "security-password", label: "Password", icon: <Key size={14} /> },
      { id: "security-2fa", label: "Two-Factor Auth", icon: <Smartphone size={14} /> },
    ]
  },
  {
    id: "integrations", label: "Integrations",
    subs: [
      { id: "integrations", label: "Calendar Integrations", icon: <CalendarDays size={14} /> },
    ]
  },
]

export function SettingsPage({ section: sectionProp }) {
  const location = useLocation()
  const [activeSection, setActiveSection] = useState("profile")
  const [activeTab, setActiveTab] = useState("general")
  const [hoveredTab, setHoveredTab] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const markDirty = useCallback(() => setDirty(true), [])
  const showToast = useCallback((msg, type = "success") => setToast({ msg, type, id: Date.now() }), [])

  useEffect(() => {
    const section = sectionProp || new URLSearchParams(location.search).get("section")
    if (!section) return
    const tab = TABS.find((t) => t.subs.some((s) => s.id === section)) || TABS[0]
    setActiveTab(tab.id)
    setActiveSection(tab.subs.some((s) => s.id === section) ? section : tab.subs[0].id)
    setHoveredTab(null)
  }, [location.search, sectionProp])

  const handleSave = async () => {
    setSaving(true); await new Promise(r => setTimeout(r, 800)); setSaving(false); setDirty(false)
    showToast("Changes saved successfully!")
  }
  const handleDiscard = () => { setDirty(false); showToast("Changes discarded.", "warn") }

  const navigate = (tabId, secId) => { setActiveTab(tabId); setActiveSection(secId); setHoveredTab(null) }

  /* left card items for current tab */
  const currentTab = TABS.find(t => t.subs.some(s => s.id === activeSection)) || TABS[0]
  const currentSubs = currentTab.subs

  return (
    <div className="stPage">
      {/* ── Breadcrumb ── */}
      <div className="stBreadcrumb">
        <Home size={13} /><span>Home</span>
        <ChevronRight size={12} /><span className="stBreadcrumbActive">Settings</span>
      </div>

      {/* ── Page Title + Tab Bar ── */}
      <div className="stTopRow">
        <h1 className="stPageTitle">Settings</h1>
        <nav className="stTabBar">
          {TABS.map(tab => {
            const isCurrent = currentTab.id === tab.id
            return (
              <div
                key={tab.id}
                className={`stTabItem ${isCurrent ? "active" : ""}`}
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <button
                  className="stTabBtn"
                  onClick={() => navigate(tab.id, tab.subs[0].id)}
                >
                  {tab.label}
                  <ChevronDown size={12} style={{ marginLeft: 4, opacity: 0.5 }} />
                </button>
                {/* Hover Dropdown */}
                {hoveredTab === tab.id && (
                  <div className="stTabDropdown">
                    {tab.subs.map(sub => (
                      <button
                        key={sub.id}
                        className={`stTabDropItem ${activeSection === sub.id ? "active" : ""}`}
                        onClick={() => navigate(tab.id, sub.id)}
                      >
                        <span className="stTabDropIcon">{sub.icon}</span>
                        {sub.label}
                        {activeSection === sub.id && <Check size={12} style={{ marginLeft: "auto", color: "#1A56DB" }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      {/* ── Body ── */}
      <div className="stBody">
        {/* Left Card */}
        <aside className="stLeftCard">
          <div className="stLeftCardTop">
            <div className="stLeftAvatar">
              <span>J</span>
              <button className="stAvatarEdit"><Edit3 size={11} /></button>
            </div>
            <div className="stLeftName">Organization Admin</div>
            <div className="stLeftRole">Enterprise ERP</div>
            <p className="stLeftBio">Manage your organization's settings, policies and integrations.</p>
          </div>
          <div className="stLeftNav">
            <div className="stLeftNavLabel">{currentTab.label}</div>
            {currentSubs.map(sub => (
              <button
                key={sub.id}
                className={`stLeftNavItem ${activeSection === sub.id ? "active" : ""}`}
                onClick={() => setActiveSection(sub.id)}
              >
                <span className="stLeftNavIcon">{sub.icon}</span>
                {sub.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Right Content */}
        <main className="stMain">
          {activeSection === "profile" && <ProfileSection markDirty={markDirty} showToast={showToast} />}
          {activeSection === "organization" && <OrganizationSection markDirty={markDirty} />}
          {activeSection === "logo" && <LogoSection markDirty={markDirty} />}
          {activeSection === "localization" && <LocalizationSection markDirty={markDirty} />}
          {activeSection === "fiscal" && <LocalizationSection markDirty={markDirty} />}
          {activeSection === "pace" && <PaceSection markDirty={markDirty} />}
          {activeSection === "notif-prefs" && <NotificationsSection markDirty={markDirty} />}
          {activeSection === "activity" && <ActivitySection />}
          {activeSection === "users" && <UsersSection showToast={showToast} />}
          {activeSection === "plan" && <PlanSection />}
          {activeSection === "security-sessions" && <SecuritySessionsSection showToast={showToast} />}
          {activeSection === "security-password" && <SecurityPasswordSection showToast={showToast} />}
          {activeSection === "security-2fa" && <Security2FASection markDirty={markDirty} showToast={showToast} />}
          {activeSection === "integrations" && <IntegrationsSection markDirty={markDirty} showToast={showToast} />}
          {["permissions", "invoices"].includes(activeSection) && <ComingSoon label={currentSubs.find(s => s.id === activeSection)?.label} />}
        </main>
      </div>

      <SaveBar dirty={dirty} onSave={handleSave} onDiscard={handleDiscard} saving={saving} />
      {toast && <Toast key={toast.id} message={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}

/* ── Field Helper ─────────────────────────────────────────────── */
function Field({ label, children, half }) {
  return (
    <div className={`stField ${half ? "half" : ""}`}>
      <label className="stLabel">{label}</label>
      {children}
    </div>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="stSectionHeader">
      <h2 className="stSectionTitle">{title}</h2>
      {subtitle && <p className="stSectionSub">{subtitle}</p>}
    </div>
  )
}

function ComingSoon({ label }) {
  return (
    <div className="stComingSoon">
      <Settings size={40} opacity={0.12} />
      <h3>{label}</h3>
      <p>Configuration for this section will be available soon.</p>
    </div>
  )
}

function IntegrationsSection({ markDirty, showToast }) {
  const [googleConnected, setGoogleConnected] = useState(false)
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [syncTimeOff, setSyncTimeOff] = useState(true)
  const [syncWorkSchedules, setSyncWorkSchedules] = useState(false)

  const googleEnabled = googleConnected && (syncTimeOff || syncWorkSchedules)
  const outlookEnabled = outlookConnected && (syncTimeOff || syncWorkSchedules)

  function toggleGoogleConnection() {
    setGoogleConnected((prev) => {
      const next = !prev
      showToast(next ? "Google Calendar connected." : "Google Calendar disconnected.", next ? "success" : "warn")
      markDirty()
      return next
    })
  }

  function toggleOutlookConnection() {
    setOutlookConnected((prev) => {
      const next = !prev
      showToast(next ? "Outlook Calendar connected." : "Outlook Calendar disconnected.", next ? "success" : "warn")
      markDirty()
      return next
    })
  }

  return (
    <div className="stPanel">
      <SectionHeader
        title="Integrations"
        subtitle="Connect external calendars to sync time off, holidays, and work schedules."
      />

      <div className="stCard">
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg)" }}>Google Calendar</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {googleConnected ? "Connected" : "Not connected"}{googleEnabled ? " · Sync enabled" : ""}
            </div>
          </div>
          <button className={googleConnected ? "stGhostBtn stDangerTxt" : "stPrimaryBtn"} onClick={toggleGoogleConnection}>
            {googleConnected ? "Disconnect" : "Connect"}
          </button>
        </div>

        <div style={{ height: 1, background: "var(--stroke)", margin: "16px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="stToggleRow" style={{ padding: 0, background: "transparent", border: "none", margin: 0 }}>
            <div>
              <div className="stToggleLabel">Sync Time Off & Holidays</div>
              <div className="stToggleDesc">Push approved time off and holidays to connected calendars</div>
            </div>
            <ToggleSwitch checked={syncTimeOff} onChange={(v) => { setSyncTimeOff(v); markDirty() }} accent="#1A56DB" />
          </div>

          <div className="stToggleRow" style={{ padding: 0, background: "transparent", border: "none", margin: 0 }}>
            <div>
              <div className="stToggleLabel">Sync Work Schedules</div>
              <div className="stToggleDesc">Publish schedules and shifts to connected calendars</div>
            </div>
            <ToggleSwitch checked={syncWorkSchedules} onChange={(v) => { setSyncWorkSchedules(v); markDirty() }} accent="#F59E0B" />
          </div>
        </div>
      </div>

      <div className="stCard">
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--fg)" }}>Outlook Calendar</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              {outlookConnected ? "Connected" : "Not connected"}{outlookEnabled ? " · Sync enabled" : ""}
            </div>
          </div>
          <button className={outlookConnected ? "stGhostBtn stDangerTxt" : "stPrimaryBtn"} onClick={toggleOutlookConnection}>
            {outlookConnected ? "Disconnect" : "Connect"}
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          Supports Microsoft 365 accounts. Once connected, the same sync settings above apply.
        </div>
      </div>
    </div>
  )
}

/* ═══ PROFILE ════════════════════════════════════════════════════ */
function ProfileSection({ markDirty, showToast }) {
  const [name, setName] = useState("Jasmine Dorathy")
  const [username, setUsername] = useState("jasminedorathy")
  const [role, setRole] = useState("Administrator")
  const [location, setLocation] = useState("Chennai, Tamil Nadu")
  const [bio, setBio] = useState("Enterprise admin managing QuickTims ERP system operations.")
  return (
    <div className="stPanel">
      <SectionHeader title="Profile" subtitle="Update your personal information visible across the system." />
      <div className="stCard">
        <div className="stFormGrid">
          <Field label="Full name" half>
            <input className="stInput" value={name} placeholder="Your full name" onChange={e => { setName(e.target.value); markDirty() }} />
          </Field>
          <Field label="Username" half>
            <input className="stInput" value={username} placeholder="Your username" onChange={e => { setUsername(e.target.value); markDirty() }} />
          </Field>
          <Field label="Profession">
            <select className="stInput stSelect" onChange={() => markDirty()}>
              <option>Administrator</option>
              <option>HR Manager</option>
              <option>Finance Lead</option>
              <option>Operations Head</option>
            </select>
          </Field>
          <Field label="Location">
            <select className="stInput stSelect" onChange={() => markDirty()}>
              <option>Chennai, Tamil Nadu</option>
              <option>Bengaluru, Karnataka</option>
              <option>Mumbai, Maharashtra</option>
              <option>Hyderabad, Telangana</option>
            </select>
          </Field>
          <Field label="Bio">
            <textarea className="stInput stTextarea" value={bio} placeholder="A short bio..."
              onChange={e => { setBio(e.target.value); markDirty() }} rows={3} />
          </Field>
          <Field label="Profile link">
            <div className="stInputAddon">
              <span className="stInputAddonPrefix">erp.caltims.com/u/</span>
              <input className="stInput stInputAddonField" value={username} onChange={e => { setUsername(e.target.value); markDirty() }} />
            </div>
          </Field>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn" onClick={() => showToast("Profile updated!")}>
            <Save size={14} /> Save Profile
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══ ORGANIZATION ═══════════════════════════════════════════════ */
function OrganizationSection({ markDirty }) {
  const [name, setName] = useState("CALTIMS")
  const [addr, setAddr] = useState("123 Enterprise Way, Tech City, Tamil Nadu 600001")
  const [country, setCountry] = useState("India")
  const [currency, setCurrency] = useState("INR (₹)")
  const [editName, setEditName] = useState(false)
  return (
    <div className="stPanel">
      <SectionHeader title="Organization" subtitle="Core company identity information displayed across the system." />
      <div className="stCard">
        {/* Inline editable company name */}
        <div className="stIdentityRow">
          <div className="stIdentityAvatar">{name.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            {editName
              ? <input autoFocus className="stInput stInlineLarge" value={name}
                onChange={e => { setName(e.target.value); markDirty() }}
                onBlur={() => setEditName(false)} onKeyDown={e => e.key === "Enter" && setEditName(false)} />
              : <div className="stInlineView" onClick={() => setEditName(true)}>
                <span className="stInlineViewName">{name}</span>
                <Edit3 size={13} color="var(--muted)" />
              </div>
            }
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted)" }}>Click to rename your organization</p>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--stroke)", margin: "20px 0" }} />
        <div className="stFormGrid">
          <Field label="Headquarters Address">
            <textarea className="stInput stTextarea" value={addr}
              onChange={e => { setAddr(e.target.value); markDirty() }} rows={2} style={{ resize: "none" }} />
          </Field>
          <Field label="Operational Country" half>
            <input className="stInput" value={country} onChange={e => { setCountry(e.target.value); markDirty() }} />
          </Field>
          <Field label="Base Currency" half>
            <select className="stInput stSelect" value={currency} onChange={e => { setCurrency(e.target.value); markDirty() }}>
              <option>USD ($)</option><option>INR (₹)</option><option>EUR (€)</option><option>GBP (£)</option>
            </select>
          </Field>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn"><Save size={14} /> Save Organization</button>
        </div>
      </div>
    </div>
  )
}

/* ═══ LOGO ═══════════════════════════════════════════════════════ */
function LogoSection({ markDirty }) {
  const [preview, setPreview] = useState(null)
  const [bg, setBg] = useState("light")
  const [drag, setDrag] = useState(false)
  const ref = useRef()
  const handleFile = useCallback(e => {
    const file = e.dataTransfer?.files[0] || e.target?.files[0]
    if (file?.type.startsWith("image/")) { setPreview(URL.createObjectURL(file)); markDirty() }
  }, [markDirty])
  return (
    <div className="stPanel">
      <SectionHeader title="Company Logo" subtitle="Upload your brand asset. Used in reports, PDFs and the navigation bar." />
      <div className="stCard">
        <div className="stLogoGrid">
          <div>
            {/* Drop zone */}
            <div className={`stDropZone ${drag ? "drag" : ""} ${preview ? "has" : ""}`}
              style={{ background: bg === "dark" ? "#0B1629" : undefined }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e) }}
              onClick={() => ref.current?.click()}>
              {preview
                ? <img src={preview} alt="logo" className="stDropPreview" />
                : <>
                  <div className="stDropIcon"><Upload size={28} /></div>
                  <div className="stDropText">Drag & drop your logo</div>
                  <div className="stDropSub">PNG, SVG or WebP · Transparent background preferred · Max 2MB</div>
                </>
              }
              <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>
            {/* bg toggle */}
            <div className="stBgToggle">
              <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Preview on:</span>
              {["light", "dark"].map(b => (
                <button key={b} className={`stBgBtn ${bg === b ? "on" : ""}`} onClick={() => setBg(b)}>
                  {b === "light" ? <Sun size={11} /> : <Moon size={11} />} {b}
                </button>
              ))}
            </div>
          </div>
          <div className="stLogoUsage">
            <div className="stLogoUsageLabel">Usage Preview</div>
            {/* navbar preview */}
            <div className="stNavbarPreview">
              <div style={{ background: "#0B1629", borderRadius: 8, padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                {preview
                  ? <img src={preview} style={{ height: 28, width: "auto", objectFit: "contain" }} alt="nav logo" />
                  : <div style={{ width: 80, height: 20, background: "rgba(255,255,255,0.15)", borderRadius: 4 }} />}
                <div style={{ flex: 1 }} />
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg,#1A56DB,#F97316)" }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>Navbar</div>
            </div>
            <div className="stNavbarPreview">
              <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                {preview
                  ? <img src={preview} style={{ height: 36, width: "auto", objectFit: "contain" }} alt="report logo" />
                  : <div style={{ width: 100, height: 24, background: "var(--stroke2)", borderRadius: 4 }} />}
                <div style={{ fontSize: 10, color: "var(--muted)" }}>Monthly Payroll Report — March 2026</div>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, textAlign: "center" }}>Report Header</div>
            </div>
          </div>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn" onClick={() => ref.current?.click()}><Upload size={14} /> Upload Logo</button>
          {preview && <button className="stGhostBtn stDangerTxt" onClick={() => { setPreview(null); markDirty() }}><X size={13} /> Remove</button>}
        </div>
      </div>
    </div>
  )
}

/* ═══ LOCALIZATION ════════════════════════════════════════════════ */
function LocalizationSection({ markDirty }) {
  const [tz, setTz] = useState("Asia/Kolkata (IST)")
  const [fmt, setFmt] = useState("DD/MM/YYYY")
  const [fiscal, setFiscal] = useState("April")
  const [week, setWeek] = useState("Monday - Friday")
  const now = new Date()
  const liveDate = fmt === "DD/MM/YYYY"
    ? `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`
    : fmt === "MM/DD/YYYY"
      ? `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  return (
    <div className="stPanel">
      <SectionHeader title="Language & Region" subtitle="Regional and time-based configurations for the entire organization." />
      <div className="stCard">
        <div className="stFormGrid">
          <Field label="Enterprise Timezone" half>
            <select className="stInput stSelect" value={tz} onChange={e => { setTz(e.target.value); markDirty() }}>
              <option>Asia/Kolkata (IST)</option><option>America/New_York (EST)</option>
              <option>Europe/London (GMT)</option><option>Asia/Dubai (GST)</option>
            </select>
          </Field>
          <Field label="Display Date Format" half>
            <select className="stInput stSelect" value={fmt} onChange={e => { setFmt(e.target.value); markDirty() }}>
              <option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option>
            </select>
          </Field>
          <Field label="Fiscal Year Start" half>
            <select className="stInput stSelect" value={fiscal} onChange={e => { setFiscal(e.target.value); markDirty() }}>
              <option>April</option><option>January</option><option>July</option><option>October</option>
            </select>
          </Field>
          <Field label="Standard Work Week" half>
            <select className="stInput stSelect" value={week} onChange={e => { setWeek(e.target.value); markDirty() }}>
              <option>Monday - Friday</option><option>Monday - Saturday</option><option>Sunday - Thursday</option>
            </select>
          </Field>
        </div>
        {/* Live preview */}
        <div className="stLocalePreview">
          <div className="stLocalePreviewTitle"><Eye size={12} /> Live Preview</div>
          <div className="stLocalePreviewRow">
            <div className="stLocaleChip"><Calendar size={12} /> Today: <strong>{liveDate}</strong></div>
            <div className="stLocaleChip"><MapPin size={12} /> Zone: <strong>{tz.split(" ")[0]}</strong></div>
            <div className="stLocaleChip"><DollarSign size={12} /> Fiscal from: <strong>{fiscal}</strong></div>
          </div>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn"><Save size={14} /> Save Localization</button>
        </div>
      </div>
    </div>
  )
}

/* ═══ OPERATIONAL PACE ════════════════════════════════════════════ */
function PaceSection({ markDirty }) {
  const [hrs, setHrs] = useState(8)
  const [strict, setStrict] = useState(true)
  const [weekend, setWeekend] = useState(false)
  const paceLabel = hrs <= 4 ? "🟢 Relaxed" : hrs <= 7 ? "🟡 Balanced" : hrs <= 9 ? "🔵 Standard" : "🔴 Strict"
  const paceDesc = hrs <= 4 ? "Flexible hours, minimal enforcement."
    : hrs <= 7 ? "Moderate tracking, balanced policy."
      : hrs <= 9 ? "Standard 8-hour workday enforcement with timesheet compliance."
        : "High-intensity mode — late marking, checkout verification, and strike policy active."
  return (
    <div className="stPanel">
      <SectionHeader title="Operational Pace" subtitle="System-wide enforcement and tracking behaviour settings." />
      <div className="stCard">
        <div className="stField" style={{ marginBottom: 24 }}>
          <label className="stLabel">STANDARD WORK DAY — <strong>{hrs} hrs</strong></label>
          <div className="stPaceScaleLabels"><span>Relaxed</span><span>Balanced</span><span>Standard</span><span>Strict</span></div>
          <input type="range" className="stPaceSlider" min="2" max="12" value={hrs}
            onChange={e => { setHrs(Number(e.target.value)); markDirty() }} />
          <div className="stPaceResult">
            <div className="stPaceResultLabel">{paceLabel}</div>
            <div className="stPaceResultDesc">{paceDesc}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8, borderTop: "1px solid var(--stroke)" }}>
          <div className="stToggleRow">
            <div>
              <div className="stToggleLabel">Strict Enforcement</div>
              <div className="stToggleDesc">Mark late arrivals and flag checkout violations with strike records</div>
            </div>
            <ToggleSwitch checked={strict} onChange={v => { setStrict(v); markDirty() }} accent="#1A56DB" />
          </div>
          <div className="stToggleRow">
            <div>
              <div className="stToggleLabel">Weekend Access</div>
              <div className="stToggleDesc">Allow timesheet entries on Saturday and Sunday</div>
            </div>
            <ToggleSwitch checked={weekend} onChange={v => { setWeekend(v); markDirty() }} accent="#059669" />
          </div>
        </div>
        <div className="stCardActions">
          <button className="stPrimaryBtn"><Save size={14} /> Save Pace Settings</button>
        </div>
      </div>
    </div>
  )
}

/* ═══ NOTIFICATIONS ══════════════════════════════════════════════ */
function NotificationsSection({ markDirty }) {
  const events = [
    { key: "clockin", label: "Clock In/Out", desc: "Time tracking events" },
    { key: "leave", label: "Leave Requests", desc: "Applications & approvals" },
    { key: "payroll", label: "Payroll Processed", desc: "Salary credits & payslips" },
    { key: "tasks", label: "Task Assignments", desc: "New tasks assigned to you" },
    { key: "security", label: "Login Alerts", desc: "New device or suspicious login" },
    { key: "reports", label: "Report Ready", desc: "Scheduled exports completed" },
  ]
  const [prefs, setPrefs] = useState(() =>
    Object.fromEntries(events.map(e => [e.key, { email: true, sms: false, app: true }]))
  )
  const toggle = (ev, ch) => { setPrefs(p => ({ ...p, [ev]: { ...p[ev], [ch]: !p[ev][ch] } })); markDirty() }
  return (
    <div className="stPanel">
      <SectionHeader title="Notification Preferences" subtitle="Choose exactly how and where you receive system alerts." />
      <div className="stCard" style={{ padding: 0 }}>
        <div className="stNotifTable">
          <div className="stNotifHead">
            <div style={{ flex: 1 }}>Event</div>
            {[["email", <Mail size={13} />], ["sms", <MessageSquare size={13} />], ["app", <Bell size={13} />]].map(([ch, ic]) => (
              <div key={ch} className="stNotifCol">{ic} {ch.toUpperCase()}</div>
            ))}
          </div>
          {events.map(ev => (
            <div key={ev.key} className="stNotifRow">
              <div style={{ flex: 1 }}>
                <div className="stNotifEvLabel">{ev.label}</div>
                <div className="stNotifEvDesc">{ev.desc}</div>
              </div>
              {["email", "sms", "app"].map(ch => (
                <div key={ch} className="stNotifCol">
                  <div className={`stNotifCheck ${prefs[ev.key][ch] ? "on" : ""}`} onClick={() => toggle(ev.key, ch)}>
                    {prefs[ev.key][ch] && <Check size={10} strokeWidth={3} />}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ═══ ACTIVITY LOG ═══════════════════════════════════════════════ */
function ActivitySection() {
  const [filter, setFilter] = useState("all")
  const logs = [
    { time: "Today, 12:09 PM", action: "Login", detail: "Chrome · Chennai, India", type: "auth" },
    { time: "Today, 11:45 AM", action: "Settings Changed", detail: "Updated Operational Pace → 9h", type: "settings" },
    { time: "Today, 10:30 AM", action: "Employee Added", detail: "Ravi Kumar onboarded", type: "hr" },
    { time: "Yesterday, 4:12 PM", action: "Payroll Run", detail: "March 2026 · 14 employees", type: "payroll" },
    { time: "Yesterday, 2:00 PM", action: "Leave Approved", detail: "Request #L-091 for Priya S.", type: "leave" },
    { time: "Mar 30, 3:00 PM", action: "Report Exported", detail: "Monthly attendance (PDF)", type: "report" },
  ]
  const colors = { auth: "#1A56DB", settings: "#7C3AED", hr: "#059669", payroll: "#F97316", leave: "#D97706", report: "#0891B2" }
  const filtered = filter === "all" ? logs : logs.filter(l => l.type === filter)
  return (
    <div className="stPanel">
      <SectionHeader title="Activity Log" subtitle="Complete audit trail of all system changes and user actions." />
      <div className="stLogFilters">
        {["all", "auth", "settings", "hr", "payroll", "leave", "report"].map(f => (
          <button key={f} className={`stLogChip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Events" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div className="stTimeline">
        {filtered.map((log, i) => (
          <div key={i} className="stTimelineItem">
            <div className="stTimelineDot" style={{ background: colors[log.type] }} />
            <div className="stTimelineCard">
              <div className="stTimelineTop">
                <span className="stTimelineAction">{log.action}</span>
                <span className="stTimelineBadge" style={{ background: `${colors[log.type]}15`, color: colors[log.type] }}>{log.type}</span>
              </div>
              <div className="stTimelineDetail">{log.detail}</div>
              <div className="stTimelineMeta">{log.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══ USERS / ROLES ══════════════════════════════════════════════ */
function UsersSection({ showToast }) {
  const [role, setRole] = useState("admin")
  const roles = [{ id: "admin", label: "Admin" }, { id: "hr", label: "HR" }, { id: "finance", label: "Finance" }, { id: "employee", label: "Employee" }]
  const permsMap = {
    admin: ["View", "Create", "Edit", "Delete", "Export", "Admin"],
    hr: ["View", "Create", "Edit", "Export"],
    finance: ["View", "Create", "Export"],
    employee: ["View", "Create"]
  }
  const modules = ["Payroll", "Employees", "Timesheets", "Leave Management", "Reports", "Settings"]
  return (
    <div className="stPanel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <SectionHeader title="Users & Roles" subtitle="Configure access levels and role-based permissions." />
        <button className="stPrimaryBtn" onClick={() => showToast("Role creation coming soon.", "warn")}><Plus size={13} /> New Role</button>
      </div>
      <div className="stRolesLayout">
        <div className="stRolesList">
          {roles.map(r => (
            <button key={r.id} className={`stRoleItem ${role === r.id ? "on" : ""}`} onClick={() => setRole(r.id)}>
              <div className="stRoleItemDot" style={{ background: role === r.id ? "#1A56DB" : "var(--stroke2)" }} />
              {r.label}
            </button>
          ))}
        </div>
        <div className="stCard" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)" }}>{role.charAt(0).toUpperCase() + role.slice(1)}</h3>
            <span style={{ fontSize: 11, fontWeight: 700, background: "#EFF0FE", color: "#1A56DB", padding: "4px 12px", borderRadius: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <Lock size={11} /> System Role
            </span>
          </div>
          <table className="stPermTable">
            <thead>
              <tr>
                <th>Module</th>
                {["View", "Create", "Edit", "Delete", "Export", "Admin"].map(p => <th key={p}>{p}</th>)}
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => (
                <tr key={mod}>
                  <td>{mod}</td>
                  {["View", "Create", "Edit", "Delete", "Export", "Admin"].map(p => (
                    <td key={p}>
                      {permsMap[role].includes(p)
                        ? <Check size={13} color="#1A56DB" strokeWidth={3} />
                        : <div style={{ width: 13, height: 2, borderRadius: 1, background: "var(--stroke2)" }} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ═══ PLAN ════════════════════════════════════════════════════════ */
function PlanSection() {
  return (
    <div className="stPanel">
      <SectionHeader title="Plans & Subscription" subtitle="Manage your organization's billing plan and usage limits." />
      <div className="stPlanGrid">
        {[
          {
            name: "Trial", price: "₹0", sub: "28 days free", icon: <Zap size={18} />, color: "var(--fg2)",
            feat: ["Timesheet Entry", "Weekly Submission", "Dashboard Overview", "Holiday Calendar"],
            miss: ["Advanced Reports", "Payroll", "Leave Management"], current: true
          },
          {
            name: "Basic", price: "₹29", sub: "per user/month", icon: <Shield size={18} />, color: "#1A56DB",
            feat: ["Everything in Trial", "Unlimited Projects", "Timesheet History", "Weekly Reports", "Holiday Mgmt"],
            miss: ["Payroll Automation", "Leave Management"], badge: "RECOMMENDED"
          },
          {
            name: "Pro", price: "₹49", sub: "per user/month", icon: <Crown size={18} />, color: "#5d5fef",
            feat: ["Everything in Basic", "Full Payroll", "Leave Management", "Analytics", "SSO", "Priority Support"],
            miss: [], badge: "MOST POPULAR", pro: true
          },
        ].map(plan => (
          <div key={plan.name} className={`stPlanCard ${plan.pro ? "pro" : ""}`}>
            {plan.badge && <div className="stPlanBadge" style={{ background: plan.pro ? "#5d5fef" : "var(--fg)" }}>{plan.badge}</div>}
            {plan.current && <div className="stPlanBadge" style={{ background: "#059669", left: 16, right: "auto" }}>
              <Check size={10} strokeWidth={3} /> ACTIVE
            </div>}
            <div className="stPlanIcon" style={{ color: plan.color, background: `${plan.color}12` }}>{plan.icon}</div>
            <h3 className="stPlanName">{plan.name}</h3>
            <div className="stPlanPrice">{plan.price} <span>{plan.sub}</span></div>
            <div style={{ height: 1, background: "var(--stroke)", margin: "16px 0" }} />
            <div className="stPlanFeats">
              {plan.feat.map(f => <div key={f} className="stPlanFeat"><Check size={12} color="#059669" strokeWidth={3} />{f}</div>)}
              {plan.miss.map(f => <div key={f} className="stPlanFeat stPlanFeatOff"><Minus size={12} color="var(--muted)" />{f}</div>)}
            </div>
            <button className={`stPlanBtn ${plan.pro ? "pro" : plan.current ? "curr" : ""}`}>
              {plan.current ? "Current Plan" : `Upgrade to ${plan.name}`}
              {!plan.current && <ArrowRight size={13} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══ SECURITY — SESSIONS ════════════════════════════════════════ */
function SecuritySessionsSection({ showToast }) {
  const sessions = [
    { device: "Chrome on Windows", loc: "Chennai, India", time: "Active now", current: true },
    { device: "Safari on iPhone", loc: "Chennai, India", time: "2 hours ago" },
    { device: "Edge on Laptop", loc: "Bengaluru, India", time: "Yesterday, 3:42 PM" },
  ]
  return (
    <div className="stPanel">
      <SectionHeader title="Active Sessions" subtitle="Devices currently logged in to your account." />
      <div className="stCard">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sessions.map((s, i) => (
            <div key={i} className="stSessionRow">
              <div className="stSessionIcon"><Monitor size={15} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>{s.device}</span>
                  {s.current && <span className="stCurrentChip">Current</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{s.loc} · {s.time}</div>
              </div>
              {!s.current && <button className="stDangerBtn" onClick={() => showToast("Session revoked.")}>Revoke</button>}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--stroke)" }}>
          <button className="stGhostBtn stDangerTxt" onClick={() => showToast("Logged out all other devices.")}>
            <LogOut size={13} /> Logout from all devices
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══ SECURITY — PASSWORD ════════════════════════════════════════ */
function SecurityPasswordSection({ showToast }) {
  const [pw, setPw] = useState("")
  const [show, setShow] = useState(false)
  const str = pw.length === 0 ? 0 : pw.length < 6 ? 1 : pw.length < 10 ? 2
    : /[A-Z]/.test(pw) && /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw) ? 4 : 3
  const strLabel = ["", "Weak", "Fair", "Good", "Strong"][str]
  const strColor = ["", "#DC2626", "#F97316", "#1A56DB", "#059669"][str]
  return (
    <div className="stPanel">
      <SectionHeader title="Change Password" subtitle="Update your authentication credentials." />
      <div className="stCard" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Current Password">
            <input className="stInput" type="password" placeholder="Enter current password" />
          </Field>
          <Field label="New Password">
            <div style={{ position: "relative" }}>
              <input className="stInput" type={show ? "text" : "password"} placeholder="Enter new password"
                value={pw} onChange={e => setPw(e.target.value)} style={{ paddingRight: 40 }} />
              <button onClick={() => setShow(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pw.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <div style={{ display: "flex", gap: 3, flex: 1 }}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= str ? strColor : "var(--stroke2)", transition: "background .3s" }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: strColor }}>{strLabel}</span>
              </div>
            )}
          </Field>
          <Field label="Confirm New Password">
            <input className="stInput" type="password" placeholder="Repeat new password" />
          </Field>
          <button className="stPrimaryBtn" style={{ alignSelf: "flex-start" }} onClick={() => showToast("Password updated!")}>
            <Key size={13} /> Update Password
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══ SECURITY — 2FA ═════════════════════════════════════════════ */
function Security2FASection({ markDirty, showToast }) {
  const [on, setOn] = useState(true)
  return (
    <div className="stPanel">
      <SectionHeader title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account." />
      <div className="stCard" style={{ maxWidth: 480 }}>
        <div className="stToggleRow" style={{ marginBottom: on ? 20 : 0 }}>
          <div>
            <div className="stToggleLabel">Enable 2FA</div>
            <div className="stToggleDesc">Require OTP verification on every new device login</div>
          </div>
          <ToggleSwitch checked={on} onChange={v => { setOn(v); markDirty(); showToast(`2FA ${v ? "enabled" : "disabled"}.${v ? "" : " Your account is now less secure."}`, v ? "success" : "warn") }} accent="#059669" />
        </div>
        {on && (
          <div style={{ background: "#ECFDF5", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={16} color="#059669" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>Your account is protected with two-factor authentication.</span>
          </div>
        )}
      </div>
    </div>
  )
}


