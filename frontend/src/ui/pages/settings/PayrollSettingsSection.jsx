import { useState, useEffect, useCallback } from "react"
import {
  Users, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Check,
  X, Save, Loader2, Settings2, Sliders, Globe, AlertCircle,
  Info, Shield, IndianRupee
} from "lucide-react"
import { apiRequest } from "../../../api/client.js"
import { useAuth } from "../../../state/auth/useAuth.js"

const REGION_META = {
  IN: { label: "India",         flag: "🇮🇳", currency: "₹", code: "INR", color: "#f97316" },
  US: { label: "United States", flag: "🇺🇸", currency: "$", code: "USD", color: "#3b82f6" },
  UK: { label: "United Kingdom",flag: "🇬🇧", currency: "£", code: "GBP", color: "#8b5cf6" },
}

function Toggle({ enabled, onChange, label, description }) {
  return (
    <div
      onClick={() => onChange(!enabled)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 10, cursor: "pointer",
        background: enabled ? "#f0fdf4" : "#f8fafc",
        border: `1.5px solid ${enabled ? "#86efac" : "#e2e8f0"}`,
        transition: "all 0.2s",
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: enabled ? "#15803d" : "#374151" }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ width: 44, height: 24, borderRadius: 12, background: enabled ? "#16a34a" : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 2, left: enabled ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)", transition: "left 0.2s" }} />
      </div>
    </div>
  )
}

function SliderRow({ label, value, onChange, min = 0, max = 100, step = 0.5, suffix = "%" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</label>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#4f46e5", background: "#eef2ff", borderRadius: 6, padding: "2px 10px" }}>
          {Number(value).toFixed(2)}{suffix}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#4f46e5" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
        <span>{min}{suffix}</span><span>{max}{suffix}</span>
      </div>
    </div>
  )
}

function NumInput({ label, value, onChange, suffix = "", hint, min = 0 }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
        <input type="number" min={min} value={value} step="0.01"
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{ flex: 1, padding: "8px 12px", fontSize: 14, fontWeight: 600, border: "none", outline: "none", background: "transparent" }} />
        {suffix && <div style={{ padding: "8px 12px", fontSize: 12, color: "#9ca3af", background: "#f8fafc", borderLeft: "1px solid #e2e8f0", fontWeight: 700 }}>{suffix}</div>}
      </div>
      {hint && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{hint}</div>}
    </div>
  )
}

function SplitPreview({ config, currency }) {
  const base = 1000
  const emp  = (base * config.employee_share_pct / 100)
  const co   = (base * config.company_share_pct  / 100)
  const plat = config.platform_fee_type === "fixed" ? Number(config.platform_fee_value) : (base * config.platform_fee_value / 100)
  const pf   = config.pf_enabled  ? (emp * config.pf_pct  / 100) : 0
  const esi  = config.esi_enabled ? (emp * config.esi_pct / 100) : 0
  const tds  = config.tds_enabled ? (emp * config.tds_rate / 100) : 0
  const net  = emp - pf - esi - tds

  const rows = [
    { lbl: "Total Revenue",                     amt: base, clr: "#e2e8f0" },
    { lbl: `Employee (${config.employee_share_pct}%)`,  amt: emp.toFixed(0),  clr: "#bbf7d0" },
    { lbl: `Company (${config.company_share_pct}%)`,    amt: co.toFixed(0),   clr: "#bfdbfe" },
    { lbl: `Platform (${config.platform_fee_type === "fixed" ? "fixed" : config.platform_fee_value + "%"})`, amt: plat.toFixed(0), clr: "#e9d5ff" },
    config.pf_enabled  && { lbl: `PF (${config.pf_pct}%)`,   amt: `-${pf.toFixed(0)}`,  clr: "#fca5a5" },
    config.esi_enabled && { lbl: `ESI (${config.esi_pct}%)`, amt: `-${esi.toFixed(0)}`, clr: "#fca5a5" },
    config.tds_enabled && { lbl: `TDS (${config.tds_rate}%)`,amt: `-${tds.toFixed(0)}`, clr: "#fca5a5" },
    { lbl: "Net Pay", amt: net.toFixed(0), clr: "#a5f3fc", bold: true },
  ].filter(Boolean)

  return (
    <div style={{ background: "linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius: 14, padding: "18px 20px", color: "#fff" }}>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, marginBottom: 12 }}>
        Live Preview — {currency}1,000 booking
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: r.bold ? "8px 10px" : "5px 10px", borderRadius: 8, background: r.bold ? "rgba(255,255,255,0.12)" : "transparent", borderTop: r.bold ? "1px solid rgba(255,255,255,0.1)" : "none", marginTop: r.bold ? 4 : 0 }}>
          <span style={{ fontSize: 12, fontWeight: r.bold ? 900 : 600, opacity: r.bold ? 1 : 0.85 }}>{r.lbl}</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: r.clr }}>{currency}{String(r.amt).replace("-","")}{String(r.amt).startsWith("-") ? " (-)" : ""}</span>
        </div>
      ))}
    </div>
  )
}

function ConfigEditor({ config, region, onSave, onCancel, loading }) {
  const meta = REGION_META[region] || REGION_META.IN
  const [f, setF] = useState({
    employee_share_pct:  config?.employee_share_pct  ?? 80,
    company_share_pct:   config?.company_share_pct   ?? 10,
    platform_fee_type:   config?.platform_fee_type   ?? "percentage",
    platform_fee_value:  config?.platform_fee_value  ?? 5,
    pf_enabled:          config?.pf_enabled          ?? true,
    pf_pct:              config?.pf_pct              ?? 12,
    esi_enabled:         config?.esi_enabled         ?? true,
    esi_pct:             config?.esi_pct             ?? 0.75,
    tds_enabled:         config?.tds_enabled         ?? false,
    tds_rate:            config?.tds_rate            ?? 10,
    ot_multiplier:       config?.ot_multiplier       ?? 1.5,
    daily_ot_threshold:  config?.daily_ot_threshold  ?? 8,
    weekly_ot_threshold: config?.weekly_ot_threshold ?? (region === "UK" ? 48 : 40),
    service_split_enabled: config?.service_split_enabled ?? false,
    pay_frequency:       config?.pay_frequency       ?? (region === "IN" ? "monthly" : "biweekly"),
    features:            config?.features            ?? { mileage_reimbursement: true, bonus: false, advance: false },
    custom_deductions:   config?.custom_deductions   ?? [],
    custom_bonuses:      config?.custom_bonuses      ?? [],
  })
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))
  const totalPct = +f.employee_share_pct + +f.company_share_pct + (f.platform_fee_type === "percentage" ? +f.platform_fee_value : 0)
  const splitOk  = totalPct <= 100
  const showSplit = region === "IN" || f.service_split_enabled

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* India / service split */}
        {showSplit && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1.5px solid #fde68a" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <IndianRupee size={14} /> Service Revenue Split
            </div>
            {!splitOk && (
              <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={13} /> Total ({totalPct.toFixed(1)}%) exceeds 100%!
              </div>
            )}
            <SliderRow label="Employee Share" value={f.employee_share_pct} onChange={v => set("employee_share_pct", v)} />
            <SliderRow label="Company Share"  value={f.company_share_pct}  onChange={v => set("company_share_pct",  v)} />
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Platform Fee Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {["percentage","fixed"].map(t => (
                  <button key={t} onClick={() => set("platform_fee_type", t)}
                    style={{ flex: 1, padding: 7, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                      border: `2px solid ${f.platform_fee_type === t ? "#4f46e5" : "#e2e8f0"}`,
                      background: f.platform_fee_type === t ? "#eef2ff" : "#fff",
                      color: f.platform_fee_type === t ? "#4f46e5" : "#6b7280" }}>
                    {t === "percentage" ? "% Percentage" : "Fixed Amount"}
                  </button>
                ))}
              </div>
            </div>
            {f.platform_fee_type === "percentage"
              ? <SliderRow label="Platform Fee %" value={f.platform_fee_value} onChange={v => set("platform_fee_value", v)} max={50} />
              : <NumInput label="Platform Fee Amount" value={f.platform_fee_value} onChange={v => set("platform_fee_value", v)} suffix={meta.currency} hint="Fixed fee deducted per booking" />
            }
          </div>
        )}

        {/* India statutory deductions */}
        {region === "IN" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1.5px solid #bfdbfe" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#1e40af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Shield size={14} /> Statutory Deductions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Toggle enabled={f.pf_enabled}  onChange={v => set("pf_enabled", v)}  label="Provident Fund (PF)"          description="Employee retirement contribution" />
              {f.pf_enabled  && <NumInput label="PF Rate"  value={f.pf_pct}  onChange={v => set("pf_pct",  v)} suffix="%" hint="Standard: 12%" />}
              <Toggle enabled={f.esi_enabled} onChange={v => set("esi_enabled",v)} label="ESI (State Insurance)"          description="Medical insurance contribution" />
              {f.esi_enabled && <NumInput label="ESI Rate" value={f.esi_pct} onChange={v => set("esi_pct", v)} suffix="%" hint="Standard: 0.75%" />}
              <Toggle enabled={f.tds_enabled} onChange={v => set("tds_enabled",v)} label="TDS (Tax Deducted at Source)"   description="Income tax withholding" />
              {f.tds_enabled && <NumInput label="TDS Rate" value={f.tds_rate} onChange={v => set("tds_rate", v)} suffix="%" hint="10%, 20% or 30%" />}
            </div>
          </div>
        )}

        {/* US/UK overtime */}
        {(region === "US" || region === "UK") && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1.5px solid #d1d5db" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Sliders size={14} /> Overtime Rules
            </div>
            <NumInput label="OT Multiplier"         value={f.ot_multiplier}       onChange={v => set("ot_multiplier",v)}       suffix="x"   hint="1.5x = time-and-a-half" />
            <NumInput label="Weekly OT Threshold"   value={f.weekly_ot_threshold}  onChange={v => set("weekly_ot_threshold",v)} suffix="hrs" hint={region === "US" ? "FLSA: 40h/week" : "UK WTR: 48h/week"} />
            {region === "US" && <NumInput label="Daily OT Threshold" value={f.daily_ot_threshold} onChange={v => set("daily_ot_threshold",v)} suffix="hrs" hint="CA/AK: after 8h/day" />}
            <div style={{ marginTop: 8 }}>
              <Toggle enabled={f.service_split_enabled} onChange={v => set("service_split_enabled",v)} label="Enable Service Revenue Split" description="Add service revenue split on top of hourly pay" />
            </div>
          </div>
        )}

        {/* Pay frequency */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1.5px solid #e2e8f0" }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Pay Frequency Override</label>
          <div style={{ display: "flex", gap: 8 }}>
            {["monthly","biweekly","weekly"].map(freq => (
              <button key={freq} onClick={() => set("pay_frequency",freq)}
                style={{ flex: 1, padding: "8px 6px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer", textTransform: "capitalize", transition: "all 0.2s",
                  border: `2px solid ${f.pay_frequency === freq ? "#4f46e5" : "#e2e8f0"}`,
                  background: f.pay_frequency === freq ? "#eef2ff" : "#fff",
                  color: f.pay_frequency === freq ? "#4f46e5" : "#6b7280" }}>
                {freq}
              </button>
            ))}
          </div>
        </div>

        {/* Feature toggles */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1.5px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Feature Toggles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[["mileage_reimbursement","Mileage Reimbursement"],["bonus","Bonus Payments"],["advance","Salary Advance"]].map(([k,lbl]) => (
              <Toggle key={k} enabled={!!f.features[k]} onChange={v => set("features",{...f.features,[k]:v})} label={lbl} />
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex:1, padding:10, borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:700, color:"#6b7280", cursor:"pointer" }}>Cancel</button>
          <button onClick={() => onSave(f)} disabled={loading || !splitOk}
            style={{ flex:2, padding:10, borderRadius:10, border:"none", fontSize:13, fontWeight:700, color:"#fff", cursor: splitOk ? "pointer" : "not-allowed", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              background: splitOk ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#d1d5db" }}>
            {loading ? <Loader2 size={14} /> : <Save size={14} />} Save Configuration
          </button>
        </div>
      </div>

      {/* Right: preview */}
      <div style={{ position: "sticky", top: 20 }}>
        {showSplit && <SplitPreview config={f} currency={meta.currency} />}
        {!showSplit && (region === "US" || region === "UK") && (
          <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", borderRadius: 14, padding: "18px 20px", color: "#fff" }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.6, marginBottom: 12 }}>OT Config Preview</div>
            {[["OT Multiplier",`${f.ot_multiplier}x`],["Weekly Threshold",`${f.weekly_ot_threshold}h`],region==="US"&&["Daily Threshold",`${f.daily_ot_threshold}h`]].filter(Boolean).map(([lbl,val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ fontSize:12, opacity:0.85 }}>{lbl}</span>
                <span style={{ fontSize:14, fontWeight:900, color:"#93c5fd" }}>{val}</span>
              </div>
            ))}
            <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", paddingTop:10, marginTop:4 }}>
              <div style={{ fontSize:11, opacity:0.5, marginBottom:6 }}>Example: 50h worked week</div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{fontSize:12,opacity:0.85}}>Regular ({f.weekly_ot_threshold}h)</span>
                <span style={{fontSize:13,fontWeight:700,color:"#bbf7d0"}}>{f.weekly_ot_threshold}h × base rate</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{fontSize:12,opacity:0.85}}>Overtime ({50 - f.weekly_ot_threshold}h)</span>
                <span style={{fontSize:13,fontWeight:700,color:"#fde68a"}}>{50 - f.weekly_ot_threshold}h × {f.ot_multiplier}x</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function PayrollSettingsSection({ SectionHeader }) {
  const { user } = useAuth()
  const [summary, setSummary]     = useState(null)
  const region   = summary?.region || user?.companyCountry || user?.company_country || user?.companyRegion || user?.primaryCountry || "US"
  const meta     = REGION_META[region] || REGION_META.US

  const [tab, setTab]             = useState("groups")
  const [groups, setGroups]       = useState([])
  const [configs, setConfigs]     = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const [showForm, setShowForm]         = useState(false)
  const [editGroup, setEditGroup]       = useState(null)
  const [gForm, setGForm]               = useState({ name:"", description:"" })
  const [expanded, setExpanded]         = useState(null)
  const [grpEmps, setGrpEmps]           = useState({})
  const [editor, setEditor]             = useState(null)
  const [cfgSaving, setCfgSaving]       = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [g, e, c, s] = await Promise.allSettled([
      apiRequest("/payroll/groups/"),
      apiRequest("/employees/"),
      apiRequest("/payroll/configs/"),
      apiRequest("/payroll/region-summary/"),
    ])
    if (g.status==="fulfilled") setGroups(g.value?.results || g.value || [])
    if (e.status==="fulfilled") setEmployees(e.value?.results || e.value || [])
    if (c.status==="fulfilled") setConfigs(c.value?.results || c.value || [])
    if (s.status==="fulfilled") setSummary(s.value)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchGrpEmps = useCallback(async (id) => {
    try {
      const res = await apiRequest(`/payroll/groups/${id}/employees/`)
      setGrpEmps(prev => ({ ...prev, [id]: res?.results || res || [] }))
    } catch {}
  }, [])

  const saveGroup = async () => {
    if (!gForm.name.trim()) return
    setSaving(true)
    try {
      if (editGroup) await apiRequest(`/payroll/groups/${editGroup.id}/`, { method:"PUT", body:gForm })
      else           await apiRequest("/payroll/groups/", { method:"POST", body:gForm })
      setShowForm(false); setEditGroup(null); setGForm({name:"",description:""})
      fetchAll()
    } catch { setError("Failed to save group") }
    finally { setSaving(false) }
  }

  const deleteGroup = async (id) => {
    if (!confirm("Delete this group? Employees will be unassigned.")) return
    try { await apiRequest(`/payroll/groups/${id}/`, { method:"DELETE" }); fetchAll() }
    catch { setError("Failed to delete group") }
  }

  const toggleAssign = async (gId, empId, assign) => {
    try {
      if (assign) await apiRequest(`/payroll/groups/${gId}/assign-employees/`, { method:"POST", body:{ employee_ids:[empId] } })
      else        await apiRequest(`/employees/${empId}/`, { method:"PATCH", body:{ payroll_group:null } })
      fetchGrpEmps(gId); fetchAll()
    } catch { setError("Failed to update assignment") }
  }

  const openEmpConfig = async (emp) => {
    try {
      const res = await apiRequest(`/payroll/configs/resolve/${emp.employee_id}/`)
      setEditor({ mode:"individual", employeeId:emp.id, empCode:emp.employee_id,
        empName: emp.user?.first_name ? `${emp.user.first_name} ${emp.user.last_name}` : emp.employee_id,
        configId: res?.config?.id || null, configData: res?.config || {}, source: res?.source || "default" })
    } catch { setError("Failed to load employee config") }
  }

  const openGroupConfig = async (group) => {
    const existing = configs.find(c => c.group === group.id)
    setEditor({ mode:"group", groupId:group.id, groupName:group.name,
      configId: existing?.id || null, configData: existing || {}, source: existing ? "group" : "default" })
    setTab("employees")
  }

  const saveConfig = async (formData) => {
    setCfgSaving(true)
    try {
      const payload = { ...formData, ...(editor.mode==="individual" ? { employee:editor.employeeId, group:null } : { group:editor.groupId, employee:null }) }
      if (editor.configId) await apiRequest(`/payroll/configs/${editor.configId}/`, { method:"PUT", body:payload })
      else                 await apiRequest("/payroll/configs/", { method:"POST", body:payload })
      setEditor(null); fetchAll()
    } catch (e) { setError("Failed to save config: " + (e?.message || "")) }
    finally { setCfgSaving(false) }
  }

  const cfgSource = (emp) => {
    if (configs.find(c => c.employee === emp.id)) return { label:"Individual", color:"#4f46e5" }
    if (emp.payroll_group) return { label: emp.payroll_group_name || "Group", color:"#16a34a" }
    return { label:"Default", color:"#9ca3af" }
  }

  const TABS = [
    { id:"groups",    label:"Payroll Groups",  icon:<Users size={14} /> },
    { id:"employees", label:"Employee Config", icon:<Sliders size={14} /> },
    { id:"region",    label:"Region Rules",    icon:<Globe size={14} /> },
  ]

  const regionRules = {
    IN: [["Currency","₹ INR"],["Model","Service Revenue Split"],["Employee Share","80% (default)"],["Company Share","10% (default)"],["PF","12% of employee share"],["ESI","0.75% of employee share"],["OT Threshold","48 hrs/week"],["OT Multiplier","2.0x"],["Tax Year","Apr 1 – Mar 31"]],
    US: [["Currency","$ USD"],["Model","Hourly + Optional Service Split"],["Weekly OT","40h (FLSA)"],["OT Multiplier","1.5x"],["CA Daily OT",">8h=1.5x, >12h=2x"],["Federal Min Wage","$7.25/hr"],["FLSA Exempt","$844/week salary"],["Tax Year","Jan 1 – Dec 31"]],
    UK: [["Currency","£ GBP"],["Model","PAYE + NI + Optional Split"],["WTR Cap","48h/week"],["Holiday Accrual","12.07% (5.6 weeks)"],["NMW (21+)","£11.44/hr"],["Income Tax","20%/40%/45%"],["Employee NI","8% (£12,570–£50,270)"],["Employer NI","13.8% (>£9,100)"],["Tax Year","Apr 6 – Apr 5"]],
  }

  return (
    <div>
      <SectionHeader
        title={`Payroll Settings ${meta.flag}`}
        subtitle={`Configure region-based payroll, employee groups, and customized pay rules for your ${meta.label} organization.`}
      />

      {/* Summary KPIs */}
      {summary && (
        <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
          {[
            { label:"Region",              value:`${meta.flag} ${meta.label}`,                   color:meta.color },
            { label:"Total Employees",      value:summary.total_employees,                        color:"#374151" },
            { label:"Groups",               value:summary.total_groups,                           color:"#7c3aed" },
            { label:"Individual Configs",   value:summary.employees_with_individual_config,       color:"#4f46e5" },
            { label:"On Group Config",      value:summary.employees_with_group,                   color:"#16a34a" },
            { label:"On Default",           value:summary.employees_on_default_config,            color:"#9ca3af" },
          ].map(k => (
            <div key={k.label} style={{ background:"#fff", border:"1.5px solid #e2e8f0", borderRadius:12, padding:"12px 18px", minWidth:110 }}>
              <div style={{ fontSize:10, fontWeight:800, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>{k.label}</div>
              <div style={{ fontSize:18, fontWeight:900, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626" }}><X size={14}/></button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display:"flex", gap:4, background:"#f1f5f9", borderRadius:12, padding:4, marginBottom:24, width:"fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if(t.id!=="employees") setEditor(null) }}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 18px", borderRadius:9, fontSize:13, fontWeight:700, border:"none", cursor:"pointer", transition:"all 0.2s",
              background: tab===t.id ? "#fff" : "transparent",
              color:      tab===t.id ? "#4f46e5" : "#64748b",
              boxShadow:  tab===t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Groups ── */}
      {tab==="groups" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <p style={{ fontSize:14, color:"#374151", margin:0 }}>Create named groups and apply the same payroll config to all members at once.</p>
            <button onClick={() => { setShowForm(true); setEditGroup(null); setGForm({name:"",description:""}) }}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 18px", borderRadius:10, border:"none", background:"linear-gradient(135deg,#4f46e5,#7c3aed)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
              <Plus size={14}/> New Group
            </button>
          </div>

          {showForm && (
            <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #c7d2fe", padding:20, marginBottom:20 }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#4f46e5", marginBottom:14 }}>{editGroup?"Edit Group":"Create Payroll Group"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:4 }}>Group Name *</label>
                  <input value={gForm.name} onChange={e=>setGForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Field Engineers"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", display:"block", marginBottom:4 }}>Description</label>
                  <input value={gForm.description} onChange={e=>setGForm(f=>({...f,description:e.target.value}))} placeholder="Optional"
                    style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #e2e8f0", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setShowForm(false)} style={{ padding:"8px 18px", borderRadius:9, border:"1.5px solid #e2e8f0", background:"#fff", fontSize:13, fontWeight:700, color:"#6b7280", cursor:"pointer" }}>Cancel</button>
                <button onClick={saveGroup} disabled={saving||!gForm.name.trim()}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 20px", borderRadius:9, border:"none", background:"#4f46e5", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
                  {saving ? <Loader2 size={13}/> : <Save size={13}/>} Save
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"#9ca3af" }}><Loader2 size={24}/></div>
          ) : groups.length===0 ? (
            <div style={{ textAlign:"center", padding:40, color:"#9ca3af", background:"#f8fafc", borderRadius:14, border:"1.5px dashed #e2e8f0" }}>
              <Users size={32} style={{ marginBottom:8, opacity:0.4 }}/>
              <div style={{ fontWeight:700 }}>No payroll groups yet</div>
              <div style={{ fontSize:13, marginTop:4 }}>Create groups to manage payroll for multiple employees efficiently.</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {groups.map(grp => (
                <div key={grp.id} style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0", overflow:"hidden" }}>
                  <div style={{ display:"flex", alignItems:"center", padding:"14px 18px", cursor:"pointer" }}
                    onClick={() => { setExpanded(expanded===grp.id?null:grp.id); if(expanded!==grp.id) fetchGrpEmps(grp.id) }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:"#eef2ff", display:"flex", alignItems:"center", justifyContent:"center", marginRight:14, flexShrink:0 }}>
                      <Users size={18} color="#4f46e5"/>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:15, fontWeight:800, color:"#1e293b" }}>{grp.name}</div>
                      {grp.description && <div style={{ fontSize:12, color:"#6b7280", marginTop:1 }}>{grp.description}</div>}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:"#4f46e5", background:"#eef2ff", borderRadius:6, padding:"3px 10px" }}>{grp.employee_count} employees</span>
                      <button onClick={e=>{e.stopPropagation();openGroupConfig(grp)}} title="Configure payroll"
                        style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid #c7d2fe", background:"#eef2ff", color:"#4f46e5", cursor:"pointer" }}><Settings2 size={12}/></button>
                      <button onClick={e=>{e.stopPropagation();setEditGroup(grp);setGForm({name:grp.name,description:grp.description||""});setShowForm(true)}}
                        style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", color:"#374151", cursor:"pointer" }}><Pencil size={12}/></button>
                      <button onClick={e=>{e.stopPropagation();deleteGroup(grp.id)}}
                        style={{ padding:"6px 10px", borderRadius:8, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", cursor:"pointer" }}><Trash2 size={12}/></button>
                      {expanded===grp.id ? <ChevronUp size={16} color="#9ca3af"/> : <ChevronDown size={16} color="#9ca3af"/>}
                    </div>
                  </div>
                  {expanded===grp.id && (
                    <div style={{ borderTop:"1px solid #f1f5f9", padding:"14px 18px", background:"#fafbff" }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#374151", marginBottom:10 }}>Click employees to assign/remove from this group</div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
                        {employees.map(emp => {
                          const inGrp = (grpEmps[grp.id]||[]).some(e=>e.id===emp.id)
                          const name  = emp.user?.first_name ? `${emp.user.first_name} ${emp.user.last_name}` : emp.employee_id
                          return (
                            <div key={emp.id} onClick={()=>toggleAssign(grp.id,emp.id,!inGrp)}
                              style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", borderRadius:9, cursor:"pointer", transition:"all 0.15s",
                                border:`1.5px solid ${inGrp?"#86efac":"#e2e8f0"}`,
                                background:inGrp?"#f0fdf4":"#fff" }}>
                              <div style={{ width:22, height:22, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all 0.15s",
                                background:inGrp?"#16a34a":"#e2e8f0" }}>
                                {inGrp && <Check size={12} color="#fff"/>}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:700, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</div>
                                <div style={{ fontSize:10, color:"#9ca3af" }}>{emp.employee_id}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Employee Config ── */}
      {tab==="employees" && (
        <div>
          {editor ? (
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
                <button onClick={()=>setEditor(null)} style={{ padding:"6px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#fff", fontSize:12, fontWeight:700, color:"#6b7280", cursor:"pointer" }}>← Back</button>
                <div>
                  <div style={{ fontSize:16, fontWeight:900, color:"#1e293b" }}>
                    {editor.mode==="individual" ? `${editor.empName} (${editor.empCode})` : `Group: ${editor.groupName}`}
                  </div>
                  <div style={{ fontSize:12, color:"#9ca3af" }}>Config source: <span style={{ fontWeight:700, color:editor.source==="individual"?"#4f46e5":editor.source==="group"?"#16a34a":"#9ca3af" }}>{editor.source}</span></div>
                </div>
              </div>
              <ConfigEditor config={editor.configData} region={region} onSave={saveConfig} onCancel={()=>setEditor(null)} loading={cfgSaving}/>
            </div>
          ) : (
            <div>
              <p style={{ fontSize:14, color:"#374151", marginBottom:16 }}>Click <strong>Configure</strong> to set individual payroll rules. Individual configs override group configs.</p>
              {loading ? <div style={{ textAlign:"center", padding:40 }}><Loader2 size={24} style={{ color:"#9ca3af" }}/></div> : (
                <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0", overflow:"hidden" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr style={{ background:"#f8fafc" }}>
                        {["Employee","ID","Department","Group","Config","Actions"].map(h => (
                          <th key={h} style={{ padding:"12px 16px", fontSize:10, fontWeight:800, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.1em", textAlign:"left", borderBottom:"1.5px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, i) => {
                        const src  = cfgSource(emp)
                        const name = emp.user?.first_name ? `${emp.user.first_name} ${emp.user.last_name}` : emp.user?.username || emp.employee_id
                        return (
                          <tr key={emp.id} style={{ borderBottom:i<employees.length-1?"1px solid #f1f5f9":"none" }}>
                            <td style={{ padding:"12px 16px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                                <div style={{ width:32, height:32, borderRadius:8, background:`${meta.color}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:meta.color, flexShrink:0 }}>
                                  {name.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontSize:13, fontWeight:700, color:"#1e293b" }}>{name}</span>
                              </div>
                            </td>
                            <td style={{ padding:"12px 16px", fontSize:12, color:"#6b7280", fontFamily:"monospace", fontWeight:600 }}>{emp.employee_id}</td>
                            <td style={{ padding:"12px 16px", fontSize:12, color:"#6b7280" }}>{emp.department||"—"}</td>
                            <td style={{ padding:"12px 16px" }}>
                              {emp.payroll_group_name
                                ? <span style={{ fontSize:11, fontWeight:700, color:"#16a34a", background:"#f0fdf4", borderRadius:6, padding:"2px 8px" }}>{emp.payroll_group_name}</span>
                                : <span style={{ fontSize:11, color:"#9ca3af" }}>No group</span>}
                            </td>
                            <td style={{ padding:"12px 16px" }}>
                              <span style={{ fontSize:11, fontWeight:700, color:src.color, background:`${src.color}18`, borderRadius:6, padding:"3px 10px" }}>{src.label}</span>
                            </td>
                            <td style={{ padding:"12px 16px" }}>
                              <button onClick={()=>openEmpConfig(emp)}
                                style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"1.5px solid #c7d2fe", background:"#eef2ff", color:"#4f46e5", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                                <Sliders size={12}/> Configure
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Region Rules ── */}
      {tab==="region" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #e2e8f0", padding:20 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#1e293b", marginBottom:16 }}>{meta.flag} {meta.label} — Compliance Rules</div>
            {(regionRules[region]||regionRules.IN).map(([lbl,val]) => (
              <div key={lbl} style={{ display:"flex", justifyContent:"space-between", padding:"9px 14px", borderRadius:8, background:"#f8fafc", border:"1px solid #e2e8f0", marginBottom:6 }}>
                <span style={{ fontSize:13, color:"#374151", fontWeight:600 }}>{lbl}</span>
                <span style={{ fontSize:13, color:meta.color, fontWeight:700 }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ background:"#fffbeb", borderRadius:14, border:"1.5px solid #fde68a", padding:18 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#92400e", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
              <Info size={14}/> Config Priority Order
            </div>
            {[
              {n:1,lbl:"Individual Config",desc:"Highest priority — set per-employee",c:"#4f46e5"},
              {n:2,lbl:"Group Config",     desc:"Applied to all employees in the group",c:"#16a34a"},
              {n:3,lbl:"Region Default",   desc:"Fallback based on organization region",c:"#9ca3af"},
            ].map(({n,lbl,desc,c}) => (
              <div key={n} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderRadius:8, background:"#fff", marginBottom:6 }}>
                <div style={{ width:24, height:24, borderRadius:"50%", background:c, color:"#fff", fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#374151" }}>{lbl}</div>
                  <div style={{ fontSize:11, color:"#9ca3af" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
