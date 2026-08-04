import { useEffect, useRef } from "react";
import { apiRequest } from "../api/client.js";

export const GPS_TIMEOUT_MS = 25000;
export const TARGET_ACCURACY_M = 30;

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

export function getPosition(onProgress) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 13.0827, lon: 80.2707, accuracy: 50 });
      return;
    }
    let watchId = null, best = null
    const cleanup = () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId) }
    const timer = setTimeout(() => {
      cleanup();
      resolve(best || { lat: 13.0827, lon: 80.2707, accuracy: 50 });
    }, 10000)

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }
        if (onProgress) onProgress(fix.accuracy)
        if (!best || fix.accuracy < best.accuracy) best = fix
        if (fix.accuracy <= TARGET_ACCURACY_M) { clearTimeout(timer); cleanup(); resolve(fix) }
      },
      (err) => {
        clearTimeout(timer);
        cleanup();
        resolve(best || { lat: 13.0827, lon: 80.2707, accuracy: 50 });
      },
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 }
    )
  })
}

export function useLocationTracker(isClockedIn) {
  const isFetching = useRef(false)
  const lastPos = useRef(null)

  useEffect(() => {
    if (!isClockedIn) return;

    const reportLocation = async () => {
      if (isFetching.current) return
      isFetching.current = true
      try {
        const pos = await getPosition()
        if (pos) {
          // Only update if location changed significantly (> 10m) or it's first time
          const dist = lastPos.current ? calculateDistance(pos.lat, pos.lon, lastPos.current.lat, lastPos.current.lon) : 999

          if (dist > 10) {
            await apiRequest("/live-locations/update/", {
              method: "POST",
              json: { lat: pos.lat, lng: pos.lon }
            })
            lastPos.current = pos
          }
        }
      } catch (err) {
        console.debug("[LiveTracking] Report failed:", err)
      } finally {
        isFetching.current = false
      }
    }

    reportLocation()
    // Every 5 minutes (reduced frequency to save DB connections and battery)
    const id = setInterval(reportLocation, 300000)
    return () => clearInterval(id)
  }, [isClockedIn])
}
