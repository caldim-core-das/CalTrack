import { useState } from "react"
import {
    Briefcase,
    Calendar,
    Plane,
    Umbrella,
    Info,
    Edit3,
    Check,
    RefreshCcw,
    Plus,
    X,
    ChevronDown
} from "lucide-react"
import "./SettingsSubpages.css"

/* ─── Mock Save API ─── */
const saveSettings = async (data) => {
    return new Promise((resolve) => setTimeout(resolve, 800))
}

export function HolidaysSettingsPage() {
    const [activeTab, setActiveTab] = useState("policies")
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
                <h1 className="pageTitle">Time Off & Holidays</h1>
            </header>

            <div className="tabNav">
                <button
                    className={`tabBtn ${activeTab === "policies" ? "active" : ""}`}
                    onClick={() => setActiveTab("policies")}
                >
                    Policies
                </button>
                <button
                    className={`tabBtn ${activeTab === "calendars" ? "active" : ""}`}
                    onClick={() => setActiveTab("calendars")}
                >
                    Holiday Calendars
                </button>
                <button
                    className={`tabBtn ${activeTab === "accruals" ? "active" : ""}`}
                    onClick={() => setActiveTab("accruals")}
                >
                    Accruals
                </button>
            </div>

            <div className="tabContent">
                {activeTab === "policies" ? (
                    <div className="policiesView">
                        <p className="policyDesc">
                            Manage how time off and holidays are handled across your organization.
                        </p>

                        {/* ── LEAVE TYPES ── */}
                        <div className={`policyCard ${editingCard === "LEAVE TYPES" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">LEAVE TYPES <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "LEAVE TYPES" ? "save" : ""}`}
                                    onClick={() => toggleEdit("LEAVE TYPES")}
                                    disabled={saving === "LEAVE TYPES"}
                                >
                                    {saving === "LEAVE TYPES" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "LEAVE TYPES" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "LEAVE TYPES" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Define different types of time off available to members.</p>

                            <div className="leaveTypeGrid">
                                {[
                                    { id: "vacation", label: "Vacation", icon: <Umbrella size={20} color="#3B82F6" /> },
                                    { id: "sick", label: "Sick Leave", icon: <Plane size={20} color="#EF4444" /> },
                                    { id: "personal", label: "Personal", icon: <Briefcase size={20} color="#10B981" /> }
                                ].map(l => (
                                    <div key={l.id} className="leaveTypeItem">
                                        <div className="leaveTypeIcon">{l.icon}</div>
                                        <span className="leaveTypeLabel">{l.label}</span>
                                        {editingCard === "LEAVE TYPES" && <button className="psClearSearch" style={{ marginLeft: "auto" }}><X size={14} /></button>}
                                    </div>
                                ))}
                                {editingCard === "LEAVE TYPES" && (
                                    <button className="psAddRowBtn">
                                        <Plus size={14} /> Add type
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── APPROVAL WORKFLOW ── */}
                        <div className={`policyCard ${editingCard === "APPROVAL WORKFLOW" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">APPROVAL WORKFLOW <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "APPROVAL WORKFLOW" ? "save" : ""}`}
                                    onClick={() => toggleEdit("APPROVAL WORKFLOW")}
                                    disabled={saving === "APPROVAL WORKFLOW"}
                                >
                                    {saving === "APPROVAL WORKFLOW" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "APPROVAL WORKFLOW" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "APPROVAL WORKFLOW" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Configure who needs to approve time off requests.</p>

                            <div className="ruleSection">
                                <div className="ruleOption">
                                    <input type="checkbox" id="autoApprove" disabled={editingCard !== "APPROVAL WORKFLOW"} />
                                    <label htmlFor="autoApprove">Auto-approve requests for selected groups</label>
                                </div>
                                <div className="ruleOption" style={{ marginTop: "8px" }}>
                                    <input type="checkbox" id="managerApproval" defaultChecked disabled={editingCard !== "APPROVAL WORKFLOW"} />
                                    <label htmlFor="managerApproval">Require direct manager approval</label>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="comingSoon">
                        <Calendar size={48} strokeWidth={1} />
                        <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Module</h3>
                        <p>This section is currently being improved for a better experience.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
