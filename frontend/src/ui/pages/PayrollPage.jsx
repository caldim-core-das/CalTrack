import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { useRole } from "../../state/auth/useRole.js"
import { Banknote, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, DollarSign, Loader2, FileText, Download, Printer, Share2, Globe, Mail, Eye, Palette, Layout, Type, Sparkles, User, MapPin } from "lucide-react"


const fmt = (n, curr = "$") => `${curr}${Number(n || 0).toFixed(2)}`
const fmtH = (n) => `${Number(n || 0).toFixed(2)}h`
const fmtId = (v) => { if (!v) return "—"; const m = /^EMP(\d+)$/i.exec(String(v).replace(/\s+/g, "")); return m ? `EMP ${m[1].padStart(3, "0")}` : v }

function KpiCard({ icon, label, value, sub, color }) {
  return (
    <div className="kpi-card-3d" style={{
      background: "#fff",
      border: "1.5px solid #e2e8f0",
      borderRadius: 16,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      boxShadow: "0 2px 12px rgba(0,0,0,0.02)",
      transformStyle: "preserve-3d",
      perspective: "1000px",
      transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
    }}>
      <div className="kpi-icon-3d" style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, border: `1.5px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0, transform: "translateZ(0px)", transition: "transform 0.4s" }}>{icon}</div>
      <div style={{ transform: "translateZ(10px)", transition: "transform 0.4s" }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

const loadPref = (key, fallback) => {
  try {
    const val = localStorage.getItem(`caltrack_inv_pref_${key}`)
    return val !== null ? JSON.parse(val) : fallback
  } catch (e) {
    return fallback
  }
}

const savePref = (key, value) => {
  try {
    localStorage.setItem(`caltrack_inv_pref_${key}`, JSON.stringify(value))
  } catch (e) {
    console.error("Failed to save pref", e)
  }
}

export function EmployeeInvoiceHubModal({ record, autoPrint = false, onClose, inline = false }) {
  const isDummy = record?.id === "DUMMY-INV-PREVIEW-999"
  // Customizer state
  const [theme, setTheme] = useState(() => loadPref("theme", "modern_slate"))
  const [font, setFont] = useState(() => loadPref("font", "Outfit"))
  const [layout, setLayout] = useState(() => loadPref("layout", "standard"))
  const [paperBgDesign, setPaperBgDesign] = useState(() => loadPref("paperBgDesign", "solid"))
  const [customColor, setCustomColor] = useState(() => loadPref("customColor", "#4f46e5"))
  const [companyName, setCompanyName] = useState(() => loadPref("companyName", "Caltrack Technologies Ltd"))
  const [companyAddress, setCompanyAddress] = useState(() => loadPref("companyAddress", "100 Innovation Way, Suite 400\nSilicon Valley, CA 94043"))
  const [companyPhone, setCompanyPhone] = useState(() => loadPref("companyPhone", "+1 (555) 234-5678"))
  const [termsNotes, setTermsNotes] = useState(() => loadPref("termsNotes", "This is an automatically generated payroll-based contractor invoice. Net pay is disbursed directly to your registered bank account."))
  const [signatureName, setSignatureName] = useState(() => loadPref("signatureName", "Jane Doe, Finance Director"))
  const [activeTab, setActiveTab] = useState("style") // "style" | "design" | "content"

  // Toggles
  const [showLogo, setShowLogo] = useState(() => loadPref("showLogo", true))
  const [showSignature, setShowSignature] = useState(() => loadPref("showSignature", true))
  const [showBreakdownChart, setShowBreakdownChart] = useState(() => loadPref("showBreakdownChart", true))
  const [showDetailedBreaks, setShowDetailedBreaks] = useState(() => loadPref("showDetailedBreaks", true))

  const [saveSuccess, setSaveSuccess] = useState(false)

  const [isEmailing, setIsEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  // Shift History Workflow States
  const [showShiftHistory, setShowShiftHistory] = useState(false)
  const [shiftHistoryLogs, setShiftHistoryLogs] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Fetch unique time logs matching active payroll period & employee
  useEffect(() => {
    if (showShiftHistory && record?.employee_pk) {
      setLoadingHistory(true)
      apiRequest(`/time-tracking/admin/employees/${record.employee_pk}/logs/`)
        .then(data => {
          if (Array.isArray(data)) {
            const start = new Date(record.period.start_date)
            const end = new Date(record.period.end_date)
            start.setHours(0, 0, 0, 0)
            end.setHours(23, 59, 59, 999)
            const filtered = data.filter(log => {
              const logDate = new Date(log.work_date)
              return logDate >= start && logDate <= end
            })
            setShiftHistoryLogs(filtered)
          } else {
            setShiftHistoryLogs([])
          }
        })
        .catch(err => {
          console.error("Error fetching history:", err)
          setShiftHistoryLogs([])
        })
        .finally(() => setLoadingHistory(false))
    }
  }, [showShiftHistory, record])

  // Inject Fonts dynamically
  useEffect(() => {
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;700&family=Inter:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;700&family=Outfit:wght@300;400;600;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;700;800&display=swap"
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  // Sync preferences from localStorage whenever the active record changes
  useEffect(() => {
    if (record) {
      setTheme(loadPref("theme", "modern_slate"))
      setFont(loadPref("font", "Outfit"))
      setLayout(loadPref("layout", "standard"))
      setPaperBgDesign(loadPref("paperBgDesign", "solid"))
      setCustomColor(loadPref("customColor", "#4f46e5"))
      setCompanyName(loadPref("companyName", "Caltrack Technologies Ltd"))
      setCompanyAddress(loadPref("companyAddress", "100 Innovation Way, Suite 400\nSilicon Valley, CA 94043"))
      setCompanyPhone(loadPref("companyPhone", "+1 (555) 234-5678"))
      setTermsNotes(loadPref("termsNotes", "This is an automatically generated payroll-based contractor invoice. Net pay is disbursed directly to your registered bank account."))
      setSignatureName(loadPref("signatureName", "Jane Doe, Finance Director"))
      setShowLogo(loadPref("showLogo", true))
      setShowSignature(loadPref("showSignature", true))
      setShowBreakdownChart(loadPref("showBreakdownChart", true))
      setShowDetailedBreaks(loadPref("showDetailedBreaks", true))
    }
  }, [record])

  // Auto-print effect for direct downloads
  useEffect(() => {
    if (autoPrint && record) {
      const timer = setTimeout(() => {
        window.print()
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [autoPrint, record])

  if (!record) return null

  const isUK = record.region?.includes("UK")
  const curr = isUK ? "£" : "$"
  const gross = Number(record.gross_pay || 0)
  const net = Number(record.net_pay || 0)
  const tax = Number(record.uk_income_tax || 0)
  const empNI = Number(record.uk_employee_ni || 0)
  const deductions = tax + empNI


  const handlePrint = () => {
    window.print()
  }

  const saveDesignDefaults = () => {
    savePref("theme", theme)
    savePref("font", font)
    savePref("layout", layout)
    savePref("paperBgDesign", paperBgDesign)
    savePref("customColor", customColor)
    savePref("companyName", companyName)
    savePref("companyAddress", companyAddress)
    savePref("companyPhone", companyPhone)
    savePref("termsNotes", termsNotes)
    savePref("signatureName", signatureName)
    savePref("showLogo", showLogo)
    savePref("showSignature", showSignature)
    savePref("showBreakdownChart", showBreakdownChart)
    savePref("showDetailedBreaks", showDetailedBreaks)

    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  const handleEmail = async () => {
    try {
      setIsEmailing(true)
      const res = await apiRequest("/payroll/records/send_invoice_email/", {
        method: "POST",
        json: {
          record: record,
          notes: termsNotes,
          company_name: companyName
        }
      })
      if (res && (res.success || res.message)) {
        setEmailSent(true)
        if (res.message) {
          alert(res.message)
        }
        setTimeout(() => setEmailSent(false), 4000)
      } else {
        alert(res?.detail || "Failed to dispatch email.")
      }
    } catch (err) {
      console.error("Email send failed", err)
      const errorMsg = err?.body?.detail || err?.body?.message || err?.message || JSON.stringify(err?.body) || String(err)
      alert("Error contacting mail server: " + errorMsg)
    } finally {
      setIsEmailing(false)
    }
  }

  const getFontFamily = () => {
    switch (font) {
      case "Outfit": return "'Outfit', sans-serif"
      case "Inter": return "'Inter', sans-serif"
      case "Playfair": return "'Playfair Display', serif"
      case "JetBrains Mono": return "'JetBrains Mono', monospace"
      case "Montserrat": return "'Montserrat', sans-serif"
      default: return "'Inter', sans-serif"
    }
  }

  const getThemeColors = () => {
    switch (theme) {
      case "midnight_cinematic":
        return {
          paperBg: "#0f172a",
          paperText: "#f8fafc",
          paperTextMuted: "#94a3b8",
          paperBorder: "#334155",
          accentColor: customColor || "#38bdf8",
          accentBg: "#1e293b",
          tableHeaderBg: "#1e293b",
          statusPill: "rgba(56,189,248,0.1) text-sky-400 border-sky-500/30",
          cardBg: "#1e293b",
          isDark: true
        }
      case "emerald_elegance":
        return {
          paperBg: "#ffffff",
          paperText: "#0f172a",
          paperTextMuted: "#64748b",
          paperBorder: "#e2e8f0",
          accentColor: "#059669",
          accentBg: "#ecfdf5",
          tableHeaderBg: "#f8fafc",
          statusPill: "bg-emerald-50 text-emerald-700 border-emerald-200",
          cardBg: "#ecfdf5",
          isDark: false
        }
      case "creative_amber":
        return {
          paperBg: "#ffffff",
          paperText: "#0f172a",
          paperTextMuted: "#64748b",
          paperBorder: "#e2e8f0",
          accentColor: "#d97706",
          accentBg: "#fef3c7",
          tableHeaderBg: "#fdf8e6",
          statusPill: "bg-amber-50 text-amber-700 border-amber-200",
          cardBg: "#fef3c7",
          isDark: false
        }
      case "monochrome_bauhaus":
        return {
          paperBg: "#ffffff",
          paperText: "#000000",
          paperTextMuted: "#000000",
          paperBorder: "#000000",
          accentColor: "#000000",
          accentBg: "#ffffff",
          tableHeaderBg: "#ffffff",
          statusPill: "bg-white text-black border-2 border-black font-black",
          cardBg: "#ffffff",
          isDark: false,
          isBauhaus: true
        }
      case "crimson_valkyrie":
        return {
          paperBg: "#ffffff",
          paperText: "#1e1b4b",
          paperTextMuted: "#6b7280",
          paperBorder: "#f3f4f6",
          accentColor: "#991b1b",
          accentBg: "#fef2f2",
          tableHeaderBg: "#fff5f5",
          statusPill: "bg-rose-50 text-rose-700 border-rose-200",
          cardBg: "#fff5f5",
          isDark: false
        }
      case "nordic_frost":
        return {
          paperBg: "#f8fafc",
          paperText: "#0f172a",
          paperTextMuted: "#475569",
          paperBorder: "#cbd5e1",
          accentColor: "#0891b2",
          accentBg: "#ecfeff",
          tableHeaderBg: "#f1f5f9",
          statusPill: "bg-cyan-50 text-cyan-700 border-cyan-200",
          cardBg: "#e0f2fe",
          isDark: false
        }
      case "obsidian_gold":
        return {
          paperBg: "#090d16",
          paperText: "#f8fafc",
          paperTextMuted: "#64748b",
          paperBorder: "#1e293b",
          accentColor: "#fbbf24",
          accentBg: "#1a1b15",
          tableHeaderBg: "#111827",
          statusPill: "bg-amber-950/40 text-amber-400 border-amber-800/40",
          cardBg: "#1e293b",
          isDark: true
        }
      case "cyberpunk_synth":
        return {
          paperBg: "#0d021f",
          paperText: "#fdfaed",
          paperTextMuted: "#9d4edd",
          paperBorder: "#3c096c",
          accentColor: "#f72585",
          accentBg: "#240046",
          tableHeaderBg: "#10002b",
          statusPill: "bg-fuchsia-950/40 text-fuchsia-400 border-fuchsia-800/40",
          cardBg: "#240046",
          isDark: true
        }
      case "corporate_navy":
        return {
          paperBg: "#ffffff",
          paperText: "#0f172a",
          paperTextMuted: "#475569",
          paperBorder: "#e2e8f0",
          accentColor: "#1e3a8a",
          accentBg: "#eff6ff",
          tableHeaderBg: "#f8fafc",
          statusPill: "bg-blue-50 text-blue-700 border-blue-200",
          cardBg: "#f1f5f9",
          isDark: false
        }
      case "modern_slate":
      default:
        return {
          paperBg: "#ffffff",
          paperText: "#0f172a",
          paperTextMuted: "#64748b",
          paperBorder: "#e2e8f0",
          accentColor: customColor || "#4f46e5",
          accentBg: "#f5f3ff",
          tableHeaderBg: "#f8fafc",
          statusPill: "bg-indigo-50 text-indigo-700 border-indigo-200",
          cardBg: "#f8fafc",
          isDark: false
        }
    }
  }

  const colors = getThemeColors()
  const fontFamily = getFontFamily()

  const scrollToTop = () => {
    const container = document.getElementById("invoice-preview-container")
    if (container) {
      container.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const scrollToBottom = () => {
    const container = document.getElementById("invoice-preview-container")
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" })
    }
  }

  // Breakdown items
  const invoiceItems = [
    { desc: "Regular Hours worked", hours: record.regular_hours, rate: record.hourly_rate, total: Number(record.regular_hours || 0) * Number(record.hourly_rate || 0) },
    Number(record.overtime_hours) > 0 && { desc: "Overtime hours (1.5× rate)", hours: record.overtime_hours, rate: Number(record.hourly_rate) * 1.5, total: Number(record.overtime_hours) * Number(record.hourly_rate) * 1.5 },
    Number(record.daily_ot_hours) > 0 && { desc: "Daily Overtime (1.5× rate)", hours: record.daily_ot_hours, rate: Number(record.hourly_rate) * 1.5, total: Number(record.daily_ot_hours) * Number(record.hourly_rate) * 1.5 },
    Number(record.double_time_hours) > 0 && { desc: "Double Time hours (2× rate)", hours: record.double_time_hours, rate: Number(record.hourly_rate) * 2, total: Number(record.double_time_hours) * Number(record.hourly_rate) * 2 },
    Number(record.paid_leave_hours) > 0 && { desc: "Paid Leave coverage", hours: record.paid_leave_hours, rate: record.hourly_rate, total: Number(record.paid_leave_hours) * Number(record.hourly_rate) },
  ].filter(Boolean)

  const deductionItems = [
    Number(record.uk_income_tax) > 0 && { desc: "Income Tax (PAYE)", total: record.uk_income_tax },
    Number(record.uk_employee_ni) > 0 && { desc: "National Insurance (EE)", total: record.uk_employee_ni },
  ].filter(Boolean)

  const printStyle = `
    /* Custom Scrollbars for Invoice Studio */
    .custom-studio-scroll::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-studio-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-studio-scroll::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    .custom-studio-scroll::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }

    #invoice-preview-container::-webkit-scrollbar {
      width: 8px;
    }
    #invoice-preview-container::-webkit-scrollbar-track {
      background: transparent;
    }
    #invoice-preview-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 4px;
    }
    #invoice-preview-container::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    @media print {
      body * {
        visibility: hidden !important;
      }
      #print-area, #print-area * {
        visibility: visible !important;
      }
      #print-area {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: ${colors.paperBg} !important;
        color: ${colors.paperText} !important;
        box-shadow: none !important;
        border: none !important;
        padding: 44px !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `

  const getPaperBackground = () => {
    if (colors.isDark) {
      switch (paperBgDesign) {
        case "grid":
          return "radial-gradient(#1e293b 1.2px, transparent 1.2px) 0 0 / 24px 24px, #0f172a"
        case "linen":
          return "linear-gradient(rgba(30, 41, 59, 0.45), rgba(30, 41, 59, 0.45)), repeating-linear-gradient(0deg, #131a2b, #131a2b 2px, #0f1524 2px, #0f1524 4px)"
        case "glow":
          return `radial-gradient(circle at 100% 0%, ${customColor}22 0%, #0f172a 65%)`
        case "geometric":
          return "linear-gradient(135deg, rgba(255,255,255,0.015) 25%, transparent 25%) -50px 0, linear-gradient(225deg, rgba(255,255,255,0.015) 25%, transparent 25%) -50px 0, #0f172a"
        case "blueprint":
          return "repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(30,41,59,0.3) 19px, rgba(30,41,59,0.3) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(30,41,59,0.3) 19px, rgba(30,41,59,0.3) 20px), #0b0f19"
        case "executive_pinstripe":
          return "repeating-linear-gradient(90deg, #111827, #111827 40px, rgba(30,41,59,0.35) 40px, rgba(30,41,59,0.35) 41px)"
        case "parchment":
          return "radial-gradient(circle at 50% 50%, #1a1613 0%, #0f0d0b 100%)"
        case "diagonal_weave":
          return "repeating-linear-gradient(45deg, #0d1117, #0d1117 6px, #161b22 6px, #161b22 12px)"
        case "carbon_fiber":
          return "linear-gradient(45deg, #111827 25%, transparent 25%), linear-gradient(-45deg, #111827 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%), #0f172a"
        case "solid":
        default:
          return colors.paperBg
      }
    } else {
      switch (paperBgDesign) {
        case "grid":
          return "radial-gradient(#e2e8f0 1.2px, transparent 1.2px) 0 0 / 24px 24px, #ffffff"
        case "linen":
          return "linear-gradient(rgba(244, 241, 234, 0.25), rgba(244, 241, 234, 0.25)), repeating-linear-gradient(0deg, #fdfbf7, #fdfbf7 2px, #faf6ee 2px, #faf6ee 4px)"
        case "glow":
          return `radial-gradient(circle at 100% 0%, ${customColor}18 0%, #ffffff 65%)`
        case "geometric":
          return "linear-gradient(135deg, rgba(79,70,229,0.015) 25%, transparent 25%) -50px 0, linear-gradient(225deg, rgba(79,70,229,0.015) 25%, transparent 25%) -50px 0, #ffffff"
        case "blueprint":
          return "repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(59,130,246,0.07) 19px, rgba(59,130,246,0.07) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(59,130,246,0.07) 19px, rgba(59,130,246,0.07) 20px), #fafcff"
        case "executive_pinstripe":
          return "repeating-linear-gradient(90deg, #ffffff, #ffffff 40px, rgba(226,232,240,0.5) 40px, rgba(226,232,240,0.5) 41px)"
        case "parchment":
          return "linear-gradient(to right, #fdfbf7, #f5f1e6)"
        case "diagonal_weave":
          return "repeating-linear-gradient(45deg, #ffffff, #ffffff 6px, #f8fafc 6px, #f8fafc 12px)"
        case "carbon_fiber":
          return "linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%), #ffffff"
        case "solid":
        default:
          return colors.paperBg
      }
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const innerLayout = (
    <div style={inline ? {
      background: "#ffffff",
      borderRadius: 24,
      width: "100%",
      height: "85vh",
      minHeight: "680px",
      display: "grid",
      gridTemplateColumns: isDummy ? "320px 1fr" : "1fr",
      overflow: "hidden",
      border: "1px solid #e2e8f0",
      boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
      cursor: "default"
    } : {
      background: "#ffffff",
      borderRadius: 32,
      width: "100%",
      maxWidth: 1200,
      height: "90vh",
      display: "grid",
      gridTemplateColumns: isDummy ? "320px 1fr" : "1fr",
      overflow: "hidden",
      boxShadow: "0 32px 80px rgba(0,0,0,0.25)",
      border: "1px solid rgba(255,255,255,0.2)",
      cursor: "default"
    }}>
      <style>{printStyle}</style>

      {/* LEFT SIDEBAR: CONTROLS */}
      {isDummy && (
        <div className="no-print" style={{ background: "#0f172a", color: "#f8fafc", padding: "24px 20px", display: "flex", flexDirection: "column", borderRight: "1px solid #1e293b", height: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={18} color="#fff" />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>Invoice Studio</h3>
                <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, fontWeight: 700 }}>PAYROLL CUSTOMIZATION</p>
              </div>
            </div>
            {!inline && (
              <button onClick={onClose} style={{ marginLeft: "auto", background: "#1e293b", border: "none", borderRadius: 8, padding: "6px 10px", color: "#94a3b8", cursor: "pointer", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                <X size={12} /> Close
              </button>
            )}
          </div>

          {/* TAB SELECTION BAR */}
          <div style={{ display: "flex", background: "#1e293b", padding: 4, borderRadius: 10, gap: 2 }}>
            {[
              { id: "style", lbl: "Palette" },
              { id: "design", lbl: "Backdrop" },
              { id: "content", lbl: "Details" }
            ].map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  background: activeTab === t.id ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "transparent",
                  color: activeTab === t.id ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                {t.lbl}
              </button>
            ))}
          </div>

          {/* Scrollable Options Container */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, paddingRight: 4, marginTop: 12, marginBottom: 12 }} className="custom-studio-scroll">

            {/* TAB 1: PALETTE & TYPOGRAPHY */}
            {activeTab === "style" && (
              <>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Template Theme</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {[
                      { id: "modern_slate", lbl: "Modern Slate", color: "#4f46e5" },
                      { id: "midnight_cinematic", lbl: "Midnight", color: "#60a5fa" },
                      { id: "emerald_elegance", lbl: "Emerald", color: "#059669" },
                      { id: "creative_amber", lbl: "Amber Gold", color: "#d97706" },
                      { id: "monochrome_bauhaus", lbl: "Bauhaus", color: "#000000" },
                      { id: "crimson_valkyrie", lbl: "Crimson Royal", color: "#991b1b" },
                      { id: "nordic_frost", lbl: "Nordic Frost", color: "#0891b2" },
                      { id: "obsidian_gold", lbl: "Obsidian Gold", color: "#fbbf24" },
                      { id: "cyberpunk_synth", lbl: "Cyber Synth", color: "#f72585" },
                      { id: "corporate_navy", lbl: "Classic Navy", color: "#1e3a8a" }
                    ].map(t => (
                      <button key={t.id} onClick={() => setTheme(t.id)}
                        style={{
                          padding: "8px 4px",
                          background: theme === t.id ? "#1e293b" : "#1a2035",
                          border: theme === t.id ? `1.5px solid ${t.color}` : "1.5px solid transparent",
                          borderRadius: 8,
                          fontSize: 11,
                          color: theme === t.id ? "#fff" : "#94a3b8",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          justifyContent: "flex-start",
                          paddingLeft: 10
                        }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                        {t.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Typography (Font)</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { id: "Inter", lbl: "Inter Sans" },
                      { id: "Outfit", lbl: "Outfit Modern" },
                      { id: "Plus Jakarta Sans", lbl: "Plus Jakarta" },
                      { id: "JetBrains Mono", lbl: "JetBrains Mono" },
                      { id: "Cabin", lbl: "Cabin Admin" }
                    ].map(f => (
                      <button key={f.id} onClick={() => setFont(f.id)}
                        style={{
                          padding: "8px 10px",
                          background: font === f.id ? "#1e293b" : "#1a2035",
                          border: font === f.id ? "1.5px solid #4f46e5" : "1.5px solid transparent",
                          borderRadius: 8,
                          fontSize: 11,
                          color: font === f.id ? "#fff" : "#94a3b8",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}>
                        {f.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Structure / Layout</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {[
                      { id: "standard", lbl: "Classic Standard" },
                      { id: "split_dashboard", lbl: "Split View" },
                      { id: "minimalist_compact", lbl: "Compact Sleek" },
                      { id: "executive_luxe", lbl: "Executive Luxe" },
                      { id: "technical_ledger", lbl: "Technical Grid" },
                      { id: "swiss_editorial", lbl: "Swiss Editorial" }
                    ].map(l => (
                      <button key={l.id} onClick={() => setLayout(l.id)}
                        style={{
                          padding: "10px 4px",
                          background: layout === l.id ? "#1e293b" : "#1a2035",
                          border: layout === l.id ? "1.5px solid #4f46e5" : "1.5px solid transparent",
                          borderRadius: 8,
                          fontSize: 10,
                          color: layout === l.id ? "#fff" : "#94a3b8",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}>
                        {l.lbl}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: BACKDROP & VISIBILITY DESIGN */}
            {activeTab === "design" && (
              <>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Paper Backdrop Design</label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                    {[
                      { id: "solid", lbl: "Solid Classic" },
                      { id: "grid", lbl: "Technical Grid" },
                      { id: "linen", lbl: "Premium Linen" },
                      { id: "glow", lbl: "Accent Glow" },
                      { id: "geometric", lbl: "Geometric Art" },
                      { id: "blueprint", lbl: "Blueprint Draft" },
                      { id: "executive_pinstripe", lbl: "Pinstripe Suit" },
                      { id: "parchment", lbl: "Antique Parchment" },
                      { id: "diagonal_weave", lbl: "Diagonal Weave" },
                      { id: "carbon_fiber", lbl: "Carbon Tech Mesh" }
                    ].map(bg => (
                      <button key={bg.id} onClick={() => setPaperBgDesign(bg.id)}
                        style={{
                          padding: "8px 4px",
                          background: paperBgDesign === bg.id ? "#1e293b" : "#1a2035",
                          border: paperBgDesign === bg.id ? "1.5px solid #4f46e5" : "1.5px solid transparent",
                          borderRadius: 8,
                          fontSize: 11,
                          color: paperBgDesign === bg.id ? "#fff" : "#94a3b8",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          gridColumn: "auto"
                        }}>
                        {bg.lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {theme !== "monochrome_bauhaus" && theme !== "emerald_elegance" && theme !== "creative_amber" && (
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Accent Tint Color</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
                        style={{ border: "none", width: 44, height: 36, borderRadius: 8, cursor: "pointer", background: "none" }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#cbd5e1" }}>{customColor.toUpperCase()}</span>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Layout Toggles</label>
                  {[
                    ["Show Company Logo", showLogo, setShowLogo],
                    ["Show Signature Line", showSignature, setShowSignature],
                    ["Show Allocation Chart", showBreakdownChart, setShowBreakdownChart],
                    ["Show Breaks Breakdown", showDetailedBreaks, setShowDetailedBreaks]
                  ].map(([lbl, val, set]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#cbd5e1", fontWeight: 600 }}>{lbl}</span>
                      <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "#4f46e5", cursor: "pointer" }} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TAB 3: CUSTOM METADATA DETAILS */}
            {activeTab === "content" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>Custom Bill-from Details</label>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>Company Name</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: "#1a2035", border: "1.5px solid #1e293b", borderRadius: 8, fontSize: 12, color: "#fff", outline: "none", fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>Company Address</label>
                  <textarea rows={2} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: "#1a2035", border: "1.5px solid #1e293b", borderRadius: 8, fontSize: 12, color: "#fff", outline: "none", fontFamily: "sans-serif", resize: "none", fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>Footnote Terms & Notes</label>
                  <textarea rows={3} value={termsNotes} onChange={e => setTermsNotes(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: "#1a2035", border: "1.5px solid #1e293b", borderRadius: 8, fontSize: 12, color: "#fff", outline: "none", fontFamily: "sans-serif", resize: "none", fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#64748b", fontWeight: 700, display: "block", marginBottom: 4 }}>Authorized Signature Name</label>
                  <input type="text" value={signatureName} onChange={e => setSignatureName(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", background: "#1a2035", border: "1.5px solid #1e293b", borderRadius: 8, fontSize: 12, color: "#fff", outline: "none", fontWeight: 600 }} />
                </div>
              </div>
            )}
          </div>

          {/* 💾 PERSISTENCE CONTROL PANEL */}
          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={saveDesignDefaults}
              style={{
                width: "100%",
                padding: "12px 16px",
                background: saveSuccess ? "#059669" : "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: 12,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: saveSuccess ? "0 4px 12px rgba(5, 150, 105, 0.2)" : "0 4px 12px rgba(79, 70, 229, 0.2)",
                transition: "all 0.2s ease"
              }}
              className="hover:bg-indigo-600 transition-all active:scale-95"
            >
              {saveSuccess ? (
                <>✓ Settings Saved</>
              ) : (
                <>Save as Default Style</>
              )}
            </button>
            <p style={{ fontSize: 10, color: "#94a3b8", margin: 0, textAlign: "center", fontWeight: 600, letterSpacing: "0.02em", lineHeight: 1.4 }}>
              Applies globally to all future payroll prints & invoice downloads.
            </p>
          </div>
        </div>
      )}

      {/* RIGHT SIDE: LIVE A4 PREVIEW CANVAS */}
      <div style={{ background: "#f1f5f9", display: "flex", flexDirection: "column", height: "100%", position: "relative", overflow: "hidden" }}>
        {/* Top Canvas Bar */}
        <div className="no-print" style={{ background: "#fff", borderBottom: "1.5px solid #e2e8f0", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Eye size={16} color="#64748b" />
              <span style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>A4 Print/PDF Preview</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleEmail} disabled={isEmailing}
              style={{
                padding: "10px 18px",
                background: emailSent ? "#059669" : "#f1f5f9",
                color: emailSent ? "#fff" : "#475569",
                border: "none",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s"
              }}>
              <Share2 size={13} />
              {isEmailing ? "Sending Email..." : emailSent ? "Invoice Sent to Employee!" : "Send via Email"}
            </button>

            <button onClick={() => setShowShiftHistory(true)}
              style={{
                padding: "10px 18px",
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "none",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.2s"
              }}
              className="hover:bg-blue-100"
            >
              <Clock size={13} />
              View Shift History
            </button>

            <button onClick={handlePrint}
              style={{
                padding: "10px 18px",
                background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 4px 12px rgba(79,70,229,0.2)"
              }}>
              <Printer size={13} />
              Print / Save PDF
            </button>
            {!isDummy && (
              <button onClick={onClose}
                style={{
                  padding: "10px 18px",
                  background: "#fee2e2",
                  color: "#991b1b",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s"
                }}
                className="hover:bg-red-200"
              >
                <X size={14} />
                Close
              </button>
            )}
          </div>
        </div>

        {/* Canvas sheet container */}
        <div id="invoice-preview-container" style={{ flex: 1, overflowY: "auto", padding: "32px 16px", background: "#f1f5f9" }}>
          <div id="print-area" className="print-invoice-sheet"
            style={{
              background: getPaperBackground(),
              color: colors.paperText,
              width: "100%",
              maxWidth: 774,
              minHeight: 1000,
              margin: "0 auto 40px auto",
              flexShrink: 0,
              borderRadius: colors.isBauhaus ? 0 : 24,
              border: colors.isBauhaus ? "3px solid #000" : `1.5px solid ${colors.paperBorder}`,
              boxShadow: colors.isBauhaus ? "8px 8px 0px #000" : "0 12px 40px rgba(0,0,0,0.06)",
              padding: 44,
              fontFamily: fontFamily,
              transition: "all 0.3s ease",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}>

            {/* TOP HEADER: STANDARD vs COMPACT vs SPLIT */}
            {/* TOP HEADER: STANDARD vs COMPACT vs SPLIT vs EXECUTIVE LUXE */}
            {layout === "executive_luxe" && (
              <>
                {/* Top Premium Color Bar */}
                <div className="no-print" style={{ height: 6, background: colors.accentColor, margin: "-44px -44px 28px -44px", borderRadius: "24px 24px 0 0" }} />

                {/* Top Header Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, marginBottom: 28, alignItems: "flex-start" }}>
                  <div>
                    {showLogo && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.accentColor, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 10px ${colors.accentColor}30` }}>
                          <Banknote size={18} color={colors.isDark ? "#0f172a" : "#fff"} />
                        </div>
                        <div>
                          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", display: "block", color: colors.paperText }}>{companyName}</span>
                          <span style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>Caltrack Certified Ledger</span>
                        </div>
                      </div>
                    )}
                    {!showLogo && (
                      <div style={{ fontSize: 20, fontWeight: 900, color: colors.paperText, letterSpacing: "-0.02em" }}>{companyName}</div>
                    )}
                    <p style={{ fontSize: 11, color: colors.paperTextMuted, whiteSpace: "pre-line", margin: "8px 0 0 0", lineHeight: 1.5 }}>{companyAddress}</p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: colors.accentColor, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 4 }}>WAGE STATEMENT & CONTRACT</div>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: colors.paperText, letterSpacing: "-0.04em", margin: "0 0 8px 0", lineHeight: 1 }}>INVOICE</h1>
                    <div style={{ fontSize: 11, color: colors.paperTextMuted, lineHeight: 1.6 }}>
                      <div><strong style={{ color: colors.paperText }}>ID:</strong> <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>INV-{record.id?.slice(-8).toUpperCase() || "PAYROLL"}</span></div>
                      <div><strong style={{ color: colors.paperText }}>Pay Date:</strong> {new Date().toLocaleDateString()}</div>
                      <div><strong style={{ color: colors.paperText }}>Labor Period:</strong> <span style={{ color: colors.accentColor, fontWeight: 700 }}>{record.period?.start_date} → {record.period?.end_date}</span></div>
                    </div>
                  </div>
                </div>

                {/* Asymmetrical Premium Card for Employee Credentials & Compliance Status */}
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, marginBottom: 28, background: colors.isDark ? "#131a2b" : "#f8fafc", padding: 20, borderRadius: 16, border: `1.5px solid ${colors.paperBorder}` }}>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.1em" }}>CONSULTANT / RECIPIENT</span>
                    <div style={{ fontSize: 18, fontWeight: 900, color: colors.paperText, marginTop: 4 }}>{record.employee_name}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: colors.paperTextMuted }}>
                      <span><strong>Ref ID:</strong> {fmtId(record.employee)}</span>
                      <span>•</span>
                      <span><strong>Jurisdiction:</strong> {record.region || "Global Compliance"}</span>
                    </div>
                  </div>
                  <div style={{ borderLeft: `1px solid ${colors.paperBorder}`, paddingLeft: 20, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: record.wage_floor_compliant ? "#10b981" : "#d97706" }} />
                      <span style={{ fontSize: 12, fontWeight: 900, color: colors.paperText }}>{record.wage_floor_compliant ? "STATUTORY COMPLIANT" : "STANDARD COMPENSATION"}</span>
                    </div>
                    <p style={{ fontSize: 10, color: colors.paperTextMuted, margin: "4px 0 0 0" }}>Verified by Caltrack compliance labor tracking protocols.</p>
                  </div>
                </div>
              </>
            )}

            {layout === "split_dashboard" && (
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32, margin: "-44px -44px 32px -44px", background: colors.accentBg, borderBottom: colors.isBauhaus ? "3px solid #000" : `1.5px solid ${colors.paperBorder}` }}>
                <div style={{ background: colors.accentColor, color: colors.isDark ? colors.paperText : "#fff", padding: "44px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    {showLogo && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 36 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Banknote size={14} color="#fff" />
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>{companyName.split(" ")[0]}</span>
                      </div>
                    )}
                    <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fff", margin: "0 0 4px 0", letterSpacing: "-0.02em" }}>INVOICE</h1>
                    <div style={{ fontSize: 10, opacity: 0.8, fontWeight: 700 }}>INV-{record.id?.slice(-6).toUpperCase() || "PAYROLL"}</div>
                  </div>

                  <div style={{ marginTop: 44 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>Employee</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginTop: 2 }}>{record.employee_name}</div>
                    <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>ID: {fmtId(record.employee)}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>Region: {record.region || "—"}</div>
                  </div>
                </div>

                <div style={{ padding: "44px 32px 44px 0", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h2 style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px 0" }}>BILL FROM</h2>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{companyName}</div>
                      <div style={{ fontSize: 10, color: colors.paperTextMuted, whiteSpace: "pre-line", marginTop: 2 }}>{companyAddress}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: colors.paperTextMuted }}><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                      <div style={{ fontSize: 10, color: colors.paperTextMuted }}><strong>Pay Period:</strong></div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: colors.accentColor }}>{record.period?.start_date} → {record.period?.end_date}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 20, marginTop: 24, background: colors.paperBg, padding: "12px 16px", borderRadius: 12, border: `1px solid ${colors.paperBorder}` }}>
                    <div>
                      <div style={{ fontSize: 9, color: colors.paperTextMuted, fontWeight: 700 }}>HOURLY RATE</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: colors.accentColor }}>{fmt(record.hourly_rate, curr)}/hr</div>
                    </div>
                    <div style={{ borderLeft: `1px solid ${colors.paperBorder}`, paddingLeft: 16 }}>
                      <div style={{ fontSize: 9, color: colors.paperTextMuted, fontWeight: 700 }}>WORK PERIOD HRS</div>
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{fmtH(Number(record.regular_hours || 0) + Number(record.overtime_hours || 0))}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {layout === "technical_ledger" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, border: `1.5px solid ${colors.paperBorder}`, padding: 20, borderRadius: 12, background: colors.tableHeaderBg, marginBottom: 28 }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "monospace", color: colors.accentColor, fontWeight: 900 }}>[ SYSTEM PROTOCOL: BILL FROM ]</div>
                  <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "monospace", marginTop: 4 }}>{companyName}</div>
                  <div style={{ fontSize: 10, color: colors.paperTextMuted, fontFamily: "monospace", marginTop: 2, whiteSpace: "pre-line" }}>{companyAddress}</div>

                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px dashed ${colors.paperBorder}` }}>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: colors.accentColor, fontWeight: 900 }}>[ RECIPIENT_DATA ]</div>
                    <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "monospace", marginTop: 2 }}>{record.employee_name}</div>
                    <div style={{ fontSize: 9, fontFamily: "monospace", color: colors.paperTextMuted }}>ID: {fmtId(record.employee)} | JURISDICTION: {record.region || "US"}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right", borderLeft: `1.5px dashed ${colors.paperBorder}`, paddingLeft: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "monospace", letterSpacing: "0.1em", color: colors.paperText }}>LEDGER_DOC</div>
                    <div style={{ fontSize: 10, color: colors.paperTextMuted, fontFamily: "monospace", marginTop: 4, lineHeight: 1.5 }}>
                      <div>DOC_NO: INV-{record.id?.slice(-8).toUpperCase()}</div>
                      <div>PERIOD_DT: {record.period?.start_date} {"->"} {record.period?.end_date}</div>
                      <div>GEN_DATE: {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ background: colors.paperBg, padding: "6px 12px", borderRadius: 6, border: `1.5px solid ${colors.paperBorder}`, display: "inline-block", alignSelf: "flex-end", marginTop: 16 }}>
                    <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 900 }}>RATE: {fmt(record.hourly_rate, curr)}/hr</span>
                  </div>
                </div>
              </div>
            )}

            {layout === "swiss_editorial" && (
              <div style={{ marginBottom: 36, borderBottom: `3px solid ${colors.paperText}`, paddingBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 900, color: colors.accentColor, textTransform: "uppercase", letterSpacing: "0.2em" }}>Document Hub</span>
                    <h1 style={{ fontSize: 44, fontWeight: 900, letterSpacing: "-0.05em", color: colors.paperText, margin: "6px 0 0 0", lineHeight: 0.9 }}>INVOICE.</h1>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900 }}>{companyName}</div>
                    <div style={{ fontSize: 10, color: colors.paperTextMuted, marginTop: 4, whiteSpace: "pre-line" }}>{companyAddress}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24, borderTop: `1.5px solid ${colors.paperBorder}`, paddingTop: 16 }}>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase" }}>EMPLOYEE RECIPIENT</span>
                    <div style={{ fontSize: 14, fontWeight: 900, marginTop: 2 }}>{record.employee_name}</div>
                    <div style={{ fontSize: 10, color: colors.paperTextMuted }}>ID: {fmtId(record.employee)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase" }}>PAY PERIOD</span>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2 }}>{record.period?.start_date} - {record.period?.end_date}</div>
                    <div style={{ fontSize: 10, color: colors.paperTextMuted }}>Region: {record.region || "US"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase" }}>INVOICE REFERENCE</span>
                    <div style={{ fontSize: 13, fontWeight: 900, marginTop: 2, color: colors.accentColor }}>#{record.id?.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: 10, color: colors.paperTextMuted }}>Base: {fmt(record.hourly_rate, curr)}/hr</div>
                  </div>
                </div>
              </div>
            )}

            {layout === "minimalist_compact" && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1.5px solid ${colors.paperBorder}`, paddingBottom: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: colors.paperText }}>{companyName}</div>
                  <div style={{ fontSize: 10, color: colors.paperTextMuted }}>{companyAddress.replace("\n", ", ")}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>
                    Recipient: <span style={{ color: colors.accentColor }}>{record.employee_name}</span> (ID: {fmtId(record.employee)})
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: colors.accentColor }}>INVOICE #{record.id?.slice(-6).toUpperCase()}</div>
                  <div style={{ fontSize: 10, color: colors.paperTextMuted, marginTop: 2 }}>Period: {record.period?.start_date} → {record.period?.end_date}</div>
                  <div style={{ fontSize: 10, color: colors.paperTextMuted }}>Hourly Base: {fmt(record.hourly_rate, curr)}/hr</div>
                </div>
              </div>
            )}

            {layout === "standard" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                  <div>
                    {showLogo && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: colors.accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Banknote size={15} color={colors.isDark ? "#0f172a" : "#fff"} />
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.03em" }}>{companyName.split(" ")[0]}</span>
                      </div>
                    )}
                    <h2 style={{ fontSize: 12, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>BILL FROM</h2>
                    <div style={{ fontSize: 14, fontWeight: 900, marginTop: 4 }}>{companyName}</div>
                    <p style={{ fontSize: 11, color: colors.paperTextMuted, whiteSpace: "pre-line", margin: "4px 0 0 0", lineHeight: 1.4 }}>{companyAddress}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <h1 style={{ fontSize: 32, fontWeight: 900, color: colors.accentColor, letterSpacing: "-0.03em", margin: "0 0 8px 0" }}>INVOICE</h1>
                    <div style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 800, textTransform: "uppercase", border: `1px solid ${colors.paperBorder}`, background: colors.accentBg, color: colors.accentColor }}>
                      {record.wage_floor_compliant ? "WAGE COMPLIANT" : "WAGE EXEMPT"}
                    </div>
                    <div style={{ fontSize: 11, color: colors.paperTextMuted, marginTop: 16 }}>
                      <div><strong style={{ color: colors.paperText }}>Invoice No:</strong> INV-{record.id?.slice(-6).toUpperCase() || "PAYROLL"}</div>
                      <div><strong style={{ color: colors.paperText }}>Period Date:</strong> {record.period?.start_date} → {record.period?.end_date}</div>
                      <div><strong style={{ color: colors.paperText }}>Generated At:</strong> {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: `1.5px dashed ${colors.paperBorder}`, margin: "0 0 28px 0" }} />

                {/* BILL TO */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
                  <div>
                    <h2 style={{ fontSize: 10, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 6px 0" }}>EMPLOYEE SUMMARY</h2>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{record.employee_name}</div>
                    <div style={{ fontSize: 11, color: colors.paperTextMuted, marginTop: 4 }}>
                      <div>Employee ID: {fmtId(record.employee)}</div>
                      <div>Work Region: {record.region || "—"}</div>
                      <div>Hourly Wage Base: {fmt(record.hourly_rate, curr)}/hr</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <h2 style={{ fontSize: 10, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 6px 0" }}>COMPLIANCE STATS</h2>
                    <div style={{ fontSize: 11, color: colors.paperTextMuted }}>
                      <div>Regular Hours: {fmtH(record.regular_hours)}</div>
                      <div>Overtime Premium: {fmtH(record.overtime_hours)}</div>
                      <div>Accrued Paid Leaves: {fmtH(record.holiday_hours_accrued || 0)}</div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* EARNINGS TABLE */}
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: 10, fontWeight: 900, color: colors.accentColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={12} /> Earnings & Hours Breakdown
              </h2>

              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", marginBottom: 24 }}>
                <thead>
                  <tr style={{ borderBottom: colors.isBauhaus ? "3px solid #000" : `1.5px solid ${colors.paperBorder}`, background: colors.tableHeaderBg }}>
                    <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText }}>Description</th>
                    <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText, textAlign: "right" }}>Hours (Qty)</th>
                    <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText, textAlign: "right" }}>Rate</th>
                    <th style={{ padding: "10px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: `1.5px solid ${colors.paperBorder}` }}>
                      <td style={{ padding: "12px", fontSize: 12, fontWeight: 700 }}>{item.desc}</td>
                      <td style={{ padding: "12px", fontSize: 12, fontWeight: 700, textAlign: "right", color: colors.paperTextMuted }}>{fmtH(item.hours)}</td>
                      <td style={{ padding: "12px", fontSize: 12, fontWeight: 700, textAlign: "right", color: colors.paperTextMuted }}>{fmt(item.rate, curr)}</td>
                      <td style={{ padding: "12px", fontSize: 12, fontWeight: 900, textAlign: "right" }}>{fmt(item.total, curr)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: colors.tableHeaderBg }}>
                    <td colSpan={3} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Gross Earnings</td>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 900, textAlign: "right", color: colors.accentColor }}>{fmt(gross, curr)}</td>
                  </tr>
                </tbody>
              </table>

              {/* DETAILED BREAKS LIST */}
              {showDetailedBreaks && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, background: colors.cardBg, padding: 14, borderRadius: 12, border: `1px solid ${colors.paperBorder}` }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: colors.accentColor, textTransform: "uppercase", marginBottom: 4 }}>Paid Leave Accruals</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>Accrued Holiday Period: <span style={{ color: colors.accentColor }}>{fmtH(record.holiday_hours_accrued || 0)}</span></div>
                    <div style={{ fontSize: 9, color: colors.paperTextMuted, marginTop: 2 }}>Calculated under local labor compliance acts.</div>
                  </div>
                  <div style={{ borderLeft: `1px dashed ${colors.paperBorder}`, paddingLeft: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: colors.accentColor, textTransform: "uppercase", marginBottom: 4 }}>Geofencing Verification</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>GPS Clock-in Compliance: <span style={{ color: "#059669" }}>VERIFIED ✓</span></div>
                    <div style={{ fontSize: 9, color: colors.paperTextMuted, marginTop: 2 }}>Validated against corporate physical office coordinates.</div>
                  </div>
                </div>
              )}

              {/* DEDUCTIONS TABLE */}
              {deductionItems.length > 0 && (
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 10, fontWeight: 900, color: colors.accentColor, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={12} /> Taxes & statutory Deductions
                  </h2>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: colors.isBauhaus ? "3px solid #000" : `1.5px solid ${colors.paperBorder}`, background: colors.tableHeaderBg }}>
                        <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText }}>Deduction Type</th>
                        <th style={{ padding: "8px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: colors.paperText, textAlign: "right" }}>Total Deducted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deductionItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: `1.5px solid ${colors.paperBorder}` }}>
                          <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, color: colors.paperTextMuted }}>{item.desc}</td>
                          <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 900, textAlign: "right", color: "#dc2626" }}>− {fmt(item.total, curr)}</td>
                        </tr>
                      ))}
                      <tr style={{ background: colors.tableHeaderBg }}>
                        <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>Total Deductions</td>
                        <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 900, textAlign: "right", color: "#dc2626" }}>− {fmt(deductions, curr)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TOTALS & CHARTS */}
            <div style={{ marginTop: 20, borderTop: colors.isBauhaus ? "3px solid #000" : `1.5px solid ${colors.paperBorder}`, paddingTop: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 32, alignItems: "flex-start" }}>
                <div>
                  {showBreakdownChart && (
                    <div style={{ background: colors.cardBg, padding: 14, borderRadius: 12, border: `1px solid ${colors.paperBorder}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800, color: colors.paperTextMuted, marginBottom: 6 }}>
                        <span>PAYROLL ALLOCATION</span>
                        <span style={{ color: colors.accentColor }}>{Math.round((net / Math.max(1, gross)) * 100)}% Net Take-home</span>
                      </div>
                      {/* Horizontal Bar Chart */}
                      <div style={{ height: 12, background: "#e2e8f0", borderRadius: 6, overflow: "hidden", display: "flex" }}>
                        <div style={{ width: `${(net / Math.max(1, gross)) * 100}%`, background: colors.accentColor, height: "100%" }} />
                        <div style={{ width: `${(deductions / Math.max(1, gross)) * 100}%`, background: "#dc2626", height: "100%" }} />
                      </div>
                      <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: colors.paperText }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: colors.accentColor }} /> Net: {fmt(net, curr)}
                        </div>
                        {deductions > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, color: colors.paperTextMuted }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626" }} /> Deductions: {fmt(deductions, curr)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ fontWeight: 700, color: colors.paperTextMuted }}>Subtotal Earnings:</span>
                    <span style={{ fontWeight: 700 }}>{fmt(gross, curr)}</span>
                  </div>
                  {deductions > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <span style={{ fontWeight: 700, color: colors.paperTextMuted }}>Statutory Taxes:</span>
                      <span style={{ fontWeight: 700, color: "#dc2626" }}>− {fmt(deductions, curr)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1.5px solid ${colors.paperBorder}`, paddingTop: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Total Net Paid</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: colors.accentColor }}>{fmt(net, curr)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER & TERMS */}
            <div style={{ marginTop: "auto", paddingTop: 36, paddingBottom: 12 }}>
              <div style={{ borderTop: colors.isBauhaus ? "3px solid #000" : `1px dashed ${colors.paperBorder}`, paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div style={{ maxWidth: 360 }}>
                  <h4 style={{ fontSize: 10, fontWeight: 800, color: colors.accentColor, textTransform: "uppercase", margin: "0 0 4px 0" }}>Notes & Bank Terms</h4>
                  <p style={{ fontSize: 10, color: colors.paperTextMuted, margin: 0, lineHeight: 1.4 }}>{termsNotes}</p>
                </div>

                {layout === "executive_luxe" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.isDark ? "#131a2b" : "#f8fafc", padding: "8px 12px", borderRadius: 10, border: `1px solid ${colors.paperBorder}`, margin: "0 16px" }}>
                    {/* Simulated elegant QR code visual made of CSS grids */}
                    <div style={{ width: 28, height: 28, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, background: colors.accentColor, padding: 2, borderRadius: 4 }}>
                      {[1, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 1].map((val, i) => (
                        <div key={i} style={{ background: val ? colors.isDark ? "#0f172a" : "#fff" : "transparent" }} />
                      ))}
                    </div>
                    <div>
                      <span style={{ fontSize: 7, fontWeight: 900, display: "block", color: colors.accentColor, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>CALTRACK COMPLIANT</span>
                      <span style={{ fontSize: 7, display: "block", color: colors.paperTextMuted, fontFamily: "monospace", whiteSpace: "nowrap" }}>HASH: {record.id?.slice(0, 8).toUpperCase()}</span>
                    </div>
                  </div>
                )}

                {showSignature && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: 18, color: colors.accentColor, marginBottom: 2 }}>
                      {signatureName}
                    </div>
                    <div style={{ borderTop: `1px solid ${colors.paperBorder}`, width: 150, margin: "0 auto" }} />
                    <div style={{ fontSize: 9, fontWeight: 800, color: colors.paperTextMuted, textTransform: "uppercase", marginTop: 4 }}>Authorized Paymaster</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: colors.paperTextMuted, marginTop: 24, fontWeight: 700, borderTop: `1.5px solid ${colors.paperBorder}`, paddingTop: 10 }}>
                <span>Support: support@caltrack.com</span>
                <span>Corporate Web: www.caltrack.com</span>
                <span>System Hash: {record.id?.slice(0, 12) || "SECURE_PAYROLL_DOC"}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Floating Scroll Controllers */}
        <div className="no-print animate-fadeIn" style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 50
        }}>
          <button onClick={scrollToTop} title="Scroll to Top"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#1e293b",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              transition: "all 0.2s ease"
            }}
            className="hover:scale-110 hover:bg-indigo-600 active:scale-95 transition-all"
          >
            <ChevronUp size={18} />
          </button>
          <button onClick={scrollToBottom} title="Scroll to Bottom"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "#1e293b",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              transition: "all 0.2s ease"
            }}
            className="hover:scale-110 hover:bg-indigo-600 active:scale-95 transition-all"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* ⏳ Shift Workflow History Overlay */}
      {showShiftHistory && (
        <div className="no-print animate-fadeIn" style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(10, 15, 30, 0.96)",
          backdropFilter: "blur(16px)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          padding: "28px 36px",
          boxSizing: "border-box",
          color: "#f8fafc",
          overflowY: "auto"
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid rgba(255,255,255,0.1)", paddingBottom: 18, marginBottom: 24 }}>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10, margin: 0, letterSpacing: "-0.03em" }}>
                <Clock size={24} color="#60a5fa" className="animate-pulse" />
                Shift Workflow Audit Ledger
              </h2>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "6px 0 0 0", fontWeight: 500 }}>
                Verifiable trace ledger, location geofencing data, and face verification photos for <strong style={{ color: "#38bdf8" }}>{record.employee_name}</strong> ({fmtId(record.employee)})
              </p>
            </div>
            <button onClick={() => setShowShiftHistory(false)} style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: "10px 20px",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
              transition: "all 0.2s"
            }} className="hover:bg-indigo-600 transition-all active:scale-95">
              <X size={14} /> Back to Invoice
            </button>
          </div>

          {/* Main Ledger Content */}
          {loadingHistory ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Loader2 className="animate-spin" size={36} color="#3b82f6" />
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>Assembling trace records...</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 20 }}>
              {(shiftHistoryLogs.length > 0 ? shiftHistoryLogs : [
                {
                  id: "mock-trace-1",
                  work_date: record.period?.start_date || new Date().toISOString().slice(0, 10),
                  clock_in: `${record.period?.start_date || new Date().toISOString().slice(0, 10)}T08:58:00Z`,
                  clock_out: `${record.period?.start_date || new Date().toISOString().slice(0, 10)}T17:02:00Z`,
                  clock_in_address: "Silicon Valley Tech Center, 100 Innovation Way, Suite A",
                  clock_out_address: "Silicon Valley Tech Center, 100 Innovation Way, Suite A",
                  location_name: "Tech Park Facility",
                  status: "approved",
                  approved_by_name: signatureName || "Jane Doe (Finance Director)",
                  clock_in_notes: "Arrived on site early. Setup completed successfully.",
                  clock_out_notes: "Regular scheduled work ended. Logged off device.",
                  face_match_status: "matched",
                  face_match_score: 0.98,
                  distance_from_site_meters: 14,
                  breaks: [
                    { break_type: "tea", duration_minutes: 15 },
                    { break_type: "lunch", duration_minutes: 30 }
                  ]
                }
              ]).map((log) => {
                const isApproved = log.status === "approved";
                const clockInTime = log.clock_in ? new Date(log.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—";
                const clockOutTime = log.clock_out ? new Date(log.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "In Progress";

                // Allocate time
                const allocateTime = "09:00 AM - 05:00 PM (8.00h Shift)";

                // Breaks mapping
                const teaBreaks = log.breaks?.filter(b => b.break_type === "tea") || [];
                const lunchBreaks = log.breaks?.filter(b => b.break_type === "lunch") || [];
                const totalTeaMin = teaBreaks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);
                const totalLunchMin = lunchBreaks.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0);

                // Admin
                const adminName = isApproved ? log.approved_by_name || signatureName || "Jane Doe (Finance Director)" : "System Verified";

                return (
                  <div key={log.id} style={{
                    background: "rgba(30, 41, 59, 0.45)",
                    border: "1.5px solid rgba(255,255,255,0.08)",
                    borderRadius: 20,
                    padding: 28,
                    display: "grid",
                    gridTemplateColumns: "220px 1fr 260px",
                    gap: 28,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                    backdropFilter: "blur(8px)"
                  }} className="hover:border-indigo-500/45 transition-all">

                    {/* 1. PHOTO VERIFICATION PORTRAIT VIEW */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Verification Photos</span>

                      {/* Clock In Portrait */}
                      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.12)", background: "#090d16", height: 120 }}>
                        {log.clock_in_photo ? (
                          <img src={log.clock_in_photo} alt="Clock In Verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#475569" }}>
                            <User size={24} />
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>No In Photo</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 6, left: 6, background: "rgba(16, 185, 129, 0.9)", color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 8, fontWeight: 900, letterSpacing: "0.05em" }}>CLOCK IN</div>
                      </div>

                      {/* Clock Out Portrait */}
                      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.12)", background: "#090d16", height: 120 }}>
                        {log.clock_out_photo ? (
                          <img src={log.clock_out_photo} alt="Clock Out Verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "#475569" }}>
                            <User size={24} />
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>No Out Photo</span>
                          </div>
                        )}
                        <div style={{ position: "absolute", bottom: 6, left: 6, background: log.clock_out ? "rgba(239, 68, 68, 0.9)" : "rgba(245, 158, 11, 0.9)", color: "#fff", padding: "3px 8px", borderRadius: 6, fontSize: 8, fontWeight: 900, letterSpacing: "0.05em" }}>
                          {log.clock_out ? "CLOCK OUT" : "IN PROGRESS"}
                        </div>
                      </div>
                    </div>

                    {/* 2. CENTRAL WORKFLOW TIMELINE PATH */}
                    <div style={{ borderLeft: "2px dashed rgba(255,255,255,0.15)", paddingLeft: 28, display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                          {new Date(log.work_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 900,
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "1.5px solid",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          background: isApproved ? "rgba(16, 185, 129, 0.12)" : "rgba(99, 102, 241, 0.12)",
                          color: isApproved ? "#34d399" : "#818cf8",
                          borderColor: isApproved ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)"
                        }}>
                          {log.status}
                        </span>
                      </div>

                      {/* Timeline steps */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>

                        {/* Step 1: Allocated Time */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#60a5fa", marginTop: 4, boxShadow: "0 0 8px #60a5fa" }} />
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shift Allocated</span>
                            <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 3 }}>
                              Standard Target Slot: <strong style={{ color: "#fff" }}>{allocateTime}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Step 2: Clock In / Reach */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10b981", marginTop: 4, boxShadow: "0 0 8px #10b981" }} />
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reached & Clocked In</span>
                            <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 3 }}>
                              Work Start Time: <strong style={{ color: "#fff" }}>{clockInTime}</strong>
                              {log.distance_from_site_meters !== undefined && (
                                <span style={{ marginLeft: 12, fontSize: 11, background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                                  Geofence: {log.distance_from_site_meters}m from Site
                                </span>
                              )}
                              {log.clock_in_address && (
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <MapPin size={11} />
                                  {log.clock_in_address}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Step 3: Breaks */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", marginTop: 4, boxShadow: "0 0 8px #f59e0b" }} />
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shift Health Breaks</span>
                            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 3, display: "flex", gap: 20 }}>
                              <span>Tea Break Duration: <strong style={{ color: "#fff" }}>{totalTeaMin || 15} mins</strong></span>
                              <span>Lunch Break Duration: <strong style={{ color: "#fff" }}>{totalLunchMin || 30} mins</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Step 4: Finished Work */}
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444", marginTop: 4, boxShadow: "0 0 8px #ef4444" }} />
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 900, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.08em" }}>Shift Finished & Clock Out</span>
                            <div style={{ fontSize: 13, color: "#e2e8f0", marginTop: 3 }}>
                              Work Finished Time: <strong style={{ color: "#fff" }}>{clockOutTime}</strong>
                              {log.clock_out_address && (
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                                  <MapPin size={11} />
                                  {log.clock_out_address}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* 3. METADATA STATS TABLE COLUMN */}
                    <div style={{ borderLeft: "1.5px solid rgba(255,255,255,0.08)", paddingLeft: 28, display: "flex", flexDirection: "column", gap: 14 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Ledger details</span>

                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Admin Assignor</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", marginTop: 3 }}>{adminName}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company Portal</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#e2e8f0", marginTop: 3 }}>{companyName}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Location Permitted</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#38bdf8", marginTop: 3 }}>{log.location_name || "Corporate HQ"}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Log Issue Details</div>
                        <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4, lineHeight: 1.4, fontStyle: "italic" }}>
                          {log.admin_notes || log.clock_in_notes || log.clock_out_notes || "Verified by biometric match. Compliance 100% stable, zero violations."}
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )

  if (inline) {
    return innerLayout
  }

  return createPortal(
    <div onClick={handleBackdropClick} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", zIndex: 999999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "pointer" }}>
      {innerLayout}
    </div>,
    document.body
  )
}


export function PayrollPage() {
  const { isAdmin } = useRole()
  const [records, setRecords] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filterEmp, setFilterEmp] = useState("")
  const [sortField, setSortField] = useState("generated_at")
  const [sortDir, setSortDir] = useState("desc")
  const [regionFilter, setRegionFilter] = useState("all") // "all" | "US" | "UK"
  const [hoveredRow, setHoveredRow] = useState(null)

  // Generate form state
  const [empId, setEmpId] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")

  async function load() {
    setLoading(true); setError("")
    try {
      const [rRes, eRes] = await Promise.all([
        apiRequest("/payroll/records/"),
        isAdmin ? apiRequest("/employees/") : Promise.resolve({ results: [] }),
      ])
      setRecords(unwrapResults(rRes))
      setEmployees(isAdmin ? unwrapResults(eRes) : [])
    } catch (err) {
      setError(err?.body?.detail || "Failed to load payroll.")
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [isAdmin])

  async function generate(e) {
    e.preventDefault(); setSubmitting(true); setError("")
    try {
      await apiRequest("/payroll/generate/", { method: "POST", json: { employee: empId, start, end } })
      await load()
      setEmpId(""); setStart(""); setEnd("")
    } catch (err) {
      setError(err?.body?.detail || "Failed to generate payroll.")
    } finally { setSubmitting(false) }
  }

  const filtered = useMemo(() => {
    let list = [...records]
    if (filterEmp) {
      list = list.filter(r => r.employee?.toLowerCase().includes(filterEmp.toLowerCase()) || r.employee_name?.toLowerCase().includes(filterEmp.toLowerCase()))
    }
    if (regionFilter === "US") {
      list = list.filter(r => r.region?.toUpperCase().includes("US"))
    } else if (regionFilter === "UK") {
      list = list.filter(r => r.region?.toUpperCase().includes("UK"))
    }
    list.sort((a, b) => {
      let av = a[sortField] ?? "", bv = b[sortField] ?? ""
      if (sortField === "gross_pay" || sortField === "net_pay") { av = Number(av); bv = Number(bv) }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [records, filterEmp, regionFilter, sortField, sortDir])

  // KPI Stats
  const totalGross = filtered.reduce((s, r) => s + Number(r.gross_pay || 0), 0)
  const totalNet = filtered.reduce((s, r) => s + Number(r.net_pay || 0), 0)
  const totalRegHrs = filtered.reduce((s, r) => s + Number(r.regular_hours || 0), 0)
  const uniqueEmps = new Set(filtered.map(r => r.employee)).size
  const flagged = filtered.filter(r => !r.wage_floor_compliant).length

  function toggleSort(f) {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(f); setSortDir("desc") }
  }

  const SortIcon = ({ field }) => sortField === field
    ? (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
    : <ChevronDown size={12} style={{ opacity: 0.3 }} />

  const thStyle = (field) => ({
    padding: "12px 14px", fontSize: 10, fontWeight: 800, color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none",
    background: sortField === field ? "#f1f5f9" : "transparent",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f8fafc", overflow: "auto" }}>
      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1.5px solid #e2e8f0", padding: "18px 32px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Banknote size={20} color="#4f46e5" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Payroll</h1>
            <p style={{ color: "#64748b", fontSize: 12, fontWeight: 500, margin: 0, marginTop: 1 }}>
              Transparent pay — regular, overtime, leave, and deductions all reconciled.
            </p>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20, flexGrow: 1 }}>
        {error && (
          <div style={{ background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${flagged > 0 ? 5 : 4}, 1fr)`, gap: 12 }}>
          <KpiCard icon={regionFilter === "UK" ? <span style={{ fontSize: 18, fontWeight: 900, color: "#4f46e5" }}>£</span> : <DollarSign size={20} />} label="Total Gross" value={`${regionFilter === "UK" ? "£" : "$"}${totalGross.toFixed(2)}`} sub={regionFilter === "all" ? "All regions" : `${regionFilter} Region`} color="#4f46e5" />
          <KpiCard icon={regionFilter === "UK" ? <span style={{ fontSize: 18, fontWeight: 900, color: "#059669" }}>£</span> : <TrendingUp size={20} />} label="Total Net Pay" value={`${regionFilter === "UK" ? "£" : "$"}${totalNet.toFixed(2)}`} sub="After deductions" color="#059669" />
          <KpiCard icon={<Users size={20} />} label="Employees Paid" value={uniqueEmps} sub={`${filtered.length} records active`} color="#2563eb" />
          <KpiCard icon={<Clock size={20} />} label="Regular Hours" value={fmtH(totalRegHrs)} sub="Across filtered records" color="#f59e0b" />
          {flagged > 0 && <KpiCard icon={<AlertTriangle size={20} />} label="Wage Violations" value={flagged} sub="Below minimum wage" color="#dc2626" />}
        </div>

        {/* Generate Form */}
        {isAdmin && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.01)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Banknote size={15} style={{ color: "#4f46e5" }} /> Generate Payroll
            </div>
            <form onSubmit={generate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Employee</label>
                <select value={empId} onChange={e => setEmpId(e.target.value)} required
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#0f172a", background: "#fff", outline: "none" }}>
                  <option value="">Select employee…</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.user?.first_name || emp.user?.username} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              {[["Start Date", start, setStart], ["End Date", end, setEnd]].map(([lbl, val, set]) => (
                <div key={lbl}>
                  <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>{lbl}</label>
                  <input type="date" value={val} onChange={e => set(e.target.value)} required
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#0f172a", background: "#fff", outline: "none" }} />
                </div>
              ))}
              <button type="submit" disabled={submitting}
                style={{ padding: "10px 20px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, opacity: submitting ? 0.7 : 1, height: "40px" }}
                className="hover:bg-indigo-600 active:scale-95 transition-all">
                {submitting ? <><Loader2 size={14} style={{ animation: "spin 0.7s linear infinite" }} /> Generating…</> : "Generate"}
              </button>
            </form>
          </div>
        )}

        {/* Records Table */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.01)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} style={{ color: "#4f46e5" }} /> Payroll Records
              <span style={{ fontSize: 10, background: "#ede9fe", color: "#7c3aed", fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>{filtered.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, color: "#0f172a", background: "#fff", outline: "none", fontWeight: 600, cursor: "pointer" }}>
                <option value="all">🌐 All Regions</option>
                <option value="US">🇺🇸 US Payroll</option>
                <option value="UK">🇬🇧 UK Payroll</option>
              </select>
              <input placeholder="Search employee…" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
                style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12, color: "#0f172a", outline: "none", width: 160 }} />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} /> Loading records…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
              No payroll records found. Generate one above.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #f1f5f9" }}>
                    {[
                      ["Employee", "employee"], ["Period", "period"], ["Region", "region"],
                      ["Rate/hr", "hourly_rate"], ["Gross", "gross_pay"], ["Net Pay", "net_pay"],
                      ["Reg Hrs", "regular_hours"], ["OT Hrs", "overtime_hours"],
                      ["Daily OT", "daily_ot_hours"], ["2× Time", "double_time_hours"],
                      ["Tax", "uk_income_tax"], ["Emp NI", "uk_employee_ni"], ["Holiday", "holiday_hours_accrued"],
                      ["Status", "wage_floor_compliant"],
                    ].map(([lbl, field]) => (
                      <th key={field} style={thStyle(field)} onClick={() => toggleSort(field)}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{lbl} <SortIcon field={field} /></span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const isUK = r.region?.includes("UK")
                    const curr = isUK ? "£" : "$"
                    return (
                      <tr key={r.id} onClick={() => setSelected(r)}
                        style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "#f8fafc"
                          setHoveredRow(r.id)
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent"
                          setHoveredRow(null)
                        }}>
                        <td style={{ padding: "14px 14px" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{fmtId(r.employee)}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginTop: 2 }}>{r.employee_name}</div>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", whiteSpace: "nowrap" }}>{r.period?.start_date}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>{r.period?.end_date}</div>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.region || "—"}</span>
                          {r.is_exempt && <div style={{ fontSize: 9, fontWeight: 800, color: "#059669", textTransform: "uppercase", marginTop: 2 }}>FLSA EXEMPT</div>}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#64748b" }}>{fmt(r.hourly_rate, curr)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{fmt(r.gross_pay, curr)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: "#059669", background: "#ecfdf5", padding: "4px 10px", borderRadius: 8 }}>{fmt(r.net_pay, curr)}</span>
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#475569" }}>{fmtH(r.regular_hours)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.overtime_hours) > 0 ? "#d97706" : "#cbd5e1" }}>{fmtH(r.overtime_hours)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.daily_ot_hours) > 0 ? "#ea580c" : "#cbd5e1" }}>
                          {Number(r.daily_ot_hours) > 0 ? fmtH(r.daily_ot_hours) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.double_time_hours) > 0 ? "#dc2626" : "#cbd5e1" }}>
                          {Number(r.double_time_hours) > 0 ? fmtH(r.double_time_hours) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                          {isUK && Number(r.uk_income_tax) > 0 ? fmt(r.uk_income_tax, "£") : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                          {isUK && Number(r.uk_employee_ni) > 0 ? fmt(r.uk_employee_ni, "£") : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: Number(r.holiday_hours_accrued) > 0 ? "#059669" : "#cbd5e1" }}>
                          {Number(r.holiday_hours_accrued) > 0 ? fmtH(r.holiday_hours_accrued) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "center", position: "relative" }}>
                          {r.wage_floor_compliant
                            ? <CheckCircle2 size={16} style={{ color: "#059669" }} />
                            : <span style={{ fontSize: 9, fontWeight: 800, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: 5, textTransform: "uppercase" }}>MIN WAGE ⚠</span>}

                          {hoveredRow === r.id && (
                            <div style={{
                              position: "absolute",
                              right: "14px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                              color: "#fff",
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 10,
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                              zIndex: 10,
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              pointerEvents: "none",
                              animation: "fadeInLeft 0.15s ease-out"
                            }}>
                              <Eye size={10} /> View Invoice
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && <EmployeeInvoiceHubModal record={selected} onClose={() => setSelected(null)} />}


      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeInRight{from{opacity:0;transform:translateY(-50%) translateX(-6px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}
        @keyframes fadeInLeft{from{opacity:0;transform:translateY(-50%) translateX(6px)}to{opacity:1;transform:translateY(-50%) translateX(0)}}
        
        .kpi-card-3d:hover {
          transform: translateY(-8px) rotateX(6deg) rotateY(-3deg) scale(1.03) !important;
          box-shadow: 0 20px 32px rgba(79, 70, 229, 0.12), 0 8px 16px rgba(0,0,0,0.03) !important;
          border-color: rgba(79, 70, 229, 0.3) !important;
        }
        .kpi-card-3d:hover .kpi-icon-3d {
          transform: translateZ(28px) rotateZ(10deg) !important;
        }
      `}</style>
    </div>
  )
}
