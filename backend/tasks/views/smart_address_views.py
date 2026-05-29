"""
tasks.views.smart_address_views
────────────────────────────────
Module 2 API views — Smart Address Auto-Detection & Area Identification

Endpoints:
  GET  /api/tasks/admin/address-autocomplete/?q=<str>
       Real-time address suggestions as admin types.

  POST /api/tasks/admin/smart-address-workflow/
       Full smart-dispatch payload: geocode, zone detection,
       validation, and nearby employee recommendations.
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.services import smart_address_service


class IsAdmin(IsAuthenticated):
    _ADMIN_ROLES = {"admin", "manager"}

    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role in self._ADMIN_ROLES
        )


class AddressAutocompleteView(APIView):
    """
    GET /api/tasks/admin/address-autocomplete/?q=<partial_address>

    Returns up to 8 address suggestion objects:
      [{ name, full_address, lat, lon, source }, ...]

    Uses the landmark DB for instant offline results, then falls back
    to OpenStreetMap Nominatim for real-world queries.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])

        suggestions = smart_address_service.address_autocomplete(q)
        return Response(suggestions)


class SmartAddressWorkflowView(APIView):
    """
    POST /api/tasks/admin/smart-address-workflow/
    Body: { address: str, lat?: float, lon?: float }

    Runs the full smart-address pipeline:
      1. Geocode + parse address → area, city, state, pincode, zone, lat/lon
      2. Detect service zone coverage
      3. Validate (completeness, duplicates, out-of-service)
      4. Recommend nearby employees within 10 KM

    Response:
    {
      "geocoded": { lat, lon, area, city, state, pincode, zone, display_name },
      "zone_check": { in_service_zone, matched_zone_name, nearest_distance_m, alert },
      "validation": { valid, issues, warnings },
      "nearby_employees": [
        {
          employee_id, user_id, employee_name, availability,
          lat, lon, area_name, distance_m, distance_km,
          current_task_title, has_current_task,
          recommendation_grade, recommendation_label,
        },
        ...
      ]
    }
    """
    permission_classes = [IsAdmin]

    def post(self, request):
        address_str = (request.data.get("address") or "").strip()
        if not address_str:
            return Response(
                {"detail": "'address' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = getattr(request, "company", None)

        # Allow pre-resolved coordinates from frontend to skip geocoding call
        lat_override = request.data.get("lat")
        lon_override = request.data.get("lon")

        # 1. Geocode
        geo = None
        if lat_override is not None and lon_override is not None:
            try:
                lat_f = float(lat_override)
                lon_f = float(lon_override)
                # Build partial geo dict from overrides; run only address parsing
                partial = smart_address_service.geocode_and_parse_address(address_str)
                if partial:
                    geo = {**partial, "lat": lat_f, "lon": lon_f}
                else:
                    geo = {
                        "lat": lat_f, "lon": lon_f,
                        "area": "", "city": "", "state": "",
                        "pincode": "", "zone": "",
                        "display_name": address_str,
                        "geocoded_by": "frontend_override",
                    }
            except (TypeError, ValueError):
                geo = None

        if geo is None:
            geo = smart_address_service.geocode_and_parse_address(address_str)

        if geo is None:
            return Response({
                "geocoded": None,
                "zone_check": None,
                "validation": {
                    "valid": False,
                    "issues": ["Could not geocode the provided address. Please try a more specific address."],
                    "warnings": [],
                },
                "nearby_employees": [],
            })

        lat_f = float(geo["lat"])
        lon_f = float(geo["lon"])

        # 2. Zone detection
        zone_check_raw = smart_address_service.detect_service_zone(lat_f, lon_f, company)
        matched_loc = zone_check_raw.get("matched_location")
        nearest_loc = zone_check_raw.get("nearest_location")
        zone_check = {
            "in_service_zone": zone_check_raw["in_service_zone"],
            "matched_location_id": str(matched_loc.id) if matched_loc else None,
            "matched_location_name": matched_loc.name if matched_loc else None,
            "matched_zone_name": zone_check_raw.get("matched_zone_name"),
            "nearest_location_id": str(nearest_loc.id) if nearest_loc else None,
            "nearest_location_name": nearest_loc.name if nearest_loc else None,
            "nearest_distance_m": zone_check_raw["nearest_distance_m"],
            "alert": zone_check_raw["alert"],
        }

        # 3. Validation
        validation = smart_address_service.validate_address_workflow(
            address_str, lat_f, lon_f, company
        )
        validation.pop("zone_check", None)  # already returned above

        # 4. Nearby employees
        nearby_employees = []
        if company:
            nearby_employees = smart_address_service.recommend_nearby_employees(
                lat_f, lon_f, company
            )

        return Response({
            "geocoded": {
                "lat": geo["lat"],
                "lon": geo["lon"],
                "area": geo.get("area", ""),
                "city": geo.get("city", ""),
                "state": geo.get("state", ""),
                "pincode": geo.get("pincode", ""),
                "zone": geo.get("zone", ""),
                "display_name": geo.get("display_name", address_str),
            },
            "zone_check": zone_check,
            "validation": validation,
            "nearby_employees": nearby_employees,
        })
