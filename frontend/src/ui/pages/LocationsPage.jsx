import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
import { Search, MapPin, X, ChevronDown, Info, Archive } from "lucide-react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { apiRequest, unwrapResults } from "../../api/client.js"

/* ── Fix default Leaflet icons ────────────────────────────────── */
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

/* ── Orange pin icon for selected search result ───────────────── */
const createOrangePin = () =>
  L.divIcon({
    className: "custom-orange-pin",
    html: `<div style="
      width: 32px; height: 32px;
      background: #F97316;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 3px 12px rgba(249,115,22,0.5);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 10px; height: 10px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })

/* ── Saved location icon (indigo) ─────────────────────────────── */
const createSavedPin = () =>
  L.divIcon({
    className: "saved-loc-pin",
    html: `<div style="
      width: 28px; height: 28px;
      background: #4F46E5;
      color: white;
      border: 2px solid white;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })

/* ── Map recenter helper ─────────────────────────────────────── */
function MapUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, zoom || 14, { animate: true })
  }, [center, zoom, map])
  return null
}

/* ── Debounce utility ────────────────────────────────────────── */
function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(h)
  }, [value, delay])
  return debounced
}

/* ═══════════════════════════════════════════════════════════════
   LOCATIONS PAGE — Search + Map + Add Location
   ═══════════════════════════════════════════════════════════════ */
export function LocationsPage() {
  /* ── Search state ──────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)

  /* ── Selected place ────────────────────────────────────────── */
  const [selectedPlace, setSelectedPlace] = useState(null)

  /* ── Add Location panel ────────────────────────────────────── */
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    coordinates: "",
    address: "",
    radius: 300,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  /* ── Saved locations from DB ───────────────────────────────── */
  const [savedLocations, setSavedLocations] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(true)

  /* ── View toggle ───────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState("map")

  /* ── Map state ─────────────────────────────────────────────── */
  const defaultCenter = [12.9716, 80.0414]
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [mapZoom, setMapZoom] = useState(5)

  /* ── Radius ────────────────────────────────────────────────── */
  const [customRadius, setCustomRadius] = useState(false)
  const [customRadiusValue, setCustomRadiusValue] = useState("")

  const radiusOptions = [
    { value: 300, label: "300 Meters", recommended: true },
    { value: 400, label: "400 Meters" },
    { value: 500, label: "500 Meters" },
    { value: 1000, label: "1000 Meters" },
  ]

  /* ── Radius Filter state ─────────────────────────────────────── */
  const radiusFilterOptions = [
    { id: "0-300", label: "0-300 meters", min: 0, max: 300 },
    { id: "300-400", label: "300-400 meters", min: 300.01, max: 400 },
    { id: "400-500", label: "400-500 meters", min: 400.01, max: 500 },
    { id: "500-1000", label: "500-1000 meters", min: 500.01, max: 1000 },
    { id: "1000+", label: "1000+ meters", min: 1000.01, max: 999999 },
  ]
  const [selectedRadiusFilters, setSelectedRadiusFilters] = useState([])
  const [showRadiusDropdown, setShowRadiusDropdown] = useState(false)
  const radiusRef = useRef(null)

  const toggleRadiusFilter = (filter) => {
    setSelectedRadiusFilters((prev) => {
      const isSelected = prev.some((f) => f.id === filter.id)
      if (isSelected) return prev.filter((f) => f.id !== filter.id)
      return [...prev, filter]
    })
  }

  const clearRadiusFilters = () => setSelectedRadiusFilters([])

  const radiusFilterLabel = useMemo(() => {
    if (selectedRadiusFilters.length === 0) return "Radius"
    if (selectedRadiusFilters.length === 1) return `Radius: ${selectedRadiusFilters[0].label}`
    return `Radius: ${selectedRadiusFilters.length} selected`
  }, [selectedRadiusFilters])

  const filteredLocations = useMemo(() => {
    if (selectedRadiusFilters.length === 0) return savedLocations
    return savedLocations.filter((loc) => {
      const r = loc.geofence_radius || 0
      return selectedRadiusFilters.some((f) => r >= f.min && r <= f.max)
    })
  }, [savedLocations, selectedRadiusFilters])

  /* ── Load saved locations on mount ─────────────────────────── */
  useEffect(() => {
    loadSavedLocations()
  }, [])

  const loadSavedLocations = async () => {
    setLoadingSaved(true)
    try {
      const res = await apiRequest("/time/locations/")
      const all = unwrapResults(res) || []
      // Split into active and archived if the field exists, otherwise assume all are active
      setSavedLocations(all.filter(l => !l.is_archived))
      setArchivedLocations(all.filter(l => l.is_archived))
    } catch {
      setSavedLocations([])
      setArchivedLocations([])
    } finally {
      setLoadingSaved(false)
    }
  }

  /* ── Archive / Restore logic ────────────────────────────────── */
  const [archivedLocations, setArchivedLocations] = useState([])

  const handleArchive = async (id) => {
    try {
      await apiRequest(`/time/locations/${id}/`, {
        method: "PATCH",
        json: { is_archived: true }
      })
      const loc = savedLocations.find(l => l.id === id)
      if (loc) {
        setSavedLocations(prev => prev.filter(l => l.id !== id))
        setArchivedLocations(prev => [{ ...loc, is_archived: true }, ...prev])
      }
    } catch {
      alert("Failed to archive location.")
    }
  }

  const handleRestore = async (id) => {
    try {
      await apiRequest(`/time/locations/${id}/`, {
        method: "PATCH",
        json: { is_archived: false }
      })
      const loc = archivedLocations.find(l => l.id === id)
      if (loc) {
        setArchivedLocations(prev => prev.filter(l => l.id !== id))
        setSavedLocations(prev => [{ ...loc, is_archived: false }, ...prev])
      }
    } catch {
      alert("Failed to restore location.")
    }
  }

  /* ── Google Maps API key ────────────────────────────────────── */
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""

  /* ── Load Google Maps JS SDK (once) ────────────────────────── */
  const autocompleteService = useRef(null)
  const placesService = useRef(null)
  const dummyDiv = useRef(null)

  useEffect(() => {
    if (!GOOGLE_API_KEY) return
    // If already loaded
    if (window.google?.maps?.places) {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      if (!dummyDiv.current) dummyDiv.current = document.createElement("div")
      placesService.current = new window.google.maps.places.PlacesService(dummyDiv.current)
      return
    }
    // Load script
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&language=en`
    script.async = true
    script.defer = true
    script.onload = () => {
      autocompleteService.current = new window.google.maps.places.AutocompleteService()
      if (!dummyDiv.current) dummyDiv.current = document.createElement("div")
      placesService.current = new window.google.maps.places.PlacesService(dummyDiv.current)
    }
    document.head.appendChild(script)
    return () => {
      // Don't remove — other components might need it
    }
  }, [GOOGLE_API_KEY])

  /* ── Google Places Autocomplete search (debounced) ─────────── */
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setSearchResults([])
      return
    }

    /* ── If Google Places is available, use it ─────────────────── */
    if (autocompleteService.current) {
      setSearching(true)
      autocompleteService.current.getPlacePredictions(
        {
          input: debouncedQuery,
          types: [],  // all types — worldwide precise results
        },
        (predictions, status) => {
          setSearching(false)
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
            setSearchResults([])
            return
          }
          setSearchResults(
            predictions.map((p) => ({
              id: p.place_id,
              placeId: p.place_id,
              name: p.structured_formatting?.main_text || p.description.split(",")[0],
              secondaryText: p.structured_formatting?.secondary_text || p.description.split(",").slice(1).join(",").trim(),
              fullAddress: p.description,
              // lat/lng not yet available — fetched on selection via getDetails
              lat: null,
              lng: null,
              types: p.types,
            }))
          )
          setShowDropdown(true)
        }
      )
      return
    }

    /* ── Fallback: Nominatim if no Google key ──────────────────── */
    let cancelled = false
    setSearching(true)
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        debouncedQuery
      )}&format=json&limit=8&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSearchResults(
          data.map((d) => ({
            id: d.place_id,
            placeId: null,
            name: d.display_name.split(",")[0],
            secondaryText: d.display_name.split(",").slice(1).join(",").trim(),
            fullAddress: d.display_name,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            type: d.type,
          }))
        )
        setShowDropdown(true)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => { cancelled = true }
  }, [debouncedQuery])


  /* ── Close dropdowns on outside click ───────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
      if (radiusRef.current && !radiusRef.current.contains(e.target)) {
        setShowRadiusDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  /* ── Select a search result ────────────────────────────────── */
  const handleSelectPlace = (place) => {
    setSearchQuery(place.name)
    setShowDropdown(false)
    setShowAddPanel(false)

    /* Google prediction — needs getDetails() for lat/lng */
    if (place.placeId && placesService.current) {
      placesService.current.getDetails(
        {
          placeId: place.placeId,
          fields: ["geometry", "formatted_address", "name"],
        },
        (result, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
            const lat = result.geometry.location.lat()
            const lng = result.geometry.location.lng()
            const resolved = {
              ...place,
              lat,
              lng,
              fullAddress: result.formatted_address || place.fullAddress,
              name: result.name || place.name,
            }
            setSelectedPlace(resolved)
            setMapCenter([lat, lng])
            setMapZoom(16)
          }
        }
      )
      return
    }

    /* Nominatim result — already has lat/lng */
    if (place.lat && place.lng) {
      setSelectedPlace(place)
      setMapCenter([place.lat, place.lng])
      setMapZoom(15)
    }
  }

  /* ── Open add panel ────────────────────────────────────────── */
  const handleOpenAddPanel = () => {
    if (!selectedPlace) return
    setFormData({
      name: selectedPlace.name,
      coordinates: `${selectedPlace.lat},${selectedPlace.lng}`,
      address: selectedPlace.fullAddress,
      radius: 300,
    })
    setSaveError("")
    setCustomRadius(false)
    setCustomRadiusValue("")
    setShowAddPanel(true)
  }

  /* ── Save location to DB ───────────────────────────────────── */
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setSaveError("Location name is required.")
      return
    }
    setSaving(true)
    setSaveError("")
    try {
      const [lat, lng] = formData.coordinates.split(",").map((s) => parseFloat(s.trim()))
      const payload = {
        name: formData.name,
        address: formData.address,
        lat,
        lng,
        geofence_radius: formData.radius,
      }
      const res = await apiRequest("/time/locations/", { method: "POST", json: payload })
      setSavedLocations((prev) => [res, ...prev])
      setShowAddPanel(false)
      setSelectedPlace(null)
      setSearchQuery("")
    } catch (err) {
      setSaveError(
        err?.body?.detail || (err?.body && JSON.stringify(err.body)) || "Failed to save location."
      )
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ────────────────────────────────────────────────── */
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this saved location?")) return
    try {
      await apiRequest(`/time/locations/${id}/`, { method: "DELETE" })
      setSavedLocations((prev) => prev.filter((l) => l.id !== id))
    } catch {
      alert("Failed to delete location.")
    }
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{
      display: "flex", height: "calc(100vh - 110px)", width: "100%",
      backgroundColor: "var(--bg)", border: "1px solid var(--stroke)",
      borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow)",
    }}>

      {/* ── LEFT: Search + Map Area ───────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

        {/* ── Top Search Bar ──────────────────────────────────── */}
        <div style={{
          position: "relative", zIndex: 1000,
          padding: "10px 16px",
          display: "flex", gap: "12px", alignItems: "center",
          borderBottom: "1px solid var(--stroke)",
          backgroundColor: "var(--surface)",
        }}>
          {/* Search Input */}
          <div ref={searchRef} style={{ position: "relative", flex: "0 1 480px" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--bg)", border: "1px solid var(--stroke)",
              borderRadius: "8px", padding: "8px 12px",
            }}>
              <Search size={16} color="var(--muted)" />
              <input
                id="location-search-input"
                type="text"
                placeholder="Search all"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  if (e.target.value.length >= 2) setShowDropdown(true)
                }}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
                style={{
                  border: "none", outline: "none", background: "transparent",
                  fontSize: "14px", fontWeight: 500, color: "var(--fg)",
                  width: "100%", fontFamily: "inherit",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(""); setSearchResults([]); setShowDropdown(false); setSelectedPlace(null) }}
                  style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}
                >
                  <X size={14} color="var(--muted)" />
                </button>
              )}
            </div>
            <ChevronDown size={14} color="var(--muted)" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />

            {/* ── Search Dropdown ─────────────────────────────── */}
            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                background: "var(--surface)", border: "1px solid var(--stroke)",
                borderRadius: "10px", boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
                zIndex: 9999, overflow: "hidden",
                maxHeight: 340, overflowY: "auto",
              }}>
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectPlace(r)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      width: "100%", padding: "12px 16px",
                      border: "none", borderBottom: "1px solid var(--stroke)",
                      background: "transparent", cursor: "pointer",
                      textAlign: "left", transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: "rgba(249,115,22,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <MapPin size={16} color="#F97316" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg)", marginBottom: 2 }}>
                        {r.name}
                      </div>
                      <div style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        lineHeight: 1.4,
                      }}>
                        {r.secondaryText || r.fullAddress.split(",").slice(1).join(",").trim()}
                      </div>
                    </div>

                  </button>
                ))}
                <button style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "12px 16px", width: "100%",
                  border: "none", background: "transparent",
                  color: "#F97316", fontSize: "13px", fontWeight: 600,
                  cursor: "pointer",
                }}>
                  + Add missing location
                </button>
              </div>
            )}
          </div>

          {/* Radius dropdown filter */}
          <div ref={radiusRef} style={{ position: "relative" }}>
            <div
              onClick={() => setShowRadiusDropdown(!showRadiusDropdown)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", border: "1px solid var(--stroke)",
                borderRadius: "8px", fontSize: "13px", fontWeight: 600,
                color: selectedRadiusFilters.length > 0 ? "#F97316" : "var(--fg2)",
                cursor: "pointer", background: "var(--bg)",
                transition: "all 0.2s",
                minWidth: 90,
              }}
            >
              {radiusFilterLabel} <ChevronDown size={12} style={{ transform: showRadiusDropdown ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </div>

            {showRadiusDropdown && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                background: "var(--surface)", border: "1px solid var(--stroke)",
                borderRadius: "10px", boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
                zIndex: 9999, width: 220, overflow: "hidden",
                padding: "8px 0",
              }}>
                {radiusFilterOptions.map((opt) => {
                  const isSelected = selectedRadiusFilters.some(f => f.id === opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleRadiusFilter(opt)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "10px 16px", border: "none",
                        background: "transparent", cursor: "pointer",
                        textAlign: "left", transition: "background 0.1s",
                        fontSize: "13px", color: "var(--fg)", fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {opt.label}
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )
                })}
                <div style={{ height: 1, background: "var(--stroke)", margin: "8px 0" }} />
                <button
                  onClick={clearRadiusFilters}
                  style={{
                    width: "100%", padding: "10px 16px", border: "none",
                    background: "transparent", cursor: "pointer",
                    textAlign: "left", fontSize: "13px", color: "#F97316", fontWeight: 600,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Clear selection
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          {/* Map / List toggle */}
          <div style={{
            display: "flex", borderRadius: "8px",
            border: "1px solid var(--stroke)", overflow: "hidden",
          }}>
            <button
              onClick={() => setViewMode("map")}
              style={{
                padding: "8px 18px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
                background: viewMode === "map" ? "rgba(249,115,22,0.08)" : "var(--surface)",
                color: viewMode === "map" ? "#F97316" : "var(--fg2)",
                borderRight: "1px solid var(--stroke)",
              }}
            >
              <MapPin size={14} /> Map
            </button>
            <button
              onClick={() => setViewMode("list")}
              style={{
                padding: "8px 18px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 600,
                background: viewMode === "list" ? "rgba(249,115,22,0.08)" : "var(--surface)",
                color: viewMode === "list" ? "#F97316" : "var(--fg2)",
              }}
            >
              ☰ List
            </button>
          </div>
        </div>

        {/* ── Map View ───────────────────────────────────────── */}
        {viewMode === "map" ? (
          <div style={{ flex: 1, position: "relative" }}>
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ width: "100%", height: "100%", zIndex: 0 }}
              zoomControl={true}
            >
              <MapUpdater center={mapCenter} zoom={mapZoom} />
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                attribution='&copy; <a href="https://maps.google.com/">Google Maps</a>'
              />

              {/* Selected search result: orange pin with popup */}
              {selectedPlace && (
                <>
                  <Marker
                    position={[selectedPlace.lat, selectedPlace.lng]}
                    icon={createOrangePin()}
                  >
                    <Popup maxWidth={300} minWidth={250} autoPan>
                      <div style={{ padding: "8px 4px", textAlign: "center" }}>
                        <div style={{
                          fontWeight: 800, fontSize: "16px",
                          color: "#1a1a2e", marginBottom: "4px",
                        }}>
                          {selectedPlace.name}
                        </div>
                        <div style={{
                          fontSize: "13px", color: "#6b7280",
                          marginBottom: "16px", lineHeight: 1.5,
                        }}>
                          {selectedPlace.fullAddress}
                        </div>
                        <button
                          onClick={handleOpenAddPanel}
                          style={{
                            background: "linear-gradient(135deg, #F97316 0%, #ea580c 100%)",
                            color: "white",
                            border: "none",
                            padding: "10px 24px",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 4px 14px rgba(249,115,22,0.35)",
                            transition: "all 0.2s",
                            width: "100%",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                        >
                          Add New Location
                        </button>
                        <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "10px" }}>
                          {savedLocations.length} of {savedLocations.length + 2} locations remaining.{" "}
                          <span style={{ color: "#F97316", cursor: "pointer" }}>Upgrade for more</span>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[selectedPlace.lat, selectedPlace.lng]}
                    radius={formData.radius || 300}
                    pathOptions={{
                      color: "#F97316",
                      fillColor: "#F97316",
                      fillOpacity: 0.1,
                      weight: 1.5,
                    }}
                  />
                </>
              )}

              {/* Saved locations: indigo pins */}
              {filteredLocations.map((loc) => (
                <React.Fragment key={loc.id}>
                  <Marker
                    position={[parseFloat(loc.lat), parseFloat(loc.lng)]}
                    icon={createSavedPin()}
                  >
                    <Popup>
                      <div style={{ fontWeight: 700, color: "#4F46E5" }}>{loc.name}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{loc.address}</div>
                      <div style={{ fontSize: "11px", fontWeight: 600, marginTop: "4px" }}>
                        Radius: {loc.geofence_radius}m
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[parseFloat(loc.lat), parseFloat(loc.lng)]}
                    radius={loc.geofence_radius || 300}
                    pathOptions={{ color: "#4F46E5", fillColor: "#4F46E5", fillOpacity: 0.08, weight: 1.5 }}
                  />
                </React.Fragment>
              ))}
            </MapContainer>

            {/* Left info card when nothing is selected */}
            {!selectedPlace && !showAddPanel && (
              <div style={{
                position: "absolute", top: 16, left: 16, zIndex: 500,
                width: 240, background: "var(--surface)",
                borderRadius: "14px", padding: "24px 20px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                border: "1px solid var(--stroke)",
                textAlign: "center",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "16px",
                  background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <MapPin size={32} color="#4F46E5" />
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--fg)", marginBottom: "8px" }}>
                  Add locations to track time with GPS
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Search for a location on the map to begin.
                </div>
                <a
                  href="#"
                  style={{ fontSize: "13px", color: "#F97316", fontWeight: 600, marginTop: "14px", display: "inline-block", textDecoration: "none" }}
                >
                  
                </a>
              </div>
            )}
          </div>
        ) : viewMode === "list" ? (
          /* ── List View ─────────────────────────────────────── */
          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--fg)" }}>
                Saved Locations ({filteredLocations.length})
              </h3>
            </div>
            {filteredLocations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 20px", color: "var(--muted)" }}>
                <MapPin size={40} opacity={0.2} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600 }}>No locations match your filter</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>Try clearing some filters to see more results.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "16px 20px",
                      background: "var(--surface)", border: "1px solid var(--stroke)",
                      borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
                    }}
                    onClick={() => { setMapCenter([parseFloat(loc.lat), parseFloat(loc.lng)]); setMapZoom(15); setViewMode("map") }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4F46E5"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,70,229,0.08)" }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--stroke)"; e.currentTarget.style.boxShadow = "none" }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "10px",
                      background: "rgba(79,70,229,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <MapPin size={18} color="#4F46E5" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--fg)" }}>{loc.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.address}</div>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600, flexShrink: 0 }}>{loc.geofence_radius}m</div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(loc.id) }}
                        style={{
                          background: "none", border: "1px solid #e5e7eb", cursor: "pointer",
                          color: "var(--fg2)", fontSize: "11px", fontWeight: 700,
                          padding: "6px 10px", borderRadius: "6px",
                        }}
                      >
                        Archive
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(loc.id) }}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#EF4444", fontSize: "11px", fontWeight: 700,
                          padding: "6px 10px", borderRadius: "6px",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── Archived View ──────────────────────────────────── */
          <div style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={() => setViewMode("map")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#F97316", fontSize: "13px", fontWeight: 700,
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  ← Back
                </button>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--fg)" }}>
                  Archived Locations ({archivedLocations.length})
                </h3>
              </div>
            </div>
            {archivedLocations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "64px 20px", color: "var(--muted)" }}>
                <Archive size={40} opacity={0.2} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600 }}>No archived locations</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>Locations you archive will appear here.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {archivedLocations.map((loc) => (
                  <div
                    key={loc.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "16px 20px",
                      background: "rgba(0,0,0,0.02)", border: "1px dashed var(--stroke)",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: "10px",
                      background: "rgba(107,114,128,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Archive size={18} color="var(--muted)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--muted)" }}>{loc.name}</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loc.address}</div>
                    </div>
                    <button
                      onClick={() => handleRestore(loc.id)}
                      style={{
                        background: "#F97316", border: "none", cursor: "pointer",
                        color: "white", fontSize: "12px", fontWeight: 700,
                        padding: "8px 16px", borderRadius: "6px",
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Bottom: Archived Locations link ─────────────────── */}
        <div
          onClick={() => setViewMode("archived")}
          style={{
            padding: "10px 16px",
            borderTop: "1px solid var(--stroke)",
            backgroundColor: viewMode === "archived" ? "rgba(249,115,22,0.08)" : "var(--surface)",
            display: "flex", alignItems: "center", gap: "8px",
            color: viewMode === "archived" ? "#F97316" : "var(--fg2)",
            fontSize: "13px", fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <Archive size={16} /> Archived Locations
        </div>
      </div>

      {/* ── RIGHT PANEL: Add New Location Form ────────────────── */}
      {showAddPanel && (
        <div style={{
          width: 400,
          borderLeft: "1px solid var(--stroke)",
          backgroundColor: "var(--surface)",
          display: "flex", flexDirection: "column",
          animation: "locSlideIn .3s ease-out",
          zIndex: 10,
        }}>
          {/* Header */}
          <div style={{
            padding: "20px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid var(--stroke)",
          }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--fg)" }}>
              Add New Location
            </h2>
            <button
              onClick={() => setShowAddPanel(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", display: "flex", padding: "6px", borderRadius: "6px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {saveError && (
              <div style={{
                padding: "10px 14px", marginBottom: "16px",
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: "8px", fontSize: "13px", color: "#DC2626", fontWeight: 600,
              }}>
                {saveError}
              </div>
            )}

            {/* Location Name */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e3a5f", marginBottom: "8px" }}>
                Location Name
              </label>
              <input
                id="location-name-input"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "1px solid var(--stroke)", borderRadius: "8px",
                  fontSize: "14px", fontWeight: 500,
                  color: "var(--fg)", background: "var(--bg)",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                onBlur={(e) => (e.target.style.borderColor = "var(--stroke)")}
              />
            </div>

            {/* Coordinates */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{
                display: "flex", alignItems: "center", gap: "6px",
                fontSize: "13px", fontWeight: 700, color: "#1e3a5f", marginBottom: "8px",
              }}>
                Coordinates
                <Info size={14} color="var(--muted)" style={{ cursor: "help" }} title="Latitude,Longitude" />
              </label>
              <input
                id="location-coords-input"
                type="text"
                value={formData.coordinates}
                onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "1px solid var(--stroke)", borderRadius: "8px",
                  fontSize: "14px", fontWeight: 500,
                  color: "var(--fg)", background: "var(--bg)",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
                placeholder="12.892,80.039"
                onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                onBlur={(e) => (e.target.style.borderColor = "var(--stroke)")}
              />
            </div>

            {/* Address (display only) */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#1e3a5f", marginBottom: "8px" }}>
                Address
              </label>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg)" }}>
                {formData.name}
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted)", marginTop: "4px", lineHeight: 1.5 }}>
                {formData.address}
              </div>
            </div>

            {/* Radius */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <label style={{ fontSize: "13px", fontWeight: 700, color: "#1e3a5f" }}>Radius</label>
                <Info size={14} color="var(--muted)" style={{ cursor: "help" }} title="Geofence radius" />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {radiusOptions.map((opt) => {
                  const isActive = formData.radius === opt.value && !customRadius
                  return (
                    <label
                      key={opt.value}
                      onClick={() => { setFormData({ ...formData, radius: opt.value }); setCustomRadius(false) }}
                      style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "2px 0" }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        border: isActive ? "2px solid #059669" : "2px solid var(--stroke2)",
                        background: isActive ? "#059669" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s", flexShrink: 0,
                      }}>
                        {isActive && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--fg)" }}>{opt.label}</span>
                      {opt.recommended && (
                        <span style={{
                          fontSize: "10px", fontWeight: 800,
                          color: "#F97316", border: "1px solid #F97316",
                          padding: "2px 8px", borderRadius: "4px", letterSpacing: "0.5px",
                        }}>
                          RECOMMENDED
                        </span>
                      )}
                    </label>
                  )
                })}

                {/* Custom radius */}
                <label
                  onClick={() => setCustomRadius(true)}
                  style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "2px 0" }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: customRadius ? "2px solid #059669" : "2px solid var(--stroke2)",
                    background: customRadius ? "#059669" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.15s", flexShrink: 0,
                  }}>
                    {customRadius && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--fg)" }}>Custom radius</span>
                </label>
                {customRadius && (
                  <div style={{ marginLeft: 34 }}>
                    <input
                      type="number"
                      value={customRadiusValue}
                      onChange={(e) => {
                        setCustomRadiusValue(e.target.value)
                        setFormData({ ...formData, radius: parseInt(e.target.value) || 300 })
                      }}
                      placeholder="Enter radius in meters"
                      style={{
                        width: "100%", padding: "10px 12px",
                        border: "1px solid var(--stroke)", borderRadius: "8px",
                        fontSize: "13px", fontWeight: 500,
                        color: "var(--fg)", background: "var(--bg)",
                        outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#F97316")}
                      onBlur={(e) => (e.target.style.borderColor = "var(--stroke)")}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Cancel / Save */}
          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--stroke)",
            display: "flex", justifyContent: "center", gap: "16px",
          }}>
            <button
              onClick={() => setShowAddPanel(false)}
              style={{
                padding: "10px 28px", borderRadius: "8px",
                border: "none", background: "transparent",
                color: "#059669", fontSize: "14px", fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 32px", borderRadius: "8px",
                border: "none",
                background: saving ? "#9ca3af" : "linear-gradient(135deg, #F97316 0%, #ea580c 100%)",
                color: "white", fontSize: "14px", fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(249,115,22,0.3)",
                transition: "all 0.2s",
                minWidth: 100,
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes locSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
