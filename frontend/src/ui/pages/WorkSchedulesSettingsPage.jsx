import { useState } from "react"
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
    Plus
} from "lucide-react"
import "./SettingsSubpages.css"

/* ─── Mock Save API ─── */
const saveSettings = async (data) => {
    return new Promise((resolve) => setTimeout(resolve, 800))
}

export function WorkSchedulesSettingsPage() {
    const [activeTab, setActiveTab] = useState("schedules")
    const [editingCard, setEditingCard] = useState(null)
    const [saving, setSaving] = useState(null)
    const [success, setSuccess] = useState(null)

    const toggleEdit = async (card) => {
        if (editingCard === card) {
            setSaving(card)
            try {
                await saveSettings({})
                setSuccess(card)
                setTimeout(() => setSuccess(null), 3000)
                setEditingCard(null)
            } catch (err) {
                alert("Failed to save settings.")
            }
            setSaving(null)
        }
        else setEditingCard(card)
    }

    return (
        <div className="settingsSubpage">
            <header className="pageHeader">
                <h1 className="pageTitle">Work Schedules</h1>
            </header>

            <div className="tabNav">
                <button
                    className={`tabBtn ${activeTab === "schedules" ? "active" : ""}`}
                    onClick={() => setActiveTab("schedules")}
                >
                    Schedules
                </button>
                <button
                    className={`tabBtn ${activeTab === "shifts" ? "active" : ""}`}
                    onClick={() => setActiveTab("shifts")}
                >
                    Shift Management
                </button>
            </div>

            <div className="tabContent">
                {activeTab === "schedules" ? (
                    <div className="policiesView">
                        <p className="policyDesc">
                            Configure standard working hours for your organization.
                        </p>

                        {/* ── DEFAULT WORKING HOURS ── */}
                        <div className={`policyCard ${editingCard === "DEFAULT WORKING HOURS" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">DEFAULT WORKING HOURS <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "DEFAULT WORKING HOURS" ? "save" : ""}`}
                                    onClick={() => toggleEdit("DEFAULT WORKING HOURS")}
                                    disabled={saving === "DEFAULT WORKING HOURS"}
                                >
                                    {saving === "DEFAULT WORKING HOURS" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "DEFAULT WORKING HOURS" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "DEFAULT WORKING HOURS" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Define the standard work day start and end times.</p>

                            <div className="rowTiered">
                                {["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => (
                                    <div key={day} className="scheduleItem">
                                        <span className="dayLabel">{day}</span>
                                        <input type="time" defaultValue="09:00" className="psTimeInput" disabled={editingCard !== "DEFAULT WORKING HOURS"} />
                                        <span>to</span>
                                        <input type="time" defaultValue="17:00" className="psTimeInput" disabled={editingCard !== "DEFAULT WORKING HOURS"} />
                                    </div>
                                ))}
                            </div>
                            <div className="scheduleItem">
                                <span className="dayLabel muted">Sat/Sun</span>
                                <span className="muted" style={{ marginLeft: "12px" }}>Weekend - Non working</span>
                                {editingCard === "DEFAULT WORKING HOURS" && <button className="psAddRowBtn" style={{ marginLeft: "12px" }}>Add hours</button>}
                            </div>
                        </div>

                        {/* ── FLEXIBLE SCHEDULES ── */}
                        <div className={`policyCard ${editingCard === "FLEXIBLE SCHEDULES" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">FLEXIBLE SCHEDULES <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "FLEXIBLE SCHEDULES" ? "save" : ""}`}
                                    onClick={() => toggleEdit("FLEXIBLE SCHEDULES")}
                                    disabled={saving === "FLEXIBLE SCHEDULES"}
                                >
                                    {saving === "FLEXIBLE SCHEDULES" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "FLEXIBLE SCHEDULES" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "FLEXIBLE SCHEDULES" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Allow members to have flexible start and end times within certain limits.</p>

                            <div className="ruleSection">
                                <div className="ruleOption">
                                    <input type="checkbox" id="flexiHours" disabled={editingCard !== "FLEXIBLE SCHEDULES"} />
                                    <label htmlFor="flexiHours">Enable flexible schedule windows</label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="comingSoon">
                        <Clock size={48} strokeWidth={1} />
                        <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Module</h3>
                        <p>This section is currently being improved for a better experience.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
