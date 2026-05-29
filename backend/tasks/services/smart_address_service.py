"""
tasks.services.smart_address_service
──────────────────────────────────────
Module 2 — Smart Address Auto-Detection & Area Identification

Business logic:
  1. Geocode a free-text address → lat, lon, city, state, pincode, area/suburb.
  2. Detect which service zones/locations the coordinates fall within.
  3. Validate address quality (completeness, duplicates, out-of-service).
  4. Recommend nearby employees within a 10 KM radius, sorted by distance,
     graded as Highly Recommended / Recommended / Nearest Available.

No view-layer knowledge; all exceptions are standard Python.
"""
from __future__ import annotations

import math
import urllib.parse
import urllib.request
import json
import re
from typing import Optional

from django.utils import timezone

from time_tracking.geo.geo_utils import haversine_m

# ── Constants ────────────────────────────────────────────────────────────────
NEARBY_RADIUS_M = 10_000       # 10 KM radius for employee recommendation
HIGH_RECOMMEND_M = 3_000       # ≤ 3 KM → "Highly Recommended"
RECOMMEND_M = 7_000            # ≤ 7 KM → "Recommended"
NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "QuickTIMS/1.0 (field-service; caldimengg@gmail.com)"


# ── Well-known address knowledge base (India / Bangalore landmark fixtures) ───
# This simulated knowledge base guarantees instant, stable, offline-friendly
# responses for demonstration and development scenarios where Nominatim may
# be rate-limited or unreachable.
_LANDMARK_DB: dict[str, dict] = {
    "itpl": {
        "lat": 12.9698, "lon": 77.7500,
        "display_name": "ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066",
        "area": "Whitefield", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560066", "zone": "East Bengaluru",
    },
    "whitefield": {
        "lat": 12.9698, "lon": 77.7500,
        "display_name": "Whitefield, Bengaluru, Karnataka 560066",
        "area": "Whitefield", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560066", "zone": "East Bengaluru",
    },
    "prestige shantiniketan": {
        "lat": 12.9890, "lon": 77.7426,
        "display_name": "Prestige Shantiniketan, Whitefield, Bengaluru, Karnataka 560048",
        "area": "Whitefield", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560048", "zone": "East Bengaluru",
    },
    "marathahalli": {
        "lat": 12.9591, "lon": 77.6971,
        "display_name": "Marathahalli, Bengaluru, Karnataka 560037",
        "area": "Marathahalli", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560037", "zone": "East Bengaluru",
    },
    "indiranagar": {
        "lat": 12.9784, "lon": 77.6408,
        "display_name": "Indiranagar, Bengaluru, Karnataka 560038",
        "area": "Indiranagar", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560038", "zone": "Central Bengaluru",
    },
    "koramangala": {
        "lat": 12.9279, "lon": 77.6271,
        "display_name": "Koramangala, Bengaluru, Karnataka 560034",
        "area": "Koramangala", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560034", "zone": "South Bengaluru",
    },
    "kr puram": {
        "lat": 13.0063, "lon": 77.6972,
        "display_name": "K R Puram, Bengaluru, Karnataka 560036",
        "area": "K R Puram", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560036", "zone": "East Bengaluru",
    },
    "electronic city": {
        "lat": 12.8458, "lon": 77.6622,
        "display_name": "Electronic City, Bengaluru, Karnataka 560100",
        "area": "Electronic City", "city": "Bengaluru", "state": "Karnataka",
        "pincode": "560100", "zone": "South Bengaluru",
    },
    "hosur": {
        "lat": 12.7409, "lon": 77.8253,
        "display_name": "Hosur, Krishnagiri District, Tamil Nadu 635109",
        "area": "Hosur", "city": "Hosur", "state": "Tamil Nadu",
        "pincode": "635109", "zone": "Hosur Zone",
    },
}


# ── Address autocomplete (suggestions) ───────────────────────────────────────

def address_autocomplete(query: str) -> list[dict]:
    """
    Returns up to 8 address suggestions for the given partial query.
    Priority: local landmark DB → Nominatim.
    Each result: {name, full_address, lat, lon}.
    """
    q_low = query.lower().strip()

    # 1. Local landmark partial matches (instant)
    local_matches = []
    for key, data in _LANDMARK_DB.items():
        if q_low in key or any(q_low in part for part in key.split()):
            local_matches.append({
                "name": data["area"],
                "full_address": data["display_name"],
                "lat": data["lat"],
                "lon": data["lon"],
                "source": "local",
            })
    if local_matches:
        return local_matches[:8]

    # 2. Nominatim search (live, subject to rate limit)
    try:
        encoded = urllib.parse.urlencode({
            "q": query,
            "format": "json",
            "addressdetails": "1",
            "limit": "8",
        })
        req = urllib.request.Request(
            f"{NOMINATIM_URL}/search?{encoded}",
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())

        results = []
        for item in data:
            addr = item.get("address", {})
            name = (
                addr.get("neighbourhood")
                or addr.get("suburb")
                or addr.get("city_district")
                or addr.get("town")
                or item.get("display_name", "").split(",")[0]
            )
            results.append({
                "name": name,
                "full_address": item.get("display_name", ""),
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "source": "nominatim",
            })
        return results
    except Exception as e:
        print(f"Nominatim autocomplete error for '{query}': {e}")
        return []


# ── Geocode & parse a chosen address ─────────────────────────────────────────

def geocode_and_parse_address(address_str: str) -> Optional[dict]:
    """
    Resolves a selected address into structured fields:
      lat, lon, area, city, state, pincode, display_name, zone

    Returns None if geocoding fails completely.
    """
    q_low = address_str.lower().strip()

    # 1. Local landmark DB — exact or substring match
    for key, data in _LANDMARK_DB.items():
        if key in q_low:
            return {**data, "raw_address": address_str, "geocoded_by": "local_db"}

    # 2. Nominatim
    try:
        encoded = urllib.parse.urlencode({
            "q": address_str,
            "format": "json",
            "addressdetails": "1",
            "limit": "1",
        })
        req = urllib.request.Request(
            f"{NOMINATIM_URL}/search?{encoded}",
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())

        if not data:
            return None

        item = data[0]
        addr = item.get("address", {})

        area = (
            addr.get("neighbourhood")
            or addr.get("suburb")
            or addr.get("city_district")
            or addr.get("quarter")
            or ""
        )
        city = (
            addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("county")
            or ""
        )
        state = addr.get("state", "")
        pincode = addr.get("postcode", "")
        lat = float(item["lat"])
        lon = float(item["lon"])

        return {
            "lat": lat,
            "lon": lon,
            "area": area,
            "city": city,
            "state": state,
            "pincode": pincode,
            "display_name": item.get("display_name", address_str),
            "zone": _infer_zone(area, city),
            "raw_address": address_str,
            "geocoded_by": "nominatim",
        }
    except Exception:
        return None


def _infer_zone(area: str, city: str) -> str:
    """Attempt to label the city zone from known patterns (heuristic)."""
    east_keywords = ("whitefield", "marathahalli", "kr puram", "k r puram",
                     "brookefield", "varthur", "sarjapur", "bellandur")
    west_keywords = ("rajajinagar", "vijaynagar", "yeshwanthpur", "peenya",
                     "tumkur", "magadi")
    south_keywords = ("koramangala", "jayanagar", "btm", "electronic city",
                      "bannerghatta", "jp nagar", "banashankari")
    north_keywords = ("hebbal", "yelahanka", "devanahalli", "kempegowda",
                      "thanisandra", "rachenahalli")
    central_keywords = ("indiranagar", "ulsoor", "mg road", "cubbon", "shivajinagar",
                        "majestic", "sadashivanagar", "malleswaram")

    combined = (area + " " + city).lower()
    if any(k in combined for k in east_keywords):
        return f"East {city}"
    if any(k in combined for k in south_keywords):
        return f"South {city}"
    if any(k in combined for k in north_keywords):
        return f"North {city}"
    if any(k in combined for k in west_keywords):
        return f"West {city}"
    if any(k in combined for k in central_keywords):
        return f"Central {city}"
    return city or "Unknown Zone"


# ── Service zone detection ────────────────────────────────────────────────────

def detect_service_zone(lat: float, lon: float, company) -> dict:
    """
    Checks whether coordinates fall within any of the company's registered
    service Locations or LocationZones.

    Returns:
      {
        "in_service_zone": bool,
        "matched_location": Location | None,
        "matched_zone_name": str | None,
        "nearest_location": Location | None,
        "nearest_distance_m": int,
        "alert": str | None,   # human-readable warning if outside zones
      }
    """
    from time_tracking.models import Location, LocationZone
    from time_tracking.geo.geo_utils import haversine_m

    locations = list(
        Location.objects.filter(company=company, is_active=True, is_archived=False)
    )

    if not locations:
        # No geofences configured → treat as global service zone
        return {
            "in_service_zone": True,
            "matched_location": None,
            "matched_zone_name": None,
            "nearest_location": None,
            "nearest_distance_m": 0,
            "alert": None,
        }

    best_loc = None
    best_dist = float("inf")

    for loc in locations:
        d = haversine_m(lat, lon, float(loc.lat), float(loc.lng))
        if d < best_dist:
            best_dist = d
            best_loc = loc

    # Check inside any location's geofence
    matched_location = None
    for loc in locations:
        d = haversine_m(lat, lon, float(loc.lat), float(loc.lng))
        radius = int(loc.geofence_radius or 300)
        if d <= radius:
            matched_location = loc
            break

    # Try to find a zone name for the matched location
    matched_zone_name = None
    if matched_location:
        try:
            zone = LocationZone.objects.filter(
                company=company, locations=matched_location
            ).first()
            if zone:
                matched_zone_name = zone.name
        except Exception:
            pass

    in_zone = matched_location is not None

    alert = None
    if not in_zone:
        dist_km = round(best_dist / 1000, 1)
        alert = (
            f"Address is outside all registered service zones. "
            f"Nearest site ({best_loc.name if best_loc else 'N/A'}) "
            f"is {dist_km} km away."
        )

    return {
        "in_service_zone": in_zone,
        "matched_location": matched_location,
        "matched_zone_name": matched_zone_name,
        "nearest_location": best_loc,
        "nearest_distance_m": int(best_dist) if best_dist != float("inf") else 0,
        "alert": alert,
    }


# ── Address validation ────────────────────────────────────────────────────────

def validate_address_workflow(
    address_str: str,
    lat: Optional[float],
    lon: Optional[float],
    company,
) -> dict:
    """
    Validates the address for:
      - Completeness (has street-level detail)
      - Duplicate active work orders at same coordinates (within 50m)
      - Service zone coverage

    Returns {valid: bool, issues: list[str], warnings: list[str]}.
    """
    from tasks.models import Task

    issues = []
    warnings = []

    # Completeness heuristic — must have ≥ 3 comma-separated segments
    segments = [s.strip() for s in address_str.split(",") if s.strip()]
    if len(segments) < 2:
        issues.append("Address appears incomplete. Please include street, area, and city.")

    # Coordinates required for geo-checks
    if lat is None or lon is None:
        warnings.append(
            "Could not resolve GPS coordinates for this address — "
            "geofence checks are unavailable."
        )
        return {"valid": not issues, "issues": issues, "warnings": warnings}

    # Duplicate active work order check (within 50m)
    active_tasks = Task.objects.filter(
        company=company,
        status__in=("pending", "in_progress", "suspended"),
        location_lat__isnull=False,
        location_lon__isnull=False,
    )
    for t in active_tasks:
        d = haversine_m(lat, lon, float(t.location_lat), float(t.location_lon))
        if d <= 50:
            warnings.append(
                f"There is already an active work order ('{t.title}') "
                f"within 50m of this address."
            )
            break

    # Service zone check
    zone_check = detect_service_zone(lat, lon, company)
    if not zone_check["in_service_zone"] and zone_check["alert"]:
        warnings.append(zone_check["alert"])

    return {
        "valid": not issues,
        "issues": issues,
        "warnings": warnings,
        "zone_check": zone_check,
    }


# ── Nearby employee recommendation ───────────────────────────────────────────

def recommend_nearby_employees(
    lat: float,
    lon: float,
    company,
    radius_m: int = NEARBY_RADIUS_M,
) -> list[dict]:
    """
    Finds active employees within `radius_m` metres and ranks them.

    Priority for employee position (in order):
      1. Latest live GPS ping (EmployeeLocationPing)
      2. Current in-progress task location_lat/lon
      3. Clock-in coordinates from open TimeLog
      4. Primary assigned job site

    Returns list of dicts sorted by distance_m ascending:
      {
        employee_id, employee_name, availability,
        lat, lon, area_name, distance_m, distance_km,
        current_task_title, recommendation_grade, recommendation_label,
        user_id, has_current_task,
      }
    """
    from employees.models import Employee
    from time_tracking.models import TimeLog
    from live_locations.models import EmployeeLocation as PingModel
    from tasks.models import Task
    from leaves.models import LeaveRequest

    today = timezone.localdate()
    now = timezone.now()

    active_employees = (
        Employee.objects.filter(company=company, is_active=True)
        .select_related("user", "assigned_job_site")
    )

    results = []

    for emp in active_employees:
        # Resolve best known position
        emp_lat = emp_lon = None
        position_source = None

        # 1. Latest GPS ping (last 30 min)
        recent_ping = (
            PingModel.objects
            .filter(employee=emp)
            .order_by("-timestamp")
            .first()
        )
        if recent_ping:
            age_min = (now - recent_ping.timestamp).total_seconds() / 60
            if age_min <= 30:
                emp_lat = float(recent_ping.lat)
                emp_lon = float(recent_ping.lng)
                position_source = "live_gps"

        # 2. In-progress task location
        if emp_lat is None:
            current_task = (
                Task.objects.filter(
                    assigned_to=emp.user,
                    company=company,
                    status="in_progress",
                    location_lat__isnull=False,
                    location_lon__isnull=False,
                ).first()
            )
            if current_task:
                emp_lat = float(current_task.location_lat)
                emp_lon = float(current_task.location_lon)
                position_source = "current_task"

        # 3. Open TimeLog clock-in coordinates
        if emp_lat is None:
            open_log = (
                TimeLog.objects.filter(
                    employee=emp,
                    clock_out__isnull=True,
                    clock_in_lat__isnull=False,
                    clock_in_lon__isnull=False,
                ).order_by("-clock_in").first()
            )
            if open_log:
                emp_lat = float(open_log.clock_in_lat)
                emp_lon = float(open_log.clock_in_lon)
                position_source = "clock_in"

        # 4. Assigned job site
        if emp_lat is None and emp.assigned_job_site:
            emp_lat = float(emp.assigned_job_site.lat)
            emp_lon = float(emp.assigned_job_site.lng)
            position_source = "job_site"

        if emp_lat is None or emp_lon is None:
            continue  # no known position

        distance_m = haversine_m(lat, lon, emp_lat, emp_lon)
        if distance_m > radius_m:
            continue

        # Determine live availability
        open_log_today = TimeLog.objects.filter(
            employee=emp, work_date=today, clock_out__isnull=True
        ).first()
        on_leave = LeaveRequest.objects.filter(
            employee=emp, status="approved",
            start_date__lte=today, end_date__gte=today,
        ).exists()

        if not emp.is_active:
            availability = "offline"
        elif on_leave:
            availability = "on_leave"
        elif open_log_today:
            from time_tracking.models import Break
            on_break = Break.objects.filter(
                time_log=open_log_today, break_end__isnull=True
            ).exists()
            availability = "on_break" if on_break else "busy"
        else:
            availability = "available"

        # Current task
        current_task = (
            Task.objects.filter(
                assigned_to=emp.user,
                company=company,
                status="in_progress",
            ).first()
        )

        # Area name heuristic from the employee's current coordinates
        area_name = _coords_to_area_name(emp_lat, emp_lon)

        # Grade
        grade, label = _grade_recommendation(distance_m, availability)

        results.append({
            "employee_id": str(emp.id),
            "user_id": str(emp.user.id),
            "employee_name": emp.user.get_full_name() or emp.user.username,
            "availability": availability,
            "lat": emp_lat,
            "lon": emp_lon,
            "area_name": area_name,
            "distance_m": distance_m,
            "distance_km": round(distance_m / 1000, 2),
            "position_source": position_source,
            "current_task_title": current_task.title if current_task else None,
            "has_current_task": current_task is not None,
            "recommendation_grade": grade,
            "recommendation_label": label,
        })

    results.sort(key=lambda x: x["distance_m"])
    return results


def _coords_to_area_name(lat: float, lon: float) -> str:
    """Reverse-lookup area from landmarks using nearest Haversine match."""
    best_name = "Unknown Area"
    best_dist = float("inf")
    for _key, data in _LANDMARK_DB.items():
        d = haversine_m(lat, lon, data["lat"], data["lon"])
        if d < best_dist:
            best_dist = d
            best_name = data["area"]
    # Only label if we're within 5 KM of a known landmark
    return best_name if best_dist < 5000 else "Field Area"


def _grade_recommendation(distance_m: float, availability: str) -> tuple[str, str]:
    """Grade recommendation: highly_recommended | recommended | nearest."""
    if availability == "available" and distance_m <= HIGH_RECOMMEND_M:
        return ("highly_recommended", "Highly Recommended")
    if availability in ("available", "busy") and distance_m <= RECOMMEND_M:
        return ("recommended", "Recommended")
    return ("nearest", "Nearest Available")
