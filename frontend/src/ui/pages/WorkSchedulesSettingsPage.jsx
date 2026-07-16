import { useState, useEffect } from "react"
import {
    Sun,
    Moon,
    Clock,
    Calendar,
    Info,
    Edit3,
    Check,
    RefreshCcw,
    X,
    ChevronDown,
    Plus,
    CheckCircle2,
    AlertCircle,
    User,
    MapPin,
    ShieldAlert,
    Trash2
} from "lucide-react"
import { apiRequest } from "../../api/client"
import "./SettingsSubpages.css"

/* ─── Mock Locations Fallback ─── */
const DEFAULT_LOCATIONS = [
    { id: 1, name: "Caltrack HQ (Main Office)" },
    { id: 2, name: "London Tech Hub" },
    { id: 3, name: "Warehouse & Logistics South" }
]

// Custom hook to detect if dark mode is active
function useDarkMode() {
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"))

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains("dark"))
        })
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
        return () => observer.disconnect()
    }, [])

    return isDark
}

export function WorkSchedulesSettingsPage() {
    const isDark = useDarkMode()
    const [activeTab, setActiveTab] = useState("schedules")
    const [editingCard, setEditingCard] = useState(null)
    const [saving, setSaving] = useState(null)
    const [success, setSuccess] = useState(null)

    /* ─── Page State ─── */
    const [employees, setEmployees] = useState([])
    const [locations, setLocations] = useState([])
    const [schedules, setSchedules] = useState(() => {
        const saved = localStorage.getItem("caltrack_schedules_default_hours")
        return saved ? JSON.parse(saved) : {
            Mon: { start: "09:00", end: "17:00", active: true },
            Tue: { start: "09:00", end: "17:00", active: true },
            Wed: { start: "09:00", end: "17:00", active: true },
            Thu: { start: "09:00", end: "17:00", active: true },
            Fri: { start: "09:00", end: "17:00", active: true },
            Sat: { start: "09:00", end: "17:00", active: false },
            Sun: { start: "09:00", end: "17:00", active: false }
        }
    })

    const [flexible, setFlexible] = useState(() => {
        const saved = localStorage.getItem("caltrack_schedules_flexible")
        return saved ? JSON.parse(saved) : {
            enabled: false,
            coreStart: "10:00",
            coreEnd: "16:00",
            minCoreHours: 6
        }
    })

    const [shifts, setShifts] = useState(() => {
        const saved = localStorage.getItem("caltrack_custom_shifts")
        return saved ? JSON.parse(saved) : [
            {
                id: 1,
                employeeName: "Marcus Vance",
                employeeCode: "EMP 001",
                date: "2026-05-26",
                start: "09:00",
                end: "17:00",
                locationName: "Caltrack HQ (Main Office)",
                enforcement: "block"
            },
            {
                id: 2,
                employeeName: "Sarah Jenkins",
                employeeCode: "EMP 002",
                date: "2026-05-26",
                start: "08:30",
                end: "16:30",
                locationName: "London Tech Hub",
                enforcement: "warn"
            }
        ]
    })

    /* ─── Shift Creation Form State ─── */
    const [newShift, setNewShift] = useState({
        employeeId: "",
        date: new Date().toISOString().split("T")[0],
        start: "09:00",
        end: "17:00",
        locationId: "",
        enforcement: "block"
    })
    const [showShiftModal, setShowShiftModal] = useState(false)

    /* ─── Load Remote Data ─── */
    useEffect(() => {
        async function loadData() {
            try {
                const empData = await apiRequest("/employees/")
                setEmployees(Array.isArray(empData) ? empData : empData.results || [])
            } catch (e) {
                console.error("Failed to load employees for schedule dropdown", e)
                setEmployees([
                    { id: 1, name: "Marcus Vance", employee_id: "EMP001" },
                    { id: 2, name: "Sarah Jenkins", employee_id: "EMP002" },
                    { id: 3, name: "Clara Oswald", employee_id: "EMP003" }
                ])
            }

            try {
                const locData = await apiRequest("/time/locations/")
                const list = Array.isArray(locData) ? locData : locData.results || []
                setLocations(list.length > 0 ? list : DEFAULT_LOCATIONS)
            } catch (e) {
                setLocations(DEFAULT_LOCATIONS)
            }
        }
        loadData()
    }, [])

    /* ─── Actions ─── */
    const handleSaveSchedules = async () => {
        setSaving("DEFAULT WORKING HOURS")
        await new Promise((resolve) => setTimeout(resolve, 600))
        localStorage.setItem("caltrack_schedules_default_hours", JSON.stringify(schedules))
        setSuccess("DEFAULT WORKING HOURS")
        setTimeout(() => setSuccess(null), 3000)
        setEditingCard(null)
        setSaving(null)
    }

    const handleSaveFlexible = async () => {
        setSaving("FLEXIBLE SCHEDULES")
        await new Promise((resolve) => setTimeout(resolve, 600))
        localStorage.setItem("caltrack_schedules_flexible", JSON.stringify(flexible))
        setSuccess("FLEXIBLE SCHEDULES")
        setTimeout(() => setSuccess(null), 3000)
        setEditingCard(null)
        setSaving(null)
    }

    const handleCreateShift = (e) => {
        e.preventDefault()
        if (!newShift.employeeId) {
            alert("Please select an employee.")
            return
        }

        const selectedEmp = employees.find(emp => String(emp.id) === String(newShift.employeeId))
        const selectedLoc = locations.find(loc => String(loc.id) === String(newShift.locationId))

        const created = {
            id: Date.now(),
            employeeName: selectedEmp ? (selectedEmp.name || `${selectedEmp.first_name || "Employee"} ${selectedEmp.last_name || ""}`) : "Unknown Employee",
            employeeCode: selectedEmp ? (selectedEmp.employee_id || `EMP ${selectedEmp.id}`) : "EMP —",
            date: newShift.date,
            start: newShift.start,
            end: newShift.end,
            locationName: selectedLoc ? selectedLoc.name : "Any Location",
            enforcement: newShift.enforcement
        }

        const updatedShifts = [created, ...shifts]
        setShifts(updatedShifts)
        localStorage.setItem("caltrack_custom_shifts", JSON.stringify(updatedShifts))
        setShowShiftModal(false)

        // Reset form except date
        setNewShift(prev => ({
            ...prev,
            employeeId: "",
            start: "09:00",
            end: "17:00",
            locationId: "",
            enforcement: "block"
        }))
    }

    const handleDeleteShift = (id) => {
        if (!confirm("Are you sure you want to delete this scheduled shift?")) return
        const filtered = shifts.filter(sh => sh.id !== id)
        setShifts(filtered)
        localStorage.setItem("caltrack_custom_shifts", JSON.stringify(filtered))
    }

    const updateDaySchedule = (day, field, value) => {
        setSchedules(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [field]: value
            }
        }))
    }

    return (
        <div className="settingsSubpage" style={{ padding: "32px", background: isDark ? "#0B111D" : "#f8fafc" }}>
            <header className="pageHeader" style={{ marginBottom: "28px" }}>
                <h1 className="pageTitle" style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", color: isDark ? "#f9fafb" : "#1e293b" }}>Work Schedules & Policies</h1>
                <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "14px", marginTop: "4px" }}>Configure baseline operating hours, flexitime bounds, and allocate biometric shift schedules.</p>
            </header>

            {/* Tabs */}
            <div className="tabNav" style={{ display: "flex", gap: "28px", borderBottom: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, marginBottom: "32px" }}>
                <button
                    className={`tabBtn ${activeTab === "schedules" ? "active" : ""}`}
                    onClick={() => setActiveTab("schedules")}
                    style={{
                        padding: "14px 8px",
                        fontSize: "15px",
                        fontWeight: 800,
                        borderBottom: activeTab === "schedules" ? "3px solid #f97316" : "3px solid transparent",
                        color: activeTab === "schedules" ? "#f97316" : (isDark ? "#9ca3af" : "#64748b"),
                        background: "none",
                        borderTop: "none",
                        borderLeft: "none",
                        borderRight: "none",
                        cursor: "pointer"
                    }}
                >
                    Operating Hours
                </button>
                <button
                    className={`tabBtn ${activeTab === "shifts" ? "active" : ""}`}
                    onClick={() => setActiveTab("shifts")}
                    style={{
                        padding: "14px 8px",
                        fontSize: "15px",
                        fontWeight: 800,
                        borderBottom: activeTab === "shifts" ? "3px solid #f97316" : "3px solid transparent",
                        color: activeTab === "shifts" ? "#f97316" : (isDark ? "#9ca3af" : "#64748b"),
                        background: "none",
                        borderTop: "none",
                        borderLeft: "none",
                        borderRight: "none",
                        cursor: "pointer"
                    }}
                >
                    Shifts & Allocations
                </button>
            </div>

            {/* Tab Contents */}
            <div className="tabContent">
                {activeTab === "schedules" ? (
                    <div className="policiesView" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                        
                        {/* ── DEFAULT WORKING HOURS CARD ── */}
                        <div className={`policyCard ${editingCard === "DEFAULT WORKING HOURS" ? "editing" : ""}`} style={{
                            background: isDark ? "#111827" : "#fff",
                            border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
                            borderRadius: "20px",
                            padding: "28px",
                            boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.01)"
                        }}>
                            <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <div className="cardTitle" style={{ fontSize: "16px", fontWeight: 900, color: isDark ? "#f9fafb" : "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                                    COMPANY STANDARD WORKING HOURS
                                    <Info size={14} className="infoIcon" style={{ color: isDark ? "#4b5563" : "#94a3b8" }} />
                                </div>

                                {editingCard === "DEFAULT WORKING HOURS" ? (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setEditingCard(null)}
                                            style={{ padding: "8px 14px", borderRadius: "10px", background: isDark ? "#1f2937" : "#f1f5f9", border: `1px solid ${isDark ? "#374151" : "transparent"}`, fontSize: "12px", fontWeight: 800, color: isDark ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                        >
                                            <X size={14} /> Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveSchedules}
                                            disabled={saving === "DEFAULT WORKING HOURS"}
                                            style={{ padding: "8px 16px", borderRadius: "10px", background: "#f97316", border: "none", fontSize: "12px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(249,115,22,0.2)", cursor: "pointer" }}
                                        >
                                            {saving === "DEFAULT WORKING HOURS" ? <RefreshCcw size={14} className="psSpin animate-spin" /> : <Check size={14} />} Save Hours
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditingCard("DEFAULT WORKING HOURS")}
                                        style={{ padding: "8px 14px", borderRadius: "10px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, background: isDark ? "#1f2937" : "#fff", fontSize: "12px", fontWeight: 800, color: isDark ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                    >
                                        <Edit3 size={14} /> Edit Schedule
                                    </button>
                                )}
                            </div>

                            {success === "DEFAULT WORKING HOURS" && (
                                <div style={{ background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5", border: `1px solid ${isDark ? "#10b981" : "#a7f3d0"}`, color: isDark ? "#34d399" : "#065f46", padding: "12px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <CheckCircle2 size={16} /> Changes saved successfully! Standard work schedules updated.
                                </div>
                            )}

                            <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "13.5px", margin: "0 0 24px" }}>Specify standard clock-in/out ranges for active business days across the company.</p>

                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {Object.entries(schedules).map(([day, config]) => (
                                    <div key={day} style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "14px 20px",
                                        borderRadius: "14px",
                                        background: config.active ? (isDark ? "#1f2937" : "#fff") : (isDark ? "rgba(31,41,55,0.4)" : "#f8fafc"),
                                        border: `1px solid ${isDark ? "#1f2937" : "#f1f5f9"}`,
                                        opacity: config.active ? 1 : 0.6
                                    }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                            <input
                                                type="checkbox"
                                                checked={config.active}
                                                disabled={editingCard !== "DEFAULT WORKING HOURS"}
                                                onChange={(e) => updateDaySchedule(day, "active", e.target.checked)}
                                                style={{ accentColor: "#f97316", width: "16px", height: "16px", cursor: "pointer" }}
                                            />
                                            <span style={{ fontSize: "14px", fontWeight: 900, color: isDark ? "#f9fafb" : "#1e293b", minWidth: "48px" }}>{day}</span>
                                        </div>

                                        {config.active ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                <input
                                                    type="time"
                                                    value={config.start}
                                                    disabled={editingCard !== "DEFAULT WORKING HOURS"}
                                                    onChange={(e) => updateDaySchedule(day, "start", e.target.value)}
                                                    style={{ padding: "6px 12px", border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: "8px", fontSize: "13px", fontWeight: 700, outline: "none", color: isDark ? "#f9fafb" : "#1e293b", background: isDark ? "#111827" : "#fff" }}
                                                />
                                                <span style={{ fontSize: "13px", color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 600 }}>to</span>
                                                <input
                                                    type="time"
                                                    value={config.end}
                                                    disabled={editingCard !== "DEFAULT WORKING HOURS"}
                                                    onChange={(e) => updateDaySchedule(day, "end", e.target.value)}
                                                    style={{ padding: "6px 12px", border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: "8px", fontSize: "13px", fontWeight: 700, outline: "none", color: isDark ? "#f9fafb" : "#1e293b", background: isDark ? "#111827" : "#fff" }}
                                                />
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: "13px", color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 600, fontStyle: "italic" }}>Rest Day (Off)</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── FLEXIBLE SCHEDULES CARD ── */}
                        <div className={`policyCard ${editingCard === "FLEXIBLE SCHEDULES" ? "editing" : ""}`} style={{
                            background: isDark ? "#111827" : "#fff",
                            border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
                            borderRadius: "20px",
                            padding: "28px",
                            boxShadow: isDark ? "0 4px 30px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.01)"
                        }}>
                            <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                <div className="cardTitle" style={{ fontSize: "16px", fontWeight: 900, color: isDark ? "#f9fafb" : "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                                    FLEXIBLE WORK POLICY
                                    <Info size={14} className="infoIcon" style={{ color: isDark ? "#4b5563" : "#94a3b8" }} />
                                </div>

                                {editingCard === "FLEXIBLE SCHEDULES" ? (
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setEditingCard(null)}
                                            style={{ padding: "8px 14px", borderRadius: "10px", background: isDark ? "#1f2937" : "#f1f5f9", border: `1px solid ${isDark ? "#374151" : "transparent"}`, fontSize: "12px", fontWeight: 800, color: isDark ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                        >
                                            <X size={14} /> Cancel
                                        </button>
                                        <button
                                            onClick={handleSaveFlexible}
                                            disabled={saving === "FLEXIBLE SCHEDULES"}
                                            style={{ padding: "8px 16px", borderRadius: "10px", background: "#f97316", border: "none", fontSize: "12px", fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: "6px", boxShadow: "0 4px 12px rgba(249,115,22,0.2)", cursor: "pointer" }}
                                        >
                                            {saving === "FLEXIBLE SCHEDULES" ? <RefreshCcw size={14} className="psSpin animate-spin" /> : <Check size={14} />} Save Policy
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setEditingCard("FLEXIBLE SCHEDULES")}
                                        style={{ padding: "8px 14px", borderRadius: "10px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, background: isDark ? "#1f2937" : "#fff", fontSize: "12px", fontWeight: 800, color: isDark ? "#cbd5e1" : "#475569", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}
                                    >
                                        <Edit3 size={14} /> Edit Policy
                                    </button>
                                )}
                            </div>

                            {success === "FLEXIBLE SCHEDULES" && (
                                <div style={{ background: isDark ? "rgba(16,185,129,0.15)" : "#ecfdf5", border: `1px solid ${isDark ? "#10b981" : "#a7f3d0"}`, color: isDark ? "#34d399" : "#065f46", padding: "12px 16px", borderRadius: "12px", fontSize: "13px", fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <CheckCircle2 size={16} /> Changes saved successfully! Flexitime configuration updated.
                                </div>
                            )}

                            <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "13.5px", margin: "0 0 24px" }}>Configure core hours windows and minimum mandatory active session constraints.</p>

                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                    <input
                                        type="checkbox"
                                        id="flexi-enabled"
                                        checked={flexible.enabled}
                                        disabled={editingCard !== "FLEXIBLE SCHEDULES"}
                                        onChange={(e) => setFlexible(prev => ({ ...prev, enabled: e.target.checked }))}
                                        style={{ accentColor: "#f97316", width: "18px", height: "18px", cursor: "pointer" }}
                                    />
                                    <label htmlFor="flexi-enabled" style={{ fontSize: "14px", fontWeight: 800, color: isDark ? "#f9fafb" : "#1e293b", cursor: "pointer" }}>
                                        Enable flexible scheduling windows
                                    </label>
                                </div>

                                {flexible.enabled && (
                                    <div style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "20px",
                                        background: isDark ? "#1f2937" : "#f8fafc",
                                        padding: "20px",
                                        borderRadius: "16px",
                                        border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}`,
                                        marginTop: "8px"
                                    }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#cbd5e1" : "#64748b", marginBottom: "8px" }}>Mandatory Core Hours Window</label>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <input
                                                    type="time"
                                                    value={flexible.coreStart}
                                                    disabled={editingCard !== "FLEXIBLE SCHEDULES"}
                                                    onChange={(e) => setFlexible(prev => ({ ...prev, coreStart: e.target.value }))}
                                                    style={{ padding: "8px 12px", border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: isDark ? "#f9fafb" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                                />
                                                <span style={{ fontSize: "12px", color: isDark ? "#9ca3af" : "#94a3b8" }}>to</span>
                                                <input
                                                    type="time"
                                                    value={flexible.coreEnd}
                                                    disabled={editingCard !== "FLEXIBLE SCHEDULES"}
                                                    onChange={(e) => setFlexible(prev => ({ ...prev, coreEnd: e.target.value }))}
                                                    style={{ padding: "8px 12px", border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: "8px", fontSize: "13px", fontWeight: 700, color: isDark ? "#f9fafb" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ display: "block", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: isDark ? "#cbd5e1" : "#64748b", marginBottom: "8px" }}>Min Core Hours Per Session</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max="12"
                                                value={flexible.minCoreHours}
                                                disabled={editingCard !== "FLEXIBLE SCHEDULES"}
                                                onChange={(e) => setFlexible(prev => ({ ...prev, minCoreHours: Number(e.target.value) }))}
                                                style={{ padding: "8px 12px", border: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}`, borderRadius: "8px", width: "90px", fontSize: "13px", fontWeight: 700, color: isDark ? "#f9fafb" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── SHIFT MANAGEMENT TAB ── */
                    <div className="shiftsView" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <h3 style={{ fontSize: "16px", fontWeight: 900, color: isDark ? "#f9fafb" : "#1e293b" }}>Shift Allocations Ledger</h3>
                                <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: "13px", marginTop: "2px" }}>Assign shift windows to specific employees and configure biometric geofencing enforcement overrides.</p>
                            </div>
                            <button
                                onClick={() => setShowShiftModal(true)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    background: "#f97316",
                                    color: "#fff",
                                    border: "none",
                                    padding: "12px 20px",
                                    borderRadius: "12px",
                                    fontSize: "13.5px",
                                    fontWeight: 900,
                                    cursor: "pointer",
                                    boxShadow: "0 6px 20px rgba(249,115,22,0.25)"
                                }}
                            >
                                <Plus size={16} /> Allocate New Shift
                            </button>
                        </div>

                        {/* Shift List Card */}
                        <div style={{
                            background: isDark ? "#111827" : "#fff",
                            border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`,
                            borderRadius: "20px",
                            overflow: "hidden"
                        }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                                <thead>
                                    <tr style={{ background: isDark ? "#1f2937" : "#f8fafc", borderBottom: `1.5px solid ${isDark ? "#374151" : "#e2e8f0"}` }}>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b" }}>Employee</th>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b" }}>Date</th>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b" }}>Timing Window</th>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b" }}>Assigned Location</th>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b" }}>Biometric Enforcement</th>
                                        <th style={{ padding: "18px 24px", fontSize: "11px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em", color: isDark ? "#cbd5e1" : "#64748b", textAlign: "right" }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shifts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: "14px", fontStyle: "italic" }}>
                                                No shifts assigned yet. Click "Allocate New Shift" to get started.
                                            </td>
                                        </tr>
                                    ) : (
                                        shifts.map((sh, idx) => (
                                            <tr key={sh.id || idx} style={{ borderBottom: `1px solid ${isDark ? "#1f2937" : "#f1f5f9"}`, background: idx % 2 === 0 ? (isDark ? "#111827" : "#fff") : (isDark ? "#1c2431" : "#fafbfd") }}>
                                                <td style={{ padding: "18px 24px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                                        <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: isDark ? "rgba(139,92,246,0.15)" : "#f5f3ff", color: isDark ? "#c084fc" : "#8b5cf6", display: "flex", alignItems: "center", justifyCenter: "center", fontSize: "13px", fontWeight: 900, flexShrink: 0, justifyContent: "center" }}>
                                                            {sh.employeeName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: "13.5px", fontWeight: 800, color: isDark ? "#f9fafb" : "#1e293b" }}>{sh.employeeName}</div>
                                                            <div style={{ fontSize: "11px", color: isDark ? "#9ca3af" : "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginTop: "1px" }}>{sh.employeeCode}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: "18px 24px", fontSize: "13.5px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#475569" }}>
                                                    {new Date(sh.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                </td>
                                                <td style={{ padding: "18px 24px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13.5px", fontWeight: 800, color: isDark ? "#f9fafb" : "#1e293b" }}>
                                                        <Clock size={14} style={{ color: isDark ? "#9ca3af" : "#94a3b8" }} />
                                                        {sh.start} – {sh.end}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "18px 24px" }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#475569" }}>
                                                        <MapPin size={13} style={{ color: "#f97316" }} />
                                                        {sh.locationName}
                                                    </div>
                                                </td>
                                                <td style={{ padding: "18px 24px" }}>
                                                    {sh.enforcement === "block" ? (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "99px", background: isDark ? "rgba(220,38,38,0.15)" : "#fee2e2", color: isDark ? "#f87171" : "#991b1b", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                                                            <ShieldAlert size={12} /> Strict Block
                                                        </span>
                                                    ) : sh.enforcement === "warn" ? (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "99px", background: isDark ? "rgba(245,158,11,0.15)" : "#fffbeb", color: isDark ? "#facc15" : "#854d0e", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                                                            <AlertCircle size={12} /> Warn Only
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 10px", borderRadius: "99px", background: isDark ? "#1f2937" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#475569", fontSize: "11px", fontWeight: 800, textTransform: "uppercase" }}>
                                                            No Enforcement
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: "18px 24px", textAlign: "right" }}>
                                                    <button
                                                        onClick={() => handleDeleteShift(sh.id)}
                                                        style={{
                                                            padding: "8px",
                                                            borderRadius: "8px",
                                                            border: "none",
                                                            background: "transparent",
                                                            color: "#ef4444",
                                                            cursor: "pointer",
                                                            transition: "background 0.2s"
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? "rgba(239,68,68,0.15)" : "#fef2f2" }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Allocate Shift Modal */}
            {showShiftModal && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0, 0, 0, 0.65)",
                    backdropFilter: "blur(12px)",
                    zIndex: 999999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <form onSubmit={handleCreateShift} style={{
                        background: isDark ? "#111827" : "#fff",
                        width: "100%",
                        maxWidth: "500px",
                        borderRadius: "24px",
                        padding: "32px",
                        boxShadow: isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 20px 50px rgba(0,0,0,0.15)",
                        border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                            <h4 style={{ fontSize: "18px", fontWeight: 900, color: isDark ? "#f9fafb" : "#1e293b", margin: 0 }}>Allocate New Shift</h4>
                            <button
                                type="button"
                                onClick={() => setShowShiftModal(false)}
                                style={{ background: "none", border: "none", color: isDark ? "#9ca3af" : "#94a3b8", cursor: "pointer", padding: "4px" }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                            {/* Employee Select */}
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>Select Personnel</label>
                                <select
                                    value={newShift.employeeId}
                                    onChange={(e) => setNewShift(prev => ({ ...prev, employeeId: e.target.value }))}
                                    required
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                >
                                    <option value="" style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>Choose Employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id} style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>
                                            {emp.name || `${emp.first_name || "Employee"} ${emp.last_name || ""}`} ({emp.employee_id || `ID: ${emp.id}`})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Picker */}
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>Shift Date</label>
                                <input
                                    type="date"
                                    value={newShift.date}
                                    onChange={(e) => setNewShift(prev => ({ ...prev, date: e.target.value }))}
                                    required
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                />
                            </div>

                            {/* Time Window */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>Start Time</label>
                                    <input
                                        type="time"
                                        value={newShift.start}
                                        onChange={(e) => setNewShift(prev => ({ ...prev, start: e.target.value }))}
                                        required
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>End Time</label>
                                    <input
                                        type="time"
                                        value={newShift.end}
                                        onChange={(e) => setNewShift(prev => ({ ...prev, end: e.target.value }))}
                                        required
                                        style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                    />
                                </div>
                            </div>

                            {/* Geofence Location */}
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>Assigned Location (Geofenced Site)</label>
                                <select
                                    value={newShift.locationId}
                                    onChange={(e) => setNewShift(prev => ({ ...prev, locationId: e.target.value }))}
                                    required
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                >
                                    <option value="" style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>Select Geofenced Site...</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id} style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Biometric Enforcement Mode */}
                            <div>
                                <label style={{ display: "block", fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: isDark ? "#cbd5e1" : "#94a3b8", marginBottom: "8px" }}>Biometric Geofence Enforcement Mode</label>
                                <select
                                    value={newShift.enforcement}
                                    onChange={(e) => setNewShift(prev => ({ ...prev, enforcement: e.target.value }))}
                                    required
                                    style={{ width: "100%", padding: "12px 16px", borderRadius: "12px", border: `1.5px solid ${isDark ? "#1f2937" : "#e2e8f0"}`, fontSize: "14px", fontWeight: 700, color: isDark ? "#cbd5e1" : "#1e293b", background: isDark ? "#111827" : "#fff", outline: "none" }}
                                >
                                    <option value="block" style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>Strict Block (Prevent clock in outside site)</option>
                                    <option value="warn" style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>Warn Only (Flag mismatch with warning)</option>
                                    <option value="off" style={{ background: isDark ? "#111827" : "#fff", color: isDark ? "#cbd5e1" : "#1e293b" }}>No Enforcement (Standard logging)</option>
                                </select>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div style={{ display: "flex", gap: "12px", marginTop: "32px", justifyContent: "flex-end" }}>
                            <button
                                type="button"
                                onClick={() => setShowShiftModal(false)}
                                style={{ padding: "12px 24px", borderRadius: "12px", background: isDark ? "#1f2937" : "#f1f5f9", fontSize: "13px", fontWeight: 900, color: isDark ? "#cbd5e1" : "#475569", border: "none", cursor: "pointer" }}
                            >
                                Discard
                            </button>
                            <button
                                type="submit"
                                style={{ padding: "12px 28px", borderRadius: "12px", background: "#f97316", fontSize: "13px", fontWeight: 900, color: "#fff", border: "none", cursor: "pointer", boxShadow: "0 6px 20px rgba(249,115,22,0.2)" }}
                            >
                                Save Shift
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}
