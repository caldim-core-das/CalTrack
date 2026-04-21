/**
 * Geocoding utilities for QuickTIMS
 *
 * Primary:  Google Maps Geocoding API  (VITE_GOOGLE_MAPS_API_KEY)
 * Fallback: Nominatim / OpenStreetMap  (no key required)
 *
 * Output format:
 *   "Golden Fairmart, SIPCOT Phase 2, Hosur, Tamil Nadu - 635109"
 *    ──────────────  ──────────────  ─────  ──────────────  ──────
 *    place/POI name  area/zone       city   state           pincode
 */

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a named component from a Google address_components array.
 * Tries each type in order, returns long_name of the first match or "".
 */
function getComponent(components, ...types) {
  for (const type of types) {
    const c = components.find((c) => c.types.includes(type))
    if (c) return c.long_name
  }
  return ""
}

/**
 * Score a Google result by specificity — most specific wins.
 * establishment/point_of_interest → street_address → sublocality → locality …
 */
function scoreBySpecificity(result) {
  const t = result.types ?? []
  if (t.some((x) => ["establishment", "point_of_interest"].includes(x))) return 110
  if (t.some((x) => ["street_address", "premise"].includes(x))) return 100
  if (t.some((x) => ["sublocality_level_1", "sublocality", "neighborhood"].includes(x))) return 80
  if (t.includes("route")) return 60
  if (t.includes("locality")) return 40
  if (t.includes("administrative_area_level_2")) return 20
  if (t.includes("administrative_area_level_1")) return 10
  return 5
}

// ---------------------------------------------------------------------------
// Google Maps Geocoding API  (primary)
// ---------------------------------------------------------------------------

/**
 * Reverse-geocode using Google Maps Geocoding API.
 *
 * Strategy:
 *  1. Fetch ALL results (no result_type filter).
 *  2. Separately find the best establishment/POI result for the place name.
 *  3. Find the best street/sublocality result for area + city + state + pincode.
 *  4. Combine into:  "PlaceName, Area, City, State - Pincode"
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>}
 */
async function getAddressFromGoogle(lat, lon) {
  if (!GOOGLE_API_KEY) return null

  try {
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${lat},${lon}` +
      `&key=${GOOGLE_API_KEY}` +
      `&language=en`

    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()

    if (data.status !== "OK" || !data.results?.length) {
      // REQUEST_DENIED means the Geocoding API isn't enabled for this key.
      // Fall through silently — Nominatim will handle it.
      console.debug("[Geocoding] Google API status:", data.status, data.error_message ?? "")
      return null
    }

    const results = data.results

    // ── 1. Look for a nearby establishment / point-of-interest ────────────
    // This gives us the specific place name (e.g. "Golden Fairmart")
    const poiResult = results.find((r) =>
      r.types?.some((t) => ["establishment", "point_of_interest"].includes(t))
    )
    const placeName = poiResult?.name ?? ""   // Google sets `name` for POIs

    // ── 2. Pick the most detailed result for address components ───────────
    const sorted = [...results].sort((a, b) => scoreBySpecificity(b) - scoreBySpecificity(a))
    const best = sorted[0]
    const components = best.address_components ?? []

    // Area / industrial zone / neighbourhood
    const area = getComponent(
      components,
      "sublocality_level_1",
      "sublocality",
      "neighborhood",
      "route"
    )

    // City — always administratively correct (not affected by state-border ambiguity)
    const city = getComponent(components, "locality", "administrative_area_level_2")

    // State — always administratively correct
    const state = getComponent(components, "administrative_area_level_1")

    // Postal code (pincode)
    const pincode = getComponent(components, "postal_code")

    if (!city && !state) {
      // Completely missing components — fall back to formatted_address + pincode
      const fa = best.formatted_address ?? ""
      return pincode && !fa.includes(pincode) ? `${fa} - ${pincode}` : fa
    }

    // ── 3. Assemble the output ────────────────────────────────────────────
    // Format: "PlaceName, Area, City, State - Pincode"
    const mainParts = [placeName, area, city, state].filter(Boolean)
    const address = mainParts.join(", ")
    return pincode ? `${address} - ${pincode}` : address

  } catch (err) {
    console.error("[Geocoding] Google fetch error:", err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Nominatim / OpenStreetMap  (fallback — no key required)
// ---------------------------------------------------------------------------

/**
 * Reverse-geocode using Nominatim.
 * zoom=17 → street/named-place level (includes area names and postcodes).
 *
 * Output: "Area, City, State - Pincode"
 */
async function getAddressFromNominatim(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    )
    if (!res.ok) return ""
    const data = await res.json()
    if (!data.display_name) return ""

    const a = data.address ?? {}

    // Area / zone name
    const suburb = a.suburb || a.neighbourhood || a.industrial || a.quarter || ""
    const road = a.road || ""
    const area = suburb || road

    // City — reliable admin settlement
    const city = a.city || a.town || a.village || a.county || ""
    const state = a.state || ""
    const pincode = a.postcode || ""

    // Don't duplicate suburb if it equals city
    const areaPart = area && area.toLowerCase() !== city.toLowerCase() ? area : ""

    const mainParts = [areaPart, city, state].filter(Boolean)
    if (mainParts.length < 2) return data.display_name

    const address = mainParts.join(", ")
    return pincode ? `${address} - ${pincode}` : address
  } catch (err) {
    console.error("[Geocoding] Nominatim error:", err)
    return ""
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get a full, precise address from coordinates including pincode.
 * Uses Google Maps API (if key set) with Nominatim as fallback.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string>}
 *   e.g. "Golden Fairmart, SIPCOT Phase 2, Hosur, Tamil Nadu - 635109"
 */
export async function getAddress(lat, lon) {
  if (GOOGLE_API_KEY) {
    const result = await getAddressFromGoogle(lat, lon)
    if (result) return result
    console.debug("[Geocoding] Google Maps unavailable, using Nominatim fallback.")
  }
  return getAddressFromNominatim(lat, lon)
}

/**
 * Returns true when a Google Maps API key is configured.
 */
export function hasGoogleMapsKey() {
  return Boolean(GOOGLE_API_KEY)
}

/**
 * Build a Google Maps URL that drops an exact pin at the given coordinates.
 *
 * Uses the `q=lat,lon` format which ALWAYS places the marker at the exact
 * GPS point — unlike the search-by-name form which can land on the wrong place.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {string}
 */
export function buildMapUrl(lat, lon) {
  if (lat == null || lon == null) return ""
  // q=lat,lon  → exact pin drop at those coordinates
  // z=17       → street-level zoom (precise enough to distinguish buildings)
  return `https://www.google.com/maps?q=${lat},${lon}&z=17`
}
