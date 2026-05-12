import React, { useState, useEffect } from "react"
import { Plus, Trash2, UserCheck, Users } from "lucide-react"
import { apiRequest, unwrapResults } from "../../../api/client.js"

export function AssignmentsPanel({ locations }) {
  const [assignments, setAssignments] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selEmployee, setSelEmployee] = useState("")
  const [selLocation, setSelLocation] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [filterLoc, setFilterLoc] = useState("")

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const [asgn, emps] = await Promise.all([
        apiRequest("/time/employee-locations/"),
        apiRequest("/employees/"),
      ])
      setAssignments(unwrapResults(asgn) || [])
      setEmployees(unwrapResults(emps) || [])
    } catch { setAssignments([]); setEmployees([]) }
    finally { setLoading(false) }
  }

  const handleAssign = async () => {
    if (!selEmployee || !selLocation) { setErr("Select both employee and location"); return }
    setSaving(true); setErr("")
    try {
      const res = await apiRequest("/time/employee-locations/", {
        method: "POST",
        json: { employee: selEmployee, location: selLocation, is_primary: isPrimary }
      })
      setAssignments(prev => [res, ...prev])
      setSelEmployee(""); setSelLocation(""); setIsPrimary(false)
    } catch (e) {
      setErr(e?.body?.detail || "Already assigned or failed")
    } finally { setSaving(false) }
  }

  const handleRemove = async (id) => {
    try {
      await apiRequest(`/time/employee-locations/${id}/`, { method: "DELETE" })
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch { alert("Failed to remove") }
  }

  const visible = filterLoc
    ? assignments.filter(a => String(a.location) === filterLoc)
    : assignments

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--stroke)" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: "var(--fg)" }}>Employee Assignments</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
          Control which locations each employee can clock in at
        </div>
      </div>

      {/* Add assignment form */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--stroke)", background: "var(--surface)" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 10 }}>ADD ASSIGNMENT</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={selEmployee} onChange={e => setSelEmployee(e.target.value)}
            style={{
              flex: "1 1 160px", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--stroke)",
              background: "var(--bg)", color: "var(--fg)", fontSize: 13
            }}>
            <option value="">Select employee…</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.user_display || `${e.first_name || ""} ${e.last_name || ""}`.trim() || e.employee_id}
              </option>
            ))}
          </select>

          <select value={selLocation} onChange={e => setSelLocation(e.target.value)}
            style={{
              flex: "1 1 160px", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--stroke)",
              background: "var(--bg)", color: "var(--fg)", fontSize: 13
            }}>
            <option value="">Select location…</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <label style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 13,
            color: "var(--fg2)", cursor: "pointer", whiteSpace: "nowrap"
          }}>
            <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)}
              style={{ accentColor: "#4F46E5" }} />
            Primary
          </label>

          <button onClick={handleAssign} disabled={saving}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "#4F46E5", color: "#fff", fontSize: 13, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}>
            <Plus size={14} /> {saving ? "…" : "Assign"}
          </button>
        </div>
        {err && <div style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{err}</div>}
      </div>

      {/* Filter */}
      <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--stroke)", display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>FILTER BY LOCATION:</span>
        <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)}
          style={{
            padding: "6px 10px", borderRadius: 8, border: "1px solid var(--stroke)",
            background: "var(--bg)", color: "var(--fg)", fontSize: 13
          }}>
          <option value="">All locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {visible.length} assignment{visible.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <UserCheck size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>No assignments yet</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>
              Assign employees to locations to restrict clock-in.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visible.map(a => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 10, border: "1px solid var(--stroke)",
                background: "var(--surface)"
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "rgba(79,70,229,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  <Users size={16} color="#4F46E5" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--fg)" }}>
                    {a.employee_name}
                    {a.is_primary && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, background: "#4F46E5",
                        color: "#fff", padding: "1px 6px", borderRadius: 99, fontWeight: 700
                      }}>
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                    📍 {a.location_name}
                  </div>
                </div>
                <button onClick={() => handleRemove(a.id)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#EF4444", padding: 4
                  }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
