import React, { useEffect, useRef, useState, memo, useMemo } from "react"
import { createPortal } from "react-dom"
import { useNavigate } from "react-router-dom"
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

/* ── Fix default Leaflet icons ────────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})
import { apiRequest, unwrapResults } from "../../api/client.js"
import { useAuth } from "../../state/auth/useAuth.js"
import { useRole } from "../../state/auth/useRole.js"
import { Pill, Button, Card, Input, Select, TextArea } from "../components/kit.jsx"
import { ClipboardList, Clock, CheckCircle2, AlertCircle, MapPin, Calendar as CalIcon, Play, Save, Trash2, Tag, Loader2, Paperclip, User, Flag, ListChecks, Plus, X, Building2, Camera, ThumbsUp, ThumbsDown, RefreshCw, UserCheck, AlertTriangle, DollarSign, Battery, Wifi, ShieldAlert, Sparkles, Navigation, Upload, Activity, Search, ChevronRight, ChevronDown, Phone, Car, Wrench, MessageSquare, Compass, MoreHorizontal, Hammer, ChevronLeft } from "lucide-react"
import { SelfieCapture, getPosition } from "./TimePage.jsx"
import { verifyFaces } from "../../utils/faceVerify.js"

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
  { value: "low", label: "Low", color: "bg-slate-500" },
  { value: "medium", label: "Medium", color: "bg-blue-600" },
  { value: "high", label: "High", color: "bg-amber-600" },
  { value: "urgent", label: "Urgent", color: "bg-rose-600" },
]

const STATUS_FILTERS = ["all", "pending", "in_progress", "suspended", "completed", "cancelled"]

const PAUSE_REASONS = [
  { value: "spare_part", label: "Spare Part Unavailable" },
  { value: "customer_absent", label: "Customer Absent" },
  { value: "approval_pending", label: "Approval Pending" },
  { value: "technical", label: "Technical Dependency" },
  { value: "other", label: "Other" },
]

function categoryLabel(val) { return CATEGORIES.find(c => c.value === val)?.label ?? val }
function statusTone(s) { return s === "completed" ? "good" : s === "in_progress" ? "warn" : s === "suspended" ? "warn" : s === "cancelled" ? "bad" : "neutral" }
function statusLabel(s) { return { pending: "Pending", in_progress: "In Progress", suspended: "Suspended", completed: "Completed", cancelled: "Cancelled" }[s] ?? s }
function priorityColorClass(p) { return PRIORITIES.find(x => x.value === p)?.color ?? "bg-slate-500" }

function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return null;
  const R = 6371000; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in m
  return Math.round(d);
}

// Acceptance status helpers
function acceptanceTone(s) {
  return s === "accepted" ? "good" : s === "declined" ? "bad" : "neutral"
}
function acceptanceLabel(s) {
  return { pending_acceptance: "Pending Acceptance", accepted: "Accepted", declined: "Declined" }[s] ?? s
}

// SLA badge helper
function SlaBadge({ slaStatus, slaMinutes }) {
  if (!slaStatus || slaStatus === "none") return null
  const cfg = {
    safe: { bg: "#dcfce7", color: "#166534", border: "#86efac", label: "SLA OK" },
    caution: { bg: "#fefce8", color: "#854d0e", border: "#fde047", label: null },
    warning: { bg: "#fff7ed", color: "#9a3412", border: "#fdba74", label: null },
    breach: { bg: "#fef2f2", color: "#7f1d1d", border: "#fca5a5", label: "SLA BREACH" },
  }[slaStatus] || { bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", label: null }
  const minsLabel = slaMinutes !== null && slaMinutes !== undefined
    ? (slaMinutes < 0 ? `${Math.abs(Math.round(slaMinutes))}m overdue` : slaMinutes < 60 ? `${Math.round(slaMinutes)}m left` : `${(slaMinutes / 60).toFixed(1)}h left`)
    : ""
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 20, fontSize: 9, fontWeight: 900,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      letterSpacing: "0.06em", textTransform: "uppercase",
    }}>
      ⏱ {cfg.label || minsLabel}
    </span>
  )
}

const EMPTY_FORM = {
  title: "", description: "", category: "other", priority: "medium",
  status: "pending",
  assigned_to: "", due_date: new Date().toISOString().slice(0, 10),
  estimated_hours: "1", location: "", job_site: "", admin_notes: "",
  job_address: "", client_name: "", geofence_radius: "200",
  location_lat: "", location_lon: "",
  require_selfie: false, require_before_after_photos: false,
  sla_deadline: "",
  client_company_name: "", client_contact_number: "", client_alternate_number: "", client_email: "",
  subcategory: "", service_type: "", required_tools: "", required_spare_parts: "",
  landmark: "", area: "", city: "", state: "", pincode: "",
}

// ─── Modal Leaflet Map Helper ─────────────────────────────
function ModalMapController({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, 12)
      map.invalidateSize()
    }
  }, [center, map])

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [map])

  return null
}

// ─── RedBus-style Live Tracking Modal ───────────────────────
function LiveTrackingMapController({ empPos, clientPos }) {
  const map = useMap()
  useEffect(() => {
    if (!empPos || !clientPos) return
    const bounds = L.latLngBounds([empPos, clientPos])
    map.fitBounds(bounds, { padding: [60, 60], animate: true, duration: 0.8 })
  }, [empPos?.lat, empPos?.lon, clientPos?.lat, clientPos?.lon, map])
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 400)
    return () => clearTimeout(t)
  }, [map])
  return null
}

function LiveTrackingModal({ task, empPos, onClose }) {
  const clientLat = parseFloat(task.location_lat)
  const clientLon = parseFloat(task.location_lon)
  const hasClient = !isNaN(clientLat) && !isNaN(clientLon)
  const hasEmp = empPos && !isNaN(empPos.lat) && !isNaN(empPos.lon)

  // Live distance & ETA
  const dist = hasEmp && hasClient ? getDistance(empPos.lat, empPos.lon, clientLat, clientLon) : null
  const etaMin = dist !== null ? Math.max(1, Math.round(dist / 1000 / 30 * 60)) : null

  // Default center: midpoint between employee and client, or client
  const center = hasEmp && hasClient
    ? [(empPos.lat + clientLat) / 2, (empPos.lon + clientLon) / 2]
    : hasClient ? [clientLat, clientLon] : [12.7419, 77.8238] // Samathuvapuram Bus Stand, Hosur

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "#0f172a",
      display: "flex", flexDirection: "column",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* ── Top Status Bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(15,23,42,0.0) 100%)",
        padding: "16px 20px 40px",
        pointerEvents: "none",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "auto" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                background: "#22c55e",
                boxShadow: "0 0 0 3px rgba(34,197,94,0.3), 0 0 12px rgba(34,197,94,0.6)",
                animation: "pulse 1.5s infinite",
              }} />
              <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>Live Tracking</span>
            </div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 900, letterSpacing: "-0.01em", lineHeight: 1.3, maxWidth: 240 }}>
              {task.title}
            </div>
            {task.client_name && (
              <div style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, marginTop: 2 }}>📍 {task.client_name}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              border: "1.5px solid rgba(255,255,255,0.2)",
              color: "#fff", fontSize: 18, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >✕</button>
        </div>
      </div>

      {/* ── Full Map ── */}
      <div style={{ flex: 1, position: "relative" }}>
        {hasClient ? (
          <MapContainer
            center={center}
            zoom={14}
            style={{ width: "100%", height: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />

            <LiveTrackingMapController
              empPos={hasEmp ? empPos : null}
              clientPos={hasClient ? { lat: clientLat, lon: clientLon } : null}
            />

            {/* ── Client Destination Pin ── */}
            <Marker
              position={[clientLat, clientLon]}
              icon={L.divIcon({
                className: "",
                html: `<div style="display:flex;flex-direction:column;align-items:center;">
                  <div style="
                    position:relative;
                    width:48px;height:48px;
                    border-radius:50% 50% 50% 0;
                    transform:rotate(-45deg);
                    background:linear-gradient(135deg,#e94560,#ff6b6b);
                    border:3px solid white;
                    box-shadow:0 6px 24px rgba(233,69,96,0.6);
                    display:flex;align-items:center;justify-content:center;
                  ">
                    <div style="transform:rotate(45deg);font-size:20px;">🏢</div>
                  </div>
                  <div style="
                    width:0;height:0;
                    border-left:7px solid transparent;
                    border-right:7px solid transparent;
                    border-top:10px solid #e94560;
                    margin-top:-2px;
                  "></div>
                </div>`,
                iconSize: [64, 72],
                iconAnchor: [32, 72],
              })}
            >
              <Popup>
                <div style={{ fontWeight: 900, fontSize: 13 }}>🎯 {task.title}</div>
                {task.job_address && <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{task.job_address}</div>}
              </Popup>
            </Marker>

            {/* ── Geofence Ring ── */}
            <Circle
              center={[clientLat, clientLon]}
              radius={parseInt(task.geofence_radius) || 200}
              pathOptions={{ color: "#e94560", fillColor: "#e94560", fillOpacity: 0.07, weight: 1.5, dashArray: "6 4" }}
            />

            {/* ── Employee Moving Marker ── */}
            {hasEmp && (
              <>
                <Marker
                  position={[empPos.lat, empPos.lon]}
                  icon={L.divIcon({
                    className: "",
                    html: `<div style="position:relative;">
                      <div style="
                        width:48px;height:48px;border-radius:50%;
                        background:linear-gradient(135deg,#3b82f6,#6366f1);
                        border:3px solid white;
                        box-shadow:0 0 0 6px rgba(59,130,246,0.25), 0 6px 20px rgba(59,130,246,0.5);
                        display:flex;align-items:center;justify-content:center;
                        font-size:20px;
                      ">🔵</div>
                      <div style="
                        position:absolute;inset:-10px;
                        border-radius:50%;
                        border:2px solid rgba(59,130,246,0.4);
                        animation:ripple 2s infinite;
                      "></div>
                    </div>`,
                    iconSize: [48, 48],
                    iconAnchor: [24, 24],
                  })}
                >
                  <Popup>
                    <div style={{ fontWeight: 900, fontSize: 12 }}>📍 Your Location</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>Accuracy: {empPos.accuracy}m</div>
                  </Popup>
                </Marker>

                {/* ── Animated Route Line ── */}
                <Polyline
                  positions={[[empPos.lat, empPos.lon], [clientLat, clientLon]]}
                  pathOptions={{
                    color: "#3b82f6",
                    weight: 4,
                    dashArray: "12 8",
                    opacity: 0.9,
                    lineCap: "round",
                  }}
                />
                {/* Secondary glow line */}
                <Polyline
                  positions={[[empPos.lat, empPos.lon], [clientLat, clientLon]]}
                  pathOptions={{
                    color: "#93c5fd",
                    weight: 8,
                    opacity: 0.15,
                    lineCap: "round",
                  }}
                />
              </>
            )}
          </MapContainer>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#475569", fontSize: 14, fontWeight: 700 }}>
            No client location set for this task.
          </div>
        )}
      </div>

      {/* ── Bottom Info Panel ── */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 1000,
        background: "linear-gradient(0deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.85) 70%, transparent 100%)",
        padding: "40px 20px 24px",
        backdropFilter: "blur(2px)",
      }}>
        {/* Distance & ETA row */}
        {hasEmp && hasClient && dist !== null && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12, marginBottom: 16,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16, padding: "12px 14px",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ color: "#64748b", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Distance</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
                {dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}
              </div>
            </div>
            <div style={{
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 16, padding: "12px 14px",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ color: "#4ade80", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>ETA</div>
              <div style={{ color: "#22c55e", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>~{etaMin} min</div>
            </div>
            <div style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 16, padding: "12px 14px",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ color: "#a5b4fc", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Accuracy</div>
              <div style={{ color: "#818cf8", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{empPos?.accuracy ?? "--"}m</div>
            </div>
          </div>
        )}

        {/* Info row */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16, padding: "12px 16px",
          display: "flex", flexDirection: "column", gap: 8,
          marginBottom: 14,
        }}>
          {task.job_address && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14 }}>📍</span>
              <div>
                <div style={{ color: "#64748b", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em" }}>Destination</div>
                <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>{task.job_address}</div>
              </div>
            </div>
          )}
          {task.client_contact_number && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 14 }}>📞</span>
              <a href={`tel:${task.client_contact_number}`} style={{ color: "#60a5fa", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                {task.client_contact_number}
              </a>
            </div>
          )}
        </div>

        {/* Google Maps button */}
        {hasClient && (
          <a
            href={`https://www.google.com/maps/dir/${hasEmp ? `${empPos.lat},${empPos.lon}/` : ""}${clientLat},${clientLon}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "14px 0",
              background: "linear-gradient(135deg, #3b82f6, #6366f1)",
              color: "#fff", borderRadius: 14,
              fontSize: 13, fontWeight: 900, textDecoration: "none",
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
              letterSpacing: "0.04em",
            }}
          >
            <Navigation size={16} /> Open in Google Maps for Navigation
          </a>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.7} }
        @keyframes ripple { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(2.5);opacity:0} }
      `}</style>
    </div>,
    document.body
  )
}

// ─── Availability Badge ──────────────────────────────────────
const AVAILABILITY_CONFIG = {
  available: { color: "#059669", bg: "#ecfdf5", label: "Available" },
  busy: { color: "#d97706", bg: "#fffbeb", label: "Working" },
  on_break: { color: "#2563eb", bg: "#eff6ff", label: "On Break" },
  on_leave: { color: "#7c3aed", bg: "#f5f3ff", label: "On Leave" },
  offline: { color: "#94a3b8", bg: "#f8fafc", label: "Offline" },
}

function AvailabilityBadge({ status, size = "sm" }) {
  const cfg = AVAILABILITY_CONFIG[status] || AVAILABILITY_CONFIG.offline
  const textSize = size === "xs" ? "9px" : "10px"
  const dotSize = size === "xs" ? 6 : 7
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: size === "xs" ? "2px 6px" : "3px 8px",
      borderRadius: 20,
      backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
    }}>
      <span style={{
        width: dotSize, height: dotSize, borderRadius: "50%",
        backgroundColor: cfg.color,
        flexShrink: 0,
        boxShadow: `0 0 0 2px ${cfg.color}30`,
      }} />
      <span style={{ fontSize: textSize, fontWeight: 800, color: cfg.color, letterSpacing: "0.05em", textTransform: "uppercase" }}>
        {cfg.label}
      </span>
    </span>
  )
}

// ─── Billing Badge ───────────────────────────────────────────
function BillingBadge({ billedHours, actualHours, estimatedHours }) {
  if (!billedHours) return null
  const isShort = parseFloat(estimatedHours) < 1
  if (!isShort) return null
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 10,
      backgroundColor: "#f0fdf4", border: "1px solid #86efac",
      fontSize: 10, fontWeight: 800, color: "#16a34a",
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>
      <DollarSign size={11} />
      Billed: {billedHours}h
      {actualHours > 0 && <span style={{ color: "#4ade80", marginLeft: 2 }}>({actualHours}h actual)</span>}
    </div>
  )
}

// ─── Task Card (Employee) ────────────────────────────────────
// Centralized timer to prevent multiple intervals
let _globalTick = Date.now()
const _timerCallbacks = new Set()
setInterval(() => {
  _globalTick = Date.now()
  _timerCallbacks.forEach(cb => cb(_globalTick))
}, 1000)

function useElapsed(clockInStr) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!clockInStr) return
    const update = (t) => setNow(t)
    _timerCallbacks.add(update)
    return () => _timerCallbacks.delete(update)
  }, [clockInStr])

  if (!clockInStr) return 0
  const start = new Date(clockInStr).getTime()
  return Math.max(0, Math.floor((now - start) / 1000))
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "00:00:00"
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
}

// ─── Attachments Viewer ──────────────────────────────────────
function AttachmentsViewer({ attachments }) {
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "svg"]

  function fileExt(url) {
    return (url || "").split(".").pop().split("?")[0].toLowerCase()
  }
  function isImage(url) { return imageExts.includes(fileExt(url)) }

  const displayLimit = expanded ? attachments.length : 3
  const visible = attachments.slice(0, displayLimit)

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
      }}>
        <Paperclip size={12} style={{ color: "#94a3b8" }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Attachments ({attachments.length})
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {visible.map((att, i) => {
          const url = att.file_url || att.file || att.url || ""
          const name = att.filename || att.file?.split("/").pop() || `File ${i + 1}`
          const img = isImage(url)
          return img ? (
            <button
              key={i}
              onClick={() => setLightboxSrc(url)}
              style={{
                padding: "5px 10px", borderRadius: 10,
                background: "#eff6ff", border: "1px solid #bfdbfe",
                fontSize: 10, fontWeight: 800, color: "#4f46e5",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              }}
            >
              🖼 {name}
            </button>
          ) : (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "5px 10px", borderRadius: 10,
                background: "#f8fafc", border: "1px solid #e2e8f0",
                fontSize: 10, fontWeight: 800, color: "#475569",
                textDecoration: "none", display: "flex", alignItems: "center", gap: 5,
              }}
            >
              📎 {name}
            </a>
          )
        })}
        {attachments.length > 3 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            style={{ padding: "5px 10px", borderRadius: 10, background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: 10, fontWeight: 800, color: "#64748b", cursor: "pointer" }}
          >+{attachments.length - 3} more</button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && createPortal(
        <div
          onClick={() => setLightboxSrc(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 99998,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <img
            src={lightboxSrc}
            alt="Attachment preview"
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)", objectFit: "contain" }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{
              position: "fixed", top: 20, right: 20,
              width: 40, height: 40, borderRadius: 12,
              background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.3)",
              color: "#fff", fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>,
        document.body
      )}
    </div>
  )
}

const SwipeButton = memo(({ onConfirm, text, emoji, colorGradient, shadowColor, disabled }) => {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)

  const handleStart = (clientX) => {
    if (disabled) return
    setIsDragging(true)
  }

  const handleMove = (clientX) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const maxDrag = rect.width - 52
    let currentDrag = clientX - rect.left - 24
    if (currentDrag < 0) currentDrag = 0
    if (currentDrag > maxDrag) currentDrag = maxDrag
    setDragX(currentDrag)
  }

  const handleEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const maxDrag = rect.width - 52
    if (dragX >= maxDrag * 0.85) {
      setDragX(maxDrag)
      onConfirm()
      // Snap back shortly after confirm to reset the state for future renders
      setTimeout(() => {
        setDragX(0)
      }, 800)
    } else {
      setDragX(0)
    }
  }

  useEffect(() => {
    const onMouseMove = (e) => handleMove(e.clientX)
    const onMouseUp = () => handleEnd()
    const onTouchMove = (e) => handleMove(e.touches[0].clientX)
    const onTouchEnd = () => handleEnd()

    if (isDragging) {
      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("mouseup", onMouseUp)
      window.addEventListener("touchmove", onTouchMove, { passive: true })
      window.addEventListener("touchend", onTouchEnd)
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", onTouchEnd)
    }
  }, [isDragging, dragX])

  const maxDrag = containerRef.current ? containerRef.current.getBoundingClientRect().width - 52 : 100
  const progress = maxDrag > 0 ? (dragX / maxDrag) * 100 : 0

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onMouseDown={(e) => handleStart(e.clientX)}
      className="relative w-full h-[52px] rounded-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center select-none overflow-hidden mt-3 shadow-inner"
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Background slide progress fill */}
      <div
        className="absolute left-0 top-0 bottom-0 rounded-full"
        style={{
          width: `calc(${progress}% + 44px)`,
          background: colorGradient,
          transition: isDragging ? "none" : "width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          opacity: 0.1,
        }}
      />

      {/* Slide text */}
      <span
        className="text-[10px] font-black uppercase tracking-[0.15em] pointer-events-none select-none z-10 flex items-center gap-1.5 transition-opacity"
        style={{
          color: "var(--fg2)",
          opacity: Math.max(0.15, 1 - (progress / 100) * 1.5),
        }}
      >
        <span>👉</span> {text}
      </span>

      {/* Slider Knob */}
      <div
        className="absolute rounded-full flex items-center justify-center text-base select-none text-white z-20"
        style={{
          left: 4 + dragX,
          top: 4,
          bottom: 4,
          width: 44,
          height: 44,
          background: colorGradient,
          boxShadow: `0 4px 14px ${shadowColor}`,
          transition: isDragging ? "none" : "left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          cursor: "grab",
        }}
      >
        {emoji}
      </div>
    </div>
  )
})

const TaskCard = memo(({ task, onAction, busy, tasks }) => {
  const navigate = useNavigate()
  const [note, setNote] = useState(task.employee_notes || "")
  const [expanded, setExpanded] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState("")
  const [localBusy, setLocalBusy] = useState(false)

  const [beforePhoto, setBeforePhoto] = useState(null)
  const [beforePhotoPreview, setBeforePhotoPreview] = useState(null)
  const [startNotes, setStartNotes] = useState("")
  const [precGPS, setPrecGPS] = useState(null)
  const [acquiringGps, setAcquiringGps] = useState(false)
  const [gpsError, setGpsError] = useState("")
  const [gpsLocked, setGpsLocked] = useState(false)
  const [showSelfieCamera, setShowSelfieCamera] = useState(false)
  const [showLiveTracking, setShowLiveTracking] = useState(false)
  const watchIdRef = useRef(null)
  const wsRef = useRef(null)

  function triggerGpsAcquisition() {
    startContinuousTracking();
  }

  function startContinuousTracking() {
    if (watchIdRef.current) return;

    setAcquiringGps(true)
    setGpsError("")

    // Connect to employee tracking WebSocket
    const WS_BASE =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_BASE_URL) ||
      "ws://localhost:8000"

    try {
      const ws = new WebSocket(`${WS_BASE}/ws/live/employee/`)
      wsRef.current = ws
      ws.onopen = () => {
        console.log("[LiveTracking] Traveling WebSocket connection established.");
      }
      ws.onerror = (e) => {
        console.warn("[LiveTracking] Traveling WebSocket error:", e);
      }
      ws.onclose = () => {
        console.log("[LiveTracking] Traveling WebSocket closed.");
      }
    } catch (err) {
      console.warn("[LiveTracking] Failed to connect traveling WebSocket:", err);
    }

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy);

          setPrecGPS({ lat, lon, accuracy });
          setGpsLocked(true);
          setAcquiringGps(false);

          // Prepare geolocation ping payload
          const payload = {
            type: "location_ping",
            lat: lat,
            lng: lon,
            accuracy: accuracy
          };

          // Send via WebSocket if open, else fallback to REST API
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(payload));
            console.log("[LiveTracking] Successfully reported travel ping to WebSocket:", lat, lon);
          } else {
            try {
              await apiRequest("/live-locations/update/", {
                method: "POST",
                json: { lat, lng: lon }
              });
              console.log("[LiveTracking] Successfully reported travel ping to REST fallback:", lat, lon);
            } catch (err) {
              console.warn("[LiveTracking] Location update REST fallback failed:", err);
            }
          }
        },
        (err) => {
          setGpsError("Failed to lock GPS. Please enable location services.");
          setAcquiringGps(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 25000
        }
      );
    } else {
      setGpsError("Geolocation is not supported by your browser.");
      setAcquiringGps(false);
    }
  }

  function stopContinuousTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log("[LiveTracking] Stopped continuous watchPosition.");
    }
    if (wsRef.current !== null) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onopen = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        try {
          wsRef.current.close(1000);
        } catch (e) {
          // ignore
        }
      }
      wsRef.current = null;
      console.log("[LiveTracking] Closed traveling WebSocket.");
    }
  }

  useEffect(() => {
    if (task.acceptance_status === "accepted" && (task.status === "pending" || task.status === "in_progress")) {
      startContinuousTracking()
    }
    return () => {
      stopContinuousTracking()
    }
  }, [task.acceptance_status, task.status])

  async function triggerStartWork() {
    if (!beforePhoto) {
      alert("Please upload or capture a Before Photo.");
      return;
    }
    if (!startNotes.trim()) {
      alert("Please enter work notes.");
      return;
    }
    if (!precGPS) {
      alert("Please lock GPS coordinates first.");
      return;
    }

    setLocalBusy(true)
    try {
      await onAction(task.id, "start", {
        require_fd: true,
        photo: beforePhoto,
        notes: startNotes,
        lat: precGPS.lat,
        lon: precGPS.lon
      })
    } catch (err) {
      alert(err.message || "Failed to start work.")
    } finally {
      setLocalBusy(false)
    }
  }

  function handleBeforePhotoCapture(file, previewUrl) {
    setBeforePhoto(file)
    setBeforePhotoPreview(previewUrl)
    setShowSelfieCamera(false)
  }

  function handleBeforePhotoFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setBeforePhoto(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        setBeforePhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Detail toggle for accepted task journey progress view
  const [showJourneyDetails, setShowJourneyDetails] = useState(!!task.travel_status)

  useEffect(() => {
    setShowJourneyDetails(!!task.travel_status)
  }, [task.id, task.travel_status])

  // Suspension & Gap Job state
  const [suspending, setSuspending] = useState(false)
  const [suspendReasonCategory, setSuspendReasonCategory] = useState("spare_part")
  const [suspendReason, setSuspendReason] = useState("")
  const [suspendDuration, setSuspendDuration] = useState("1h")
  const [customDeadline, setCustomDeadline] = useState("")
  const [suspendSlaBlock, setSuspendSlaBlock] = useState(null) // non-null = sla blocker message

  const [showingGapJobs, setShowingGapJobs] = useState(false)
  const [gapJobs, setGapJobs] = useState([])
  const [fetchingGapJobs, setFetchingGapJobs] = useState(false)
  const [radiusKm, setRadiusKm] = useState(0.5)
  const [gpsAccuracy, setGpsAccuracy] = useState(null)

  // Completion percentage slider
  const [completionPct, setCompletionPct] = useState(task.completion_percentage || 0)
  const [savingPct, setSavingPct] = useState(false)

  // Resume modal (3 choices)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [resumeLaterDeadline, setResumeLaterDeadline] = useState("")

  // Signature and OTP state hooks
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpInput, setOtpInput] = useState("")
  const [otpVerified, setOtpVerified] = useState(false)

  // Nearest Stock Info
  const [nearestStock, setNearestStock] = useState({})

  useEffect(() => {
    if (task.inventory_status && task.inventory_status !== "Fulfilled" && task.inventory_status !== "None" && precGPS && task.required_items?.length > 0) {
      task.required_items.forEach(async (reqItem) => {
        try {
          const res = await apiRequest(`/inventory/nearest-stock/${reqItem.item_id}/?lat=${precGPS.lat}&lng=${precGPS.lon}`)
          setNearestStock(prev => ({ ...prev, [reqItem.item_id]: res }))
        } catch (e) {
          console.error("Failed to fetch nearest stock", e)
        }
      })
    }
  }, [task.inventory_status, task.required_items, precGPS])

  // Activity timeline
  const [showTimeline, setShowTimeline] = useState(false)
  const [timeline, setTimeline] = useState([])
  const [loadingTimeline, setLoadingTimeline] = useState(false)

  // Complete flow state
  const [afterPhoto, setAfterPhoto] = useState(null)
  const [afterPhotoPreview, setAfterPhotoPreview] = useState(null)
  const [faceVerifyScore, setFaceVerifyScore] = useState(null)
  const [faceVerifyStatus, setFaceVerifyStatus] = useState(null) // 'verifying', 'matched', 'mismatch', 'no_face', 'skipped'
  const [faceVerifyError, setFaceVerifyError] = useState("")
  const [showEndSelfieCamera, setShowEndSelfieCamera] = useState(false)

  async function performFaceMatching(endingPhotoPreview) {
    setFaceVerifyStatus("verifying")
    setFaceVerifyError("")
    
    let startPhotoUrl = task.start_photo
    if (startPhotoUrl && startPhotoUrl.startsWith('/')) {
      const host = "http://localhost:8000"
      startPhotoUrl = `${host}${startPhotoUrl}`;
    }

    if (!startPhotoUrl) {
      setFaceVerifyStatus("skipped")
      setFaceVerifyScore(100)
      return
    }

    try {
      const result = await verifyFaces(startPhotoUrl, endingPhotoPreview)
      setFaceVerifyScore(result.score)
      if (result.status === 'mismatch') {
        setFaceVerifyStatus('mismatch')
        setFaceVerifyError('Face verification failed. Please retake the photo.')
      } else if (result.status === 'no_face') {
        setFaceVerifyStatus('no_face')
        setFaceVerifyError('No face detected in the photos! Please retake.')
      } else {
        setFaceVerifyStatus('matched')
      }
    } catch (err) {
      console.error("Face verification error:", err)
      setFaceVerifyStatus("skipped")
      setFaceVerifyScore(100)
    }
  }

  function handleAfterPhotoCapture(file, previewUrl) {
    setAfterPhoto(file)
    setAfterPhotoPreview(previewUrl)
    setShowEndSelfieCamera(false)
    performFaceMatching(previewUrl)
  }

  function handleAfterPhotoFileChange(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAfterPhoto(file)

      const reader = new FileReader()
      reader.onloadend = () => {
        setAfterPhotoPreview(reader.result)
        performFaceMatching(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const elapsed = useElapsed(task.started_at)
  const liveHours = task.status === "in_progress" && elapsed > 0 ? formatDuration(elapsed) : null

  // Sync completion % from prop
  useEffect(() => { setCompletionPct(task.completion_percentage || 0) }, [task.completion_percentage])

  function handleStartWork() { navigate(`/time?task_id=${task.id}`) }

  // Signature drawing functions
  function startDrawing(e) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1e293b"
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
    setIsDrawing(true)
  }

  function draw(e) {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // OTP generator
  function generateOtp() {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    setOtpCode(code)
    alert(`[SMS GATEWAY SIMULATOR] Customer SMS sent. Verification Code: ${code}`)
  }

  // OTP verify
  function verifyOtp() {
    if (otpInput === otpCode && otpCode !== "") {
      setOtpVerified(true)
      alert("✅ Customer OTP verified successfully!")
    } else {
      alert("❌ Invalid OTP. Please try again.")
    }
  }

  function handleComplete() {
    if (task.require_before_after_photos && !afterPhoto) {
      alert("An after photo is required to complete this task."); return;
    }
    if (faceVerifyStatus === "mismatch" || faceVerifyStatus === "no_face") {
      alert("Face verification failed. Please retake the photo."); return;
    }
    if (faceVerifyStatus === "verifying") {
      alert("Please wait for face verification to complete."); return;
    }
    if (!faceVerifyStatus && task.start_photo) {
      alert("Please capture or upload an ending photo to verify identity."); return;
    }
    if (!otpVerified) {
      alert("Please generate and verify the Customer OTP code to proceed."); return;
    }
    const payload = { 
      notes: note, 
      require_fd: true,
      face_match_percentage: faceVerifyScore ?? 0,
      face_match_status: faceVerifyStatus === 'matched' ? 'verified' : (faceVerifyStatus === 'skipped' ? 'skipped' : 'failed')
    }
    if (afterPhoto) payload.photo = afterPhoto
    onAction(task.id, "complete", payload)
  }

  async function handleAccept() {
    setLocalBusy(true)
    await onAction(task.id, "accept", {})
    setLocalBusy(false)
  }

  async function handleStartTravel() {
    setLocalBusy(true)
    try {
      await onAction(task.id, "start_travel", {})
      setShowLiveTracking(true)
    } catch (err) {
      alert(err.message || "Failed to start journey.")
    } finally {
      setLocalBusy(false)
    }
  }

  async function handleReachedSite() {
    setLocalBusy(true)
    try {
      await onAction(task.id, "reached_site", {})
      setShowLiveTracking(false)
    } catch (err) {
      alert(err.message || "Failed to mark arrival.")
    } finally {
      setLocalBusy(false)
    }
  }

  async function handleStartWorkNew() {
    if (!precGPS) {
      alert("Please wait for GPS to lock first.")
      return
    }
    setLocalBusy(true)
    try {
      await onAction(task.id, "start_work", {
        require_fd: true,
        photo: beforePhoto,
        lat: precGPS.lat,
        lon: precGPS.lon,
        notes: startNotes || "Work started",
      })
    } catch (err) {
      alert(err.message || "Failed to start work.")
    } finally {
      setLocalBusy(false)
    }
  }

  async function handleDecline() {
    if (!declining) { setDeclining(true); return }
    setLocalBusy(true)
    await onAction(task.id, "decline", { reason: declineReason })
    setLocalBusy(false)
    setDeclining(false)
    setDeclineReason("")
  }

  function calculateResumeDeadline() {
    if (suspendDuration === "custom") {
      return customDeadline ? new Date(customDeadline).toISOString() : new Date(Date.now() + 3600000).toISOString()
    }
    let offsetMs = 3600000
    if (suspendDuration === "30m") offsetMs = 30 * 60 * 1000
    if (suspendDuration === "1h") offsetMs = 60 * 60 * 1000
    if (suspendDuration === "2h") offsetMs = 120 * 60 * 1000
    if (suspendDuration === "4h") offsetMs = 240 * 60 * 1000
    return new Date(Date.now() + offsetMs).toISOString()
  }

  async function handleConfirmSuspend() {
    setSuspendSlaBlock(null)
    const deadline = calculateResumeDeadline()
    setLocalBusy(true)
    try {
      const res = await apiRequest(`/tasks/${task.id}/suspend/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason_category: suspendReasonCategory,
          reason: suspendReason,
          resume_deadline: deadline,
        }),
      })
      setSuspending(false)
      setSuspendReason("")
      setSuspendReasonCategory("spare_part")
      await onAction(task.id, "_refresh", {})
    } catch (err) {
      if (err?.status === 423 || err?.body?.error === "sla_breach") {
        setSuspendSlaBlock(err?.body?.detail || "SLA breach imminent. Cannot pause.")
      } else {
        setSuspendSlaBlock(err?.body?.detail || "Cannot suspend this task.")
      }
    } finally {
      setLocalBusy(false)
    }
  }

  async function handleSaveCompletion(pct) {
    setSavingPct(true)
    try {
      await apiRequest(`/tasks/${task.id}/completion/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completion_percentage: pct }),
      })
    } catch { /* silent */ } finally { setSavingPct(false) }
  }

  async function loadTimeline() {
    if (loadingTimeline) return
    setLoadingTimeline(true)
    try {
      const data = await apiRequest(`/tasks/${task.id}/activity-log/`)
      setTimeline(Array.isArray(data) ? data : [])
    } catch { setTimeline([]) } finally { setLoadingTimeline(false) }
  }

  function toggleTimeline() {
    if (!showTimeline && timeline.length === 0) loadTimeline()
    setShowTimeline(v => !v)
  }

  async function handleFindGapJobs() {
    setFetchingGapJobs(true)
    setGpsAccuracy("Acquiring GPS position...")
    try {
      const pos = await getPosition((acc) => setGpsAccuracy(`GPS Accuracy: ${acc}m`))
      setGpsAccuracy(null)
      const data = await apiRequest(`/tasks/available-gap-jobs/?lat=${pos.lat}&lng=${pos.lon}&radius_km=${radiusKm}`)
      setGapJobs(Array.isArray(data) ? data : (data?.results || []))
      setShowingGapJobs(true)
    } catch (err) {
      alert("Failed to acquire GPS location. Please ensure location services are enabled.");
      setGpsAccuracy(null)
    } finally {
      setFetchingGapJobs(false)
    }
  }

  async function handleResumeNow() {
    setShowResumeModal(false)
    setLocalBusy(true)
    setGpsAccuracy("Acquiring GPS position...")
    try {
      const pos = await getPosition((acc) => setGpsAccuracy(`GPS Accuracy: ${acc}m`))
      setGpsAccuracy(null)
      const res = await apiRequest(`/tasks/${task.id}/resume/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: pos.lat, lng: pos.lon }),
      })
      if (res?.overdue_warning) alert("Welcome back! Note: You have resumed this task after the scheduled deadline.")
      await onAction(task.id, "_refresh", {})
    } catch (err) {
      alert(err?.body?.detail || err.message || "Failed to resume.")
      setGpsAccuracy(null)
    } finally { setLocalBusy(false) }
  }

  async function handleResumeLater() {
    if (!resumeLaterDeadline) return
    setShowResumeModal(false)
    // Just update the resume deadline — task stays suspended
    setLocalBusy(true)
    try {
      await apiRequest(`/tasks/admin/${task.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_deadline: new Date(resumeLaterDeadline).toISOString() }),
      })
      await onAction(task.id, "_refresh", {})
    } catch { /* silent */ } finally { setLocalBusy(false) }
  }

  async function handleRequestReassign() {
    setShowResumeModal(false)
    if (confirm("Request admin to reassign this task? Your progress will be noted.")) {
      alert("Reassignment request sent to admin.")
    }
  }

  async function handleResumeParent() {
    setShowResumeModal(true)
  }

  async function handleAcceptGapJob(gapJobId) {
    setLocalBusy(true)
    try {
      await onAction(gapJobId, "accept-gap-job", { parent_task_id: task.id })
      setShowingGapJobs(false)
    } catch (err) { /* errors handled by onAction */ } finally { setLocalBusy(false) }
  }

  const isPending = task.acceptance_status === "pending_acceptance"
  const isDeclined = task.acceptance_status === "declined"

  return (
    <>
      {showLiveTracking && (
        <LiveTrackingModal
          task={task}
          empPos={precGPS}
          onClose={() => setShowLiveTracking(false)}
        />
      )}
      <div
        className={`rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-5 flex flex-col gap-4 ${!task.is_pushed_gap_job ? 'bg-surface dark:bg-slate-900/60 border border-stroke dark:border-slate-800' : ''}`}
        style={task.is_pushed_gap_job ? {
          background: 'linear-gradient(135deg, #fff5f5 0%, #fff 60%)',
          border: '2px solid #ef4444',
          boxShadow: '0 0 0 3px rgba(239,68,68,0.15), 0 4px 24px rgba(239,68,68,0.12)',
          animation: 'urgentCardPulse 2s ease-in-out infinite',
        } : undefined}
      >
        <style>{`
        @keyframes urgentCardPulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.15), 0 4px 24px rgba(239,68,68,0.12); }
          50% { box-shadow: 0 0 0 6px rgba(239,68,68,0.08), 0 4px 32px rgba(239,68,68,0.2); }
        }
      `}</style>
        {/* ── 3-Choice Resume Modal ── */}
        {showResumeModal && createPortal(
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }} onClick={() => setShowResumeModal(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
              boxShadow: "0 25px 80px rgba(0,0,0,0.25)",
            }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#1e293b", marginBottom: 6 }}>▶ Resume Options</div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, fontWeight: 600 }}>Gap job complete. What would you like to do with the original task?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button onClick={handleResumeNow} style={{
                  padding: "12px 16px", borderRadius: 12, border: "none", background: "#4f46e5",
                  color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer", textAlign: "left",
                }}>
                  ▶ Resume Now — Head back to the original job
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>⏰ Resume Later — Set a new deadline:</div>
                  <input type="datetime-local" value={resumeLaterDeadline}
                    onChange={e => setResumeLaterDeadline(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13 }}
                  />
                  <button onClick={handleResumeLater} disabled={!resumeLaterDeadline} style={{
                    padding: "10px 16px", borderRadius: 12,
                    border: "1.5px solid #e2e8f0", background: resumeLaterDeadline ? "#f8fafc" : "#f1f5f9",
                    color: resumeLaterDeadline ? "#334155" : "#94a3b8",
                    fontSize: 12, fontWeight: 800, cursor: resumeLaterDeadline ? "pointer" : "not-allowed",
                  }}>
                    Confirm Resume Later
                  </button>
                </div>
                <button onClick={handleRequestReassign} style={{
                  padding: "12px 16px", borderRadius: 12,
                  border: "1.5px solid #fca5a5", background: "#fff5f5",
                  color: "#dc2626", fontSize: 13, fontWeight: 900, cursor: "pointer",
                }}>
                  🔄 Request Reassignment — Pass this task to another employee
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── COMPACT HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {task.is_pushed_gap_job ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20,
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                color: '#fff', fontSize: 9, fontWeight: 900,
                letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>⚡ URGENT GAP JOB</span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 6,
                background: '#f1f5f9', color: '#475569',
                fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{categoryLabel(task.category)}</span>
            )}
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: priorityColorClass(task.priority).includes('red') ? '#ef4444' : priorityColorClass(task.priority).includes('amber') ? '#f59e0b' : '#22c55e' }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isPending && (
              <span style={{
                padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 900,
                background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>⏳ Awaiting Response</span>
            )}
            <SlaBadge slaStatus={task.sla_status} slaMinutes={task.sla_minutes_remaining} />
            {/* Status pill with proper color coding */}
            <span style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
              letterSpacing: "0.06em", textTransform: "uppercase",
              background: task.status === 'pending' ? '#fff7ed' : task.status === 'in_progress' ? '#f0fdf4' : task.status === 'completed' ? '#064e3b' : task.status === 'suspended' ? '#f8fafc' : '#eff6ff',
              color: task.status === 'pending' ? '#ea580c' : task.status === 'in_progress' ? '#16a34a' : task.status === 'completed' ? '#fff' : task.status === 'suspended' ? '#64748b' : '#2563eb',
              border: `1px solid ${task.status === 'pending' ? '#fed7aa' : task.status === 'in_progress' ? '#bbf7d0' : task.status === 'completed' ? '#065f46' : task.status === 'suspended' ? '#e2e8f0' : '#bfdbfe'}`,
            }}>
              {task.status === "in_progress" ? (liveHours ? `🟢 ${liveHours}` : "In Progress") : statusLabel(task.status)}
            </span>
          </div>
        </div>

        {/* ── TITLE BLOCK ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", lineHeight: 1.2, margin: 0 }}>{task.title}</h3>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginTop: 2 }}>Job #{task.id}</div>
          </div>
          {!isPending && (
            <div style={{
              flexShrink: 0, width: 52, height: 52,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, padding: 8,
            }}>
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
                <polyline points="10,56 10,16 34,8 34,56" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
                <rect x="34" y="26" width="20" height="30" rx="1" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" fill="none"/>
                <line x1="6" y1="56" x2="58" y2="56" stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
                <rect x="14" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="22" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="14" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="22" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="14" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="22" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="38" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="46" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="38" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="46" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                <rect x="21" y="46" width="7" height="10" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              </svg>
            </div>
          )}
        </div>

        {/* ── META ROW: site / date / est ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Building2 size={11} />
            {task.job_site_name || task.client_name || "No Site"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <CalIcon size={11} />
            {task.due_date}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={11} />
            Est: {task.estimated_hours}h
          </span>
          {task.actual_hours > 0 && (
            <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
              <CheckCircle2 size={11} />
              Act: {task.actual_hours}h
            </span>
          )}
        </div>

        {/* ── CLIENT CARD — shown immediately after header for accepted tasks ── */}
        {!isPending && (task.client_name || task.client_contact_number || task.job_address) && (
          <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-3.5 shadow-sm">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] mb-0.5">Customer Dossier</div>
            {task.client_name && (
              <div className="flex items-center gap-3 text-sm text-slate-800 dark:text-slate-200 font-bold">
                <User size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{task.client_name}</span>
              </div>
            )}
            {task.client_company_name && (
              <div className="flex items-center gap-3 text-[12px] text-slate-500 dark:text-slate-400 font-semibold">
                <Building2 size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <span>{task.client_company_name}</span>
              </div>
            )}
            {task.client_contact_number && (
              <a href={`tel:${task.client_contact_number}`}
                className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                style={{ textDecoration: "none" }}
              >
                <Phone size={15} className="text-blue-500 dark:text-blue-400 shrink-0" />
                <span>{task.client_contact_number}</span>
              </a>
            )}
            {task.job_address && (
              <div className="flex items-start gap-3 text-[12px] text-slate-650 dark:text-slate-400 font-semibold leading-relaxed">
                <MapPin size={15} className="text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                <span>{task.job_address}</span>
              </div>
            )}
          </div>
        )}

        {/* Billing badge for completed tasks */}
        {task.status === "completed" && task.billed_hours && (
          <BillingBadge
            billedHours={task.billed_hours}
            actualHours={task.actual_hours}
            estimatedHours={task.estimated_hours}
          />
        )}

        {task.admin_notes && (
          <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-3 rounded-xl text-[11px] font-bold border border-amber-100 dark:border-amber-900/30">
            <strong className="uppercase tracking-widest mr-1 opacity-60">Admin note:</strong> {task.admin_notes}
          </div>
        )}

        {/* Attachments Viewer */}
        {task.attachments && task.attachments.length > 0 && (
          <AttachmentsViewer attachments={task.attachments} />
        )}

        {/* Urgent Gap Job dispatched info strip */}
        {task.is_pushed_gap_job && (
          <div style={{
            padding: '14px 16px', borderRadius: 14,
            background: 'linear-gradient(135deg, #fef2f2 0%, #fff5f5 100%)',
            border: '1.5px solid #fca5a5',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#fff',
                boxShadow: '0 2px 8px rgba(220,38,38,0.35)',
              }}>⚡</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#991b1b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Admin Dispatched — Urgent Gap Job
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#f87171', marginTop: 1 }}>
                  Your manager has assigned this task while you are suspended. Please accept immediately.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, paddingTop: 4, borderTop: '1px solid #fecaca' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626' }}>
                ⏱ Est: {task.estimated_hours}h
              </div>
              {task.client_contact_number && (
                <a href={`tel:${task.client_contact_number}`}
                  style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  📞 Call Client
                </a>
              )}
              {task.job_address && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', flex: 1, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📍 {task.job_address}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Suspension Panel details */}
        {task.status === "suspended" && (
          <div style={{
            padding: 16, borderRadius: 14,
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
            border: "1.5px solid #cbd5e1",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
              ⏸️ JOB SUSPENDED
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold">Reason:</span> {task.suspend_reason || "No reason specified"}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold">Resume Deadline:</span> {task.resume_deadline ? new Date(task.resume_deadline).toLocaleString() : "None"}
            </div>
            <div className="text-xs text-slate-700 dark:text-slate-300">
              <span className="font-bold">Total Active Time:</span> {formatDuration(task.total_active_seconds || 0)}
            </div>
          </div>
        )}

        {/* ── Accept / Decline Banner ── */}
        {isPending && (
          <div style={{
            padding: 16, borderRadius: 14,
            background: "linear-gradient(135deg, #eff6ff 0%, #fefce8 100%)",
            border: "1.5px solid #bfdbfe",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8", letterSpacing: "0.08em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
              <UserCheck size={14} /> New Task Assigned — Please Respond
            </div>
            {!declining ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={handleAccept}
                  disabled={localBusy || busy}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                    background: "#059669", color: "#fff",
                    fontSize: 11, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    opacity: localBusy || busy ? 0.6 : 1,
                  }}
                >
                  <ThumbsUp size={14} /> Accept Task
                </button>
                <button
                  onClick={handleDecline}
                  disabled={localBusy || busy}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #fca5a5",
                    background: "#fff", color: "#dc2626",
                    fontSize: 11, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    opacity: localBusy || busy ? 0.6 : 1,
                  }}
                >
                  <ThumbsDown size={14} /> Decline
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea
                  rows={2}
                  placeholder="Reason for declining (optional)..."
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  style={{
                    resize: "none", borderRadius: 10, border: "1.5px solid #fca5a5",
                    padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
                    outline: "none", color: "#374151",
                  }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => { setDeclining(false); setDeclineReason("") }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #e2e8f0",
                      background: "#fff", color: "#64748b",
                      fontSize: 10, fontWeight: 800, cursor: "pointer",
                      letterSpacing: "0.08em", textTransform: "uppercase",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={localBusy || busy}
                    style={{
                      flex: 2, padding: "8px 0", borderRadius: 10, border: "none",
                      background: "#dc2626", color: "#fff",
                      fontSize: 10, fontWeight: 900, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                      opacity: localBusy || busy ? 0.6 : 1,
                    }}
                  >
                    <ThumbsDown size={12} /> Confirm Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
          {gpsAccuracy && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-750 text-xs font-bold rounded-xl animate-pulse text-center">
              {gpsAccuracy}
            </div>
          )}

          {task.status === "completed" && (
            <div className="flex flex-col items-center justify-center p-6 border-2 border-emerald-100 dark:border-emerald-900/20 rounded-2xl bg-emerald-50/10 dark:bg-emerald-950/5 border-dashed gap-4 text-center mt-2 animate-in fade-in duration-300">
              {/* Pulsing completed checkmark ring */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-100 dark:bg-emerald-950/40 animate-ping opacity-75" />
                <div className="relative w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/35">
                  <CheckCircle2 size={36} strokeWidth={2.5} />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <h4 className="text-sm font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">Work Completed</h4>
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider mt-0.5">All objectives and requirements met</p>
              </div>

              {/* Quick summary grid */}
              <div className="w-full grid grid-cols-2 gap-3 mt-2 text-left bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 p-4 rounded-xl shadow-inner">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Started At</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                    {task.started_at ? new Date(task.started_at).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Completed At</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-350">
                    {task.completed_at ? new Date(task.completed_at).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-50 dark:border-slate-900 pt-2 mt-1">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Your Work Notes / Summary</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-450 italic">
                    "{task.employee_notes || "No notes submitted"}"
                  </span>
                </div>
              </div>
            </div>
          )}

          {task.status === "pending" && !isPending && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── COMPACT CHECKLIST HEADER ── */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <ClipboardList size={18} />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wider">Before Work Requirements</div>
                    <div className="text-[10px] text-indigo-500 dark:text-indigo-500/80 font-bold mt-0.5">Complete checklist to unlock Start Work</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-[9px] font-black bg-indigo-600 text-white uppercase tracking-wider shrink-0 shadow-sm shadow-indigo-100 dark:shadow-none">
                  Accepted
                </span>
              </div>

              {/* ── JOURNEY PROGRESS — improved ── */}
              {(() => {
                const travelSteps = [
                  { key: null,           icon: <UserCheck size={16} />, label: "Accepted" },
                  { key: "on_the_way",   icon: <Car size={16} />, label: "On The Way" },
                  { key: "reached_site", icon: <MapPin size={16} />, label: "Reached Site" },
                  { key: "working",      icon: <Hammer size={16} />, label: "Working" },
                ]
                const curIdx = task.travel_status
                  ? travelSteps.findIndex(s => s.key === task.travel_status)
                  : 0
                return (
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] mb-5">Task Progress</div>
                    <div className="flex items-center w-full">
                      {travelSteps.map((step, idx) => {
                        const isActive = idx === curIdx
                        const isDone = idx < curIdx
                        
                        let animationClass = ""
                        if (isActive) {
                          if (step.key === "on_the_way") animationClass = "travel-on-way"
                          else if (step.key === "reached_site") animationClass = "travel-reached"
                          else if (step.key === "working") animationClass = "travel-working"
                        }

                        return (
                          <React.Fragment key={step.key || "accepted"}>
                            <div className="flex flex-col items-center gap-2 flex-1 relative">
                              <div 
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${animationClass}`}
                                style={{
                                  background: isDone ? "#10b981" : isActive ? "#2563eb" : "var(--bg, #f1f5f9)",
                                  border: `2px solid ${isDone ? "#10b981" : isActive ? "#2563eb" : "var(--stroke2, #e2e8f0)"}`,
                                  color: isDone || isActive ? "#fff" : "var(--muted, #94a3b8)",
                                  boxShadow: isActive ? "0 0 0 5px rgba(37,99,235,0.15)" : "none",
                                }}
                              >
                                {isDone ? <CheckCircle2 size={16} /> : step.icon}
                              </div>
                              <div 
                                className="text-[9px] font-black uppercase tracking-wider text-center transition-all duration-300"
                                style={{
                                  color: isDone ? "#10b981" : isActive ? "#2563eb" : "var(--muted, #94a3b8)"
                                }}
                              >
                                {step.label}
                              </div>
                            </div>
                            {idx < travelSteps.length - 1 && (
                              <div className="flex-1 h-[2px] -mt-5 relative overflow-hidden" style={{ background: "var(--stroke2, #e2e8f0)" }}>
                                <div 
                                  className="absolute top-0 left-0 h-full transition-all duration-500"
                                  style={{
                                    width: idx < curIdx ? "100%" : "0%",
                                    background: "#10b981",
                                  }}
                                />
                              </div>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* ── CONTEXTUAL ACTION BUTTON ── */}
              <button
                type="button"
                onClick={() => setShowJourneyDetails(true)}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 14, border: "none",
                  background: !task.travel_status
                    ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                    : task.travel_status === "on_the_way"
                    ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                    : task.travel_status === "reached_site"
                    ? "linear-gradient(135deg, #059669, #047857)"
                    : "linear-gradient(135deg, #059669, #047857)",
                  color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  boxShadow: !task.travel_status
                    ? "0 4px 14px rgba(37,99,235,0.35)"
                    : task.travel_status === "on_the_way"
                    ? "0 4px 14px rgba(124,58,237,0.35)"
                    : "0 4px 14px rgba(5,150,105,0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                {!task.travel_status && <><Car size={16} /> Start Travel</>}
                {task.travel_status === "on_the_way" && <><MapPin size={16} /> Arrived at Client</>}
                {task.travel_status === "reached_site" && <><Hammer size={16} /> Start Work</>}
                {task.travel_status === "working" && <><CheckCircle2 size={16} /> Complete Work</>}
              </button>

              {/* ── QUICK ACTION BAR ── */}
              <div className="flex items-center justify-around p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 shadow-sm w-full">
                {task.client_contact_number && (
                  <a href={`tel:${task.client_contact_number}`} 
                    className="flex flex-col items-center gap-2 text-decoration-none group active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-emerald-500/20">
                      <Phone size={18} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">Call</span>
                  </a>
                )}
                <button type="button" 
                  className="flex flex-col items-center gap-2 bg-none border-none cursor-pointer group active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-blue-50/20">
                    <MessageSquare size={18} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">Chat</span>
                </button>
                {task.location_lat && task.location_lon ? (
                  <a
                    href={precGPS
                      ? `https://www.google.com/maps/dir/?api=1&origin=${precGPS.lat},${precGPS.lon}&destination=${task.location_lat},${task.location_lon}`
                      : `https://www.google.com/maps/dir/?api=1&destination=${task.location_lat},${task.location_lon}`
                    }
                    target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 text-decoration-none group active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-violet-50/20">
                      <Compass size={18} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">Navigate</span>
                  </a>
                ) : (
                  <button type="button" 
                    className="flex flex-col items-center gap-2 bg-none border-none cursor-pointer group active:scale-95 transition-transform"
                  >
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-violet-50/20">
                      <Compass size={18} />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">Navigate</span>
                  </button>
                )}
                <button type="button" onClick={() => setShowJourneyDetails(true)} 
                  className="flex flex-col items-center gap-2 bg-none border-none cursor-pointer group active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-amber-50/20">
                    <Upload size={18} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">Upload</span>
                </button>
                <button type="button" 
                  className="flex flex-col items-center gap-2 bg-none border-none cursor-pointer group active:scale-95 transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 border border-slate-500/20 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-50/20">
                    <MoreHorizontal size={18} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-250 transition-colors">More</span>
                </button>
              </div>

              {showJourneyDetails && createPortal(
                <div style={{
                  position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.75)",
                  backdropFilter: "blur(8px)", zIndex: 9999, display: "flex",
                  alignItems: "center", justifyContent: "center", padding: "20px",
                }} onClick={() => setShowJourneyDetails(false)}>
                  <div onClick={e => e.stopPropagation()} style={{
                    background: "#ffffff", borderRadius: "24px", padding: "24px",
                    width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 40px rgba(99, 102, 241, 0.08)",
                    display: "flex", flexDirection: "column", gap: "20px",
                    border: "1px solid #e2e8f0",
                    animation: "modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                  }}>
                    <style>{`
                    @keyframes modalFadeIn {
                      from { opacity: 0; transform: scale(0.95) translateY(10px); }
                      to { opacity: 1; transform: scale(1) translateY(0); }
                    }
                    @keyframes markerPulse {
                      0% { transform: scale(0.6); opacity: 0.9; }
                      100% { transform: scale(1.6); opacity: 0; }
                    }
                  `}</style>

                    {/* Header with Back Button */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(79, 70, 229, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>
                          <ClipboardList size={16} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 900, color: "#1e293b", textTransform: "uppercase", letterSpacing: "0.04em" }}>Before Work Checklist</h4>
                          <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Complete to unlock [Start Work]</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowJourneyDetails(false)}
                        style={{
                          display: "flex", alignItems: "center", gap: "4px",
                          padding: "6px 12px", borderRadius: "10px", border: "1.5px solid #e2e8f0",
                          background: "#ffffff", color: "#475569", fontSize: "10px", fontWeight: 900,
                          cursor: "pointer", textTransform: "uppercase", transition: "all 0.2s ease"
                        }}
                      >
                        <span>← Back</span>
                      </button>
                    </div>

                    {/* Travel Routing Card (ETA & Distance) */}
                    {precGPS && task.location_lat && (() => {
                      const dist = getDistance(precGPS.lat, precGPS.lon, parseFloat(task.location_lat), parseFloat(task.location_lon))
                      const etaMin = dist !== null ? Math.round(dist / 1000 / 25 * 60) : 0
                      return (
                        <div className="p-4 bg-indigo-50/60 dark:bg-slate-950 border border-indigo-100 dark:border-slate-800 text-slate-700 dark:text-slate-350 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in duration-300">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md animate-pulse">
                              <Navigation size={16} />
                            </div>
                            <div>
                              <div className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Traveling to Client</div>
                              <div className="text-[10px] text-slate-400 font-extrabold uppercase mt-0.5">Swiggy Live Tracking Enabled</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-indigo-600 dark:text-indigo-400 flex items-center justify-end gap-1">
                               <Car size={15} />
                               <span>{dist !== null ? (dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`) : "Calculating..."}</span>
                             </div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-500 font-black uppercase mt-0.5">
                              ETA: ~{etaMin} min
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Live Route Quick View Button */}
                    {precGPS && task.location_lat && task.location_lon && (
                      <button
                        type="button"
                        onClick={() => setShowLiveTracking(true)}
                        style={{
                          width: "100%", padding: "12px 16px",
                          borderRadius: 14,
                          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
                          border: "1.5px solid #334155",
                          color: "#fff", fontSize: 12, fontWeight: 900,
                          cursor: "pointer", textAlign: "left",
                          display: "flex", alignItems: "center", gap: 10,
                          letterSpacing: "0.04em",
                          boxShadow: "0 4px 20px rgba(59,130,246,0.2)",
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}><Compass size={18} className="text-white" /></div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#f1f5f9" }}>View Live Route</div>
                          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                            {(() => {
                              const d = getDistance(precGPS.lat, precGPS.lon, parseFloat(task.location_lat), parseFloat(task.location_lon))
                              return d !== null ? (d < 1000 ? `${d}m to client` : `${(d / 1000).toFixed(1)}km to client`) : "Tracking active"
                            })()}
                          </div>
                        </div>
                        <div style={{ marginLeft: "auto", fontSize: 18 }}>›</div>
                      </button>
                    )}

                    {/* Mini Map Container */}
                    {task.location_lat && task.location_lon && (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Site Location</div>
                        <div style={{
                          position: "relative",
                          height: 200, borderRadius: 16, overflow: "hidden",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                          boxShadow: "0 10px 30px -10px rgba(99, 102, 241, 0.2), 0 1px 3px rgba(0,0,0,0.05)",
                        }}>
                          <MapContainer
                            center={[parseFloat(task.location_lat), parseFloat(task.location_lon)]}
                            zoom={15}
                            style={{ width: "100%", height: "100%" }}
                            zoomControl={false}
                            scrollWheelZoom={false}
                          >
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
                            />

                            {/* Automatic bounds fitter for the mini-map to show both employee and client */}
                            <LiveTrackingMapController
                              empPos={precGPS ? { lat: precGPS.lat, lon: precGPS.lon } : null}
                              clientPos={{ lat: parseFloat(task.location_lat), lon: parseFloat(task.location_lon) }}
                            />

                            {/* Red client pin */}
                            <Marker
                              position={[parseFloat(task.location_lat), parseFloat(task.location_lon)]}
                              icon={L.divIcon({
                                className: "",
                                html: `<div style="display:flex;flex-direction:column;align-items:center;">
                                <div style="
                                  width:38px;height:38px;
                                  border-radius:50% 50% 50% 0;
                                  transform:rotate(-45deg);
                                  background:linear-gradient(135deg,#e94560,#ff6b6b);
                                  border:3px solid white;
                                  box-shadow:0 4px 16px rgba(233,69,96,0.5);
                                  display:flex;align-items:center;justify-content:center;
                                ">
                                  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' style='width:16px;height:16px;transform:rotate(45deg);'><rect x='4' y='2' width='16' height='20' rx='2' ry='2'></rect><line x1='9' y1='22' x2='9' y2='16'></line><line x1='15' y1='22' x2='15' y2='16'></line><line x1='9' y1='16' x2='15' y2='16'></line><path d='M9 6h1'></path><path d='M14 6h1'></path><path d='M9 10h1'></path><path d='M14 10h1'></path></svg>
                                </div>
                              </div>`,
                                iconSize: [50, 50],
                                iconAnchor: [25, 45],
                              })}
                            >
                              <Popup>
                                <div style={{ fontSize: 11, fontWeight: 800, padding: 4 }}>
                                  🎯 {task.title}
                                  {task.job_address && <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{task.job_address}</div>}
                                </div>
                              </Popup>
                            </Marker>

                            {/* Green geofence circle */}
                            <Circle
                              center={[parseFloat(task.location_lat), parseFloat(task.location_lon)]}
                              radius={parseInt(task.geofence_radius) || 200}
                              pathOptions={{ color: "#059669", fillColor: "#059669", fillOpacity: 0.10, weight: 2, dashArray: "6 4" }}
                            />

                            {/* Nearest Stock Pins */}
                            {Object.values(nearestStock).map(stockLocs => {
                              if (!stockLocs || stockLocs.length === 0) return null;
                              const closest = stockLocs[0];
                              if (!closest.lat || !closest.lng) return null;
                              return (
                                <Marker
                                  key={`stock-${closest.location_id}`}
                                  position={[closest.lat, closest.lng]}
                                  icon={L.divIcon({
                                    className: "",
                                    html: `<div style="display:flex;flex-direction:column;align-items:center;">
                                      <div style="width:32px;height:32px;border-radius:50%;background:#f59e0b;border:2px solid white;box-shadow:0 4px 12px rgba(245,158,11,0.4);display:flex;align-items:center;justify-content:center;">
                                        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' style='width:16px;height:16px;'><path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'></path><polyline points='3.27 6.96 12 12.01 20.73 6.96'></polyline><line x1='12' y1='22.08' x2='12' y2='12'></line></svg>
                                      </div>
                                    </div>`,
                                    iconSize: [32, 32],
                                    iconAnchor: [16, 16],
                                  })}
                                >
                                  <Popup>
                                    <div style={{ fontSize: 11, fontWeight: 800, padding: 4 }}>
                                      📦 Nearest Stock: {closest.location_name}
                                      <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>{closest.distance_km}km away</div>
                                    </div>
                                  </Popup>
                                </Marker>
                              );
                            })}

                            {/* Employee current position (blue) */}
                            {precGPS && (
                              <Marker
                                position={[precGPS.lat, precGPS.lon]}
                                icon={L.divIcon({
                                  className: "",
                                  html: `<div style="
                                  position:relative;width:24px;height:24px;
                                  display:flex;align-items:center;justify-content:center;
                                ">
                                  <div style="
                                    position:absolute;width:20px;height:20px;
                                    border-radius:50%;background:rgba(59,130,246,0.35);
                                    animation:markerPulse 1.8s infinite ease-in-out;
                                  "></div>
                                  <div style="
                                    position:relative;width:11px;height:11px;
                                    border-radius:50%;background:#3b82f6;
                                    border:2px solid white;box-shadow:0 2px 8px rgba(59,130,246,0.5);
                                  "></div>
                                </div>`,
                                  iconSize: [24, 24],
                                  iconAnchor: [12, 12],
                                })}
                              />
                            )}

                            {/* Animated Blue Route Polyline */}
                            {precGPS && (
                              <Polyline
                                positions={[[precGPS.lat, precGPS.lon], [parseFloat(task.location_lat), parseFloat(task.location_lon)]]}
                                pathOptions={{
                                  className: "animated-route-line",
                                  color: "#3b82f6",
                                  weight: 3.5,
                                  dashArray: "8 5",
                                  opacity: 0.85
                                }}
                              />
                            )}
                          </MapContainer>

                          {/* Get Directions overlay button with live origin routing */}
                          <a
                            href={precGPS
                              ? `https://www.google.com/maps/dir/?api=1&origin=${precGPS.lat},${precGPS.lon}&destination=${task.location_lat},${task.location_lon}`
                              : `https://www.google.com/maps/dir/?api=1&destination=${task.location_lat},${task.location_lon}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              position: "absolute", bottom: 8, right: 8,
                              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                              color: "white", padding: "5px 12px",
                              borderRadius: 20, fontSize: 9, fontWeight: 900,
                              textDecoration: "none", zIndex: 600,
                              boxShadow: "0 4px 12px rgba(99,102,241,0.4)",
                              display: "flex", alignItems: "center", gap: 4,
                            }}
                          >
                            <Navigation size={10} /> Get Directions
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Before Photo Upload Requirement */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                        <span>Before Photo *</span>
                        {beforePhoto && <span className="text-emerald-600 font-extrabold uppercase">Captured ✓</span>}
                      </label>

                      {beforePhotoPreview ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-650/40 h-44 group shadow-sm bg-slate-900">
                          <img src={beforePhotoPreview} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-205">
                            <button
                              type="button"
                              onClick={() => { setBeforePhoto(null); setBeforePhotoPreview(null) }}
                              className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-705 transition-colors shadow-lg"
                            >
                              Remove Photo
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setShowSelfieCamera(true)}
                            className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 hover:bg-indigo-50/20 bg-white dark:bg-slate-950 transition-all shadow-sm"
                          >
                            <Camera size={24} className="text-indigo-600" />
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Take Selfie / Photo</span>
                          </button>
                          <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 hover:bg-indigo-50/20 bg-white dark:bg-slate-950 transition-all shadow-sm cursor-pointer">
                            <Upload size={24} className="text-indigo-600" />
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Upload File</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleBeforePhotoFileChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Selfie Capture Modal Portal */}
                    {showSelfieCamera && (
                      <SelfieCapture
                        onCapture={handleBeforePhotoCapture}
                        onCancel={() => setShowSelfieCamera(false)}
                      />
                    )}

                    {/* Starting Work Notes */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Notes / Objectives *</label>
                      <textarea
                        value={startNotes}
                        onChange={e => setStartNotes(e.target.value)}
                        placeholder="Describe the initial condition, diagnostic status, or action plan..."
                        className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all shadow-sm resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Location Verification Panel */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location Verification</label>

                      {acquiringGps ? (
                        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 animate-pulse">
                          <Loader2 size={14} className="animate-spin" /> Locating precise GPS coordinates...
                        </div>
                      ) : gpsError ? (
                        <div className="p-4 bg-red-50 border border-red-100 text-red-750 text-xs font-bold rounded-2xl flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle size={14} className="text-red-600" /> {gpsError}
                          </div>
                          <button
                            type="button"
                            onClick={triggerGpsAcquisition}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[9px] font-black uppercase rounded-lg shadow transition-colors"
                          >
                            Retry
                          </button>
                        </div>
                      ) : precGPS ? (
                        (() => {
                          const dist = getDistance(
                            parseFloat(task.location_lat),
                            parseFloat(task.location_lon),
                            precGPS.lat,
                            precGPS.lon
                          )
                          const radius = parseInt(task.geofence_radius) || 200
                          const inside = dist === null || dist <= radius

                          return (
                            <div className={`p-4 border rounded-2xl flex flex-col gap-2 shadow-sm ${inside ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-400' : 'bg-amber-50 border-amber-100 text-amber-850 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-amber-400'}`}>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                                  {inside ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
                                  {inside ? "GPS Location Locked ✓" : "Geofence Boundary Alert"}
                                </span>
                                <button
                                  type="button"
                                  onClick={triggerGpsAcquisition}
                                  className={`p-1.5 rounded-lg border transition-all ${inside ? 'bg-emerald-100 hover:bg-emerald-200 border-emerald-200 text-emerald-700' : 'bg-amber-100 hover:bg-amber-200 border-amber-200 text-amber-700'}`}
                                  title="Refresh Location"
                                >
                                  <RefreshCw size={11} />
                                </button>
                              </div>
                              <div className="text-[11px] font-bold">
                                {dist !== null ? (
                                  <>
                                    You are <span className="font-extrabold">{dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`}</span> from the job site.
                                    {inside ? " (Within Allowed Geofence Radius)" : ` (Required radius: ${radius}m)`}
                                  </>
                                ) : (
                                  "Precision GPS Coordinates Registered Successfully."
                                )}
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <button
                          type="button"
                          onClick={triggerGpsAcquisition}
                          className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs font-black rounded-2xl flex items-center justify-center gap-2 uppercase tracking-wider shadow-sm transition-all"
                        >
                          <MapPin size={14} /> Lock Precision GPS Coordinate
                        </button>
                      )}
                    </div>

                    {/* Required Inventory Check Panel */}
                    <div className="flex flex-col gap-2 mt-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Required Inventory</label>
                      {(!task.required_items || task.required_items.length === 0) ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 size={14} /> No specific inventory required.
                        </div>
                      ) : task.inventory_status === "Fulfilled" ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-black flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 size={14} /> All required inventory is available.
                        </div>
                      ) : (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-3 shadow-sm">
                          <div className="text-red-800 text-xs font-black flex items-center gap-1.5">
                            <AlertTriangle size={14} /> Missing Required Inventory
                          </div>
                          <div className="text-[11px] font-bold text-red-700/90 leading-relaxed">
                            {task.blocking_reason}
                          </div>
                          <div className="flex flex-col gap-2 mt-1">
                            {task.required_items.map(item => {
                              const stockLocs = nearestStock[item.item_id]
                              if (!stockLocs || stockLocs.length === 0) return null
                              const closest = stockLocs[0]
                              return (
                                <div key={item.item_id} className="p-2.5 bg-white border border-red-200 rounded-xl flex items-center justify-between text-[10px] shadow-sm">
                                  <div>
                                    <div className="font-black text-slate-800">{item.name}</div>
                                    <div className="text-slate-500 font-bold mt-0.5">Nearest: {closest.location_name} ({closest.distance_km}km)</div>
                                  </div>
                                  <div className="font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                    {closest.available_quantity} available
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Journey Action Buttons — context-sensitive based on travel_status */}
                    {!task.travel_status && (
                      <SwipeButton
                        text="Start Journey"
                        emoji="🚗"
                        colorGradient="linear-gradient(135deg, #3b82f6, #6366f1)"
                        shadowColor="rgba(59,130,246,0.3)"
                        onConfirm={handleStartTravel}
                        disabled={localBusy || busy}
                      />
                    )}

                    {task.travel_status === "on_the_way" && (
                      <>
                        <div style={{
                          padding: "10px 14px", borderRadius: 12,
                          background: "linear-gradient(135deg, #dbeafe, #eff6ff)",
                          border: "1.5px solid #93c5fd",
                          fontSize: 11, fontWeight: 800, color: "#1d4ed8",
                          display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                          animation: "travelPulse 2s ease-in-out infinite",
                        }}>
                          🚗 <span>You are On The Way — Admin is tracking your location live</span>
                        </div>
                        <SwipeButton
                          text="Arrived at Client"
                          emoji="📍"
                          colorGradient="linear-gradient(135deg, #f59e0b, #d97706)"
                          shadowColor="rgba(245,158,11,0.3)"
                          onConfirm={handleReachedSite}
                          disabled={localBusy || busy}
                        />
                      </>
                    )}

                    {task.travel_status === "reached_site" && (
                      <>
                        <div style={{
                          padding: "10px 14px", borderRadius: 12,
                          background: "linear-gradient(135deg, #fef3c7, #fffbeb)",
                          border: "1.5px solid #fde68a",
                          fontSize: 11, fontWeight: 800, color: "#92400e",
                          display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                        }}>
                          📍 <span>You have Arrived — Ready to begin work?</span>
                        </div>
                        <SwipeButton
                          text={precGPS ? "Start Work" : "Locking GPS..."}
                          emoji="🔨"
                          colorGradient={precGPS ? "linear-gradient(135deg, #059669, #047857)" : "linear-gradient(135deg, #94a3b8, #64748b)"}
                          shadowColor={precGPS ? "rgba(5,150,105,0.3)" : "rgba(148,163,184,0.1)"}
                          onConfirm={handleStartWorkNew}
                          disabled={localBusy || busy || !precGPS}
                        />
                        {!precGPS && (
                          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textAlign: "center", marginTop: 4 }}>
                            GPS is locking automatically…
                          </div>
                        )}
                      </>
                    )}

                    {/* ── START WORK — Visible for non-reached, non-working states ── */}
                    {task.travel_status !== "reached_site" && task.travel_status !== "working" && (
                      <div className="mt-3 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 flex flex-col gap-3.5 shadow-sm">
                        <div className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <Hammer size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Start Work Action</span>
                        </div>
                        
                        {(!beforePhoto || !startNotes.trim()) && (
                          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400/90 leading-relaxed flex flex-col gap-2 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                            {!beforePhoto && (
                              <div className="flex items-center gap-2">
                                <Camera size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>Capture a Before Photo above first</span>
                              </div>
                            )}
                            {!startNotes.trim() && (
                              <div className="flex items-center gap-2">
                                <ClipboardList size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>Fill in Work Notes / Objectives above first</span>
                              </div>
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            if (task.inventory_status && task.inventory_status !== "Fulfilled" && task.inventory_status !== "None") {
                              alert("Cannot start work until required inventory is fulfilled. Please visit the nearest stock location.");
                              return;
                            }
                            if (!beforePhoto) { alert("Please capture a Before Photo first."); return; }
                            if (!startNotes.trim()) { alert("Please enter Work Notes / Objectives first."); return; }
                            if (!precGPS) { alert("GPS is still locking. Please wait a moment and try again."); return; }
                            await handleStartWorkNew();
                          }}
                          disabled={localBusy || busy || (task.inventory_status && task.inventory_status !== "Fulfilled" && task.inventory_status !== "None")}
                          style={{
                            width: "100%",
                            padding: "15px 0",
                            borderRadius: 14,
                            border: "none",
                            background: (beforePhoto && startNotes.trim() && precGPS && (!task.inventory_status || task.inventory_status === "Fulfilled" || task.inventory_status === "None"))
                              ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                              : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 900,
                            cursor: (localBusy || busy || (task.inventory_status && task.inventory_status !== "Fulfilled" && task.inventory_status !== "None")) ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            boxShadow: (beforePhoto && startNotes.trim() && precGPS && (!task.inventory_status || task.inventory_status === "Fulfilled" || task.inventory_status === "None"))
                              ? "0 6px 20px rgba(5,150,105,0.4)"
                              : "0 4px 12px rgba(100,116,139,0.2)",
                            transition: "all 0.25s ease",
                            opacity: (localBusy || busy || (task.inventory_status && task.inventory_status !== "Fulfilled" && task.inventory_status !== "None")) ? 0.6 : 1,
                          }}
                        >
                          <Hammer size={16} />
                          <span>{localBusy ? "Starting Work…" : "Start Work"}</span>
                          {!localBusy && <ChevronRight size={16} />}
                        </button>

                        {!precGPS && (
                          <div className="text-[9px] text-emerald-650 dark:text-emerald-500/80 font-bold text-center flex items-center justify-center gap-1.5">
                            <Loader2 size={10} className="animate-spin" />
                            <span>GPS is locking automatically in the background…</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── COMPLETE WORK — Visible for working state ── */}
                    {task.travel_status === "working" && (
                      <div className="mt-3 p-5 rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 flex flex-col gap-5 shadow-sm">
                        <div className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-indigo-600" />
                          <span>Complete Work Action</span>
                        </div>

                        {/* End Photo Requirement */}
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Ending Photo (After Photo) *</span>
                            {afterPhoto && <span className="text-emerald-600 font-extrabold uppercase">Captured ✓</span>}
                          </label>

                          {afterPhotoPreview ? (
                            <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-650/40 h-44 group shadow-sm bg-slate-900">
                              <img src={afterPhotoPreview} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-205">
                                <button
                                  type="button"
                                  onClick={() => { setAfterPhoto(null); setAfterPhotoPreview(null); setFaceVerifyStatus(null); setFaceVerifyScore(null); }}
                                  className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-705 transition-colors shadow-lg"
                                >
                                  Remove Photo
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setShowEndSelfieCamera(true)}
                                className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 hover:bg-indigo-50/20 bg-white dark:bg-slate-950 transition-all shadow-sm"
                              >
                                <Camera size={24} className="text-indigo-600" />
                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Take Selfie / Photo</span>
                              </button>
                              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 hover:bg-indigo-50/20 bg-white dark:bg-slate-950 transition-all shadow-sm cursor-pointer">
                                <Upload size={24} className="text-indigo-600" />
                                <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Upload File</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleAfterPhotoFileChange}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        {showEndSelfieCamera && (
                          <SelfieCapture
                            onCapture={handleAfterPhotoCapture}
                            onCancel={() => setShowEndSelfieCamera(false)}
                          />
                        )}

                        {/* Face Verification Preview Section */}
                        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-stroke bg-white dark:bg-slate-950 shadow-sm">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity Verification Section</div>
                          <div className="grid grid-cols-2 gap-4 items-center">
                            {/* Start Photo Preview */}
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase">Start Photo</span>
                              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                {task.start_photo ? (
                                  <img src={`http://localhost:8000${task.start_photo}`} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase">No Start Photo</div>
                                )}
                              </div>
                            </div>
                            
                            {/* End Photo Preview */}
                            <div className="flex flex-col gap-1 items-center">
                              <span className="text-[9px] font-black text-slate-400 uppercase">End Photo</span>
                              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                {afterPhotoPreview ? (
                                  <img src={afterPhotoPreview} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase">Awaiting Photo</div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Verification Badge */}
                          <div className="mt-2 flex justify-center">
                            {faceVerifyStatus === "verifying" && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-indigo-50 border border-indigo-200 text-indigo-700 animate-pulse flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Verifying Facial Models...
                              </span>
                            )}
                            {faceVerifyStatus === "matched" && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-emerald-50 border border-emerald-200 text-emerald-805 flex items-center gap-1.5">
                                🟢 Identity Verified ({faceVerifyScore}% Match)
                              </span>
                            )}
                            {faceVerifyStatus === "mismatch" && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-red-50 border border-red-200 text-red-800 flex items-center gap-1.5">
                                🔴 Verification Failed ({faceVerifyScore}% Match)
                              </span>
                            )}
                            {faceVerifyStatus === "no_face" && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-red-50 border border-red-200 text-red-800 flex items-center gap-1.5">
                                🔴 Verification Failed (No face detected)
                              </span>
                            )}
                            {faceVerifyStatus === "skipped" && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
                                🟡 Identity Verification Skipped
                              </span>
                            )}
                            {!faceVerifyStatus && (
                              <span className="px-4 py-2 rounded-full text-xs font-black bg-slate-100 border border-slate-200 text-slate-500">
                                ⚪ Verification Pending Ending Photo
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Work Summary Notes */}
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Summary Notes</label>
                          <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Add brief description of task completion..."
                            className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold text-slate-900 dark:text-white focus:border-indigo-500 outline-none transition-all shadow-sm resize-none"
                            rows={2}
                          />
                        </div>

                        {/* Customer Digital Signature */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Digital Signature *</label>
                            <button
                              type="button"
                              onClick={clearCanvas}
                              className="text-[9px] font-black uppercase text-indigo-600 tracking-wider hover:text-indigo-800"
                            >
                              Clear Pad
                            </button>
                          </div>
                          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-900 h-32 relative">
                            <canvas
                              ref={canvasRef}
                              width={480}
                              height={128}
                              onMouseDown={startDrawing}
                              onMouseMove={draw}
                              onMouseUp={stopDrawing}
                              onMouseLeave={stopDrawing}
                              onTouchStart={startDrawing}
                              onTouchMove={draw}
                              onTouchEnd={stopDrawing}
                              className="w-full h-full cursor-crosshair touch-none"
                            />
                          </div>
                        </div>

                        {/* Customer OTP Verification */}
                        <div className="flex flex-col gap-2.5 p-4 rounded-2xl border border-stroke bg-white dark:bg-slate-950 shadow-sm">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer OTP Verification *</label>
                          
                          {otpVerified ? (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-black flex items-center gap-1.5">
                              <span>✓ Customer OTP Verification Successful</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={generateOtp}
                                className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-xl uppercase tracking-wider transition-colors border border-indigo-200"
                              >
                                Send OTP Code to Customer
                              </button>
                              {otpCode && (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={4}
                                    placeholder="Enter 4-digit code"
                                    value={otpInput}
                                    onChange={e => setOtpInput(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-center font-black text-sm tracking-widest outline-none focus:border-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={verifyOtp}
                                    className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl uppercase tracking-wider transition-colors"
                                  >
                                    Verify
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Complete Button */}
                        <button
                          type="button"
                          onClick={handleComplete}
                          disabled={
                            localBusy || 
                            busy || 
                            faceVerifyStatus === "verifying" || 
                            (task.start_photo && faceVerifyStatus !== "matched" && faceVerifyStatus !== "skipped") || 
                            !otpVerified
                          }
                          style={{
                            width: "100%",
                            padding: "15px 0",
                            borderRadius: 14,
                            border: "none",
                            background: (otpVerified && (!task.start_photo || faceVerifyStatus === "matched" || faceVerifyStatus === "skipped"))
                              ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                              : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
                            color: "#fff",
                            fontSize: 13,
                            fontWeight: 900,
                            cursor: (localBusy || busy) ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 10,
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            boxShadow: (otpVerified && (!task.start_photo || faceVerifyStatus === "matched" || faceVerifyStatus === "skipped"))
                              ? "0 6px 20px rgba(5,150,105,0.4)"
                              : "0 4px 12px rgba(100,116,139,0.2)",
                            transition: "all 0.25s ease",
                            opacity: (localBusy || busy) ? 0.6 : 1,
                          }}
                        >
                          <CheckCircle2 size={16} />
                          <span>{localBusy ? "Submitting…" : "Submit & Finish"}</span>
                          {!localBusy && <ChevronRight size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          )}

          {/* ── COMPLETED STATE ── */}
          {task.status === "completed" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: 14, textAlign: "center" }}>
              <div style={{ position: "relative", width: 76, height: 76, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#d1fae5", opacity: 0.5 }} />
                <div style={{ width: 62, height: 62, borderRadius: "50%", background: "#059669", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(5,150,105,0.35)" }}>
                  <CheckCircle2 size={32} style={{ color: "#fff" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.06em" }}>Work Completed</div>
                <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 3 }}>All objectives and requirements met</div>
              </div>
              {task.billed_hours && <BillingBadge billedHours={task.billed_hours} actualHours={task.actual_hours} estimatedHours={task.estimated_hours} />}
              <div style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Started At</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginTop: 3 }}>{task.started_at ? new Date(task.started_at).toLocaleString() : "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Completed At</div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", marginTop: 3 }}>{task.completed_at ? new Date(task.completed_at).toLocaleString() : "—"}</div>
                </div>
                <div style={{ gridColumn: "span 2", borderTop: "1px solid #f1f5f9", paddingTop: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Work Notes</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginTop: 3, fontStyle: "italic" }}>"{task.employee_notes || "No notes submitted"}"</div>
                </div>
              </div>
            </div>
          )}

          {/* ── SHOW ACTIVITY LOG ── */}
          <button onClick={toggleTimeline} 
            className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 w-full cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-3 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              <ClipboardList size={16} className="text-slate-400 dark:text-slate-500" />
              <span>{showTimeline ? "Hide" : "Show"} Activity Log</span>
              {loadingTimeline && <span className="text-[9px] font-bold text-slate-400 animate-pulse"> (loading...)</span>}
            </div>
            <ChevronDown size={16} className="text-slate-400 transition-transform duration-300" style={{ transform: showTimeline ? "rotate(180deg)" : "none" }} />
          </button>
          
          {showTimeline && (
            <div className="p-4 rounded-2xl bg-slate-50/30 dark:bg-slate-900/20 border border-slate-200/60 dark:border-slate-800 max-h-64 overflow-y-auto flex flex-col gap-3 shadow-inner">
              {timeline.length === 0 ? (
                <div className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-2">No activity recorded yet.</div>
              ) : timeline.map(entry => (
                <div key={entry.id} className="flex gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80 items-start last:border-0 last:pb-0">
                  <span className="text-base leading-none shrink-0">{entry.icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-300 tracking-tight">{entry.event_label}</div>
                    {entry.notes && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{entry.notes}</div>}
                    <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-2 font-extrabold uppercase tracking-wider">
                      {new Date(entry.timestamp).toLocaleString()} · {entry.actor_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
})
// ─── Declined Tasks Panel (Admin) ────────────────────────────
function DeclinedTasksPanel({ declinedTasks, availableEmployees, onReassigned }) {
  const [reassigning, setReassigning] = useState({}) // taskId → newUserId
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  if (!declinedTasks || declinedTasks.length === 0) return null

  // Sort employees: available first, then busy, on_break, on_leave, offline
  const ORDER = { available: 0, busy: 1, on_break: 2, on_leave: 3, offline: 4 }
  const sortedEmployees = [...availableEmployees].sort((a, b) => {
    const aOrder = ORDER[a.current_availability] ?? 5
    const bOrder = ORDER[b.current_availability] ?? 5
    return aOrder - bOrder
  })

  async function doReassign(taskId) {
    const newUserId = reassigning[taskId]
    if (!newUserId) return
    setBusy(true); setErr("")
    try {
      await apiRequest(`/tasks/admin/${taskId}/`, {
        method: "PATCH",
        json: { assigned_to: newUserId },
      })
      await onReassigned?.()
    } catch (ex) {
      setErr(ex?.body?.detail || "Reassignment failed.")
    } finally { setBusy(false) }
  }

  return (
    <div style={{
      borderRadius: 20, border: "1.5px solid #fca5a5",
      background: "linear-gradient(135deg, #fff5f5 0%, #fff 100%)",
      overflow: "hidden", boxShadow: "0 4px 24px rgba(220,38,38,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "18px 24px", display: "flex", alignItems: "center", gap: 12,
        borderBottom: "1px solid #fecaca",
        background: "linear-gradient(90deg, #fef2f2 0%, #fff 100%)",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "#fef2f2", border: "1.5px solid #fca5a5",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#dc2626",
        }}>
          <AlertTriangle size={18} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#991b1b", letterSpacing: "-0.01em" }}>
            Declined — Needs Reassignment
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#f87171", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {declinedTasks.length} task{declinedTasks.length !== 1 ? "s" : ""} rejected by employees
          </div>
        </div>
      </div>

      {err && (
        <div style={{ padding: "10px 24px", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>
          {err}
        </div>
      )}

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {declinedTasks.map((task, i) => (
          <div key={task.id} style={{
            padding: "20px 24px",
            borderBottom: i < declinedTasks.length - 1 ? "1px solid #fee2e2" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              {/* Task info */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#1e293b", letterSpacing: "-0.01em" }}>
                  {task.title}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginTop: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {task.category} · Due {task.due_date} · Est {task.estimated_hours}h
                </div>
                {task.decline_reason && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px", borderRadius: 10,
                    background: "#fff7ed", border: "1px solid #fed7aa",
                    fontSize: 12, color: "#92400e", fontStyle: "italic",
                  }}>
                    <span style={{ fontWeight: 800, fontStyle: "normal", marginRight: 4 }}>Reason:</span>
                    {task.decline_reason}
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 10, color: "#cbd5e1", fontWeight: 600 }}>
                  Declined by {task.assigned_to_detail?.first_name || task.assigned_to_detail?.username || "employee"}
                  {task.declined_at && ` · ${new Date(task.declined_at).toLocaleDateString()}`}
                </div>
              </div>

              {/* Reassign UI */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <select
                    value={reassigning[task.id] || ""}
                    onChange={e => setReassigning(prev => ({ ...prev, [task.id]: e.target.value }))}
                    style={{
                      padding: "8px 36px 8px 12px", borderRadius: 10,
                      border: "1.5px solid #e2e8f0", background: "#fff",
                      fontSize: 12, fontWeight: 700, color: "#334155",
                      cursor: "pointer", appearance: "none", outline: "none",
                      minWidth: 180,
                    }}
                  >
                    <option value="">— Reassign to —</option>
                    {sortedEmployees.map(emp => {
                      const avail = emp.current_availability || "offline"
                      const cfg = AVAILABILITY_CONFIG[avail] || AVAILABILITY_CONFIG.offline
                      const name = `${emp.first_name || emp.user?.first_name || emp.user?.username || "?"} ${emp.last_name || emp.user?.last_name || ""}`.trim()
                      return (
                        <option key={emp.id} value={emp.user?.id}>
                          {cfg.label.toUpperCase()} · {name}
                        </option>
                      )
                    })}
                  </select>
                  <RefreshCw size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
                </div>
                <button
                  onClick={() => doReassign(task.id)}
                  disabled={busy || !reassigning[task.id]}
                  style={{
                    padding: "8px 18px", borderRadius: 10, border: "none",
                    background: reassigning[task.id] ? "#4f46e5" : "#e2e8f0",
                    color: reassigning[task.id] ? "#fff" : "#94a3b8",
                    fontSize: 11, fontWeight: 900, cursor: reassigning[task.id] ? "pointer" : "not-allowed",
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "all 0.15s ease",
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  <UserCheck size={13} /> Reassign
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ADMIN: Assign Panel ─────────────────────────────────────
function AssignTaskPanel({ employees, jobSites, availableEmployees, onAssigned, onClose }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const fileInputRef = useRef(null)

  // ── Smart Address State ──────────────────────────────────────
  const [addressInput, setAddressInput] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [autocompleteLoading, setAutocompleteLoading] = useState(false)
  const [workflowLoading, setWorkflowLoading] = useState(false)
  const [workflowData, setWorkflowData] = useState(null)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [hoveredEmpId, setHoveredEmpId] = useState(null)
  const addressInputRef = useRef(null)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Sort employees by availability + GPS distance priority (Urban Company / Swiggy flow)
  const empList = useMemo(() => {
    const list = availableEmployees && availableEmployees.length > 0
      ? [...availableEmployees]
      : [...employees];

    const nearbyMap = {};
    if (workflowData?.nearby_employees) {
      workflowData.nearby_employees.forEach(rec => {
        nearbyMap[String(rec.user_id)] = rec;
      });
    }

    return list.map(emp => {
      const userId = emp.user?.id || emp.id;
      const nearbyDetail = nearbyMap[String(userId)];
      const avail = emp.current_availability || "offline";
      const isOnline = avail !== "offline";
      const isNearby = nearbyDetail && nearbyDetail.distance_km <= 10;

      let priority = 3; // OFFLINE
      if (isOnline) {
        priority = isNearby ? 1 : 2;
      }

      return {
        ...emp,
        nearbyDetail,
        isOnline,
        isNearby,
        priorityOrder: priority,
        distance_km: nearbyDetail ? nearbyDetail.distance_km : null,
      };
    }).sort((a, b) => {
      if (a.priorityOrder !== b.priorityOrder) {
        return a.priorityOrder - b.priorityOrder;
      }
      if (a.distance_km !== null && b.distance_km !== null) {
        return a.distance_km - b.distance_km;
      }
      if (a.distance_km !== null) return -1;
      if (b.distance_km !== null) return 1;

      const ORDER = { available: 0, busy: 1, on_break: 2, on_leave: 3, offline: 4 };
      return (ORDER[a.current_availability] ?? 5) - (ORDER[b.current_availability] ?? 5);
    });
  }, [availableEmployees, employees, workflowData]);

  // 1. Dynamic Address Autocomplete
  useEffect(() => {
    if (addressInput.trim().length < 3) {
      setSuggestions([])
      return
    }
    setLocationConfirmed(false)
    const t = setTimeout(async () => {
      setAutocompleteLoading(true)
      try {
        const data = await apiRequest(`/tasks/admin/address-autocomplete/?q=${encodeURIComponent(addressInput)}`)
        setSuggestions(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) setShowSuggestions(true)
      } catch (e) {
        console.error(e)
      } finally {
        setAutocompleteLoading(false)
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [addressInput])

  // 2. Select Suggestion & open map with pin
  async function selectAddressSuggestion(sug) {
    setAddressInput(sug.full_address)
    set("job_address", sug.full_address)
    setSuggestions([])
    setShowSuggestions(false)
    // Immediately place pin on map with the suggestion coordinates
    if (sug.lat && sug.lon) {
      set("location_lat", String(parseFloat(sug.lat).toFixed(6)))
      set("location_lon", String(parseFloat(sug.lon).toFixed(6)))
    }
    setWorkflowData(null)
    setLocationConfirmed(false)
  }

  // 3. Confirm Location → run full workflow
  async function confirmLocation() {
    const addressStr = addressInput || form.job_address
    if (!addressStr) return
    setWorkflowLoading(true)
    setErr("")
    try {
      const res = await apiRequest("/tasks/admin/smart-address-workflow/", {
        method: "POST",
        json: {
          address: addressStr,
          lat: form.location_lat ? parseFloat(form.location_lat) : undefined,
          lon: form.location_lon ? parseFloat(form.location_lon) : undefined,
        }
      })
      setWorkflowData(res)
      setLocationConfirmed(true)
      if (res.geocoded) {
        set("location_lat", String(parseFloat(res.geocoded.lat).toFixed(6)))
        set("location_lon", String(parseFloat(res.geocoded.lon).toFixed(6)))
        set("area", res.geocoded.area || "")
        set("city", res.geocoded.city || "")
        set("state", res.geocoded.state || "")
        set("pincode", res.geocoded.pincode || "")
        set("location", res.geocoded.zone || "")
      }
    } catch (e) {
      setErr("Failed to confirm location. Please try again.")
    } finally {
      setWorkflowLoading(false)
    }
  }

  // 4. Fallback: type address & confirm manually
  function clearLocation() {
    setAddressInput("")
    set("job_address", "")
    set("location_lat", "")
    set("location_lon", "")
    set("area", "")
    set("city", "")
    set("state", "")
    set("pincode", "")
    set("location", "")
    setWorkflowData(null)
    setLocationConfirmed(false)
    setSuggestions([])
    setTimeout(() => addressInputRef.current?.focus(), 100)
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
    const latVal = form.location_lat ? parseFloat(form.location_lat) : null
    const lonVal = form.location_lon ? parseFloat(form.location_lon) : null
    if (form.location_lat && isNaN(latVal)) return setErr("Latitude must be a valid number (e.g. 12.9716).")
    if (form.location_lon && isNaN(lonVal)) return setErr("Longitude must be a valid number (e.g. 77.5946).")
    setBusy(true); setErr("")
    try {
      const payload = {
        ...form,
        estimated_hours: parseFloat(form.estimated_hours) || 1,
        ...(latVal !== null ? { location_lat: latVal } : {}),
        ...(lonVal !== null ? { location_lon: lonVal } : {}),
      }
      if (!latVal) delete payload.location_lat
      if (!lonVal) delete payload.location_lon
      if (!payload.geofence_radius) delete payload.geofence_radius
      if (!payload.job_site) delete payload.job_site
      if (!payload.sla_deadline) delete payload.sla_deadline
      else payload.sla_deadline = new Date(payload.sla_deadline).toISOString()

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
      setWorkflowData(null)
      setAddressInput("")
      setLocationConfirmed(false)
      setShowMore(false)
      await onAssigned?.()
      onClose?.()
    } catch (ex) {
      setErr(ex?.body?.detail || "Failed to assign task.")
    } finally {
      setBusy(false)
    }
  }

  const mapCenter = form.location_lat && form.location_lon
    ? [parseFloat(form.location_lat), parseFloat(form.location_lon)]
    : [12.7419, 77.8238] // Samathuvapuram Bus Stand, Hosur

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      {err && (
        <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-sm font-semibold flex items-center gap-2 animate-bounce">
          <AlertCircle size={18} /> {err}
        </div>
      )}

      {/* ── SECTION: GENERAL DETAILS ── */}
      <div className="bg-surface dark:bg-slate-900/40 p-6 rounded-3xl border border-stroke dark:border-slate-800 shadow-sm flex flex-col gap-6">
        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 flex items-center gap-2">
          <Sparkles size={13} className="text-indigo-500" /> General Details
        </div>

        <div>
          <Input
            value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="e.g. Repair HVAC unit in Block B"
            label="Task Title *"
            className="text-lg font-black tracking-tight"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Assign To — with availability sorting */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex justify-between items-center">
              <span>Assign To *</span>
              {form.assigned_to && (
                <span className="text-[10px] text-indigo-600 font-extrabold uppercase">Selected</span>
              )}
            </div>
            <select
              value={form.assigned_to}
              onChange={e => set("assigned_to", e.target.value)}
              required
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid #e2e8f0", background: "#fff",
                fontSize: 13, fontWeight: 700, color: "#334155",
                outline: "none", cursor: "pointer",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <option value="">— Select employee —</option>
              {empList.map(emp => {
                const avail = emp.current_availability || "offline"
                const cfg = AVAILABILITY_CONFIG[avail] || AVAILABILITY_CONFIG.offline
                const userId = emp.user?.id || emp.id
                const name = `${emp.first_name || emp.user?.first_name || emp.user?.username || "?"} ${emp.last_name || emp.user?.last_name || ""}`.trim()

                let displayLabel = `[${cfg.label.toUpperCase()}] ${name}`;
                if (emp.isOnline) {
                  if (emp.nearbyDetail) {
                    const distStr = `${emp.nearbyDetail.distance_km}km`;
                    const etaMin = Math.max(1, Math.round(emp.nearbyDetail.distance_km / 30 * 60));
                    displayLabel = `🟢 [ONLINE · ${distStr} · ETA: ${etaMin}m] ${name} (${cfg.label})`;
                  } else {
                    displayLabel = `🟢 [ONLINE] ${name} (${cfg.label})`;
                  }
                } else {
                  displayLabel = `🔴 [OFFLINE] ${name}`;
                }

                return (
                  <option key={emp.id} value={userId}>
                    {displayLabel}
                  </option>
                )
              })}
            </select>
            {/* Availability legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {Object.entries(AVAILABILITY_CONFIG).map(([k, v]) => (
                <span key={k} style={{
                  fontSize: 9, fontWeight: 900, color: v.color,
                  background: v.bg, border: `1px solid ${v.color}25`,
                  padding: "3px 8px", borderRadius: 20, letterSpacing: "0.06em", textTransform: "uppercase",
                  boxShadow: `0 0 4px ${v.color}10`
                }}>
                  ● {v.label}
                </span>
              ))}
            </div>
          </div>

          <Select
            label="Job Site"
            value={form.job_site}
            onChange={e => set("job_site", e.target.value)}
            options={[
              { value: "", label: "— No specified site —" },
              ...jobSites.map(site => ({ value: site.id, label: site.name }))
            ]}
          />

          <Select
            label="Category *"
            value={form.category}
            onChange={e => set("category", e.target.value)}
            options={CATEGORIES}
            required
          />

          <Input
            label="Due Date *"
            type="date"
            value={form.due_date}
            onChange={e => set("due_date", e.target.value)}
            required
          />

          <Select
            label="Priority *"
            value={form.priority}
            onChange={e => set("priority", e.target.value)}
            options={PRIORITIES.map(p => ({ value: p.value, label: p.label }))}
            required
          />

          <Select
            label="Status"
            value={form.status}
            onChange={e => set("status", e.target.value)}
            options={[{ value: "pending", label: "Pending" }]}
            disabled
          />
        </div>
      </div>

      {/* ── EXPANDER LINK ── */}
      <div className="flex justify-center my-2">
        <button
          type="button"
          className="px-6 py-2.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-slate-900 dark:text-indigo-400 dark:hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest hover:shadow transition-all flex items-center gap-1.5 border border-indigo-100/50 dark:border-slate-800"
          onClick={() => setShowMore(v => !v)}
        >
          {showMore ? "- Hide Properties" : "+ Add properties (GPS, Client, Requirements, Problem)"}
        </button>
      </div>

      {/* ── SECTION: ADVANCED PROPERTIES ── */}
      {showMore && (
        <div className="bg-surface dark:bg-slate-900/40 p-6 rounded-3xl border border-stroke dark:border-slate-800 shadow-sm flex flex-col gap-8 animate-in fade-in slide-in-from-top-3 duration-300">

          {/* CLIENT DETAILS */}
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 mb-4 flex items-center gap-1.5">
              <User size={13} className="text-indigo-500" /> Client Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Company Name"
                value={form.client_company_name}
                onChange={e => set("client_company_name", e.target.value)}
                placeholder="e.g. Prestige Estates"
              />
              <Input
                label="Customer Name"
                value={form.client_name}
                onChange={e => set("client_name", e.target.value)}
                placeholder="e.g. Ramesh Kumar"
              />
              <Input
                label="Contact Number"
                value={form.client_contact_number}
                onChange={e => set("client_contact_number", e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
              <Input
                label="Alternate Number"
                value={form.client_alternate_number}
                onChange={e => set("client_alternate_number", e.target.value)}
                placeholder="e.g. +91 98765 43211"
              />
              <div className="md:col-span-2">
                <Input
                  label="Email Address"
                  type="email"
                  value={form.client_email}
                  onChange={e => set("client_email", e.target.value)}
                  placeholder="e.g. ramesh@example.com"
                />
              </div>
            </div>
          </div>

          {/* PROBLEM DETAILS */}
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 mb-4 flex items-center gap-1.5">
              <Flag size={13} className="text-indigo-500" /> Problem Details
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Subcategory"
                value={form.subcategory}
                onChange={e => set("subcategory", e.target.value)}
                placeholder="e.g. Leakage / Compressor Failure"
              />
              <Input
                label="Service Type"
                value={form.service_type}
                onChange={e => set("service_type", e.target.value)}
                placeholder="e.g. Periodic Maintenance / Emergency Repair"
              />
              <TextArea
                label="Required Tools"
                value={form.required_tools}
                onChange={e => set("required_tools", e.target.value)}
                placeholder="e.g. Screwdriver set, Multimeter, Pressure gauge"
                rows={2}
              />
              <TextArea
                label="Required Spare Parts"
                value={form.required_spare_parts}
                onChange={e => set("required_spare_parts", e.target.value)}
                placeholder="e.g. 1.5 Ton Compressor, R32 Refrigerant Gas 1kg"
                rows={2}
              />
            </div>
          </div>

          {/* ═══ ADDRESS & GPS — PROFESSIONAL SWIGGY-STYLE ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 mb-4 flex items-center gap-1.5">
              <MapPin size={13} className="text-indigo-500" /> Client Location & GPS
            </div>

            {/* ── SEARCH BAR (Urban Company Style) ── */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <div style={{
                display: "flex", alignItems: "center",
                border: locationConfirmed ? "2px solid #059669" : "2px solid #6366f1",
                borderRadius: 16, background: "white",
                boxShadow: locationConfirmed
                  ? "0 0 0 3px #059669" + "20"
                  : "0 0 0 3px #6366f1" + "15, 0 4px 20px rgba(99,102,241,0.1)",
                overflow: "hidden",
                transition: "all 0.3s ease",
              }}>
                <div style={{ padding: "0 14px", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  {workflowLoading
                    ? <Loader2 size={18} style={{ color: "#6366f1", animation: "spin 1s linear infinite" }} />
                    : locationConfirmed
                      ? <CheckCircle2 size={18} style={{ color: "#059669" }} />
                      : <MapPin size={18} style={{ color: "#6366f1" }} />
                  }
                </div>
                <input
                  ref={addressInputRef}
                  type="text"
                  value={addressInput}
                  onChange={e => { setAddressInput(e.target.value); setShowSuggestions(true); setLocationConfirmed(false) }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Search client address or landmark... (e.g. Sivakasi Bus Stand)"
                  style={{
                    flex: 1, padding: "14px 0", border: "none", outline: "none",
                    fontSize: 13, fontWeight: 600, color: "#1e293b",
                    background: "transparent",
                  }}
                />
                {addressInput && (
                  <button
                    type="button"
                    onClick={clearLocation}
                    style={{ padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown — Google Maps Style */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                  background: "white", borderRadius: 16,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
                  border: "1px solid #e2e8f0",
                  zIndex: 2000, overflow: "hidden",
                  maxHeight: 280, overflowY: "auto",
                }}>
                  {suggestions.map((sug, i) => (
                    <div
                      key={i}
                      onMouseDown={() => selectAddressSuggestion(sug)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "12px 16px",
                        borderBottom: i < suggestions.length - 1 ? "1px solid #f1f5f9" : "none",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      className="hover:bg-indigo-50"
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: "#eff6ff", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <MapPin size={16} style={{ color: "#6366f1" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 2 }}>
                          {sug.name || sug.full_address?.split(",")[0]}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, lineHeight: 1.4 }}>
                          {sug.full_address}
                        </div>
                      </div>
                      {sug.source === "local" && (
                        <span style={{ fontSize: 9, fontWeight: 900, color: "#059669", background: "#ecfdf5", padding: "2px 6px", borderRadius: 4, alignSelf: "center", letterSpacing: "0.05em", flexShrink: 0 }}>INSTANT</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── ALWAYS-VISIBLE LEAFLET MAP ── */}
            <div style={{
              position: "relative", borderRadius: 20, overflow: "hidden",
              border: locationConfirmed ? "2px solid #059669" : "1.5px solid #e2e8f0",
              boxShadow: locationConfirmed ? "0 0 0 3px #05996920" : "0 2px 12px rgba(0,0,0,0.06)",
              height: 340, marginBottom: 16,
              transition: "all 0.4s ease",
            }}>
              <MapContainer
                center={form.location_lat && form.location_lon
                  ? [parseFloat(form.location_lat), parseFloat(form.location_lon)]
                  : [20.5937, 78.9629]} // India center
                zoom={form.location_lat ? 14 : 5}
                style={{ width: "100%", height: "100%" }}
                zoomControl
              >
                <ModalMapController center={
                  form.location_lat && form.location_lon
                    ? [parseFloat(form.location_lat), parseFloat(form.location_lon)]
                    : null
                } />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap"
                />

                {/* 🔴 Client Pin */}
                {form.location_lat && form.location_lon && (
                  <Marker
                    position={[parseFloat(form.location_lat), parseFloat(form.location_lon)]}
                    icon={L.divIcon({
                      className: "",
                      html: `<div style="
                        position:relative;
                        display:flex;flex-direction:column;align-items:center;
                      ">
                        <div style="
                          width:44px;height:44px;border-radius:50% 50% 50% 0;
                          transform:rotate(-45deg);
                          background:linear-gradient(135deg,#e94560,#ff6b6b);
                          border:3px solid white;
                          box-shadow:0 4px 16px rgba(233,69,96,0.5);
                          display:flex;align-items:center;justify-content:center;
                        ">
                          <div style="transform:rotate(45deg);font-size:20px">🏢</div>
                        </div>
                        <div style="
                          margin-top:4px;background:rgba(233,69,96,0.9);color:white;
                          padding:2px 8px;border-radius:20px;font-size:10px;
                          font-weight:900;white-space:nowrap;
                          box-shadow:0 2px 8px rgba(0,0,0,0.2);
                        ">CLIENT</div>
                      </div>`,
                      iconSize: [60, 70],
                      iconAnchor: [30, 60],
                      popupAnchor: [0, -60],
                    })}
                  >
                    <Popup>
                      <div style={{ fontSize: 12, fontWeight: 800, padding: 4 }}>
                        📍 {addressInput || "Client Location"}
                        {form.area && <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{form.area}, {form.city}</div>}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Green geofence circle */}
                {form.location_lat && form.location_lon && (
                  <Circle
                    center={[parseFloat(form.location_lat), parseFloat(form.location_lon)]}
                    radius={parseInt(form.geofence_radius) || 200}
                    pathOptions={{ color: "#059669", fillColor: "#059669", fillOpacity: 0.08, weight: 2, dashArray: "6 4" }}
                  />
                )}

                {/* 🟡/🟢 Employee Pins from recommendations */}
                {workflowData?.nearby_employees?.map((rec) => {
                  if (!rec.lat || !rec.lon) return null
                  const isAssigned = form.assigned_to === rec.user_id
                  const isHighly = rec.recommendation_grade === "highly_recommended"
                  const pinColor = isAssigned ? "#4f46e5" : isHighly ? "#059669" : rec.availability === "busy" ? "#f59e0b" : "#64748b"
                  const isHovered = hoveredEmpId === rec.employee_id
                  return (
                    <Marker
                      key={`emp-pin-${rec.employee_id}`}
                      position={[parseFloat(rec.lat), parseFloat(rec.lon)]}
                      icon={L.divIcon({
                        className: "",
                        html: `<div style="
                          position:relative;
                          display:flex;flex-direction:column;align-items:center;
                          transition:all 0.2s;
                          transform:${isHovered || isAssigned ? "scale(1.3)" : "scale(1)"};
                        ">
                          <div style="
                            width:${isAssigned ? 38 : 32}px;height:${isAssigned ? 38 : 32}px;
                            border-radius:${isAssigned ? 12 : 10}px;
                            background:${pinColor};
                            border:3px solid white;
                            box-shadow:0 4px 12px ${pinColor}60;
                            display:flex;align-items:center;justify-content:center;
                            color:white;font-size:${isAssigned ? 16 : 13}px;font-weight:900;
                          ">${isAssigned ? "✓" : "👷"}</div>
                          <div style="
                            margin-top:2px;background:${pinColor};color:white;
                            padding:1px 6px;border-radius:10px;font-size:9px;
                            font-weight:900;white-space:nowrap;max-width:80px;
                            overflow:hidden;text-overflow:ellipsis;
                          ">${rec.employee_name.split(" ")[0]}</div>
                        </div>`,
                        iconSize: [80, 56],
                        iconAnchor: [40, 48],
                      })}
                    >
                      <Popup>
                        <div style={{ fontSize: 12, fontWeight: 800, padding: 4 }}>
                          👷 {rec.employee_name}<br />
                          <span style={{ fontSize: 10, color: "#64748b" }}>{rec.distance_km}km · {rec.area_name}</span>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}

                {/* 10KM dispatch radius (dashed) */}
                {form.location_lat && form.location_lon && (
                  <Circle
                    center={[parseFloat(form.location_lat), parseFloat(form.location_lon)]}
                    radius={10000}
                    pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.02, weight: 1, dashArray: "8 6" }}
                  />
                )}
              </MapContainer>

              {/* Map overlay labels */}
              {!form.location_lat && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.85)",
                  pointerEvents: "none", zIndex: 500,
                  gap: 12,
                }}>
                  <div style={{ fontSize: 40 }}>🗺️</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#64748b", textAlign: "center" }}>
                    Search client address above<br />
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>Map will auto-pin the location</span>
                  </div>
                </div>
              )}

              {/* Location confirmed badge */}
              {locationConfirmed && (
                <div style={{
                  position: "absolute", top: 12, right: 12,
                  background: "linear-gradient(135deg,#059669,#10b981)",
                  color: "white", padding: "6px 14px", borderRadius: 20,
                  fontSize: 11, fontWeight: 900, zIndex: 600,
                  boxShadow: "0 4px 12px rgba(5,150,105,0.4)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <CheckCircle2 size={14} /> Location Confirmed
                </div>
              )}
            </div>

            {/* ── CONFIRM LOCATION BUTTON ── */}
            {form.location_lat && form.location_lon && !locationConfirmed && (
              <button
                type="button"
                onClick={confirmLocation}
                disabled={workflowLoading}
                style={{
                  width: "100%", padding: "14px",
                  background: workflowLoading
                    ? "#e2e8f0"
                    : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  color: workflowLoading ? "#94a3b8" : "white",
                  border: "none", borderRadius: 14,
                  fontSize: 13, fontWeight: 900, letterSpacing: "0.08em",
                  cursor: workflowLoading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: workflowLoading ? "none" : "0 4px 20px rgba(99,102,241,0.35)",
                  transition: "all 0.2s ease",
                  marginBottom: 16,
                }}
              >
                {workflowLoading
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> DETECTING AREA & NEARBY TEAM...</>
                  : <><CheckCircle2 size={16} /> CONFIRM CLIENT LOCATION & FIND NEARBY TEAM</>
                }
              </button>
            )}

            {/* ── AUTO-FILLED LOCATION DETAILS ── */}
            {(form.area || form.city || form.state || form.pincode) && (
              <div style={{
                background: locationConfirmed ? "#f0fdf4" : "#f8fafc",
                border: `1.5px solid ${locationConfirmed ? "#a7f3d0" : "#e2e8f0"}`,
                borderRadius: 16, padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: locationConfirmed ? "#059669" : "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin size={11} /> Auto-Detected Location Details
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {[["Area", "area", "e.g. Sivakasi"], ["City", "city", "e.g. Virudhunagar"], ["State", "state", "e.g. Tamil Nadu"], ["Pincode", "pincode", "e.g. 626123"]].map(([label, field, ph]) => (
                    <div key={field}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                      <input
                        type="text"
                        value={form[field]}
                        onChange={e => set(field, e.target.value)}
                        placeholder={ph}
                        style={{
                          width: "100%", padding: "8px 10px", borderRadius: 10,
                          border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700,
                          outline: "none", background: "white", color: "#1e293b",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: "1 / 3" }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Landmark</div>
                    <input type="text" value={form.landmark} onChange={e => set("landmark", e.target.value)} placeholder="e.g. Near Bus Stand" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, outline: "none", background: "white", color: "#1e293b", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Latitude</div>
                    <input type="text" value={form.location_lat} onChange={e => set("location_lat", e.target.value)} placeholder="Auto" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, outline: "none", background: "white", color: "#1e293b", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Longitude</div>
                    <input type="text" value={form.location_lon} onChange={e => set("location_lon", e.target.value)} placeholder="Auto" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, outline: "none", background: "white", color: "#1e293b", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Geofence (m)</div>
                    <input type="number" value={form.geofence_radius} onChange={e => set("geofence_radius", e.target.value)} placeholder="200" style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, outline: "none", background: "white", color: "#1e293b", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>
            )}

            {/* ── SWIGGY-STYLE NEARBY EMPLOYEE CARDS ── */}
            {workflowData?.nearby_employees && locationConfirmed && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Validation alerts */}
                {workflowData.validation?.issues?.map((iss, idx) => (
                  <div key={idx} style={{ padding: "10px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertCircle size={14} /> {iss}
                  </div>
                ))}
                {workflowData.validation?.warnings?.map((warn, idx) => (
                  <div key={idx} style={{ padding: "10px 14px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 12, color: "#b45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={14} /> {warn}
                  </div>
                ))}

                {/* Zone check */}
                {workflowData.zone_check && (
                  <div style={{
                    padding: "10px 16px", borderRadius: 14,
                    background: workflowData.zone_check.in_service_zone ? "#ecfdf5" : "#fff5f5",
                    border: `2px solid ${workflowData.zone_check.in_service_zone ? "#a7f3d0" : "#fca5a5"}`,
                    fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 8,
                    color: workflowData.zone_check.in_service_zone ? "#065f46" : "#dc2626",
                  }}>
                    {workflowData.zone_check.in_service_zone
                      ? <><CheckCircle2 size={14} /> In Service Zone: {workflowData.zone_check.matched_zone_name || workflowData.zone_check.matched_location_name || "Primary Zone"}</>
                      : <><AlertCircle size={14} /> Outside service zones — nearest: {workflowData.zone_check.nearest_location_name || "N/A"} ({((workflowData.zone_check.nearest_distance_m || 0) / 1000).toFixed(1)}km)</>}
                  </div>
                )}

                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                    <Sparkles size={14} style={{ color: "#6366f1" }} />
                    NEARBY TEAM — {workflowData.nearby_employees.length} found within 10KM
                  </div>
                  {workflowData.nearby_employees.length === 0 && (
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>No employees tracked nearby</span>
                  )}
                </div>

                {/* Employee recommendation cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {workflowData.nearby_employees.map((rec) => {
                    const isHighly = rec.recommendation_grade === "highly_recommended"
                    const isRecommended = rec.recommendation_grade === "recommended"
                    const isAssigned = form.assigned_to === rec.user_id
                    const avColor = rec.availability === "available" ? "#059669" : rec.availability === "busy" ? "#d97706" : "#94a3b8"
                    const badgeColor = isHighly ? "#059669" : isRecommended ? "#6366f1" : "#64748b"
                    const badgeBg = isHighly ? "#ecfdf5" : isRecommended ? "#eff6ff" : "#f1f5f9"

                    return (
                      <div
                        key={rec.employee_id}
                        onMouseEnter={() => setHoveredEmpId(rec.employee_id)}
                        onMouseLeave={() => setHoveredEmpId(null)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "14px 16px", borderRadius: 18,
                          border: isAssigned ? "2px solid #6366f1" : "1.5px solid #e2e8f0",
                          background: isAssigned
                            ? "linear-gradient(135deg,#eff6ff,#f5f3ff)"
                            : "white",
                          boxShadow: isAssigned
                            ? "0 4px 20px rgba(99,102,241,0.15)"
                            : "0 2px 8px rgba(0,0,0,0.04)",
                          transition: "all 0.2s ease",
                          cursor: "pointer",
                        }}
                        onClick={() => set("assigned_to", rec.user_id)}
                      >
                        {/* Avatar with pulsing dot */}
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <div style={{
                            width: 46, height: 46, borderRadius: 14,
                            background: `linear-gradient(135deg,${avColor}20,${avColor}10)`,
                            border: `2px solid ${avColor}40`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 18, fontWeight: 900, color: avColor,
                          }}>
                            {rec.employee_name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{
                            position: "absolute", bottom: -2, right: -2,
                            width: 14, height: 14, borderRadius: "50%",
                            background: avColor,
                            border: "2px solid white",
                            boxShadow: `0 0 0 3px ${avColor}30`,
                          }} />
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{rec.employee_name}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 900,
                              padding: "2px 7px", borderRadius: 6,
                              color: badgeColor, background: badgeBg,
                              border: `1px solid ${badgeColor}20`,
                              letterSpacing: "0.06em", textTransform: "uppercase",
                            }}>
                              {isHighly ? "⚡ BEST MATCH" : isRecommended ? "★ RECOMMENDED" : "NEAREST"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                            <span>🚗 {rec.distance_km}km · {rec.area_name}</span>
                            <span style={{ color: avColor, fontWeight: 800 }}>● {rec.availability.replace("_", " ").toUpperCase()}</span>
                          </div>
                          {rec.has_current_task && (
                            <div style={{ fontSize: 10, color: "#b45309", fontWeight: 700, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={10} />
                              Busy: "{rec.current_task_title}" — can queue next job
                            </div>
                          )}
                        </div>

                        {/* Assign button */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); set("assigned_to", rec.user_id) }}
                          style={{
                            padding: "8px 16px", borderRadius: 12, border: "none",
                            background: isAssigned
                              ? "linear-gradient(135deg,#059669,#10b981)"
                              : isHighly
                                ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
                                : "#f1f5f9",
                            color: isAssigned ? "white" : isHighly ? "white" : "#64748b",
                            fontSize: 11, fontWeight: 900, cursor: "pointer",
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            display: "flex", alignItems: "center", gap: 5,
                            boxShadow: (isAssigned || isHighly) ? "0 2px 12px rgba(99,102,241,0.25)" : "none",
                            transition: "all 0.2s ease", flexShrink: 0,
                          }}
                        >
                          {isAssigned ? <><CheckCircle2 size={12} /> Assigned</> : "Assign"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* SLA & SPECIFIC SETTINGS */}
          <div>
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 mb-4 flex items-center gap-1.5">
              <Clock size={13} className="text-indigo-500" /> SLA & Requirements
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Estimated Hours"
                type="number"
                min="0.5"
                step="0.5"
                value={form.estimated_hours}
                onChange={e => set("estimated_hours", e.target.value)}
              />
              <div>
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                  ⏱ Expected SLA Deadline <span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "none" }}>(pausing blocked when &lt;30m)</span>
                </div>
                <input
                  type="datetime-local"
                  value={form.sla_deadline}
                  onChange={e => set("sla_deadline", e.target.value)}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 12,
                    border: "1.5px solid #e2e8f0", fontSize: 13, color: "#1e293b",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <div className="text-sm font-semibold text-slate-700 mb-3">Verification Checklist</div>
                <div className="flex gap-8">
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-600 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={form.require_selfie} onChange={e => set("require_selfie", e.target.checked)} />
                    Require Selfie at Clock-in
                  </label>
                  <label className="flex items-center gap-2.5 text-sm font-medium text-slate-600 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={form.require_before_after_photos} onChange={e => set("require_before_after_photos", e.target.checked)} />
                    Before & After Photo uploads
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: ATTACHMENTS & DOCUMENTATION ── */}
      <div className="bg-surface dark:bg-slate-900/40 p-6 rounded-3xl border border-stroke dark:border-slate-800 shadow-sm flex flex-col gap-6">
        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-stroke dark:border-slate-800 pb-2 flex items-center gap-1.5">
          <Paperclip size={13} className="text-indigo-500" /> Attachments & Documentation
        </div>
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${dragging ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-bg dark:bg-slate-950/40 shadow-sm border border-stroke dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600">
              <Paperclip size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Drag & drop files here</p>
              <p className="text-xs text-slate-400 mt-1">or click to browse your computer</p>
            </div>
            <Button type="button" variant="ghost" className="mt-2 border border-stroke dark:border-slate-800 bg-bg dark:bg-slate-950/40" onClick={() => fileInputRef.current?.click()}>
              Choose Files
            </Button>
            <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((f, idx) => (
              <div key={`${f.name}:${f.size}:${f.lastModified}`} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-bg dark:bg-slate-950/40 border border-stroke dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="truncate max-w-[150px]">{f.name}</span>
                <button type="button" className="p-1 rounded-md hover:bg-rose-50 hover:text-rose-600 transition-colors" onClick={() => removeFile(idx)}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <TextArea
        label="Description / Work Instructions *"
        rows={3}
        value={form.description}
        onChange={e => set("description", e.target.value)}
        placeholder="Add a more detailed description or instructions..."
        required
      />

      <Input
        label="Internal Admin Notes"
        value={form.admin_notes}
        onChange={e => set("admin_notes", e.target.value)}
        placeholder="Private notes for admins only..."
      />

      <div className="pt-4">
        <Button type="submit" className="w-full py-4 text-base shadow-lg shadow-indigo-200/40 font-black tracking-widest" disabled={busy}>
          {busy ? <Loader2 size={20} className="animate-spin mr-2" /> : <Save size={20} className="mr-2" />}
          CREATE WORK ORDER
        </Button>
      </div>
    </form>
  )
}

// ─── ADMIN: All Tasks Table ──────────────────────────────────
function AdminTasksTable({ tasks, employees, availableEmployees, jobSites, onRefresh, onRowClick }) {
  const [busy, setBusy] = useState(false)
  const [selectedParent, setSelectedParent] = useState({})

  async function deleteTask(id) {
    if (!window.confirm("Delete this task?")) return
    setBusy(true)
    try { await apiRequest(`/tasks/admin/${id}/`, { method: "DELETE" }); onRefresh() }
    catch { /* ignore */ }
    finally { setBusy(false) }
  }

  async function handlePushGapJob(gapTaskId) {
    const parentTaskId = selectedParent[gapTaskId]
    if (!parentTaskId) return
    setBusy(true)
    try {
      await apiRequest(`/tasks/admin/${gapTaskId}/push-gap-job/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_task_id: parentTaskId }),
      })
      setSelectedParent(prev => ({ ...prev, [gapTaskId]: "" }))
      onRefresh?.()
    } catch (ex) {
      alert(ex?.body?.detail || "Failed to push gap job.")
    } finally {
      setBusy(false)
    }
  }

  function getEmp(id) {
    // Try availableEmployees first (has availability), fallback to employees
    const fromAvail = availableEmployees.find(e => e.user?.id === id || String(e.user?.id) === String(id))
    if (fromAvail) return fromAvail
    const fromEmp = employees.find(x => x.user?.id === id || String(x.user?.id) === String(id))
    return fromEmp
  }

  const suspendedTasks = tasks.filter(t => t.status === "suspended")

  return (
    <div className="overflow-hidden rounded-3xl border border-stroke dark:border-slate-800 bg-surface dark:bg-slate-900/60 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface2 dark:bg-slate-900/50 border-b border-stroke dark:border-slate-800">
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Job Details</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigned To</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Acceptance</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Face Match %</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verification Status</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
              <th className="p-6 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke dark:divide-slate-800">
            {tasks.length === 0 && (
              <tr>
                <td colSpan={8} className="p-24 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                    <ClipboardList size={32} className="opacity-20" />
                    No jobs in this view.
                  </div>
                </td>
              </tr>
            )}
            {tasks.map(t => {
              const emp = getEmp(t.assigned_to)
              const avail = emp?.current_availability
              return (
                <tr
                  key={t.id}
                  className="hover:bg-bg dark:hover:bg-slate-950/40 transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(t)}
                >
                  <td className="px-6 py-4">
                    <div className="font-black text-slate-900 dark:text-white text-sm tracking-tight">{t.title}</div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${priorityColorClass(t.priority)} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
                        {t.priority}
                      </span>
                      <span className="opacity-30">|</span>
                      <span>{categoryLabel(t.category)}</span>
                      {t.job_site_name && (
                        <><span className="opacity-30">|</span><span className="text-indigo-600 dark:text-indigo-400">🏢 {t.job_site_name}</span></>
                      )}
                    </div>
                    {(t.require_selfie || t.require_before_after_photos) && (
                      <div className="flex items-center gap-1.5 mt-2 text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                        <Camera size={12} />
                        {t.require_selfie && "Selfie"}
                        {t.require_selfie && t.require_before_after_photos && " + "}
                        {t.require_before_after_photos && "Photos"} Required
                      </div>
                    )}
                    {/* Suspension detail panel for admin */}
                    {t.status === "suspended" && (
                      <div style={{
                        marginTop: 10, padding: "8px 12px", borderRadius: 10,
                        background: "linear-gradient(135deg, #fef3c7 0%, #fff 100%)",
                        border: "1px solid #fde68a", fontSize: 11, color: "#78350f"
                      }}>
                        <div className="font-bold flex items-center gap-1.5 uppercase text-[9px] tracking-wider text-amber-800">
                          ⏸️ JOB SUSPENDED
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <span className="font-semibold text-amber-900">Reason:</span> {t.suspend_reason || "None"}
                        </div>
                        {t.resume_deadline && (
                          <div style={{ marginTop: 2, color: new Date() > new Date(t.resume_deadline) ? "#dc2626" : "inherit" }}>
                            <span className="font-semibold">Return Deadline:</span> {new Date(t.resume_deadline).toLocaleString()}
                            {new Date() > new Date(t.resume_deadline) && " (OVERDUE)"}
                          </div>
                        )}
                        {t.gap_job && (
                          <div style={{ marginTop: 4, display: "inline-block", padding: "2px 6px", borderRadius: 4, background: "#ecfdf5", color: "#065f46", fontSize: 9, fontWeight: 900 }}>
                            ⚡ Linked Gap Job: #{t.gap_job}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Billing badge for short completed tasks */}
                    {t.status === "completed" && t.billed_hours && parseFloat(t.estimated_hours) < 1 && (
                      <div style={{ marginTop: 6 }}>
                        <BillingBadge billedHours={t.billed_hours} actualHours={t.actual_hours} estimatedHours={t.estimated_hours} />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {emp && emp.user ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-100 dark:border-indigo-800">
                            {(emp.user.first_name || emp.user.username || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {emp.user.first_name || emp.user.username} {emp.user.last_name || ""}
                          </div>
                        </div>
                        {avail && <AvailabilityBadge status={avail} size="xs" />}
                      </div>
                    ) : <span className="text-slate-300 dark:text-slate-600 italic text-sm">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.due_date}</td>
                  <td className="px-6 py-4">
                    <Pill tone={acceptanceTone(t.acceptance_status)}>
                      {acceptanceLabel(t.acceptance_status)}
                    </Pill>
                    {t.decline_reason && (
                      <div style={{ marginTop: 4, fontSize: 10, color: "#f87171", fontStyle: "italic", maxWidth: 160 }}>
                        "{t.decline_reason.slice(0, 60)}{t.decline_reason.length > 60 ? "…" : ""}"
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t.face_match_percentage !== null && t.face_match_percentage !== undefined ? (
                      <span className={t.face_match_percentage >= 90 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {t.face_match_percentage.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {t.face_match_status === "verified" ? (
                      <Pill tone="good">🟢 Verified</Pill>
                    ) : t.face_match_status === "failed" ? (
                      <Pill tone="bad">🔴 Failed</Pill>
                    ) : t.face_match_status === "skipped" ? (
                      <Pill tone="neutral">⚪ Skipped</Pill>
                    ) : t.face_match_status === "pending" ? (
                      <Pill tone="warn">🟡 Pending</Pill>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <div>
                        <Pill tone={statusTone(t.status)}>{statusLabel(t.status)}</Pill>
                      </div>
                      {/* Push gap job selector */}
                      {t.status === "pending" && suspendedTasks.length > 0 && (
                        <div style={{
                          marginTop: 6, display: "flex", flexDirection: "column", gap: 4,
                          padding: 8, borderRadius: 10, border: "1px solid #cbd5e1",
                          backgroundColor: "#f8fafc", width: 160
                        }}>
                          <span style={{ fontSize: 8, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            ⚡ Push as Gap Job:
                          </span>
                          <select
                            value={selectedParent[t.id] || ""}
                            onChange={e => setSelectedParent(prev => ({ ...prev, [t.id]: e.target.value }))}
                            style={{
                              width: "100%", padding: "4px", borderRadius: 6, border: "1px solid #cbd5e1",
                              fontSize: 9, fontWeight: 700, color: "#334155", background: "#fff",
                              outline: "none", cursor: "pointer"
                            }}
                          >
                            <option value="">— Select Target —</option>
                            {suspendedTasks.map(st => {
                              const workerEmp = getEmp(st.assigned_to)
                              const workerName = workerEmp ? (workerEmp.user?.first_name || workerEmp.user?.username || "?") : `User ${st.assigned_to}`
                              return (
                                <option key={st.id} value={st.id}>
                                  {workerName} ({st.title.slice(0, 12)}…)
                                </option>
                              )
                            })}
                          </select>
                          <button
                            type="button"
                            onClick={() => handlePushGapJob(t.id)}
                            disabled={!selectedParent[t.id] || busy}
                            style={{
                              width: "100%", padding: "4px 0", borderRadius: 6, border: "none",
                              background: selectedParent[t.id] ? "#059669" : "#cbd5e1",
                              color: "#fff", fontSize: 9, fontWeight: 900,
                              textTransform: "uppercase", cursor: selectedParent[t.id] ? "pointer" : "not-allowed",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Confirm Push
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all" onClick={() => deleteTask(t.id)} disabled={busy} title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Admin Task Detail Slide-Over ───────────────────────────
function AdminTaskDetailPanel({ task, employees, availableEmployees, jobSites, onClose, onRefresh }) {
  const [editOpen, setEditOpen] = useState(false)
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [completeBusy, setCompleteBusy] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)
  const [adminNotes, setAdminNotes] = useState(task.admin_notes || "")
  const [notesSaving, setNotesSaving] = useState(false)

  const emp = employees.find(x => {
    const uid = x.user?.id || x.id
    return String(uid) === String(task.assigned_to)
  })
  const workerName = emp
    ? `${emp.first_name || emp.user?.first_name || emp.user?.username || ""} ${emp.last_name || ""}`.trim()
    : `User #${task.assigned_to}`

  async function loadTimeline() {
    if (timelineLoading) return
    setTimelineLoading(true)
    try {
      const data = await apiRequest(`/tasks/${task.id}/activity-log/`)
      setTimeline(Array.isArray(data) ? data : [])
    } catch { setTimeline([]) } finally { setTimelineLoading(false) }
  }

  function toggleTimeline() {
    if (!showTimeline && timeline.length === 0) loadTimeline()
    setShowTimeline(v => !v)
  }

  async function handleCancel() {
    setCancelBusy(true)
    try {
      await apiRequest(`/tasks/admin/${task.id}/cancel/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      })
      setShowCancelConfirm(false)
      onRefresh()
      onClose()
    } catch (err) {
      alert(err?.body?.detail || "Failed to cancel job.")
    } finally { setCancelBusy(false) }
  }

  async function handleForceComplete() {
    setCompleteBusy(true)
    try {
      await apiRequest(`/tasks/admin/${task.id}/complete/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      setShowCompleteConfirm(false)
      onRefresh()
      onClose()
    } catch (err) {
      alert(err?.body?.detail || "Failed to complete job.")
    } finally { setCompleteBusy(false) }
  }

  async function saveNotes() {
    setNotesSaving(true)
    try {
      await apiRequest(`/tasks/admin/${task.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_notes: adminNotes }),
      })
    } catch { /* silent */ } finally { setNotesSaving(false) }
  }

  const statusColors = {
    pending: { bg: "#eff6ff", color: "#2563eb", label: "Pending" },
    in_progress: { bg: "#ecfdf5", color: "#059669", label: "In Progress" },
    completed: { bg: "#f0fdf4", color: "#16a34a", label: "Completed" },
    suspended: { bg: "#fffbeb", color: "#d97706", label: "Suspended" },
    cancelled: { bg: "#fef2f2", color: "#dc2626", label: "Cancelled" },
  }
  const sc = statusColors[task.status] || statusColors.pending

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(2px)" }}
      />
      {/* Panel */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(540px, 100vw)",
        height: "100vh",
        background: "#fff",
        boxShadow: "-20px 0 80px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column",
        fontFamily: "var(--font)",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #e2e8f0",
          background: "linear-gradient(135deg, #f8fafc 0%, #fff 100%)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                background: sc.bg, color: sc.color, letterSpacing: "0.06em", textTransform: "uppercase",
              }}>{sc.label}</span>
              {task.is_pushed_gap_job && (
                <span style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                  background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5",
                }}>⚡ URGENT GAP</span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a", lineHeight: 1.3 }}>{task.title}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 4 }}>
              Job #{task.id} · Due: {task.due_date}
            </div>
          </div>

          {/* Building icon */}
          <div style={{
            flexShrink: 0,
            width: 60,
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8fafc",
            border: "1.5px solid #e2e8f0",
            borderRadius: 14,
            padding: 9,
            marginRight: 10,
          }}>
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
              <polyline points="10,56 10,16 34,8 34,56" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
              <rect x="34" y="26" width="20" height="30" rx="1" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" fill="none"/>
              <line x1="6" y1="56" x2="58" y2="56" stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
              <rect x="14" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="22" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="14" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="22" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="14" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="22" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="38" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="46" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="38" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="46" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
              <rect x="21" y="46" width="7" height="10" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
            </svg>
          </div>

          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, background: "#f1f5f9",
            border: "1px solid #e2e8f0", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <X size={18} style={{ color: "#64748b" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>

          {/* Assignment */}
          <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Assignment</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16, fontWeight: 900, color: "#fff",
              }}>
                {workerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{workerName}</div>
                {emp?.current_availability && (
                  <AvailabilityBadge status={emp.current_availability} size="xs" />
                )}
              </div>
            </div>
          </div>

          {/* Journey Progress Bar */}
          {task.assigned_to && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Journey Progress</div>
              {(() => {
                const travelSteps = [
                  { key: null, icon: "✅", label: "Accepted" },
                  { key: "on_the_way", icon: "🚗", label: "On The Way" },
                  { key: "reached_site", icon: "📍", label: "Reached Site" },
                  { key: "working", icon: "🔨", label: "Working" },
                ]
                const curIdx = task.travel_status
                  ? travelSteps.findIndex(s => s.key === task.travel_status)
                  : 0
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {travelSteps.map((step, idx) => {
                      const isActive = idx === curIdx
                      const isDone = idx < curIdx
                      return (
                        <React.Fragment key={step.key || "start"}>
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                            flex: 1,
                          }}>
                            <div
                              style={{
                                width: 34, height: 34,
                                borderRadius: "50%",
                                display: "flex", justifyContent: "center", alignItems: "center",
                                fontSize: 13,
                                transition: "all 0.3s ease",
                                border: "2px solid",
                                borderColor: isDone ? "#10b981" : isActive ? "#3b82f6" : "#cbd5e1",
                                background: isDone ? "#ecfdf5" : isActive ? "#eff6ff" : "#f8fafc",
                                color: isDone ? "#059669" : isActive ? "#2563eb" : "#94a3b8",
                                boxShadow: isActive ? "0 4px 10px rgba(59, 130, 246, 0.15)" : "none",
                              }}
                            >
                              {isDone ? "✓" : step.icon}
                            </div>
                            <div
                              style={{
                                fontSize: 8,
                                fontWeight: 900,
                                textTransform: "uppercase",
                                tracking: "0.05em",
                                textAlign: "center",
                                whiteSpace: "nowrap",
                                color: isDone ? "#059669" : isActive ? "#2563eb" : "#64748b",
                              }}
                            >
                              {step.label}
                            </div>
                          </div>
                          {idx < travelSteps.length - 1 && (
                            <div
                              style={{
                                height: 2,
                                flex: 1,
                                background: idx < curIdx ? "#10b981" : "#cbd5e1",
                                marginBottom: 16,
                                transition: "all 0.5s ease",
                              }}
                            />
                          )}
                        </React.Fragment>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Identity Verification Section */}
          {(task.start_photo || task.end_photo || task.face_match_percentage !== null || task.face_match_status) && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Identity Verification</div>
              
              {/* Status Badge & Match Percentage */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {task.face_match_status === "verified" ? (
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                      background: "#dcfce7", color: "#166534", border: "1px solid #86efac",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}>
                      🟢 Identity Verified
                    </span>
                  ) : task.face_match_status === "failed" ? (
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                      background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}>
                      🔴 Verification Failed
                    </span>
                  ) : task.face_match_status === "skipped" ? (
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                      background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}>
                      ⚪ Verification Skipped
                    </span>
                  ) : (
                    <span style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 900,
                      background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa",
                      display: "inline-flex", alignItems: "center", gap: 4
                    }}>
                      🟡 Pending Verification
                    </span>
                  )}
                </div>
                {task.face_match_percentage !== null && task.face_match_percentage !== undefined && (
                  <div style={{ fontSize: 12, fontWeight: 900, color: task.face_match_percentage >= 90 ? "#16a34a" : "#dc2626" }}>
                    Match Score: {task.face_match_percentage.toFixed(1)}%
                  </div>
                )}
              </div>

              {/* Photos comparison */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Start Photo</div>
                  <div style={{
                    width: "100%", height: 120, borderRadius: 10, border: "1.5px solid #cbd5e1",
                    overflow: "hidden", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {task.start_photo ? (
                      <img src={task.start_photo} alt="Start Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8" }}>No Start Photo</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 8, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>End Photo</div>
                  <div style={{
                    width: "100%", height: 120, borderRadius: 10, border: "1.5px solid #cbd5e1",
                    overflow: "hidden", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    {task.end_photo ? (
                      <img src={task.end_photo} alt="End Photo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8" }}>No End Photo</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Submission Time */}
              {task.submission_time && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>🕒 Submitted:</span>
                  <span>{new Date(task.submission_time).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Client Info */}
          {(task.client_name || task.client_company_name || task.job_address) && (
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Client Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {task.client_company_name && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>🏢 {task.client_company_name}</div>
                )}
                {task.client_name && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>👤 {task.client_name}</div>
                )}
                {task.client_contact_number && (
                  <a href={`tel:${task.client_contact_number}`} style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", textDecoration: "none" }}>
                    📞 {task.client_contact_number}
                  </a>
                )}
                {task.client_email && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>✉️ {task.client_email}</div>
                )}
                {task.job_address && (
                  <div style={{
                    padding: "8px 12px", borderRadius: 10, background: "#eff6ff",
                    border: "1px solid #bfdbfe", fontSize: 11, fontWeight: 700, color: "#1e293b",
                  }}>
                    📍 {task.job_address}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Job Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[
              { label: "Priority", value: task.priority?.toUpperCase() || "—", color: task.priority === "urgent" ? "#dc2626" : task.priority === "high" ? "#d97706" : "#6366f1" },
              { label: "Est. Hours", value: `${task.estimated_hours}h`, color: "#475569" },
              { label: "Category", value: categoryLabel(task.category), color: "#475569" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding: "10px 12px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Admin Notes */}
          <div>
            <label style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>Admin Notes</label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Add internal notes about this job..."
              style={{
                width: "100%", borderRadius: 12, border: "1.5px solid #e2e8f0",
                padding: "10px 12px", fontSize: 13, fontFamily: "inherit",
                resize: "none", outline: "none", boxSizing: "border-box",
                color: "#1e293b",
              }}
            />
            {notesSaving && <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, marginTop: 4 }}>Saving...</div>}
          </div>

          {/* Attachments */}
          {task.attachments?.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                Attachments ({task.attachments.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {task.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.file_url || att.file || att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "6px 12px", borderRadius: 10,
                      background: "#eff6ff", border: "1px solid #bfdbfe",
                      fontSize: 11, fontWeight: 800, color: "#4f46e5", textDecoration: "none",
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    📎 {att.filename || att.file?.split("/").pop() || `File ${i + 1}`}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div>
            <button
              onClick={toggleTimeline}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0",
                background: "#f8fafc", cursor: "pointer", width: "100%",
                fontSize: 11, fontWeight: 900, color: "#475569",
                letterSpacing: "0.04em",
              }}
            >
              <Activity size={14} />
              {showTimeline ? "Hide Activity Log" : "View Activity Log"}
              {timelineLoading && <Loader2 size={12} style={{ animation: "spin 1s linear infinite", marginLeft: "auto" }} />}
            </button>
            {showTimeline && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {timeline.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textAlign: "center", padding: "16px 0" }}>No activity recorded yet.</div>
                ) : timeline.map((entry, i) => (
                  <div key={i} style={{
                    padding: "10px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0",
                    display: "flex", gap: 12, alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                      background: entry.event_type === "completed" ? "#059669" : entry.event_type === "started" ? "#6366f1" : entry.event_type === "paused" ? "#d97706" : "#94a3b8",
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: "#1e293b", textTransform: "capitalize" }}>
                        {entry.event_type?.replace(/_/g, " ")}
                        {entry.actor && <span style={{ fontWeight: 600, color: "#64748b" }}> — {entry.actor_name || entry.actor}</span>}
                      </div>
                      {entry.notes && <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginTop: 2 }}>{entry.notes}</div>}
                      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 700, marginTop: 3 }}>
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Action Buttons */}
          {task.status !== "completed" && task.status !== "cancelled" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Admin Actions</div>

              {/* Force Complete */}
              {!showCompleteConfirm ? (
                <button
                  onClick={() => setShowCompleteConfirm(true)}
                  style={{
                    padding: "12px 16px", borderRadius: 12, border: "1.5px solid #a7f3d0",
                    background: "#ecfdf5", color: "#065f46",
                    fontSize: 12, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.04em",
                  }}
                >
                  <CheckCircle2 size={14} /> Mark as Complete (Admin Override)
                </button>
              ) : (
                <div style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #a7f3d0", background: "#ecfdf5" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#065f46", marginBottom: 8 }}>Confirm Force Complete?</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleForceComplete} disabled={completeBusy} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                      background: "#059669", color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>
                      {completeBusy ? "..." : "Yes, Complete"}
                    </button>
                    <button onClick={() => setShowCompleteConfirm(false)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #cbd5e1",
                      background: "#fff", color: "#64748b", fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Cancel Job */}
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  style={{
                    padding: "12px 16px", borderRadius: 12, border: "1.5px solid #fca5a5",
                    background: "#fff5f5", color: "#dc2626",
                    fontSize: 12, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.04em",
                  }}
                >
                  <X size={14} /> Cancel This Job
                </button>
              ) : (
                <div style={{ padding: "12px 16px", borderRadius: 12, border: "1.5px solid #fca5a5", background: "#fff5f5" }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#dc2626", marginBottom: 8 }}>Cancel reason (optional):</div>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="e.g. Client cancelled appointment"
                    style={{
                      width: "100%", borderRadius: 10, border: "1.5px solid #fca5a5",
                      padding: "8px 12px", fontSize: 12, outline: "none", boxSizing: "border-box",
                      marginBottom: 8, color: "#1e293b", fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleCancel} disabled={cancelBusy} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
                      background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>
                      {cancelBusy ? "..." : "Confirm Cancel"}
                    </button>
                    <button onClick={() => setShowCancelConfirm(false)} style={{
                      flex: 1, padding: "8px 0", borderRadius: 10, border: "1.5px solid #cbd5e1",
                      background: "#fff", color: "#64748b", fontSize: 11, fontWeight: 900, cursor: "pointer",
                    }}>Back</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── ADMIN LAYOUT ────────────────────────────────────────────
function AdminTasksPage({ tasks, employees, availableEmployees, jobSites, declinedTasks, loadTasks }) {
  const [open, setOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterPriority, setFilterPriority] = useState("all")
  const [filterEmployee, setFilterEmployee] = useState("all")
  const modalRef = useRef(null)

  const suspended = tasks.filter(t => t.status === "suspended")
  const delayed = suspended.filter(t => t.resume_deadline && new Date() > new Date(t.resume_deadline))

  // Stats
  const today = new Date().toDateString()
  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === "pending").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    suspended: suspended.length,
    completedToday: tasks.filter(t => t.status === "completed" && t.completed_at && new Date(t.completed_at).toDateString() === today).length,
    declined: (declinedTasks || []).length,
  }

  // Filtered tasks for table
  const filteredTasks = tasks.filter(t => {
    const emp = employees.find(x => String(x.user?.id || x.id) === String(t.assigned_to))
    const empName = emp ? `${emp.first_name || emp.user?.first_name || ""} ${emp.last_name || ""}`.toLowerCase() : ""
    const matchSearch = !search || (
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      (t.client_name || "").toLowerCase().includes(search.toLowerCase()) ||
      empName.includes(search.toLowerCase())
    )
    const matchStatus = filterStatus === "all" || t.status === filterStatus
    const matchPriority = filterPriority === "all" || t.priority === filterPriority
    const matchEmp = filterEmployee === "all" || String(t.assigned_to) === filterEmployee
    return matchSearch && matchStatus && matchPriority && matchEmp
  })

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <>
      {/* Detail slide-over */}
      {selectedTask && (
        <AdminTaskDetailPanel
          task={selectedTask}
          employees={employees}
          availableEmployees={availableEmployees}
          jobSites={jobSites}
          onClose={() => setSelectedTask(null)}
          onRefresh={loadTasks}
        />
      )}

      {open && createPortal(
        <div className="modal-overlay">
          <div
            className="modal-sheet w-[min(880px,100%)] max-h-[calc(100vh-32px)] flex flex-col pointer-events-auto"
          >
            <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 shrink-0">
              <div className="flex flex-col flex-1 user-select-none">
                <div className="text-xl professional-title text-slate-900 dark:text-white">Create Work Order</div>
                <div className="text-sm text-slate-400 font-medium mt-0.5">Define jobs, assign personnel, and set location constraints.</div>
              </div>

              {/* Building icon */}
              <div style={{
                flexShrink: 0,
                width: 60,
                height: 60,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc",
                border: "1.5px solid #e2e8f0",
                borderRadius: 14,
                padding: 9,
                marginRight: 12,
              }}>
                <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
                  <polyline points="10,56 10,16 34,8 34,56" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
                  <rect x="34" y="26" width="20" height="30" rx="1" stroke="#1e293b" strokeWidth="3" strokeLinejoin="round" fill="none"/>
                  <line x1="6" y1="56" x2="58" y2="56" stroke="#1e293b" strokeWidth="3" strokeLinecap="round"/>
                  <rect x="14" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="22" y="22" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="14" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="22" y="32" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="14" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="22" y="42" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="38" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="46" y="30" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="38" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="46" y="40" width="5" height="5" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                  <rect x="21" y="46" width="7" height="10" rx="1" stroke="#1e293b" strokeWidth="2" fill="none"/>
                </svg>
              </div>

              <button type="button" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors" onClick={() => setOpen(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <AssignTaskPanel
                employees={employees}
                availableEmployees={availableEmployees}
                jobSites={jobSites}
                onAssigned={loadTasks}
                onClose={() => setOpen(false)}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col gap-6">
        {/* ── Stats Bar ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
        }}>
          {[
            { label: "Total Jobs", value: stats.total, color: "#6366f1", bg: "#eff6ff" },
            { label: "Pending", value: stats.pending, color: "#d97706", bg: "#fffbeb" },
            { label: "In Progress", value: stats.inProgress, color: "#059669", bg: "#ecfdf5" },
            { label: "Suspended", value: stats.suspended, color: "#94a3b8", bg: "#f8fafc" },
            { label: "Done Today", value: stats.completedToday, color: "#16a34a", bg: "#f0fdf4" },
            { label: "Declined", value: stats.declined, color: "#dc2626", bg: "#fef2f2" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} style={{
              padding: "14px 16px", borderRadius: 16,
              background: bg, border: `1.5px solid ${color}20`,
              boxShadow: `0 2px 12px ${color}08`,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 900, color, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Declined tasks panel */}
        {declinedTasks && declinedTasks.length > 0 && (
          <DeclinedTasksPanel
            declinedTasks={declinedTasks}
            availableEmployees={availableEmployees}
            onReassigned={loadTasks}
          />
        )}

        {/* Suspended Jobs Panel */}
        {suspended && suspended.length > 0 && (
          <div style={{
            borderRadius: 20, border: "1.5px solid #cbd5e1",
            background: "linear-gradient(135deg, #f8fafc 0%, #fff 100%)",
            overflow: "hidden", boxShadow: "0 4px 24px rgba(71,85,105,0.06)",
          }}>
            <div style={{
              padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid #e2e8f0",
              background: "linear-gradient(90deg, #f1f5f9 0%, #fff 100%)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "#f1f5f9", border: "1.5px solid #cbd5e1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#475569",
                }}>
                  <Clock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#334155", letterSpacing: "-0.01em" }}>
                    Suspended Jobs Monitor
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                    {suspended.length} job{suspended.length !== 1 ? "s" : ""} currently suspended · {delayed.length} delayed
                  </div>
                </div>
              </div>
              {delayed.length > 0 && (
                <span style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 9, fontWeight: 900,
                  backgroundColor: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                  ⚠️ {delayed.length} Delayed Worker{delayed.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {suspended.map((task, i) => {
                const isTaskDelayed = task.resume_deadline && new Date() > new Date(task.resume_deadline)
                const emp = employees.find(x => x.user?.id === task.assigned_to || String(x.user?.id) === String(task.assigned_to))
                const workerName = emp ? `${emp.first_name || emp.user?.first_name || emp.user?.username || ""} ${emp.last_name || ""}`.trim() : `User #${task.assigned_to}`
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    style={{
                      padding: "20px 24px",
                      borderBottom: i < suspended.length - 1 ? "1px solid #e2e8f0" : "none",
                      background: isTaskDelayed ? "#fffbeb" : "transparent",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                    className="hover:bg-slate-50"
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#1e293b", letterSpacing: "-0.01em" }}>{task.title}</span>
                          {isTaskDelayed && (
                            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 900, backgroundColor: "#dc2626", color: "#fff", textTransform: "uppercase" }}>Overdue</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginTop: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          Assigned to: <span style={{ color: "#475569", fontWeight: 800 }}>{workerName}</span> · Active: {formatDuration(task.total_active_seconds || 0)}
                        </div>
                        <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                          <span style={{ fontWeight: 800, marginRight: 4 }}>Reason:</span>
                          <span style={{ fontStyle: "italic" }}>{task.suspend_reason || "None specified"}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>Paused: <span style={{ fontWeight: 800, color: "#334155" }}>{task.suspended_at ? new Date(task.suspended_at).toLocaleString() : "N/A"}</span></div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: isTaskDelayed ? "#dc2626" : "#64748b" }}>Return Deadline: <span style={{ fontWeight: 800 }}>{task.resume_deadline ? new Date(task.resume_deadline).toLocaleString() : "None"}</span></div>
                        {task.gap_job && (
                          <div style={{ marginTop: 4, padding: "4px 8px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", fontSize: 10, fontWeight: 800, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            ⚡ Linked Gap Job: #{task.gap_job}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Header + Search/Filter Toolbar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="flex justify-between items-center">
            <div className="flex items-baseline gap-3">
              <h2 className="text-xl professional-title text-slate-900 dark:text-white">Job Queue</h2>
              <span className="text-[10px] professional-subtitle text-slate-400">{filteredTasks.length} of {tasks.length}</span>
            </div>
            <Button onClick={() => setOpen(true)} className="shadow-indigo-100 shadow-xl gap-2">
              <Plus size={18} /> New Work Order
            </Button>
          </div>

          {/* Search + Filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Search */}
            <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search by title, client, employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
                  borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 600,
                  outline: "none", color: "#1e293b", boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, color: "#334155", outline: "none", cursor: "pointer", background: "#fff" }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="suspended">Suspended</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {/* Priority Filter */}
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, color: "#334155", outline: "none", cursor: "pointer", background: "#fff" }}
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            {/* Employee Filter */}
            <select
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 12, fontWeight: 700, color: "#334155", outline: "none", cursor: "pointer", background: "#fff", maxWidth: 180 }}
            >
              <option value="all">All Employees</option>
              {employees.map(emp => {
                const uid = emp.user?.id || emp.id
                const name = `${emp.first_name || emp.user?.first_name || emp.user?.username || "?"} ${emp.last_name || ""}`.trim()
                return <option key={uid} value={uid}>{name}</option>
              })}
            </select>
            {/* Clear filters */}
            {(search || filterStatus !== "all" || filterPriority !== "all" || filterEmployee !== "all") && (
              <button
                onClick={() => { setSearch(""); setFilterStatus("all"); setFilterPriority("all"); setFilterEmployee("all") }}
                style={{ padding: "9px 14px", borderRadius: 12, border: "1.5px solid #fca5a5", background: "#fff5f5", color: "#dc2626", fontSize: 11, fontWeight: 900, cursor: "pointer", letterSpacing: "0.04em" }}
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <AdminTasksTable
          tasks={filteredTasks}
          employees={employees}
          availableEmployees={availableEmployees}
          jobSites={jobSites}
          onRefresh={loadTasks}
          onRowClick={setSelectedTask}
        />
      </div>
    </>
  )
}

// ─── Smart Nearby Alert Banner (Module 1) ────────────────────
function SmartNearbyAlert({ tasks, onRefresh }) {
  const [nearbyJobs, setNearbyJobs] = useState([])
  const [currentTaskId, setCurrentTaskId] = useState(null)
  const [dismissed, setDismissed] = useState({})
  const [actionBusy, setActionBusy] = useState(false)

  const qualifyingTask = tasks.find(t =>
    t.status === "in_progress" && (t.completion_percentage || 0) >= 80
  )

  async function checkNearby() {
    if (!qualifyingTask) return
    try {
      const pos = await getPosition(() => { })
      const data = await apiRequest(
        `/tasks/smart-nearby/?lat=${pos.lat}&lng=${pos.lon}&current_task_id=${qualifyingTask.id}`
      )
      if (data?.jobs) {
        setNearbyJobs(data.jobs.filter(j => !dismissed[j.id]))
        setCurrentTaskId(qualifyingTask.id)
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    checkNearby()
    const interval = setInterval(checkNearby, 60000)
    return () => clearInterval(interval)
  }, [qualifyingTask?.id])

  async function handleAccept(job) {
    setActionBusy(true)
    try {
      await apiRequest(`/tasks/${job.id}/nearby-decision/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accept", current_task_id: currentTaskId }),
      })
      setNearbyJobs(prev => prev.filter(j => j.id !== job.id))
      await onRefresh()
    } catch { /* silent */ } finally { setActionBusy(false) }
  }

  async function handleReject(job) {
    setActionBusy(true)
    try {
      await apiRequest(`/tasks/${job.id}/nearby-decision/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "reject", current_task_id: currentTaskId, reason: "Not now" }),
      })
    } catch { /* silent */ } finally {
      setDismissed(prev => ({ ...prev, [job.id]: true }))
      setNearbyJobs(prev => prev.filter(j => j.id !== job.id))
      setActionBusy(false)
    }
  }

  if (!nearbyJobs.length || !qualifyingTask) return null
  const job = nearbyJobs[0]

  return createPortal(
    <div style={{
      position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
      zIndex: 8888, width: "100%", maxWidth: 480, padding: "0 16px",
    }}>
      <div style={{
        background: "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)",
        borderRadius: 20, padding: "18px 20px",
        boxShadow: "0 20px 60px rgba(79,70,229,0.4)",
        border: "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#a5b4fc", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ⚡ Nearby Job Available
          </div>
          <button onClick={() => setNearbyJobs([])} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.5)",
            cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0,
          }}>×</button>
        </div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginBottom: 6 }}>{job.title}</div>
        {job.client_name && <div style={{ fontSize: 11, color: "#c7d2fe", marginBottom: 8 }}>{job.client_name}</div>}
        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc" }}>
            📍 {job.distance_m ? `${Math.round(job.distance_m)}m away` : `${job.distance_km?.toFixed(2)}km`}
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc" }}>
            ⏱️ {job.estimated_duration_minutes} min
          </span>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#a5b4fc", textTransform: "capitalize" }}>
            🟡 {job.priority} priority
          </span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => handleAccept(job)} disabled={actionBusy} style={{
            flex: 1, padding: "10px 0", borderRadius: 12, border: "none",
            background: "#fff", color: "#4f46e5", fontSize: 12, fontWeight: 900, cursor: "pointer",
          }}>
            ✔ Accept & Queue
          </button>
          <button onClick={() => handleReject(job)} disabled={actionBusy} style={{
            flex: 1, padding: "10px 0", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.3)", background: "transparent",
            color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 800, cursor: "pointer",
          }}>
            Not Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── EMPLOYEE LAYOUT ─────────────────────────────────────────
// ─── Urgent Gap Job Alert Banner ──────────────────────
function UrgentGapJobAlert({ urgentGapJobs, onDismiss }) {
  const [dismissed, setDismissed] = useState(false)
  const [beepDone, setBeepDone] = useState(false)

  // Play alert sound once
  useEffect(() => {
    if (urgentGapJobs.length > 0 && !beepDone) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
          // Triple beep for urgency
          ;[0, 0.25, 0.5].forEach(offset => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = 1046 // C6 - urgent high tone
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.4, ctx.currentTime + offset)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18)
            osc.start(ctx.currentTime + offset)
            osc.stop(ctx.currentTime + offset + 0.2)
          })
      } catch { /* blocked */ }
      setBeepDone(true)
    }
  }, [urgentGapJobs.length])

  if (urgentGapJobs.length === 0 || dismissed) return null

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998,
      background: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #b91c1c 100%)',
      boxShadow: '0 4px 32px rgba(220,38,38,0.6)',
      animation: 'urgentSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      fontFamily: "var(--font)",
    }}>
      <style>{`
        @keyframes urgentSlideIn { from{transform:translateY(-100%);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes urgentPulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,0.4)} 50%{box-shadow:0 0 0 8px rgba(255,255,255,0)} }
        @keyframes urgentFlash { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        {/* Pulsing alert icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          border: '2px solid rgba(255,255,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
          animation: 'urgentPulse 1.2s infinite',
        }}>⚡</div>

        {/* Text */}
        <div style={{ flex: 1 }}>
          <div style={{
            color: '#fff', fontSize: 14, fontWeight: 900,
            letterSpacing: '-0.01em', lineHeight: 1.2,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ animation: 'urgentFlash 1.5s infinite' }}>🚨</span>
            URGENT GAP JOB PUSHED BY ADMIN
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px', borderRadius: 20,
              fontSize: 10, fontWeight: 900,
            }}>×{urgentGapJobs.length}</span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600, marginTop: 3 }}>
            {urgentGapJobs.map(t => t.title).join(' · ')} — Scroll down to view the red-highlighted task cards
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <a
            href="#urgent-gap-jobs"
            onClick={() => setDismissed(true)}
            style={{
              padding: '8px 16px', borderRadius: 10,
              background: '#fff', color: '#dc2626',
              fontSize: 11, fontWeight: 900, textDecoration: 'none',
              letterSpacing: '0.04em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            View Task
          </a>
          <button
            onClick={() => { setDismissed(true); onDismiss?.() }}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.15)',
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: '#fff', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function EmployeeTasksPage({ tasks, handleAction, busy, onRefresh }) {
  const [filter, setFilter] = useState("all")
  const [newJobToast, setNewJobToast] = useState(null)
  const prevTaskIdsRef = useRef(new Set(tasks.map(t => t.id)))

  // Auto-refresh every 30s for employee
  useEffect(() => {
    const interval = setInterval(async () => {
      await onRefresh()
    }, 30000)
    return () => clearInterval(interval)
  }, [onRefresh])

  // Detect new jobs after refresh
  useEffect(() => {
    const prevIds = prevTaskIdsRef.current
    const newTasks = tasks.filter(t => !prevIds.has(t.id))
    if (newTasks.length > 0) {
      // Play soft notification tone
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = "sine"
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.6)
      } catch { /* blocked */ }
      setNewJobToast(`${newTasks.length} new job${newTasks.length > 1 ? "s" : ""} assigned: ${newTasks.map(t => t.title).join(", ")}`)
      setTimeout(() => setNewJobToast(null), 8000)
    }
    prevTaskIdsRef.current = new Set(tasks.map(t => t.id))
  }, [tasks])

  const pendingAcceptance = tasks.filter(t => t.acceptance_status === "pending_acceptance")
  const urgentGapJobs = tasks.filter(t => t.is_pushed_gap_job && t.acceptance_status === "pending_acceptance")
  const filtered = filter === "all"
    ? tasks
    : tasks.filter(t => t.status === filter)

  return (
    <div className="flex flex-col gap-8">
      {/* New Job Toast */}
      {newJobToast && createPortal(
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 99990, width: "100%", maxWidth: 460, padding: "0 16px",
          animation: "slideUpToast 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <style>{`@keyframes slideUpToast{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}`}</style>
          <div style={{
            background: "linear-gradient(135deg, #312e81, #4f46e5)",
            borderRadius: 18, padding: "14px 18px",
            boxShadow: "0 16px 48px rgba(79,70,229,0.45)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>📋</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 900, lineHeight: 1.3 }}>New Job Assigned!</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 600, marginTop: 2 }}>{newJobToast}</div>
            </div>
            <button onClick={() => setNewJobToast(null)} style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.6)",
              cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4,
            }}>×</button>
          </div>
        </div>,
        document.body
      )}

      {/* Urgent Gap Job notification banner */}
      <UrgentGapJobAlert urgentGapJobs={urgentGapJobs} />

      <SmartNearbyAlert tasks={tasks} onRefresh={onRefresh} />
      {/* Pending acceptance banner */}
      {pendingAcceptance.length > 0 && (
        <div style={{
          padding: "16px 20px", borderRadius: 16,
          background: "linear-gradient(135deg, #fefce8 0%, #eff6ff 100%)",
          border: "1.5px solid #fde68a",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "#fef9c3", border: "1.5px solid #fde047",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ca8a04", flexShrink: 0,
          }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>
              {pendingAcceptance.length} task{pendingAcceptance.length !== 1 ? "s" : ""} awaiting your response
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#d97706", marginTop: 2 }}>
              Please accept or decline the highlighted tasks below so your manager can plan accordingly.
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 bg-surface2 dark:bg-slate-900/60 p-1.5 rounded-2xl self-start border border-stroke dark:border-slate-800 shadow-inner">
        {STATUS_FILTERS.map(f => {
          const isActive = filter === f
          const count = tasks.filter(t => t.status === f).length
          return (
            <button
              key={f}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${isActive ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-500 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              onClick={() => setFilter(f)}
            >
              <span className="flex items-center gap-2">
                {f === "all" ? "All Jobs" : statusLabel(f)}
                {f !== "all" && count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>{count}</span>}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 bg-surface dark:bg-slate-900/40 border border-stroke dark:border-slate-800 border-dashed rounded-[3rem] text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-200 dark:text-slate-800 mb-8 shadow-inner">
            <ClipboardList size={40} />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">No jobs found</h3>
          <p className="text-slate-400 dark:text-slate-500 mt-3 max-w-xs text-sm font-medium leading-relaxed">You're all caught up! Enjoy your break or check back later for new assignments.</p>
        </div>
      ) : (
        <div id="urgent-gap-jobs" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(t => <TaskCard key={t.id} task={t} onAction={handleAction} busy={busy} tasks={tasks} />)}
        </div>
      )}
    </div>
  )
}

// ─── MAIN ROUTER PAGE ────────────────────────────────────────
export function TasksPage() {
  const { user } = useAuth()
  const { isAdmin } = useRole()
  const navigate = useNavigate()

  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [availableEmployees, setAvailableEmployees] = useState([])
  const [declinedTasks, setDeclinedTasks] = useState([])
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

      if (isAdmin) {
        // Load declined tasks and available employees in parallel
        const [declined, available] = await Promise.all([
          apiRequest("/tasks/admin/declined/").catch(() => []),
          apiRequest("/tasks/admin/available-employees/").catch(() => []),
        ])
        setDeclinedTasks(Array.isArray(declined) ? declined : unwrapResults(declined))
        setAvailableEmployees(Array.isArray(available) ? available : unwrapResults(available))
      }
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

  useEffect(() => {
    const handleStatusChange = () => {
      loadEmployees(); // Reload availability list in real-time
    };
    window.addEventListener("quicktims:employeeStatusChange", handleStatusChange);
    return () => window.removeEventListener("quicktims:employeeStatusChange", handleStatusChange);
  }, []);

  async function handleAction(taskId, action, body = {}) {
    setBusy(true)
    try {
      if (action === "_refresh") {
        // Just reload tasks — no API call needed
        await loadTasks()
        return
      } else if (action === "suspend") {
        await apiRequest(`/tasks/${taskId}/suspend/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else if (action === "accept-gap-job") {
        await apiRequest(`/tasks/${taskId}/accept-gap-job/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else if (action === "complete-gap-job") {
        await apiRequest(`/tasks/${taskId}/complete-gap-job/`, {
          method: "POST",
        })
      } else if (action === "resume") {
        const res = await apiRequest(`/tasks/${taskId}/resume/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (res && res.overdue_warning) {
          alert("Welcome back! Note: You have resumed this job after the scheduled deadline.");
        }
      } else if (action === "start_travel" || action === "reached_site") {
        // Journey phase transitions — simple POST, no body
        await apiRequest(`/tasks/my/${taskId}/${action}/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      } else if (action === "start_work" && !body.require_fd) {
        // start_work may include GPS lat/lon — send as JSON
        await apiRequest(`/tasks/my/${taskId}/start_work/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: body.lat ?? null,
            lon: body.lon ?? null,
            notes: body.notes ?? "",
          }),
        })
      } else if (body.require_fd) {
        const fd = new FormData()
        Object.keys(body).forEach(k => {
          if (k !== 'require_fd' && body[k] !== undefined && body[k] !== null) {
            fd.append(k, body[k])
          }
        })
        await apiRequest(`/tasks/my/${taskId}/${action}/`, {
          method: "POST",
          body: fd,
        })
      } else {
        // Accept and decline use POST; notes uses PATCH
        const method = (action === "accept" || action === "decline") ? "POST" : "PATCH"
        await apiRequest(`/tasks/my/${taskId}/${action}/`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }



      await loadTasks()
    } catch (e) { setError(e?.body?.detail || e.message || "Action failed.") }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-var(--header-height,64px))] w-full bg-bg dark:bg-bg overflow-hidden">
      {/* ── HEADER ── */}
      <div className="h-24 bg-surface dark:bg-slate-900/60 border-b border-stroke dark:border-slate-800 px-10 flex items-center justify-between shrink-0 relative overflow-hidden">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-[Manrope] flex items-center gap-3">
              <ClipboardList className="text-indigo-600 dark:text-indigo-400" size={24} />
              Tasks & Orders
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest opacity-80">
                {isAdmin ? "Dispatch and monitor work activity across all employees." : "Your personal job feed and execution queue."}
              </span>
            </div>
          </div>
        </div>
        {isAdmin && declinedTasks.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 16px", borderRadius: 12,
            background: "#fef2f2", border: "1.5px solid #fca5a5",
          }}>
            <AlertTriangle size={16} style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 12, fontWeight: 900, color: "#dc2626" }}>
              {declinedTasks.length} declined task{declinedTasks.length !== 1 ? "s" : ""} need reassignment
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-10">

        {error && (
          <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl font-bold flex items-center gap-3 animate-in shake duration-500">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-4">
            <Loader2 className="animate-spin" size={40} />
            <span className="text-lg font-medium">Syncing work orders...</span>
          </div>
        ) : isAdmin ? (
          <AdminTasksPage
            tasks={tasks}
            employees={employees}
            availableEmployees={availableEmployees}
            declinedTasks={declinedTasks}
            jobSites={jobSites}
            loadTasks={loadTasks}
          />
        ) : (
          <EmployeeTasksPage tasks={tasks} handleAction={handleAction} busy={busy} onRefresh={loadTasks} />
        )}
      </div>
    </div>
  )
}
