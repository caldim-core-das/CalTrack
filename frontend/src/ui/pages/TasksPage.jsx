import { useEffect, useRef, useState } from "react"
import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { Pill } from "../components/kit.jsx"
import { ClipboardList, Clock, CheckCircle2, AlertCircle, MapPin, Calendar as CalIcon, Play, Save, Trash2, Tag, Loader2, Paperclip, User, Flag, ListChecks, Plus, X, Building2, Camera } from "lucide-react"
import { SelfieCapture, getPosition } from "./TimePage.jsx"

// ─── Constants & Helpers ─────────────────────────────────────
const CATEGORIES = [
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "carpenter", label: "Carpenter" },
  { value: "hvac", label: "HVAC" },
  { value: "maintenance", label: "Maintenance" },
  { value: "inspection", label: "Inspection" },
  { value: "cleaning", label: "Cleaning" },
  { value: "installation", label: "Installation" },
  { value: "repair", label: "Repair" },
  { value: "other", label: "Other" },
]

const PRIORITIES = [
  { value: "low", label: "Low", color: "#6B7280" },
  { value: "medium", label: "Medium", color: "#2563EB" },
  { value: "high", label: "High", color: "#D97706" },
  { value: "urgent", label: "Urgent", color: "#DC2626" },
]

const STATUS_FILTERS = ["all", "pending", "in_progress", "completed", "cancelled"]

function categoryLabel(val) { return CATEGORIES.find(c => c.value === val)?.label ?? val }
function statusTone(s) { return s === "completed" ? "good" : s === "in_progress" ? "warn" : s === "cancelled" ? "bad" : "neutral" }
function statusLabel(s) { return { pending: "Pending", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" }[s] ?? s }
function priorityColor(p) { return PRIORITIES.find(x => x.value === p)?.color ?? "#6B7280" }

const EMPTY_FORM = {
  title: "", description: "", category: "other", priority: "medium",
  status: "pending",
  assigned_to: "", due_date: new Date().toISOString().slice(0, 10),
  estimated_hours: "1", location: "", job_site: "", admin_notes: "",
  job_address: "", client_name: "", geofence_radius: "",
  location_lat: "", location_lon: "",
  require_selfie: false, require_before_after_photos: false
}

// ─── Task Card (Employee) ────────────────────────────────────
function useElapsed(clockInStr) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!clockInStr) { setElapsed(0); return }
    const start = new Date(clockInStr).getTime()
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [clockInStr])
  return elapsed
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "00:00:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
}

function TaskCard({ task, onAction, busy }) {
  const [note, setNote] = useState(task.employee_notes || "")
  const [expanded, setExpanded] = useState(false)

  // Start flow state
  const [startFlow, setStartFlow] = useState(false)
  const [showSelfie, setShowSelfie] = useState(false)
  const [selfieFile, setSelfieFile] = useState(null)
  const [gpsStatus, setGpsStatus] = useState("")

  // Complete flow state
  const [afterPhoto, setAfterPhoto] = useState(null)

  const elapsed = useElapsed(task.started_at)
  const liveHours = task.status === "in_progress" && elapsed > 0 ? formatDuration(elapsed) : null

  async function beginStartFlow() {
    if (task.require_selfie) {
      setShowSelfie(true)
    } else {
      executeStartFlow(null)
    }
  }

  async function executeStartFlow(photoFile) {
    setShowSelfie(false)
    setStartFlow(true)
    setGpsStatus("Acquiring GPS...")
    try {
      const pos = await getPosition()
      setGpsStatus("GPS locked!")

      const payload = {
        lat: pos.lat,
        lon: pos.lon,
        require_fd: true
      }
      if (photoFile) payload.photo = photoFile

      await onAction(task.id, "start", payload)
    } catch (e) {
      setGpsStatus("GPS failed: " + e.message)
      alert("GPS failed. You must allow location to start the task.")
    } finally {
      setStartFlow(false)
    }
  }

  function handleAfterPhotoChange(e) {
    if (e.target.files && e.target.files[0]) {
      setAfterPhoto(e.target.files[0])
    }
  }

  function handleComplete() {
    if (task.require_before_after_photos && !afterPhoto) {
      alert("An after photo is required to complete this task."); return;
    }
    const payload = { notes: note, require_fd: true }
    if (afterPhoto) payload.photo = afterPhoto
    onAction(task.id, "complete", payload)
  }

  return (
    <div className="tsk-card">
      <div className="tsk-card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tsk-badge tsk-badge-cat"><Tag size={12} /> {categoryLabel(task.category)}</span>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: priorityColor(task.priority), display: "block" }} title={task.priority} />
        </div>
        <Pill tone={statusTone(task.status)}>
          {task.status === "in_progress" ? (liveHours ? `🟢 ${liveHours}` : "In Progress") : statusLabel(task.status)}
        </Pill>
      </div>

      <div>
        <div className="tsk-card-title">{task.title}</div>
        {task.description && (
          <div className="tsk-card-desc" style={{ marginTop: 8, maxHeight: expanded ? "none" : "2.8em", overflow: "hidden" }}>
            {task.description}
          </div>
        )}
        {task.description && task.description.length > 100 && (
          <button style={{ color: "#6366F1", fontSize: 12, fontWeight: 600, background: "none", border: "none", padding: 0, marginTop: 4, cursor: "pointer" }} onClick={() => setExpanded(v => !v)}>
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      <div className="tsk-card-meta">
        {task.job_site_name ? (
          <div className="tsk-card-meta-item"><Building2 size={13} /> {task.job_site_name}</div>
        ) : task.job_address ? (
          <div className="tsk-card-meta-item"><MapPin size={13} /> {task.job_address}</div>
        ) : task.location && (
          <div className="tsk-card-meta-item"><MapPin size={13} /> {task.location}</div>
        )}
        <div className="tsk-card-meta-item"><CalIcon size={13} /> {task.due_date}</div>
        <div className="tsk-card-meta-item"><Clock size={13} /> {task.estimated_hours}h est.</div>
        {task.actual_hours > 0 && <div className="tsk-card-meta-item"><CheckCircle2 size={13} /> {task.actual_hours}h actual</div>}
      </div>
        
      {task.admin_notes && (
        <div style={{ background: "#FEF3C7", color: "#92400E", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
          <strong>Admin note:</strong> {task.admin_notes}
        </div>
      )}

      {showSelfie && (
        <SelfieCapture
          onCancel={() => setShowSelfie(false)}
          onCapture={(file) => executeStartFlow(file)}
        />
      )}

      {task.status !== "completed" && task.status !== "cancelled" && (
        <div style={{ borderTop: "1px solid var(--stroke)", margin: "10px -20px -20px", padding: 20 }}>
          {task.status === "pending" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {gpsStatus && <div style={{ fontSize: 13, color: "var(--accent)" }}>{gpsStatus}</div>}
              <button
                className="tsk-btn tsk-btn-primary"
                disabled={busy || startFlow}
                onClick={beginStartFlow}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {startFlow ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                {startFlow ? "Processing..." : "START TASK & CLOCK IN"}
              </button>
            </div>
          )}
          {task.status === "in_progress" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {task.require_before_after_photos && (
                <div style={{ padding: "10px", background: "var(--surface2)", borderRadius: 8, border: "1px solid var(--stroke)", fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}><Camera size={14} style={{ verticalAlign: "bottom", marginRight: 4 }} /> Requirement: After Photo</div>
                  <input type="file" accept="image/*" onChange={handleAfterPhotoChange} style={{ fontSize: 13 }} />
                </div>
              )}

              <textarea
                className="tsk-input"
                rows={2}
                placeholder="Optional completion notes..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="tsk-btn tsk-btn-outline" style={{ flex: 1, justifyContent: "center" }} disabled={busy} onClick={() => onAction(task.id, "notes", { employee_notes: note })}>
                  <Save size={15} /> Save Note
                </button>
                <button className="tsk-btn tsk-btn-primary" style={{ flex: 1.5, justifyContent: "center", background: "#10B981" }} disabled={busy} onClick={handleComplete}>
                  <CheckCircle2 size={15} /> COMPLETE & CLOCK OUT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── ADMIN: Assign Panel ─────────────────────────────────────
function AssignTaskPanel({ employees, jobSites, onAssigned, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const fileInputRef = useRef(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function geocodeAddress() {
    if (!form.job_address) return;
    try {
      setBusy(true);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.job_address)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        set("location_lat", parseFloat(data[0].lat).toFixed(6));
        set("location_lon", parseFloat(data[0].lon).toFixed(6));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function addFiles(list) {
    const next = [...files, ...Array.from(list || [])]
    const uniq = []
    const seen = new Set()
    for (const f of next) {
      const key = `${f.name}:${f.size}:${f.lastModified}`
      if (seen.has(key)) continue
      seen.add(key)
      uniq.push(f)
    }
    setFiles(uniq)
  }

  function removeFile(idx) {
    setFiles(xs => xs.filter((_, i) => i !== idx))
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.assigned_to) return setErr("Please select an employee.")
    if (!form.title.trim()) return setErr("Title is required.")
    setBusy(true); setErr("")
    try {
      const payload = { ...form, estimated_hours: parseFloat(form.estimated_hours) || 1 }
      if (!payload.location_lat) delete payload.location_lat
      if (!payload.location_lon) delete payload.location_lon
      if (!payload.geofence_radius) delete payload.geofence_radius
      if (!payload.job_site) delete payload.job_site

      const created = await apiRequest("/tasks/admin/", {
        method: "POST",
        json: payload,
      })
      if (files.length) {
        const fd = new FormData()
        for (const f of files) fd.append("files", f)
        await apiRequest(`/tasks/admin/${created.id}/attachments/`, { method: "POST", body: fd })
      }
      setForm(EMPTY_FORM)
      setFiles([])
      setShowMore(false)
      await onAssigned?.()
      onClose?.()
    } catch (ex) {
      setErr(ex?.body?.detail || "Failed to assign task.")
    } finally { setBusy(false) }
  }

  return (
    <div className="tsk-panel">
      <form className="tsk-assign-body" onSubmit={submit}>
        <div className="tsk-assign-meta">General</div>
        <input className="tsk-assign-title" value={form.title} onChange={e => set("title", e.target.value)} placeholder="Untitled" />

        {err && <div style={{ color: "#DC2626", fontSize: 13, fontWeight: 600 }}><AlertCircle size={14} style={{ verticalAlign: "middle", marginRight: 4 }} /> {err}</div>}

        <div className="tsk-props">
          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><User size={14} /> Assign To</div>
            <div className="tsk-prop-right">
              <select className="tsk-input tsk-select" value={form.assigned_to} onChange={e => set("assigned_to", e.target.value)} required>
                <option value="">— Select employee —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.user?.id}>{emp.user?.first_name || emp.user?.username} {emp.user?.last_name || ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><Building2 size={14} /> Job Site</div>
            <div className="tsk-prop-right">
              <select className="tsk-input tsk-select" value={form.job_site} onChange={e => set("job_site", e.target.value)}>
                <option value="">— No specified site —</option>
                {jobSites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><Tag size={14} /> Label</div>
            <div className="tsk-prop-right">
              <select className="tsk-input tsk-select" value={form.category} onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><CalIcon size={14} /> Due Date</div>
            <div className="tsk-prop-right">
              <input className="tsk-input" type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>

          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><Flag size={14} /> Priority</div>
            <div className="tsk-prop-right">
              <select className="tsk-input tsk-select" value={form.priority} onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="tsk-prop-row">
            <div className="tsk-prop-left"><ListChecks size={14} /> Status</div>
            <div className="tsk-prop-right">
              <select className="tsk-input tsk-select" value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUS_FILTERS.filter(x => x !== "all").map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button type="button" className="tsk-prop-more" onClick={() => setShowMore(v => !v)}>
          + Add more properties
        </button>

        {showMore && (
          <div className="tsk-props" style={{ marginTop: 0 }}>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><Clock size={14} /> Est. Hours</div>
              <div className="tsk-prop-right">
                <input className="tsk-input" type="number" min="0.5" step="0.5" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} />
              </div>
            </div>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><Building2 size={14} /> Client Name</div>
              <div className="tsk-prop-right">
                <input className="tsk-input" value={form.client_name} onChange={e => set("client_name", e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><MapPin size={14} /> Job Address</div>
              <div className="tsk-prop-right" style={{ display: "flex", gap: 8 }}>
                <input className="tsk-input" style={{ flex: 1 }} value={form.job_address} onChange={e => set("job_address", e.target.value)} onBlur={geocodeAddress} placeholder="Street Address" />
              </div>
            </div>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><MapPin size={14} /> GPS Loc.</div>
              <div className="tsk-prop-right" style={{ display: "flex", gap: 8 }}>
                <input className="tsk-input" style={{ flex: 1 }} type="number" step="any" value={form.location_lat} onChange={e => set("location_lat", e.target.value)} placeholder="Lat" />
                <input className="tsk-input" style={{ flex: 1 }} type="number" step="any" value={form.location_lon} onChange={e => set("location_lon", e.target.value)} placeholder="Lon" />
              </div>
            </div>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><Activity size={14} /> GPS Radius</div>
              <div className="tsk-prop-right">
                <input className="tsk-input" type="number" value={form.geofence_radius} onChange={e => set("geofence_radius", e.target.value)} placeholder="Default 200m" />
              </div>
            </div>
            <div className="tsk-prop-row">
              <div className="tsk-prop-left"><Camera size={14} /> Security</div>
              <div className="tsk-prop-right" style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.require_selfie} onChange={e => set("require_selfie", e.target.checked)} /> Require Selfie
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.require_before_after_photos} onChange={e => set("require_before_after_photos", e.target.checked)} /> Before/After Photos
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="tsk-form-divider" />

        <div className="tsk-section-title">ATTACHMENTS</div>
        <div
          className={`tsk-dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        >
          <div className="tsk-dropzone-inner">
            <div className="tsk-dropzone-label">Drag & drop your files here</div>
            <div className="tsk-dropzone-or">OR</div>
            <button type="button" className="tsk-btn tsk-btn-outline" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={15} /> Browse files
            </button>
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>

        {files.length > 0 && (
          <div className="tsk-file-list">
            {files.map((f, idx) => (
              <div key={`${f.name}:${f.size}:${f.lastModified}`} className="tsk-file-item">
                <div className="tsk-file-name">{f.name}</div>
                <button type="button" className="tsk-file-remove" onClick={() => removeFile(idx)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="tsk-form-divider" />

        <div className="tsk-section-title">DESCRIPTION</div>
        <textarea className="tsk-input" rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Add a more detailed description..." />

        <input className="tsk-input" value={form.admin_notes} onChange={e => set("admin_notes", e.target.value)} placeholder="Add a comment..." />

        <button type="submit" className="tsk-btn tsk-btn-primary tsk-save-btn" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save
        </button>
      </form>
    </div>
  )
}

// ─── ADMIN: All Tasks Table ──────────────────────────────────
function AdminTasksTable({ tasks, employees, jobSites, onRefresh }) {
  const [busy, setBusy] = useState(false)

  async function deleteTask(id) {
    if (!window.confirm("Delete this task?")) return
    setBusy(true)
    try { await apiRequest(`/tasks/admin/${id}/`, { method: "DELETE" }); onRefresh() }
    catch { /* ignore */ }
    finally { setBusy(false) }
  }

  function getEmp(id) { return employees.find((x) => x.user?.id === id) }

  return (
    <div className="tsk-table-wrap">
      <table className="tsk-table">
        <thead>
          <tr>
            <th>Task Details</th>
            <th>Assigned To</th>
            <th>Due Date</th>
            <th>Status</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: 40 }}>No tasks actively assigned.</td></tr>}
          {tasks.map(t => {
            const emp = getEmp(t.assigned_to)
            return (
              <tr key={t.id} className="tsk-row">
                <td>
                  <div className="tsk-table-title">{t.title}</div>
                  <div className="tsk-table-sub">
                    <span style={{ color: priorityColor(t.priority) }}>● {t.priority}</span> · {categoryLabel(t.category)} {t.job_site_name ? `· 🏢 ${t.job_site_name}` : (t.job_address && `· 📍 ${t.job_address}`)}
                  </div>
                  {(t.require_selfie || t.require_before_after_photos) && (
                    <div className="tsk-table-sub" style={{ color: "var(--primary)", marginTop: 4 }}>
                      <Camera size={11} style={{ verticalAlign: "middle", marginRight: 3 }} />
                      {t.require_selfie && "Selfie "}
                      {t.require_selfie && t.require_before_after_photos && "· "}
                      {t.require_before_after_photos && "Before/After"} required
                    </div>
                  )}
                </td>
                <td>
                  {emp && emp.user ? (
                    <div className="tsk-avatar-wrap">
                      <div className="tsk-avatar">{(emp.user.first_name || emp.user.username || "?").charAt(0).toUpperCase()}</div>
                      <div style={{ fontWeight: 600 }}>{emp.user.first_name || emp.user.username} {emp.user.last_name || ""}</div>
                    </div>
                  ) : <span className="muted">Unassigned</span>}
                </td>
                <td style={{ fontWeight: 500 }}>{t.due_date}</td>
                <td><Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill></td>
                <td style={{ textAlign: "right" }}>
                  <button style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: 8 }} onClick={() => deleteTask(t.id)} disabled={busy} title="Delete">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── ADMIN LAYOUT ────────────────────────────────────────────
function AdminTasksPage({ tasks, employees, jobSites, loadTasks }) {
  const [open, setOpen] = useState(false)
  const modalRef = useRef(null)
  const [pos, setPos] = useState({ x: 24, y: 88 })
  const dragRef = useRef({ dragging: false, dx: 0, dy: 0 })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const w = window.innerWidth || 0
    const h = window.innerHeight || 0
    const rect = modalRef.current?.getBoundingClientRect()
    const mw = rect?.width || 880
    const mh = rect?.height || 520
    setPos({
      x: Math.max(16, Math.round((w - mw) / 2)),
      y: Math.max(16, Math.round((h - mh) / 6)),
    })
  }, [open])

  function startDrag(e) {
    if (!open) return
    dragRef.current.dragging = true
    dragRef.current.dx = e.clientX - pos.x
    dragRef.current.dy = e.clientY - pos.y
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function moveDrag(e) {
    if (!dragRef.current.dragging) return
    const rect = modalRef.current?.getBoundingClientRect()
    const mw = rect?.width || 880
    const mh = rect?.height || 520
    const w = window.innerWidth || 0
    const h = window.innerHeight || 0
    const x = e.clientX - dragRef.current.dx
    const y = e.clientY - dragRef.current.dy
    setPos({
      x: Math.min(Math.max(16, x), Math.max(16, w - mw - 16)),
      y: Math.min(Math.max(16, y), Math.max(16, h - mh - 16)),
    })
  }

  function endDrag() {
    dragRef.current.dragging = false
  }

  return (
    <>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}
        >
          <div
            ref={modalRef}
            style={{ position: "absolute", left: pos.x, top: pos.y, width: "min(880px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)", overflow: "auto", background: "var(--surface)", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px var(--stroke)", pointerEvents: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px", borderBottom: "1px solid var(--stroke)" }}>
              <div
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{ display: "flex", flexDirection: "column", flex: 1, cursor: "grab", userSelect: "none" }}
              >
                <div style={{ fontSize: 16, fontWeight: 800 }}>Add Task</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600 }}>Fill the details and save to push into the task queue.</div>
              </div>
              <button type="button" className="tsk-btn tsk-btn-outline" onClick={() => setOpen(false)} aria-label="Close">
                <X size={16} /> Close
              </button>
            </div>

            <div style={{ padding: 14 }}>
              <AssignTaskPanel employees={employees} jobSites={jobSites} onAssigned={loadTasks} onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Task Queue</h2>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{tasks.length} Total</span>
          </div>

          <button type="button" className="tsk-btn tsk-btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add Task
          </button>
        </div>

        <AdminTasksTable tasks={tasks} employees={employees} jobSites={jobSites} onRefresh={loadTasks} />
      </div>
    </>
  )
}

// ─── EMPLOYEE LAYOUT ─────────────────────────────────────────
function EmployeeTasksPage({ tasks, handleAction, busy }) {
  const [filter, setFilter] = useState("all")
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter)

  return (
    <>
      <div className="tsk-filters">
        {STATUS_FILTERS.map(f => (
          <button key={f} className={`tsk-filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All Tasks" : statusLabel(f)}
            {f !== "all" && <span className="tsk-count">{tasks.filter(t => t.status === f).length}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 20px", background: "var(--surface)", border: "1px dashed var(--stroke)", borderRadius: 16 }}>
          <ClipboardList size={48} color="var(--stroke2)" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 700 }}>No tasks found</div>
          <div style={{ color: "var(--muted)", marginTop: 8 }}>You're all caught up for now!</div>
        </div>
      ) : (
        <div className="tsk-kanban">
          {filtered.map(t => <TaskCard key={t.id} task={t} onAction={handleAction} busy={busy} />)}
        </div>
      )}
    </>
  )
}

// ─── MAIN ROUTER PAGE ────────────────────────────────────────
export function TasksPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"

  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [jobSites, setJobSites] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function loadTasks() {
    setLoading(true); setError("")
    try {
      const url = isAdmin ? "/tasks/admin/" : "/tasks/my/"
      const data = await apiRequest(url)
      setTasks(Array.isArray(data) ? data : unwrapResults(data))
    } catch (e) { setError(e?.body?.detail || "Failed to load tasks.") }
    finally { setLoading(false) }
  }

  async function loadEmployees() {
    if (!isAdmin) return
    try {
      const data = await apiRequest("/employees/")
      setEmployees(Array.isArray(data) ? data : unwrapResults(data))
    } catch { /* ignore */ }
  }

  async function loadSites() {
    if (!isAdmin) return
    try {
      const data = await apiRequest("/time/sites/")
      setJobSites(Array.isArray(data) ? data : unwrapResults(data))
    } catch { /* ignore */ }
  }

  useEffect(() => { loadTasks(); loadEmployees(); loadSites(); }, [])

  async function handleAction(taskId, action, body = {}) {
    setBusy(true)
    try {
      if (body.require_fd) {
        const fd = new FormData()
        Object.keys(body).forEach(k => {
          if (k !== 'require_fd' && body[k] !== undefined && body[k] !== null) {
            fd.append(k, body[k])
          }
        })
        await apiRequest(`/tasks/my/${taskId}/${action}/`, {
          method: "POST", // using POST because of FormData implementation
          body: fd,
        })
      } else {
        await apiRequest(`/tasks/my/${taskId}/${action}/`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        })
      }
      await loadTasks()
    } catch (e) { setError(e?.body?.detail || e.message || "Action failed.") }
    finally { setBusy(false) }
  }

  return (
    <div className="tsk-layout">
      <div className="tsk-header">
        <div className="tsk-title-group">
          <h1>Tasks & Work Orders</h1>
          <p>{isAdmin ? "Dispatch and monitor work activity across all employees." : "Your personal task feed and execution queue."}</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", color: "#B91C1C", padding: "16px", borderRadius: "12px", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 80, color: "var(--muted)", gap: 10 }}>
          <Loader2 className="spin" size={24} /> Syncing tasks...
        </div>
      ) : isAdmin ? (
        <AdminTasksPage tasks={tasks} employees={employees} jobSites={jobSites} loadTasks={loadTasks} />
      ) : (
        <EmployeeTasksPage tasks={tasks} handleAction={handleAction} busy={busy} />
      )}
    </div>
  )
}
