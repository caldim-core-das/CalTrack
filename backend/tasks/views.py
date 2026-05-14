from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Task, TaskAttachment
from .serializers import TaskSerializer, TaskStatusUpdateSerializer


class IsAdmin(IsAuthenticated):
    """Allows access for admin and manager roles."""
    _ADMIN_ROLES = {"admin", "manager"}

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in self._ADMIN_ROLES


# ── Admin: full CRUD ──────────────────────────────────────────

from rest_framework.generics import GenericAPIView

class AdminTaskListCreateView(GenericAPIView):
    """
    GET  /api/tasks/admin/          → list all tasks (admin)
    POST /api/tasks/admin/          → create & assign a task (admin)
    """
    permission_classes = [IsAdmin]
    serializer_class = TaskSerializer

    def get(self, request):
        if not hasattr(request, 'company'):
            return Response([])
        qs = Task.objects.filter(company=request.company).select_related("assigned_to", "assigned_by")

        # Optional filters
        employee_id  = request.query_params.get("employee")
        status_f     = request.query_params.get("status")
        due_date     = request.query_params.get("due_date")
        acceptance_f = request.query_params.get("acceptance_status")

        if employee_id:
            qs = qs.filter(assigned_to_id=employee_id)
        if status_f:
            qs = qs.filter(status=status_f)
        if due_date:
            qs = qs.filter(due_date=due_date)
        if acceptance_f:
            qs = qs.filter(acceptance_status=acceptance_f)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(TaskSerializer(qs, many=True).data)

    def post(self, request):
        ser = TaskSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        # New tasks always start as pending_acceptance for the assignee
        task = ser.save(
            assigned_by=request.user,
            company=request.company,
            acceptance_status=Task.AcceptanceStatus.PENDING_ACCEPTANCE,
        )
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class AdminTaskDetailView(APIView):
    """
    GET    /api/tasks/admin/<pk>/   → retrieve
    PATCH  /api/tasks/admin/<pk>/   → update / reassign
    DELETE /api/tasks/admin/<pk>/   → delete
    """
    permission_classes = [IsAdmin]

    def get_object(self, pk, company):
        try:
            return Task.objects.select_related("assigned_to", "assigned_by").get(pk=pk, company=company)
        except Task.DoesNotExist:
            return None

    def get(self, request, pk):
        task = self.get_object(pk, request.company)
        if not task:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(TaskSerializer(task).data)

    def patch(self, request, pk):
        task = self.get_object(pk, request.company)
        if not task:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        # Detect reassignment: if assigned_to is changing, reset acceptance workflow
        new_assignee_id = request.data.get("assigned_to")
        is_reassigning = (
            new_assignee_id is not None
            and str(new_assignee_id) != str(task.assigned_to_id)
        )

        ser = TaskSerializer(task, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        saved_task = ser.save()

        if is_reassigning:
            # Reset acceptance so new assignee must accept/decline
            saved_task.acceptance_status = Task.AcceptanceStatus.PENDING_ACCEPTANCE
            saved_task.decline_reason = ""
            saved_task.declined_at = None
            saved_task.declined_by = None
            saved_task.save(update_fields=[
                "acceptance_status", "decline_reason", "declined_at", "declined_by"
            ])

        return Response(TaskSerializer(saved_task).data)

    def delete(self, request, pk):
        task = self.get_object(pk, request.company)
        if not task:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminTaskAttachmentCreateView(APIView):
    permission_classes = [IsAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        try:
            task = Task.objects.get(pk=pk, company=request.company)
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        files = request.FILES.getlist("files") or request.FILES.getlist("file")
        if not files:
            return Response({"detail": "No files provided."}, status=status.HTTP_400_BAD_REQUEST)

        for f in files:
            TaskAttachment.objects.create(
                task=task,
                file=f,
                original_name=getattr(f, "name", "") or "",
                uploaded_by=request.user,
            )

        task = Task.objects.get(pk=pk)
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


# ── Admin: declined tasks fast-view ──────────────────────────

class AdminDeclinedTasksView(APIView):
    """
    GET /api/tasks/admin/declined/
    Returns all declined tasks for the company, ordered most-recent first.
    Powers the admin "Declined — Needs Reassignment" panel.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        if not hasattr(request, 'company'):
            return Response([])
        qs = (
            Task.objects
            .filter(company=request.company, acceptance_status=Task.AcceptanceStatus.DECLINED)
            .select_related("assigned_to", "assigned_by", "declined_by")
            .order_by("-declined_at")
        )
        return Response(TaskSerializer(qs, many=True).data)


# ── Admin: available employees for reassignment ───────────────

class AdminAvailableEmployeesView(APIView):
    """
    GET /api/tasks/admin/available-employees/
    Returns all active employees with their current_availability field so
    the admin can pick someone who is free when reassigning a declined task.
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        if not hasattr(request, 'company'):
            return Response([])
        from employees.models import Employee
        from employees.serializers import EmployeeSerializer
        employees = (
            Employee.objects
            .filter(company=request.company, is_active=True)
            .select_related("user", "assigned_job_site")
        )
        ser = EmployeeSerializer(employees, many=True, context={"request": request})
        return Response(ser.data)


# ── Employee: own tasks ───────────────────────────────────────

class EmployeeTaskListView(GenericAPIView):
    """
    GET /api/tasks/my/              → list tasks assigned to current user
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TaskSerializer

    def get(self, request):
        if not hasattr(request, 'company'):
            return Response([])
        qs = Task.objects.filter(assigned_to=request.user, company=request.company).select_related("assigned_by")
        status_f = request.query_params.get("status")
        if status_f:
            qs = qs.filter(status=status_f)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        return Response(TaskSerializer(qs, many=True).data)


class EmployeeTaskActionView(APIView):
    """
    POST /api/tasks/my/<pk>/accept/    → employee accepts the task
    POST /api/tasks/my/<pk>/decline/   → employee declines (body: {reason})
    POST /api/tasks/my/<pk>/start/     → mark In Progress
    POST /api/tasks/my/<pk>/complete/  → mark Completed + compute billed_hours
    PATCH /api/tasks/my/<pk>/notes/    → update employee notes
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [FormParser, MultiPartParser]

    def get_object(self, pk, user, company):
        try:
            return Task.objects.get(pk=pk, assigned_to=user, company=company)
        except Task.DoesNotExist:
            return None

    def post(self, request, pk, action):
        return self.handle_action(request, pk, action)

    def patch(self, request, pk, action):
        return self.handle_action(request, pk, action)

    def handle_action(self, request, pk, action):
        company = getattr(request, 'company', None)
        task = self.get_object(pk, request.user, company)
        if not task:
            return Response({"detail": "Not found or not assigned to you."}, status=status.HTTP_404_NOT_FOUND)

        # ── Accept ────────────────────────────────────────────────────────
        if action == "accept":
            if task.acceptance_status == Task.AcceptanceStatus.PENDING_ACCEPTANCE:
                task.acceptance_status = Task.AcceptanceStatus.ACCEPTED
                task.save(update_fields=["acceptance_status", "updated_at"])
            return Response(TaskSerializer(task).data)

        # ── Decline ───────────────────────────────────────────────────────
        elif action == "decline":
            if task.acceptance_status == Task.AcceptanceStatus.PENDING_ACCEPTANCE:
                reason = request.data.get("reason", "").strip()
                task.acceptance_status = Task.AcceptanceStatus.DECLINED
                task.decline_reason    = reason
                task.declined_at       = timezone.now()
                task.declined_by       = request.user
                task.save(update_fields=[
                    "acceptance_status", "decline_reason",
                    "declined_at", "declined_by", "updated_at",
                ])
            return Response(TaskSerializer(task).data)

        # ── Start ─────────────────────────────────────────────────────────
        elif action == "start":
            if task.acceptance_status != Task.AcceptanceStatus.ACCEPTED:
                return Response(
                    {"detail": "You must accept this task before starting it."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if task.status == Task.Status.PENDING:
                from time_tracking.models import TimeLog
                lat   = request.data.get("lat")
                lon   = request.data.get("lon")
                photo = request.FILES.get("photo")

                employee_profile = getattr(request.user, "employee_profile", None)
                timelog = None
                if employee_profile:
                    timelog = TimeLog.objects.create(
                        employee=employee_profile,
                        work_date=timezone.localdate(),
                        clock_in=timezone.now(),
                        clock_in_lat=lat,
                        clock_in_lon=lon,
                        clock_in_photo=photo,
                    )

                task.status     = Task.Status.IN_PROGRESS
                task.started_at = timezone.now()
                task.time_log   = timelog
                task.save()

        # ── Complete ──────────────────────────────────────────────────────
        elif action == "complete":
            if task.status in (Task.Status.PENDING, Task.Status.IN_PROGRESS):
                from time_tracking.models import TimeLogPhoto
                photo = request.FILES.get("photo")
                notes = request.data.get("notes", "")

                task.status       = Task.Status.COMPLETED
                task.completed_at = timezone.now()
                if notes:
                    task.employee_notes = notes
                if not task.started_at:
                    task.started_at = task.completed_at

                # ── Sub-1-hour billing round-up ───────────────────────────
                actual_seconds = int(
                    (task.completed_at - task.started_at).total_seconds()
                ) if task.started_at else 0
                task.billed_hours = Task.compute_billed_hours(
                    task.estimated_hours, actual_seconds
                )

                if task.time_log:
                    task.time_log.clock_out       = timezone.now()
                    task.time_log.clock_out_notes = notes
                    task.time_log.save()
                    if photo:
                        TimeLogPhoto.objects.create(
                            time_log=task.time_log,
                            photo=photo,
                            photo_type="after",
                        )
                task.save()

        # ── Notes ─────────────────────────────────────────────────────────
        elif action == "notes":
            ser = TaskStatusUpdateSerializer(task, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()

        else:
            return Response({"detail": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(TaskSerializer(task).data)
