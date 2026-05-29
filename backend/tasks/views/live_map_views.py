"""
tasks.views.live_map_views
──────────────────────────
Live Task Map endpoint — powers the admin live-map task overlay.

GET /api/tasks/admin/live-task-map/
Response:
{
  "active_tasks": [
    {
      "task_id", "title", "client_lat", "client_lon",
      "client_name", "client_contact_number",
      "assigned_employee_id", "assigned_employee_name",
      "status", "priority"
    }, ...
  ],
  "employee_positions": [
    { "employee_id", "lat", "lon", "timestamp", "task_id" }, ...
  ]
}
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import Task


class IsAdmin(IsAuthenticated):
    _ADMIN_ROLES = {"admin", "manager"}

    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.user.role in self._ADMIN_ROLES
        )


class LiveTaskMapView(APIView):
    """
    GET /api/tasks/admin/live-task-map/

    Returns all in-progress tasks with GPS coordinates (for client pins)
    and latest employee GPS positions (for route lines + ETA).
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        company = getattr(request, "company", None)

        # ── 1. In-progress tasks with GPS ────────────────────────────
        active_tasks_qs = (
            Task.objects
            .filter(
                company=company,
                status__in=("pending", "in_progress"),
                location_lat__isnull=False,
                location_lon__isnull=False,
            )
            .select_related("assigned_to", "assigned_by")
        )

        active_tasks = []
        for t in active_tasks_qs:
            emp = t.assigned_to
            active_tasks.append({
                "task_id": str(t.id),
                "title": t.title,
                "client_lat": float(t.location_lat),
                "client_lon": float(t.location_lon),
                "client_name": t.client_name or "",
                "client_contact_number": t.client_contact_number or "",
                "client_company_name": t.client_company_name or "",
                "job_address": t.job_address or "",
                "area": t.area or "",
                "city": t.city or "",
                "assigned_employee_id": str(emp.employee_profile.id) if (emp and hasattr(emp, "employee_profile")) else None,
                "assigned_employee_name": (
                    emp.get_full_name() or emp.username
                ) if emp else None,
                "status": t.status,
                "priority": t.priority,
                "geofence_radius": t.geofence_radius or 200,
            })

        # ── 2. Latest employee GPS pings ─────────────────────────────
        from live_locations.models import EmployeeLocation
        from employees.models import Employee
        from django.utils import timezone
        import datetime

        thirty_min_ago = timezone.now() - datetime.timedelta(minutes=30)

        employees = Employee.objects.filter(
            company=company, is_active=True
        ).select_related("user")

        # Build map: employee_id → latest in-progress task id
        task_map = {
            str(t["assigned_employee_id"]): t["task_id"]
            for t in active_tasks
            if t["assigned_employee_id"]
        }

        employee_positions = []
        for emp in employees:
            ping = (
                EmployeeLocation.objects
                .filter(employee=emp, timestamp__gte=thirty_min_ago)
                .order_by("-timestamp")
                .first()
            )
            if not ping:
                continue
            employee_positions.append({
                "employee_id": str(emp.id),
                "employee_name": emp.user.get_full_name() or emp.user.username,
                "lat": float(ping.lat),
                "lon": float(ping.lng),
                "timestamp": ping.timestamp.isoformat(),
                "task_id": task_map.get(str(emp.id)),
            })

        return Response({
            "active_tasks": active_tasks,
            "employee_positions": employee_positions,
        })
