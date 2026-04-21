import { useState } from "react"
import {
    Smartphone,
    Laptop,
    Monitor,
    LayoutGrid,
    Info,
    ChevronDown,
    ChevronRight,
    Edit3,
    Check,
    RefreshCcw,
    X
} from "lucide-react"
import "./SettingsSubpages.css"

/* ─── Mock Save API ─── */
const saveSettings = async (data) => {
    return new Promise((resolve) => setTimeout(resolve, 800))
}

export function TimeTrackingSettingsPage() {
    const [activeTab, setActiveTab] = useState("policies")
    const [editingCard, setEditingCard] = useState(null)
    const [saving, setSaving] = useState(null)
    const [success, setSuccess] = useState(null)

    const toggleEdit = async (card) => {
        if (editingCard === card) {
            // Save logic
            setSaving(card)
            try {
                await saveSettings({}) // Actually pass policy data here
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
                <h1 className="pageTitle">Policies</h1>
            </header>

            <div className="tabNav">
                <button
                    className={`tabBtn ${activeTab === "policies" ? "active" : ""}`}
                    onClick={() => setActiveTab("policies")}
                >
                    Policies
                </button>
                <button
                    className={`tabBtn ${activeTab === "approvals" ? "active" : ""}`}
                    onClick={() => setActiveTab("approvals")}
                >
                    Approvals
                </button>
                <button
                    className={`tabBtn ${activeTab === "rounding" ? "active" : ""}`}
                    onClick={() => setActiveTab("rounding")}
                >
                    Time Rounding
                </button>
            </div>

            <div className="tabContent">
                {activeTab === "policies" ? (
                    <div className="policiesView">
                        <p className="policyDesc">
                            These time tracking rules are applied as defaults to everyone in the organization, unless stated otherwise. You can override these settings for each group in Group Settings.
                        </p>

                        {/* ── DEVICE RESTRICTIONS ── */}
                        <div className={`policyCard ${editingCard === "DEVICE RESTRICTIONS" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">DEVICE RESTRICTIONS <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "DEVICE RESTRICTIONS" ? "save" : ""}`}
                                    onClick={() => toggleEdit("DEVICE RESTRICTIONS")}
                                    disabled={saving === "DEVICE RESTRICTIONS"}
                                >
                                    {saving === "DEVICE RESTRICTIONS" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "DEVICE RESTRICTIONS" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "DEVICE RESTRICTIONS" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Select the platforms your team members and managers are allowed to clock in and out from.</p>
                            <div className="deviceGrid">
                                {[
                                    { id: "mobile", label: "Mobile Apps", img: "https://cdn-icons-png.flaticon.com/512/3135/3135768.png" },
                                    { id: "kiosk", label: "Shared Kiosk", img: "https://cdn-icons-png.flaticon.com/512/3261/3261771.png" },
                                    { id: "web", label: "Web Browser", img: "https://cdn-icons-png.flaticon.com/512/2855/2855146.png" },
                                    { id: "desktop", label: "Desktop Apps", img: "https://cdn-icons-png.flaticon.com/512/3039/3039474.png" }
                                ].map(d => (
                                    <div
                                        key={d.id}
                                        className={`deviceItem ${editingCard === "DEVICE RESTRICTIONS" ? "editable" : ""} ${d.id === "mobile" || d.id === "kiosk" ? "selected" : ""}`}
                                    >
                                        <img src={d.img} alt={d.label} className="deviceImg" />
                                        <span className="deviceLabel">{d.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="policyOption">
                                <input type="checkbox" id="offlineClock" defaultChecked disabled={editingCard !== "DEVICE RESTRICTIONS"} />
                                <label htmlFor="offlineClock">Allow members to clock in and out on mobile while offline <Info size={14} className="infoIcon" /></label>
                            </div>
                        </div>

                        {/* ── TIME TRACKING RULES ── */}
                        <div className={`policyCard ${editingCard === "TIME TRACKING RULES" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">TIME TRACKING RULES <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "TIME TRACKING RULES" ? "save" : ""}`}
                                    onClick={() => toggleEdit("TIME TRACKING RULES")}
                                    disabled={saving === "TIME TRACKING RULES"}
                                >
                                    {saving === "TIME TRACKING RULES" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "TIME TRACKING RULES" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "TIME TRACKING RULES" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Require members to track time with additional verification methods in <strong>Personal Mode</strong>. Restrictions for Kiosk Mode can be configured in Kiosk Settings on shared devices.</p>

                            <div className="ruleSection">
                                <div className="ruleHeader"><LayoutGrid size={16} className="ruleIcon" /> VERIFICATION</div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="faceRec" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="faceRec">Require verification by Face Recognition <Info size={14} className="infoIcon" /></label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="selfie" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="selfie">Require selfies when clocking in and out <Info size={14} className="infoIcon" /></label>
                                </div>
                            </div>

                            <div className="ruleSection">
                                <div className="ruleHeader"><Monitor size={16} className="ruleIcon" /> LOCATION</div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="liveTrack" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="liveTrack">Enable live location tracking <span className="premiumTag">ULTIMATE</span> <Info size={14} className="infoIcon" /></label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="locEntry" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="locEntry">Require location with time entries <Info size={14} className="infoIcon" /></label>
                                </div>
                            </div>

                            <div className="ruleSection">
                                <div className="ruleHeader"><Monitor size={16} className="ruleIcon" /> TIME ENTRIES</div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="reqActivity" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="reqActivity">Require activity when clocking in <span className="premiumTag blue">PREMIUM</span> <Info size={14} className="infoIcon" /></label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="reqProject" disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="reqProject">Require project when clocking in <span className="premiumTag blue">PREMIUM</span> <Info size={14} className="infoIcon" /></label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="editEntries" defaultChecked disabled={editingCard !== "TIME TRACKING RULES"} />
                                    <label htmlFor="editEntries">Allow members to edit their time entries <Info size={14} className="infoIcon" /></label>
                                </div>
                            </div>
                        </div>

                        {/* ── SCREENSHOTS ── */}
                        <div className={`policyCard ${editingCard === "SCREENSHOTS" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">SCREENSHOTS <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "SCREENSHOTS" ? "save" : ""}`}
                                    onClick={() => toggleEdit("SCREENSHOTS")}
                                    disabled={saving === "SCREENSHOTS"}
                                >
                                    {saving === "SCREENSHOTS" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "SCREENSHOTS" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "SCREENSHOTS" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Screenshots are taken when members are clocked in with the desktop app running and viewable in their timesheets. <a href="#" className="psHighlight">Learn more <ChevronRight size={11} style={{ display: "inline" }} /></a></p>
                            <div className="ruleOption">
                                <input type="checkbox" id="reqScreenshots" disabled={editingCard !== "SCREENSHOTS"} />
                                <label htmlFor="reqScreenshots">Require screenshot capturing</label>
                            </div>
                        </div>

                        {/* ── DEVICE LOCK ── */}
                        <div className={`policyCard ${editingCard === "DEVICE LOCK" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">DEVICE LOCK <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "DEVICE LOCK" ? "save" : ""}`}
                                    onClick={() => toggleEdit("DEVICE LOCK")}
                                    disabled={saving === "DEVICE LOCK"}
                                >
                                    {saving === "DEVICE LOCK" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "DEVICE LOCK" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "DEVICE LOCK" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">To prevent a user from clocking in from a different device, enable this setting to eliminate fraudulent clocking in and out.</p>
                            <div className="ruleOption">
                                <input type="checkbox" id="deviceLock" disabled={editingCard !== "DEVICE LOCK"} />
                                <label htmlFor="deviceLock">Enable device lock for members</label>
                            </div>
                            <div className="infoBanner blue">
                                <Info size={16} />
                                <span>Device lock can be used together with Face Spoofing Prevention to eliminate fraudulent clocking in and out.</span>
                            </div>
                        </div>

                        {/* ── WORK SCHEDULE RESTRICTIONS ── */}
                        <div className={`policyCard ${editingCard === "WORK SCHEDULE RESTRICTIONS" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">WORK SCHEDULE RESTRICTIONS <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "WORK SCHEDULE RESTRICTIONS" ? "save" : ""}`}
                                    onClick={() => toggleEdit("WORK SCHEDULE RESTRICTIONS")}
                                    disabled={saving === "WORK SCHEDULE RESTRICTIONS"}
                                >
                                    {saving === "WORK SCHEDULE RESTRICTIONS" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "WORK SCHEDULE RESTRICTIONS" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "WORK SCHEDULE RESTRICTIONS" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <p className="cardDesc">Restrict the extent to which members are allowed to clock in or out before or after their fixed work schedule time.</p>
                            <div className="ruleOption-inputs">
                                <div className="ruleOption">
                                    <input type="checkbox" id="earlyIn" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} />
                                    <label htmlFor="earlyIn">Allow early clock in up to <input type="number" defaultValue="5" className="psTinyInput" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} /> minutes before start time</label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="lateIn" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} />
                                    <label htmlFor="lateIn">Allow late clock in up to <input type="number" defaultValue="5" className="psTinyInput" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} /> minutes after start time</label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="earlyOut" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} />
                                    <label htmlFor="earlyOut">Allow early clock out up to <input type="number" defaultValue="5" className="psTinyInput" disabled={editingCard !== "WORK SCHEDULE RESTRICTIONS"} /> minutes before end time</label>
                                </div>
                            </div>
                        </div>

                        {/* ── REMINDERS ── */}
                        <div className={`policyCard ${editingCard === "REMINDERS" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">REMINDERS <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "REMINDERS" ? "save" : ""}`}
                                    onClick={() => toggleEdit("REMINDERS")}
                                    disabled={saving === "REMINDERS"}
                                >
                                    {saving === "REMINDERS" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "REMINDERS" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "REMINDERS" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <div className="ruleOption-inputs">
                                <div className="ruleOption">
                                    <input type="checkbox" id="remindIn" disabled={editingCard !== "REMINDERS"} />
                                    <label htmlFor="remindIn">Send clock in reminder <input type="number" defaultValue="5" className="psTinyInput" disabled={editingCard !== "REMINDERS"} /> minutes before and after the scheduled start time</label>
                                </div>
                                <div className="ruleOption">
                                    <input type="checkbox" id="remindOut" disabled={editingCard !== "REMINDERS"} />
                                    <label htmlFor="remindOut">Send clock out reminder <input type="number" defaultValue="5" className="psTinyInput" disabled={editingCard !== "REMINDERS"} /> minutes before and after the scheduled end time</label>
                                </div>
                            </div>
                        </div>

                        {/* ── AUTOMATIC CLOCK OUT ── */}
                        <div className={`policyCard ${editingCard === "AUTOMATIC CLOCK OUT" ? "editing" : ""}`}>
                            <div className="cardHeader">
                                <div className="cardTitle">AUTOMATIC CLOCK OUT <Info size={14} className="infoIcon" /></div>
                                <button
                                    className={`iconBtn ${editingCard === "AUTOMATIC CLOCK OUT" ? "save" : ""}`}
                                    onClick={() => toggleEdit("AUTOMATIC CLOCK OUT")}
                                    disabled={saving === "AUTOMATIC CLOCK OUT"}
                                >
                                    {saving === "AUTOMATIC CLOCK OUT" ? <RefreshCcw size={16} className="psSpin" /> :
                                        editingCard === "AUTOMATIC CLOCK OUT" ? <Check size={18} /> : <Edit3 size={16} />}
                                </button>
                            </div>
                            {success === "AUTOMATIC CLOCK OUT" && <div className="psSaveNotice">Changes saved successfully!</div>}
                            <div className="ruleOption">
                                <input type="checkbox" id="autoOut" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} />
                                <label htmlFor="autoOut">Allow members to set automatic clock out</label>
                            </div>
                            <div className="nestedRule" style={{ marginLeft: "28px" }}>
                                <div className="ruleOption">
                                    <input type="checkbox" id="autoOutAll" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} />
                                    <label htmlFor="autoOutAll">Set automatic clock out for all members...</label>
                                </div>
                                <div className="nestedRule-options" style={{ marginLeft: "28px", marginTop: "12px" }}>
                                    <div className="ruleOption">
                                        <input type="radio" name="autoOutType" id="afterX" defaultValue="after" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} />
                                        <label htmlFor="afterX">After <input type="number" defaultValue="0" className="psTinyInput" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} /> h <input type="number" defaultValue="0" className="psTinyInput" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} /> m <Info size={14} className="infoIcon" /></label>
                                    </div>
                                    <div className="ruleOption" style={{ marginTop: "8px" }}>
                                        <input type="radio" name="autoOutType" id="atTime" defaultValue="at" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} />
                                        <label htmlFor="atTime">At <input type="time" defaultValue="00:00" className="psTimeInput" disabled={editingCard !== "AUTOMATIC CLOCK OUT"} /> <Info size={14} className="infoIcon" /></label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="comingSoon">This module is coming soon.</div>
                )}
            </div>
        </div>
    )
}
