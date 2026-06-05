import React, { useState, useEffect } from "react"
import { Plus, Pencil, Trash2, X, Check, Layers } from "lucide-react"
import { apiRequest, unwrapResults } from "../../../api/client.js"

const COLOURS = ["#4F46E5", "#F97316", "#10B981", "#EF4444", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899"]

function ZoneForm({ zone, locations, onSave, onCancel }) {
  const [name, setName] = useState(zone?.name || "")
  const [desc, setDesc] = useState(zone?.description || "")
  const [color, setColor] = useState(zone?.color || COLOURS[0])
  const [selected, setSelected] = useState(zone?.location_ids?.map(String) || [])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const toggle = (id) => setSelected(p => p.includes(String(id)) ? p.filter(x => x !== String(id)) : [...p, String(id)])

  const submit = async () => {
    if (!name.trim()) { setErr("Name required"); return }
    setSaving(true); setErr("")
    try {
      const payload = { name, description: desc, color, location_ids: selected }
      const res = zone?.id
        ? await apiRequest(`/time/zones/${zone.id}/`, { method: "PATCH", json: payload })
        : await apiRequest("/time/zones/", { method: "POST", json: payload })
      onSave(res)
    } catch (e) {
      setErr(e?.body?.detail || "Failed to save zone")
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: 20, borderTop: "1px solid var(--stroke)", background: "var(--surface)" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: "var(--fg)" }}>
        {zone?.id ? "Edit Zone" : "New Zone"}
      </div>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Zone name"
        style={{
          width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--stroke)",
          background: "var(--bg)", color: "var(--fg)", fontSize: 14, marginBottom: 10, boxSizing: "border-box"
        }} />
      <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" rows={2}
        style={{
          width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--stroke)",
          background: "var(--bg)", color: "var(--fg)", fontSize: 14, marginBottom: 10, resize: "none", boxSizing: "border-box"
        }} />

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>ZONE COLOUR</div>
        <div style={{ display: "flex", gap: 8 }}>
          {COLOURS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 24, height: 24, borderRadius: "50%", background: c, border: color === c ? "3px solid var(--fg)" : "2px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>ASSIGN LOCATIONS</div>
        <div style={{ maxHeight: 150, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          {locations.map(loc => {
            const on = selected.includes(String(loc.id))
            return (
              <label key={loc.id} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "6px 8px", borderRadius: 6, background: on ? "rgba(79,70,229,0.06)" : "transparent"
              }}>
                <input type="checkbox" checked={on} onChange={() => toggle(loc.id)}
                  style={{ accentColor: "#4F46E5" }} />
                <span style={{ fontSize: 13, color: "var(--fg)", fontWeight: on ? 600 : 400 }}>{loc.name}</span>
              </label>
            )
          })}
          {locations.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)" }}>No locations yet — add some first.</div>}
        </div>
      </div>

      {err && <div style={{ color: "#EF4444", fontSize: 12, marginBottom: 8 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid var(--stroke)",
          background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--fg2)"
        }}>
          Cancel
        </button>
        <button onClick={submit} disabled={saving}
          style={{
            flex: 2, padding: "9px 0", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg,#4F46E5,#6366F1)", color: "#fff",
            cursor: "pointer", fontSize: 13, fontWeight: 700
          }}>
          {saving ? "Saving…" : "Save Zone"}
        </button>
      </div>
    </div>
  )
}

export function ZonesPanel({ locations }) {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // null | {} | zone-obj
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { setZones(unwrapResults(await apiRequest("/time/zones/")) || []) }
    catch { setZones([]) }
    finally { setLoading(false) }
  }

  const handleSave = (saved) => {
    setZones(prev => {
      const idx = prev.findIndex(z => z.id === saved.id)
      return idx >= 0 ? prev.map(z => z.id === saved.id ? saved : z) : [saved, ...prev]
    })
    setShowForm(false); setEditing(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this zone?")) return
    try {
      await apiRequest(`/time/zones/${id}/`, { method: "DELETE" })
      setZones(prev => prev.filter(z => z.id !== id))
    } catch { alert("Failed to delete zone") }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--stroke)",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "var(--fg)" }}>Location Zones</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Group locations into named zones</div>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 14px",
            borderRadius: 8, border: "none", background: "#4F46E5", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>
          <Plus size={14} /> New Zone
        </button>
      </div>

      {/* Zone list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>Loading…</div>
        ) : zones.length === 0 && !showForm ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Layers size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>No zones yet</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Create a zone to group related locations.</div>
          </div>
        ) : zones.length === 0 && showForm ? (
          // Empty hint while the create form is open below
          <div style={{ padding: "18px 4px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>
              Fill in the form below to create your first zone.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {zones.map(zone => (
              <div key={zone.id} style={{
                borderRadius: 12, border: "1px solid var(--stroke)",
                background: "var(--surface)", overflow: "hidden"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: zone.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--fg)" }}>{zone.name}</div>
                    {zone.description && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{zone.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                      {zone.location_count} location{zone.location_count !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <button onClick={() => { setEditing(zone); setShowForm(true) }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 4 }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(zone.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#EF4444", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline form */}
      {showForm && (
        <ZoneForm
          zone={editing}
          locations={locations}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
