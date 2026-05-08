import React, { useState, useEffect, useCallback, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import { 
  Search, MapPin, X, ChevronDown, User, Navigation, History as HistoryIcon, 
  Clock, Filter, ArrowUpDown, Paperclip, ChevronRight, Play, Info, Bell, 
  Loader2, Activity, Zap, ShieldCheck, Map as MapIcon, Globe
} from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { apiRequest, unwrapResults } from "../../api/client.js"
import { NotificationService } from "../../utils/notifications.js"
import { Card, Pill, Input, Button } from "../components/kit.jsx"

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
        <div style="position: relative; width: 64px; height: 74px; display: flex; flex-direction: column; align-items: center;">
            <div style=" 
                width: 52px; height: 52px; 
                border-radius: 18px; 
                border: 3px solid ${isSelected ? "#6366F1" : "white"}; 
                box-shadow: ${isSelected ? '0 10px 25px -5px rgba(99, 102, 241, 0.5)' : '0 8px 20px -5px rgba(0,0,0,0.3)'};
                overflow: hidden;
                background: ${isSelected ? "#6366F1" : "#F8FAFC"};
                z-index: 2;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform: ${isSelected ? 'scale(1.15) translateY(-4px)' : 'scale(1)'};
            ">
                ${photoUrl ? `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` :
                `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: ${isSelected ? '#6366F1' : '#F1F5F9'}; color: ${isSelected ? 'white' : '#64748B'}; font-weight: 900; font-size: 18px; font-family: sans-serif;">${name.charAt(0).toUpperCase()}</div>`}
            </div>
            <div style="
                width: 0; height: 0; 
                border-left: 10px solid transparent; 
                border-right: 10px solid transparent; 
                border-top: 12px solid ${isSelected ? "#6366F1" : "white"};
                margin-top: -6px;
                filter: drop-shadow(0 4px 3px rgba(0,0,0,0.1));
            "></div>
            ${isSelected ? `
              <div style="position: absolute; bottom: 0; width: 12px; height: 12px; border-radius: 50%; background: #10B981; border: 2px solid white; z-index: 3; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
            ` : ''}
        </div>`,
        iconSize: [64, 74],
        iconAnchor: [32, 74],
        popupAnchor: [0, -60],
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
        const interval = setInterval(fetchLocations, 60000)

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
        <div className="flex flex-col h-[calc(100vh-64px)] w-full bg-white overflow-hidden">
            {/* ── HEADER ── */}
            <div className="h-16 bg-white border-b border-slate-100 px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                        <Activity size={20} className="animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 tracking-tight">Live Operations</h1>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Telemetry Active</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <User size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">{employees.length} Personnel Online</span>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <Bell size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 flex relative">
                {/* ── MAP ── */}
                <div className="flex-1 relative bg-slate-100">
                    <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        className="w-full h-full z-0"
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
                                <Popup className="custom-popup">
                                    <div className="p-1 text-center">
                                        <div className="font-black text-slate-900 text-sm">{emp.employee_name}</div>
                                        <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{emp.job_site_name}</div>
                                        <div className="text-[9px] text-slate-400 mt-2">Last ping: {new Date(emp.timestamp).toLocaleTimeString()}</div>
                                    </div>
                                </Popup>
                            </Marker>
                        ))}

                        {detailData && polylinePositions.length > 1 && (
                            <Polyline
                                positions={polylinePositions}
                                pathOptions={{ color: "#6366F1", weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }}
                            />
                        )}
                    </MapContainer>

                    {/* Glassmorphism Map Overlays */}
                    <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-3">
                        <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-2xl shadow-slate-200/50 border border-white flex gap-1">
                            <button className="px-4 py-2 text-[11px] font-black bg-slate-900 text-white rounded-xl shadow-lg transition-all">MAP</button>
                            <button className="px-4 py-2 text-[11px] font-black text-slate-500 hover:bg-slate-100 rounded-xl transition-all">SATELLITE</button>
                        </div>
                        
                        <div className="bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-2xl shadow-slate-200/50 border border-white">
                            <div className="flex items-center gap-2">
                                <Globe size={14} className="text-indigo-500" />
                                <span className="text-[11px] font-black text-slate-900">Traffic Layers</span>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-8 left-8 z-[1000]">
                        <button className="w-14 h-14 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-2xl shadow-slate-300 border border-white hover:scale-110 transition-all">
                            <Play size={24} fill="currentColor" />
                        </button>
                    </div>
                </div>

                {/* ── SIDEBAR PANEL ── */}
                <div className="w-[400px] h-full bg-white border-l border-slate-100 flex flex-col z-10 shadow-[-20px_0_50px_-10px_rgba(0,0,0,0.05)]">
                    {!detailData ? (
                        <>
                            {/* List Sidebar Header */}
                            <div className="p-8 bg-slate-50/50 border-b border-slate-100">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Active Roster</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <button className="group flex flex-col items-end gap-0.5" onClick={() => setSortBy(v => v === "name" ? "duration" : "name")}>
                                            <span className="text-[9px] font-black text-slate-400 uppercase">Sort By</span>
                                            <span className="text-[12px] font-bold text-slate-900 group-hover:text-indigo-600 flex items-center gap-1">
                                                {sortBy === "name" ? "Alpha" : "Duration"} <ArrowUpDown size={12} />
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <Search size={18} className="absolute left-4 top-1/2 translate-y-[-50%] text-slate-300" />
                                    <input
                                        type="text"
                                        placeholder="Search live personnel..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-100 rounded-2xl py-3.5 pl-12 pr-6 text-sm font-bold placeholder-slate-300 focus:border-indigo-500 transition-all outline-none"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                                        <Loader2 size={32} className="animate-spin text-indigo-600" />
                                        <span className="text-sm font-black uppercase tracking-widest">Establishing Uplink...</span>
                                    </div>
                                ) : filteredEmployees.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4 px-8 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center">
                                            <User size={32} className="opacity-20" />
                                        </div>
                                        <div>
                                            <div className="text-lg font-black text-slate-900">No signals detected</div>
                                            <div className="text-xs font-medium mt-1">Nobody is currently clocked in with active tracking.</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {filteredEmployees.map(emp => (
                                            <div
                                                key={emp.employee}
                                                onClick={() => handleSelect(emp)}
                                                className={`group p-5 rounded-[2rem] cursor-pointer transition-all duration-300 border-2 ${selectedId === emp.time_log ? 'bg-slate-900 border-slate-900 shadow-2xl shadow-slate-300' : 'bg-white border-slate-50 hover:border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className={`w-14 h-14 rounded-2xl overflow-hidden border-2 ${selectedId === emp.time_log ? 'border-slate-700' : 'border-white'}`}>
                                                            {emp.clock_in_photo ? <img src={emp.clock_in_photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg">{emp.employee_name.charAt(0)}</div>}
                                                        </div>
                                                        <div className="absolute bottom-[-4px] right-[-4px] w-4 h-4 rounded-full bg-emerald-500 border-2 border-white z-10"></div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`text-sm font-black tracking-tight ${selectedId === emp.time_log ? 'text-white' : 'text-slate-900'}`}>{emp.employee_name}</div>
                                                        <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${selectedId === emp.time_log ? 'text-slate-400' : 'text-slate-400'}`}>{emp.job_site_name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`text-[11px] font-black ${selectedId === emp.time_log ? 'text-emerald-400' : 'text-emerald-600'}`}>{formatDuration(emp.worked_seconds)}</div>
                                                        <div className={`text-[9px] font-bold mt-1 ${selectedId === emp.time_log ? 'text-slate-500' : 'text-slate-300'}`}>{new Date(emp.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Detail View with Timeline */
                        <div className="flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                            <div className="p-8 bg-slate-900 text-white relative">
                                <button
                                    onClick={() => setSelectedId(null)}
                                    className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-white/10 text-white/50 hover:bg-white/20 hover:text-white flex items-center justify-center transition-all"
                                >
                                    <X size={20} />
                                </button>
                                
                                <div className="flex items-center gap-6 mb-8">
                                    <div className="w-20 h-20 rounded-3xl bg-white/10 p-1">
                                        <div className="w-full h-full rounded-[1.25rem] overflow-hidden border-2 border-white/20">
                                            {detailData.clock_in_photo ? <img src={detailData.clock_in_photo} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-2xl font-black">{detailData.employee_name.charAt(0)}</div>}
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">{detailData.employee_name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <ShieldCheck size={14} className="text-emerald-400" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity Verified</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Time</div>
                                        <div className="text-lg font-black text-emerald-400">{formatDuration(detailData.worked_seconds)}</div>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Shift Start</div>
                                        <div className="text-lg font-black">{new Date(detailData.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <MapIcon size={16} className="text-indigo-600" />
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Operations Timeline</span>
                                </div>

                                <div className="relative pl-8 space-y-10">
                                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

                                    {/* Start Event */}
                                    <div className="relative">
                                        <div className="absolute left-[-31px] top-1 w-6 h-6 rounded-full bg-white border-4 border-emerald-500 z-10"></div>
                                        <div>
                                            <div className="text-xs font-black text-slate-900">Shift Established</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(detailData.clock_in).toLocaleTimeString()} @ {detailData.job_site_name}</div>
                                            {detailData.clock_in_notes && (
                                                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-medium italic leading-relaxed">
                                                    "{detailData.clock_in_notes}"
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Telemetry Pings */}
                                    {(detailData.history || []).map((ping, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute left-[-28px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-400 z-10"></div>
                                            <div>
                                                <div className="text-xs font-bold text-slate-700">Telemetry Signal</div>
                                                <div className="text-[10px] font-medium text-slate-400 mt-0.5">{new Date(ping.timestamp).toLocaleTimeString()}</div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Current/End State */}
                                    <div className="relative">
                                        <div className={`absolute left-[-31px] top-1 w-6 h-6 rounded-full bg-white border-4 z-10 ${detailData.clock_out ? 'border-slate-300' : 'border-indigo-600 animate-pulse'}`}></div>
                                        <div>
                                            <div className="text-xs font-black text-slate-900">{detailData.clock_out ? 'Shift Concluded' : 'Active Deployment'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                                {detailData.clock_out ? new Date(detailData.clock_out).toLocaleTimeString() : 'Signal tracking live...'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {detailData.photos?.length > 0 && (
                                    <div className="mt-12">
                                        <div className="flex items-center gap-3 mb-4">
                                            <Paperclip size={16} className="text-indigo-600" />
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Site Attachments</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {detailData.photos.map(photo => (
                                                <div key={photo.id} className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 hover:border-indigo-500 transition-all cursor-zoom-in">
                                                    <img src={photo.url} className="w-full h-full object-cover" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="p-6 border-t border-slate-100">
                                <Button variant="ghost" className="w-full py-4 text-indigo-600 bg-indigo-50 border-none rounded-2xl font-black" onClick={() => setSelectedId(null)}>
                                    RETURN TO ROSTER
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                .custom-popup .leaflet-popup-content-wrapper {
                    border-radius: 1.5rem;
                    padding: 0.5rem;
                    box-shadow: 0 20px 50px -10px rgba(0,0,0,0.1);
                }
                .custom-popup .leaflet-popup-tip {
                    display: none;
                }
            `}</style>
        </div>
    )
}
