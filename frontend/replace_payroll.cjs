const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/ui/pages/PayrollPage.jsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { Banknote, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, DollarSign, Loader2, FileText, Download, Printer, Share2, Globe, Mail, Eye, Palette, Layout, Type, Sparkles, User, MapPin } from "lucide-react"',
  'import { Banknote, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, DollarSign, Loader2, FileText, Download, Printer, Share2, Globe, Mail, Eye, Palette, Layout, Type, Sparkles, User, MapPin, Calendar, Filter } from "lucide-react"'
);

const newPayrollPage = `
function FilterDropdown({ options, value, onChange, isDark }) {
  const [open, setOpen] = useState(false)
  
  useEffect(() => {
    if (!open) return
    const handle = () => setOpen(false)
    window.addEventListener("click", handle)
    return () => window.removeEventListener("click", handle)
  }, [open])

  return (
    <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)} style={{
        padding: "10px 16px",
        background: isDark ? "#1f2937" : "#fff",
        border: \\\`1px solid \\\${isDark ? "#374151" : "#e2e8f0"}\\\`,
        borderRadius: 10,
        color: isDark ? "#f9fafb" : "#0f172a",
        fontSize: 13,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        boxShadow: isDark ? "0 4px 12px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.02)",
        transition: "all 0.2s"
      }} className="hover:border-indigo-500">
        <Calendar size={15} style={{ color: "#6366f1" }} />
        {options.find(o => o.value === value)?.label || "Select Filter"}
        <ChevronDown size={14} style={{ opacity: 0.5, marginLeft: 8 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: 8, width: 220,
          background: isDark ? "#1f2937" : "#fff", border: \\\`1px solid \\\${isDark ? "#374151" : "#e2e8f0"}\\\`,
          borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", zIndex: 50, overflow: "hidden",
          padding: "6px",
          animation: "fadeInRight 0.15s ease-out"
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", padding: "6px 12px 6px 12px", letterSpacing: "0.05em" }}>Payroll Range</div>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false) }} style={{
              padding: "10px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              color: isDark ? "#f9fafb" : "#0f172a",
              borderRadius: 8,
              background: value === o.value ? (isDark ? "#374151" : "#f1f5f9") : "transparent",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "all 0.15s"
            }} className="hover:bg-indigo-50 dark:hover:bg-gray-700">
              {o.label}
              {value === o.value && <CheckCircle2 size={14} color="#6366f1" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PayrollPage() {
  const isDark = useDarkMode()
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
  const [regionFilter, setRegionFilter] = useState("all")
  const [hoveredRow, setHoveredRow] = useState(null)

  const [dateFilterMode, setDateFilterMode] = useState("all")
  const [filterStartDate, setFilterStartDate] = useState("")
  const [filterEndDate, setFilterEndDate] = useState("")
  
  const [activeEmployees, setActiveEmployees] = useState([])
  const [loadingActiveEmps, setLoadingActiveEmps] = useState(false)
  
  const [generateEmpId, setGenerateEmpId] = useState("all")
  const [generateRegion, setGenerateRegion] = useState("all")

  async function load() {
    setLoading(true); setError("")
    try {
      const [rRes, eRes] = await Promise.all([
        apiRequest("/payroll/records/"),
        isAdmin ? apiRequest("/employees/") : Promise.resolve({ results: [] }),
      ])
      setRecords(unwrapResults(rRes))
      const loadedEmps = isAdmin ? unwrapResults(eRes) : []
      setEmployees(loadedEmps)
      if (dateFilterMode === "all") setActiveEmployees(loadedEmps)
    } catch (err) {
      setError(err?.body?.detail || "Failed to load payroll.")
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [isAdmin])

  useEffect(() => {
    const today = new Date()
    const formatDate = (d) => d.toISOString().split("T")[0]
    
    if (dateFilterMode === "today") {
      setFilterStartDate(formatDate(today))
      setFilterEndDate(formatDate(today))
    } else if (dateFilterMode === "week") {
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      const start = new Date(today.setDate(diff))
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      setFilterStartDate(formatDate(start))
      setFilterEndDate(formatDate(end))
    } else if (dateFilterMode === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      setFilterStartDate(formatDate(start))
      setFilterEndDate(formatDate(end))
    } else if (dateFilterMode === "all") {
      setFilterStartDate("")
      setFilterEndDate("")
      setActiveEmployees(employees)
      setGenerateEmpId("all")
    }
  }, [dateFilterMode, employees])

  async function loadActiveEmployees() {
    if (!filterStartDate || !filterEndDate) return;
    setLoadingActiveEmps(true)
    try {
      const logsRaw = await apiRequest(\\\`/time-tracking/logs/?date_from=\\\${filterStartDate}&date_to=\\\${filterEndDate}\\\`)
      const logs = unwrapResults(logsRaw)
      const activeIds = new Set(logs.map(l => l.employee?.id || l.employee))
      const active = employees.filter(e => activeIds.has(e.id))
      setActiveEmployees(active)
      setGenerateEmpId("all")
    } catch (e) {
      console.error("Failed to load active employees", e)
      setError("Failed to load employee activity logs for the selected dates.")
    } finally {
      setLoadingActiveEmps(false)
    }
  }

  useEffect(() => {
    if (dateFilterMode !== "all" && dateFilterMode !== "custom" && filterStartDate && filterEndDate && employees.length > 0) {
      loadActiveEmployees()
    }
  }, [dateFilterMode, filterStartDate, filterEndDate, employees.length])

  async function generatePayroll(e) {
    if (e) e.preventDefault()
    setSubmitting(true)
    setError("")
    
    if (!filterStartDate || !filterEndDate) {
      setError("Please select a valid date range to generate payroll.")
      setSubmitting(false)
      return
    }

    try {
      if (generateEmpId === "all") {
        const toGenerate = activeEmployees.length > 0 ? activeEmployees : employees
        const results = await Promise.allSettled(toGenerate.map(emp => 
          apiRequest("/payroll/generate/", { method: "POST", json: { employee: emp.id, start: filterStartDate, end: filterEndDate } })
        ))
        const failed = results.filter(r => r.status === "rejected")
        if (failed.length > 0) {
          setError(\\\`Generated with \\\${failed.length} errors. Some records may already exist.\\\`)
        }
      } else {
        await apiRequest("/payroll/generate/", { method: "POST", json: { employee: generateEmpId, start: filterStartDate, end: filterEndDate } })
      }
      await load()
    } catch (err) {
      setError(err?.body?.detail || "Failed to generate payroll.")
    } finally {
      setSubmitting(false)
    }
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
    
    if (dateFilterMode !== "all" && filterStartDate && filterEndDate) {
      list = list.filter(r => {
        const pStart = r.period?.start_date
        const pEnd = r.period?.end_date
        if (!pStart || !pEnd) return false
        return pStart <= filterEndDate && pEnd >= filterStartDate
      })
    }

    list.sort((a, b) => {
      let av = a[sortField] ?? "", bv = b[sortField] ?? ""
      if (sortField === "gross_pay" || sortField === "net_pay") { av = Number(av); bv = Number(bv) }
      return sortDir === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [records, filterEmp, regionFilter, sortField, sortDir, dateFilterMode, filterStartDate, filterEndDate])

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
    padding: "12px 14px", fontSize: 10, fontWeight: 800, color: isDark ? "#9ca3af" : "#94a3b8",
    textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap",
    cursor: "pointer", userSelect: "none",
    background: sortField === field ? (isDark ? "#1f2937" : "#f1f5f9") : "transparent",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: isDark ? "#0B111D" : "#f8fafc", overflow: "auto" }}>
      <div style={{ background: isDark ? "#111827" : "#ffffff", borderBottom: \\\`1.5px solid \\\${isDark ? "#1f2937" : "#e2e8f0"}\\\`, padding: "18px 32px", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: isDark ? "#1f2937" : "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Banknote size={20} color={isDark ? "#818cf8" : "#4f46e5"} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>Payroll</h1>
            <p style={{ color: isDark ? "#9ca3af" : "#64748b", fontSize: 12, fontWeight: 500, margin: 0, marginTop: 1 }}>
              Transparent pay — regular, overtime, leave, and deductions all reconciled.
            </p>
          </div>
        </div>
      </div>

      <div style={{ width: "100%", padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20, flexGrow: 1 }}>
        {error && (
          <div style={{ background: isDark ? "rgba(220,38,38,0.1)" : "#fef2f2", border: \\\`1.5px solid \\\${isDark ? "rgba(220,38,38,0.2)" : "#fecaca"}\\\`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, color: "#dc2626", fontSize: 13, fontWeight: 700 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: \\\`repeat(\\\${flagged > 0 ? 5 : 4}, 1fr)\\\`, gap: 12 }}>
          <KpiCard icon={regionFilter === "UK" ? <span style={{ fontSize: 18, fontWeight: 900, color: "#818cf8" }}>£</span> : <DollarSign size={20} />} label="Total Gross" value={\\\`\\\${regionFilter === "UK" ? "£" : "$"}\\\${totalGross.toFixed(2)}\\\`} sub={regionFilter === "all" ? "All regions" : \\\`\\\${regionFilter} Region\\\`} color="#4f46e5" />
          <KpiCard icon={regionFilter === "UK" ? <span style={{ fontSize: 18, fontWeight: 900, color: "#34d399" }}>£</span> : <TrendingUp size={20} />} label="Total Net Pay" value={\\\`\\\${regionFilter === "UK" ? "£" : "$"}\\\${totalNet.toFixed(2)}\\\`} sub="After deductions" color="#059669" />
          <KpiCard icon={<Users size={20} />} label="Employees Paid" value={uniqueEmps} sub={\\\`\\\${filtered.length} records active\\\`} color="#2563eb" />
          <KpiCard icon={<Clock size={20} />} label="Regular Hours" value={fmtH(totalRegHrs)} sub="Across filtered records" color="#f59e0b" />
          {flagged > 0 && <KpiCard icon={<AlertTriangle size={20} />} label="Wage Violations" value={flagged} sub="Below minimum wage" color="#dc2626" />}
        </div>

        {isAdmin && (
          <div style={{ background: isDark ? "#111827" : "#fff", border: \\\`1px solid \\\${isDark ? "#1f2937" : "#e2e8f0"}\\\`, borderRadius: 16, padding: "24px", boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: \\\`1px solid \\\${isDark ? "#1f2937" : "#f1f5f9"}\\\`, paddingBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
                <Filter size={18} style={{ color: "#4f46e5" }} /> Payroll Dashboard Engine
              </div>
              <FilterDropdown 
                options={[
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" },
                  { value: "month", label: "This Month" },
                  { value: "custom", label: "Custom Date" },
                  { value: "all", label: "All Payroll" }
                ]}
                value={dateFilterMode}
                onChange={setDateFilterMode}
                isDark={isDark}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Start Date</label>
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} disabled={dateFilterMode !== "custom"}
                  style={{ padding: "10px 14px", border: \\\`1px solid \\\${isDark ? "#374151" : "#cbd5e1"}\\\`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#fff", outline: "none", opacity: dateFilterMode !== "custom" ? 0.6 : 1 }} />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>End Date</label>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} disabled={dateFilterMode !== "custom"}
                  style={{ padding: "10px 14px", border: \\\`1px solid \\\${isDark ? "#374151" : "#cbd5e1"}\\\`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#fff", outline: "none", opacity: dateFilterMode !== "custom" ? 0.6 : 1 }} />
              </div>
              <button onClick={loadActiveEmployees} disabled={loadingActiveEmps || dateFilterMode === "all" || !filterStartDate || !filterEndDate}
                style={{ padding: "10px 20px", background: isDark ? "#334155" : "#f1f5f9", color: isDark ? "#cbd5e1" : "#475569", border: \\\`1px solid \\\${isDark ? "#475569" : "#cbd5e1"}\\\`, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, height: "42px", transition: "all 0.2s", opacity: (dateFilterMode === "all" || !filterStartDate || !filterEndDate) ? 0.5 : 1 }}
                className="hover:bg-indigo-50 dark:hover:bg-gray-700">
                {loadingActiveEmps ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Load Employees
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: \\\`1px dashed \\\${isDark ? "#374151" : "#e2e8f0"}\\\`, display: "flex", gap: 16, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#9ca3af" : "#64748b", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Target Employee</label>
                <select value={generateEmpId} onChange={e => setGenerateEmpId(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: \\\`1px solid \\\${isDark ? "#374151" : "#cbd5e1"}\\\`, borderRadius: 10, fontSize: 13, fontWeight: 600, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#fff", outline: "none", cursor: "pointer" }}>
                  <option value="all">-- All Active Employees --</option>
                  {activeEmployees.map(emp => (
                    <option key={emp.id} value={emp.id} style={{ background: isDark ? "#1f2937" : "#fff" }}>
                      {emp.user?.first_name || emp.user?.username} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={generatePayroll} disabled={submitting || (generateEmpId === "all" && activeEmployees.length === 0)}
                style={{ padding: "0 24px", background: "linear-gradient(135deg, #4f46e5, #7c3aed)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, height: "42px", boxShadow: "0 4px 12px rgba(79, 70, 229, 0.2)", opacity: (submitting || (generateEmpId === "all" && activeEmployees.length === 0)) ? 0.7 : 1 }}
                className="hover:scale-105 active:scale-95 transition-all">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {generateEmpId === "all" ? "Batch Generate Payroll" : "Generate Payroll"}
              </button>
            </div>
          </div>
        )}

        <div style={{ background: isDark ? "#111827" : "#fff", border: \\\`1px solid \\\${isDark ? "#1f2937" : "#e2e8f0"}\\\`, borderRadius: 16, boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 2px 12px rgba(0,0,0,0.01)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: \\\`1px solid \\\${isDark ? "#1f2937" : "#f1f5f9"}\\\`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? "#f9fafb" : "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={15} style={{ color: isDark ? "#818cf8" : "#4f46e5" }} /> Payroll Records
              <span style={{ fontSize: 10, background: isDark ? "#312e81" : "#ede9fe", color: isDark ? "#c084fc" : "#7c3aed", fontWeight: 800, padding: "2px 8px", borderRadius: 6 }}>{filtered.length}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                style={{ padding: "6px 12px", border: \\\`1px solid \\\${isDark ? "#374151" : "#cbd5e1"}\\\`, borderRadius: 8, fontSize: 12, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#fff", outline: "none", fontWeight: 600, cursor: "pointer" }}>
                <option value="all" style={{ background: isDark ? "#1f2937" : "#fff" }}>🌐 All Regions</option>
                <option value="US" style={{ background: isDark ? "#1f2937" : "#fff" }}>🇺🇸 US Payroll</option>
                <option value="UK" style={{ background: isDark ? "#1f2937" : "#fff" }}>🇬🇧 UK Payroll</option>
              </select>
              <input placeholder="Search employee…" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
                style={{ padding: "6px 12px", border: \\\`1px solid \\\${isDark ? "#374151" : "#cbd5e1"}\\\`, borderRadius: 8, fontSize: 12, color: isDark ? "#f9fafb" : "#0f172a", background: isDark ? "#1f2937" : "#fff", outline: "none", width: 160 }} />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <Loader2 size={20} style={{ animation: "spin 0.7s linear infinite" }} /> Loading records…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
              No payroll records found for the selected filter.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: \\\`1.5px solid \\\${isDark ? "#1f2937" : "#f1f5f9"}\\\` }}>
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
                    let curr = "$"
                    if (r.employee_currency) {
                      const cMap = { INR: "₹", GBP: "£", EUR: "€", SGD: "S$", AED: "د.إ", USD: "$" }
                      curr = cMap[r.employee_currency] || r.employee_currency + " "
                    } else if (r.employee_country) {
                      const cMap = { IN: "₹", UK: "£", DE: "€", SG: "S$", AE: "د.إ", US: "$" }
                      curr = cMap[r.employee_country] || "$"
                    } else if (r.region?.includes("UK")) {
                      curr = "£"
                    }
                    const isUK = r.region?.includes("UK") || r.employee_country === "UK"
                    
                    return (
                      <tr key={r.id} onClick={() => setSelected(r)}
                        style={{ borderBottom: \\\`1px solid \\\${isDark ? "#1f2937" : "#f1f5f9"}\\\`, cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = isDark ? "#1f2937" : "#f8fafc"
                          setHoveredRow(r.id)
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent"
                          setHoveredRow(null)
                        }}>
                        <td style={{ padding: "14px 14px" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a" }}>{fmtId(r.employee)}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: isDark ? "#6b7280" : "#94a3b8", textTransform: "uppercase", marginTop: 2 }}>{r.employee_name}</div>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b", whiteSpace: "nowrap" }}>{r.period?.start_date}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b" }}>{r.period?.end_date}</div>
                        </td>
                        <td style={{ padding: "14px 14px" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: isDark ? "#818cf8" : "#4f46e5", textTransform: "uppercase", letterSpacing: "0.06em" }}>{r.employee_country || r.region || "—"}</span>
                          {r.is_exempt && <div style={{ fontSize: 9, fontWeight: 800, color: isDark ? "#34d399" : "#059669", textTransform: "uppercase", marginTop: 2 }}>FLSA EXEMPT</div>}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b" }}>{fmt(r.hourly_rate, curr)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 13, fontWeight: 900, color: isDark ? "#f9fafb" : "#0f172a" }}>{fmt(r.gross_pay, curr)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right" }}>
                          <span style={{ fontSize: 13, fontWeight: 900, color: isDark ? "#34d399" : "#059669", background: isDark ? "rgba(52,211,153,0.1)" : "#ecfdf5", padding: "4px 10px", borderRadius: 8 }}>{fmt(r.net_pay, curr)}</span>
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isDark ? "#cbd5e1" : "#475569" }}>{fmtH(r.regular_hours)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.overtime_hours) > 0 ? "#d97706" : (isDark ? "#4b5563" : "#cbd5e1") }}>{fmtH(r.overtime_hours)}</td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.daily_ot_hours) > 0 ? "#ea580c" : (isDark ? "#4b5563" : "#cbd5e1") }}>
                          {Number(r.daily_ot_hours) > 0 ? fmtH(r.daily_ot_hours) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 800, color: Number(r.double_time_hours) > 0 ? "#dc2626" : (isDark ? "#4b5563" : "#cbd5e1") }}>
                          {Number(r.double_time_hours) > 0 ? fmtH(r.double_time_hours) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b" }}>
                          {isUK && Number(r.uk_income_tax) > 0 ? fmt(r.uk_income_tax, "£") : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: isDark ? "#9ca3af" : "#64748b" }}>
                          {isUK && Number(r.uk_employee_ni) > 0 ? fmt(r.uk_employee_ni, "£") : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "right", fontSize: 12, fontWeight: 700, color: Number(r.holiday_hours_accrued) > 0 ? (isDark ? "#34d399" : "#059669") : (isDark ? "#4b5563" : "#cbd5e1") }}>
                          {Number(r.holiday_hours_accrued) > 0 ? fmtH(r.holiday_hours_accrued) : "—"}
                        </td>
                        <td style={{ padding: "14px 14px", textAlign: "center", position: "relative" }}>
                          {r.wage_floor_compliant
                            ? <CheckCircle2 size={16} style={{ color: isDark ? "#34d399" : "#059669" }} />
                            : <span style={{ fontSize: 9, fontWeight: 800, background: isDark ? "rgba(220,38,38,0.1)" : "#fef2f2", color: "#dc2626", border: \\\`1px solid \\\${isDark ? "rgba(220,38,38,0.2)" : "#fecaca"}\\\`, padding: "3px 8px", borderRadius: 5, textTransform: "uppercase" }}>MIN WAGE ⚠</span>}

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

      <style>{\\\`
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
      \\\`}</style>
    </div>
  )
}
`;

const replacePattern = /export function PayrollPage\(\) \{[\s\S]*\}\s*$/;
if (replacePattern.test(content)) {
  content = content.replace(replacePattern, newPayrollPage);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated PayrollPage.jsx');
} else {
  console.log('Error: Could not find PayrollPage function block.');
}
