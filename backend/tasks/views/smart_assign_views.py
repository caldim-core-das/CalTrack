"""
smart_assign_views.py

Module 1 API views — Smart Nearby Work Assignment
"""
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import Task, TaskActivityLog
from tasks.serializers.gap_job_serializers import GapJobListSerializer
from tasks.serializers.task_serializers import TaskSerializer
from tasks.serializers.activity_log_serializers import TaskActivityLogSerializer
from tasks.services import gap_job_service, smart_assignment_service


class IsAdmin(IsAuthenticated):
    _ADMIN_ROLES = {"admin", "manager"}
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in self._ADMIN_ROLES


# ── Employee: smart nearby check ─────────────────────────────────────────────

class CheckSmartNearbyView(APIView):
    """
    GET /api/tasks/smart-nearby/?lat=<float>&lng=<float>&current_task_id=<str>

    Returns nearby pending jobs the employee can queue.
    All 5 business rules are enforced:
      1. Current job ≥80% OR ≤20min remaining
      2. Candidate job within 500m
      3. Candidate job NOT High/Urgent priority
      4. Current job SLA is safe
      5. Employee max 1 suspended task (not overloaded)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        current_task_id = request.query_params.get("current_task_id")

        if not lat or not lng:
            return Response({"detail": "'lat' and 'lng' are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return Response({"detail": "Invalid coordinates."}, status=status.HTTP_400_BAD_REQUEST)

        current_task = None
        if current_task_id:
            try:
                current_task = Task.objects.get(
                    pk=current_task_id,
                    assigned_to=request.user,
                    company=request.company,
                )
            except Task.DoesNotExist:
                pass

        jobs = smart_assignment_service.find_smart_nearby_for_employee(
            worker=request.user,
            lat=lat,
            lng=lng,
            current_task=current_task,
        )

        return Response({
            "qualifies": bool(current_task and smart_assignment_service.employee_qualifies_for_nearby(current_task)),
            "jobs": GapJobListSerializer(jobs, many=True).data,
        })


class EmployeeNearbyDecisionView(APIView):
    """
    POST /api/tasks/<pk>/nearby-decision/
    Body: { decision: "accept"|"reject", current_task_id: str, reason?: str }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        decision = request.data.get("decision")
        current_task_id = request.data.get("current_task_id")
        reason = request.data.get("reason", "")

        if decision not in ("accept", "reject"):
            return Response({"detail": "'decision' must be 'accept' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        current_task = None
        if current_task_id:
            try:
                current_task = Task.objects.get(
                    pk=current_task_id,
                    assigned_to=request.user,
                    company=request.company,
                )
            except Task.DoesNotExist:
                pass

        if decision == "accept":
            try:
                nearby_task = smart_assignment_service.employee_accept_nearby(
                    worker=request.user,
                    nearby_task_id=pk,
                    current_task=current_task,
                )
                return Response({
                    "status": "queued",
                    "nearby_task": TaskSerializer(nearby_task).data,
                })
            except Exception as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            try:
                smart_assignment_service.employee_reject_nearby(
                    worker=request.user,
                    nearby_task_id=pk,
                    current_task=current_task,
                    reason=reason,
                )
                return Response({"status": "rejected"})
            except Exception as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# ── Employee: update completion percentage ────────────────────────────────────

class UpdateCompletionView(APIView):
    """
    PATCH /api/tasks/<pk>/completion/
    Body: { completion_percentage: 0-100 }
    Also logs a COMPLETION_PCT activity entry.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            task = Task.objects.get(
                pk=pk,
                assigned_to=request.user,
                company=request.company,
                status=Task.Status.IN_PROGRESS,
            )
        except Task.DoesNotExist:
            return Response({"detail": "Task not found or not in-progress."}, status=status.HTTP_404_NOT_FOUND)

        pct = request.data.get("completion_percentage")
        if pct is None:
            return Response({"detail": "'completion_percentage' is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            pct = int(pct)
            if not (0 <= pct <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return Response({"detail": "'completion_percentage' must be an integer 0–100."}, status=status.HTTP_400_BAD_REQUEST)

        old_pct = task.completion_percentage
        task.completion_percentage = pct
        task.save(update_fields=["completion_percentage", "updated_at"])

        gap_job_service.log_activity(
            task,
            TaskActivityLog.EventType.COMPLETION_PCT,
            actor=request.user,
            notes=f"Completion updated: {old_pct}% → {pct}%",
        )

        return Response(TaskSerializer(task).data)


# ── Employee: activity log timeline ──────────────────────────────────────────

class TaskActivityLogView(APIView):
    """
    GET /api/tasks/<pk>/activity-log/
    Returns ordered activity timeline. Available to assignee or admin.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, company=request.company)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Allow access to the assignee or any admin/manager
        is_admin = request.user.role in ("admin", "manager")
        is_assignee = str(task.assigned_to_id) == str(request.user.pk)
        if not (is_admin or is_assignee):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        logs = task.activity_logs.select_related("actor").order_by("timestamp")
        return Response(TaskActivityLogSerializer(logs, many=True).data)


# ── Admin: smart dispatch table ───────────────────────────────────────────────

class AdminSmartDispatchView(APIView):
    """
    GET /api/tasks/admin/smart-dispatch/
    Returns per-employee smart dispatch rows for the admin dashboard.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        if not hasattr(request, "company"):
            return Response([])
        rows = smart_assignment_service.get_admin_smart_dispatch_table(request.company)
        return Response(rows)


# ── Admin: update completion on behalf of employee ────────────────────────────

class AdminUpdateCompletionView(APIView):
    """
    PATCH /api/tasks/admin/<pk>/completion/
    Admin can set completion % on any task.
    """
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, company=request.company)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        pct = request.data.get("completion_percentage")
        try:
            pct = int(pct)
            if not (0 <= pct <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return Response({"detail": "'completion_percentage' must be 0–100."}, status=status.HTTP_400_BAD_REQUEST)

        task.completion_percentage = pct
        task.save(update_fields=["completion_percentage", "updated_at"])
        return Response(TaskSerializer(task).data)
