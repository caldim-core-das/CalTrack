import React, { useState, useEffect, useCallback, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import { Search, MapPin, X, ChevronDown, User, Navigation, History as HistoryIcon, Clock, Filter, ArrowUpDown, Paperclip, ChevronRight, Play, Info, Bell } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { NotificationService } from "../../utils/notifications.js"

/* ── Fix default Leaflet icons ────────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

/* ── Custom Employee Photo Marker ────────────────────────────── */
const createEmployeePhotoMarker = (photoUrl, name, isSelected = false) =>
    L.divIcon({
        className: "custom-employee-marker",
        html: `
        <div style="position: relative; width: 50px; height: 60px; display: flex; flex-direction: column; align-items: center;">
            <div style=" 
                width: 44px; height: 44px; 
                border-radius: 50%; 
                border: 3px solid ${isSelected ? "#007AFF" : "white"}; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                overflow: hidden;
                background: #eee;
                z-index: 2;
            ">
                ${photoUrl ? `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` :
                `<div style="width: 100%; height: 100%; display: flex; align-items: center; justifyContent: center; background: #6366F1; color: white; fontWeight: 800; fontSize: 16px;">${name.charAt(0).toUpperCase()}</div>`}
            </div>
            <div style="
                width: 0; height: 0; 
                border-left: 8px solid transparent; 
                border-right: 8px solid transparent; 
                border-top: 10px solid ${isSelected ? "#007AFF" : "white"};
                margin-top: -4px;
                filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
            "></div>
        </div>`,
        iconSize: [50, 60],
        iconAnchor: [25, 60],
        popupAnchor: [0, -50],
    })

/* ── Map recenter helper ─────────────────────────────────────── */
function MapUpdater({ center, zoom }) {
    const map = useMap()
    useEffect(() => {
        if (center) map.setView(center, zoom || 14, { animate: true })
    }, [center, zoom, map])
    return null
}

/* ── Helper: Format Duration ────────────────────────────────── */
function formatDuration(seconds) {
    if (!seconds && seconds !== 0) return "--:--"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}:${String(m).padStart(2, "0")}`
}

export function LiveLocationsPage() {
    const [employees, setEmployees] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedId, setSelectedId] = useState(null)
    const [detailData, setDetailData] = useState(null)
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortBy, setSortBy] = useState("name") // name | duration

    const [mapCenter, setMapCenter] = useState([12.9716, 80.0414])
    const [mapZoom, setMapZoom] = useState(13)

    // 1. Fetch live status
    const fetchLocations = useCallback(async () => {
        try {
            const res = await apiRequest("/live-locations/current/")
            const data = unwrapResults(res) || []
            setEmployees(data)

            if (!selectedId && data.length > 0) {
                // Initial center on first employee
                setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lng)])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [selectedId])

    useEffect(() => {
        fetchLocations()
        const interval = setInterval(fetchLocations, 30000)

        // Request notification permission
        NotificationService.requestPermission()

        return () => clearInterval(interval)
    }, [fetchLocations])

    // 2. Fetch details for selected session
    useEffect(() => {
        if (selectedId) {
            const fetchDetail = async () => {
                setLoadingDetail(true)
                try {
                    const res = await apiRequest(`/live-locations/session/${selectedId}/`)
                    setDetailData(res)
                    if (res.history?.length > 0) {
                        const last = res.history[res.history.length - 1]
                        setMapCenter([parseFloat(last.lat), parseFloat(last.lng)])
                        setMapZoom(16)
                    }
                } catch (err) {
                    console.error("Detail fetch error", err)
                } finally {
                    setLoadingDetail(false)
                }
            }
            fetchDetail()
        } else {
            setDetailData(null)
        }
    }, [selectedId])

    // ── Filtering and Sorting ──
    const filteredEmployees = useMemo(() => {
        let arr = [...employees]
        if (searchQuery) {
            arr = arr.filter(e => e.employee_name.toLowerCase().includes(searchQuery.toLowerCase()))
        }
        arr.sort((a, b) => {
            if (sortBy === "name") return a.employee_name.localeCompare(b.employee_name)
            if (sortBy === "duration") return b.worked_seconds - a.worked_seconds
            return 0
        })
        return arr
    }, [employees, searchQuery, sortBy])

    const handleSelect = (emp) => {
        setSelectedId(emp.time_log)
    }

    const polylinePositions = useMemo(() => {
        if (!detailData?.history) return []
        return detailData.history.map(h => [parseFloat(h.lat), parseFloat(h.lng)])
    }, [detailData])

    return (
        <div style={{
            display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", width: "100%",
            backgroundColor: "white", overflow: "hidden"
        }}>
            {/* ── HEADER ── */}
            <div style={{
                height: 48, backgroundColor: "#E5E7EB", borderBottom: "1px solid #D1D5DB",
                display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px"
            }}>
                <h1 style={{ fontSize: "16px", fontWeight: 600, color: "#374151", margin: 0 }}>Who's Working</h1>
                <X size={20} color="#6B7280" style={{ cursor: "pointer" }} />
            </div>

            <div style={{ flex: 1, display: "flex", position: "relative" }}>
                {/* ── MAP ── */}
                <div style={{ flex: 1, position: "relative" }}>
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        style={{ width: "100%", height: "100%", zIndex: 0 }}
                        zoomControl={false}
                    >
                        <MapUpdater center={mapCenter} zoom={mapZoom} />
                        <TileLayer
                            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                            attribution='&copy; <a href="https://maps.google.com/">Google Maps</a>'
                        />

                        {employees.map(emp => (
                            <Marker
                                key={emp.employee}
                                position={[parseFloat(emp.lat), parseFloat(emp.lng)]}
                                icon={createEmployeePhotoMarker(emp.clock_in_photo, emp.employee_name, selectedId === emp.time_log)}
                                eventHandlers={{ click: () => handleSelect(emp) }}
                            >
                                <Popup>
                                    <div style={{ textAlign: "center", minWidth: 120 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.employee_name}</div>
                                        <div style={{ fontSize: 11, color: "#666" }}>{emp.job_site_name}</div>
                                        <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>Last seen: {new Date(emp.timestamp).toLocaleTimeString()}</div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {detailData && polylinePositions.length > 1 && (
                            <Polyline
                                positions={polylinePositions}
                                pathOptions={{ color: "#007AFF", weight: 4, opacity: 0.8 }}
                            />
                        )}
                    </MapContainer>

                    {/* Map Overlays (controls) */}
                    <div style={{ position: "absolute", top: 12, left: 12, zIndex: 1000, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ background: "white", padding: 4, borderRadius: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                            <button style={{ border: "none", background: "white", padding: "4px 8px", fontSize: 12, fontWeight: 700, borderRight: "1px solid #eee", cursor: "pointer" }}>Map</button>
                            <button style={{ border: "none", background: "white", padding: "4px 8px", fontSize: 12, color: "#666", cursor: "pointer" }}>Satellite</button>
                        </div>
                    </div>

                    <div style={{ position: "absolute", bottom: 20, left: 20, zIndex: 1000 }}>
                        <div style={{ background: "white", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", cursor: "pointer" }}>
                            <Play size={20} color="#007AFF" />
                        </div>
                    </div>
                </div>

                {/* ── SIDEBAR PANEL ── */}
                <div style={{
                    width: 340, height: "100%", backgroundColor: "white", borderLeft: "1px solid #D1D5DB",
                    display: "flex", flexDirection: "column", zIndex: 10
                }}>
                    {!detailData ? (
                        <>
                            {/* List Sidebar (Image 1 style) */}
                            <div style={{ background: "#F3F4F6", padding: "12px 16px", borderBottom: "1px solid #D1D5DB" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                    <div style={{ background: "#007AFF", color: "white", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                        <Navigation size={12} fill="white" /> MAP
                                    </div>
                                    <div style={{ flex: 1 }} />

                                    <div style={{ display: "flex", gap: 12 }}>
                                        <div style={{ textAlign: "right", cursor: "pointer" }}>
                                            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>Filter</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#111827" }}>
                                                On the clock <ChevronDown size={12} />
                                            </div>
                                        </div>
                                        <div style={{ textAlign: "right", cursor: "pointer" }} onClick={() => setSortBy(v => v === "name" ? "duration" : "name")}>
                                            <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>Sort</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#111827" }}>
                                                {sortBy === "name" ? "Name" : "Day Total"} <ArrowUpDown size={12} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ position: "relative" }}>
                                    <Search size={14} color="#9CA3AF" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
                                    <input
                                        type="text"
                                        placeholder="Search people..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: "100%", padding: "8px 8px 8px 32px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, background: "white" }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: "auto" }}>
                                {loading ? (
                                    <div style={{ padding: 20, textAlign: "center", color: "#999" }}>Loading workers...</div>
                                ) : filteredEmployees.length === 0 ? (
                                    <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
                                        <User size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                        <div style={{ fontWeight: 600 }}>No active workers found</div>
                                    </div>
                                ) : (
                                    filteredEmployees.map(emp => (
                                        <div
                                            key={emp.employee}
                                            onClick={() => handleSelect(emp)}
                                            style={{
                                                padding: "12px 16px", borderBottom: "1px solid #F3F4F6", cursor: "pointer",
                                                backgroundColor: selectedId === emp.time_log ? "#007AFF" : "white",
                                                color: selectedId === emp.time_log ? "white" : "inherit"
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10B981", border: "1px solid white" }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{emp.employee_name}</div>
                                                    <div style={{ fontSize: 11, color: selectedId === emp.time_log ? "rgba(255,255,255,0.8)" : "#6B7280" }}>{emp.job_site_name}</div>
                                                </div>
                                                <div style={{ textAlign: "right" }}>
                                                    <div style={{ fontSize: 12, fontWeight: 700, color: selectedId === emp.time_log ? "white" : "#EF4444", display: "flex", alignItems: "center", gap: 4 }}>
                                                        <MapPin size={10} fill={selectedId === emp.time_log ? "white" : "#EF4444"} /> {new Date(emp.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: selectedId === emp.time_log ? "white" : "#9CA3AF" }}>{formatDuration(emp.worked_seconds)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        /* Detail View (Image 2 style) */
                        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                            <div style={{ padding: "16px", borderBottom: "1px solid #E5E7EB", position: "relative" }}>
                                <button
                                    onClick={() => setSelectedId(null)}
                                    style={{ position: "absolute", top: 12, right: 12, border: "none", background: "none", padding: 4, cursor: "pointer" }}
                                >
                                    <X size={20} color="#9CA3AF" />
                                </button>
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "#eee" }}>
                                        {detailData.clock_in_photo ? <img src={detailData.clock_in_photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={44} color="#ccc" />}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{detailData.employee_name}</div>
                                        <div style={{ fontSize: 12, color: "#6B7280" }}>{detailData.employee_id_code}</div>
                                    </div>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5563" }}>
                                        <Clock size={16} /> {formatDuration(detailData.worked_seconds)} ({new Date(detailData.worked_seconds * 1000).toISOString().substr(11, 5)})
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5563" }}>
                                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid #6B7280" }} />
                                        {new Date(detailData.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {detailData.clock_out ? new Date(detailData.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now"}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5563" }}>
                                        <HistoryIcon size={16} /> {detailData.clock_in_address || detailData.job_site_name}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#4B5563" }}>
                                        <Info size={16} /> {detailData.clock_in_notes || "No notes provided"}
                                    </div>

                                    {detailData.photos?.length > 0 && (
                                        <div style={{ marginTop: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>
                                                <Paperclip size={12} /> Attachments
                                            </div>
                                            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                                                {detailData.photos.map(photo => (
                                                    <div key={photo.id} style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 4, overflow: "hidden", border: "1px solid #E5E7EB" }}>
                                                        <img src={photo.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 16 }}>Timesheet Timeline</div>
                                <div style={{ position: "relative", paddingLeft: "16px" }}>
                                    <div style={{ position: "absolute", left: 0, top: 4, bottom: 4, width: "3px", backgroundColor: "#007AFF", borderRadius: 2 }} />

                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                            <div style={{ position: "absolute", left: -22, width: 15, height: 15, borderRadius: "50%", backgroundColor: "#10B981", border: "2px solid white", zIndex: 1 }} />
                                            <span style={{ fontSize: 13, color: "#4B5563" }}>{new Date(detailData.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Clock In</span>
                                        </div>

                                        {(detailData.history || []).map((ping, idx) => (
                                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                                <div style={{ position: "absolute", left: -20, width: 11, height: 11, borderRadius: "50%", backgroundColor: "#F59E0B", border: "2px solid white", zIndex: 1 }} />
                                                <span style={{ fontSize: 13, color: "#6B7280" }}>{new Date(ping.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Location Ping</span>
                                            </div>
                                        ))}

                                        {detailData.clock_out && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                                                <div style={{ position: "absolute", left: -22, width: 15, height: 15, borderRadius: "50%", backgroundColor: "#EF4444", border: "2px solid white", zIndex: 1 }} />
                                                <span style={{ fontSize: 13, color: "#4B5563" }}>{new Date(detailData.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Clock Out</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
