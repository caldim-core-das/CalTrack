from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from tasks.models import Task, TaskAttachment
from tasks.serializers.task_serializers import TaskSerializer, TaskStatusUpdateSerializer
from tasks.services.gap_job_service import push_task_notification


def _get_company_for_tasks(request):
    company = getattr(request, "company", None)
    if not company and request.user and request.user.is_authenticated:
        company = getattr(request.user, "company", None)
    if not company and request.user and request.user.is_authenticated:
        try:
            from employees.models import Employee
            emp = Employee.objects.filter(user=request.user).first()
            if emp:
                company = emp.company
        except Exception:
            pass
    return company


def _write_task_audit(user, action, task):
    """Write an audit log entry for a task event. Fails silently if audit app not configured."""
    try:
        from django.apps import apps
        if apps.is_installed("audit"):
            AuditLog = apps.get_model("audit", "AuditLog")
            AuditLog.objects.create(
                user=user,
                action=action,
                target_model="Task",
                target_id=str(task.id),
            )
    except Exception:
        pass


def _broadcast_travel_status(task, actor, travel_event):
    """
    Push a travel_status_update message to the admin WS group so the admin map
    reflects the employee's journey phase in real time.
    Runs synchronously (fire-and-forget via async_to_sync).
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from employees.models import Employee

        employee = Employee.objects.select_related("user").filter(user=actor).first()
        if not employee or not task.company_id:
            return

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        payload = {
            "type": "travel_status_update",
            "employee_id": str(employee.id),
            "employee_name": actor.get_full_name() or actor.username,
            "task_id": str(task.id),
            "task_title": task.title,
            "travel_event": travel_event,          # on_the_way / reached_site / working / task_completed
            "travel_status": task.travel_status or "",
            "task_status": task.status,
        }
        async_to_sync(channel_layer.group_send)(
            f"live_admin_{task.company_id}",
            payload,
        )
    except Exception as exc:
        print(f"[_broadcast_travel_status] WS push failed: {exc}")



def sync_task_lifecycle_to_service_request(task, actor=None):
    """
    Synchronizes the state of a Task to its linked ServiceRequest and EmployeeJob.
    Used during task transitions (accept, decline, start, complete, cancel, etc.).
    """
    if not getattr(task, "service_request", None):
        return

    try:
        from django.db import transaction
        from django.utils import timezone
        from service_requests.models import ServiceRequest, ServiceFeedback, EmployeeJob
        from service_requests.state_machine import apply_transition
        from employees.models import Employee

        sr = task.service_request
        employee = None
        if task.assigned_to:
            employee = Employee.objects.filter(user=task.assigned_to).first()

        def _get_or_create_job():
            if not employee:
                return None
            job, _ = EmployeeJob.objects.update_or_create(
                service_request=sr,
                defaults={
                    "employee": employee,
                    "assigned_by": actor or task.assigned_by,
                }
            )
            return job

        with transaction.atomic():
            # 1. DECLINED task
            if task.acceptance_status == Task.AcceptanceStatus.DECLINED:
                sr.status = ServiceRequest.Status.REVIEWED
                sr.assigned_employee = None
                sr.save(update_fields=["status", "assigned_employee", "updated_at"])
                
                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.REJECTED
                    job.save(update_fields=["status"])

            # 2. CANCELLED task
            elif task.status == Task.Status.CANCELLED:
                sr.status = ServiceRequest.Status.REVIEWED
                sr.assigned_employee = None
                sr.save(update_fields=["status", "assigned_employee", "updated_at"])
                
                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.REJECTED
                    job.save(update_fields=["status"])

            # 3. COMPLETED task
            elif task.status == Task.Status.COMPLETED:
                if sr.status != ServiceRequest.Status.FEEDBACK_PENDING:
                    # Step through states dynamically — handles any starting status
                    from service_requests.state_machine import ALLOWED_TRANSITIONS
                    S = ServiceRequest.Status
                    COMPLETION_PATH = [
                        S.ASSIGNED, S.ACCEPTED, S.IN_PROGRESS,
                        S.COMPLETED, S.AWAITING_VERIFICATION, S.VERIFIED, S.FEEDBACK_PENDING,
                    ]
                    max_steps = 10
                    while sr.status != S.FEEDBACK_PENDING and max_steps > 0:
                        max_steps -= 1
                        allowed = ALLOWED_TRANSITIONS.get(sr.status, set())
                        next_step = None
                        for candidate in COMPLETION_PATH:
                            if candidate in allowed:
                                next_step = candidate
                                break
                        if next_step is None:
                            break
                        apply_transition(sr, next_step)

                    sr.save(update_fields=["status", "updated_at"])

                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.COMPLETED
                    if not job.completed_date:
                        job.completed_date = timezone.now()
                    job.save(update_fields=["status", "completed_date"])

                feedback, _ = ServiceFeedback.objects.get_or_create(service_request=sr)
                transaction.on_commit(lambda: _send_feedback_link_safe(sr, str(feedback.feedback_token)))


            # 4. IN_PROGRESS task
            elif task.status == Task.Status.IN_PROGRESS:
                from service_requests.state_machine import ALLOWED_TRANSITIONS
                S = ServiceRequest.Status
                PROGRESS_PATH = [S.ASSIGNED, S.ACCEPTED, S.IN_PROGRESS]
                max_steps = 5
                while sr.status != S.IN_PROGRESS and max_steps > 0:
                    max_steps -= 1
                    allowed = ALLOWED_TRANSITIONS.get(sr.status, set())
                    next_step = None
                    for candidate in PROGRESS_PATH:
                        if candidate in allowed:
                            next_step = candidate
                            break
                    if next_step is None:
                        sr.status = S.IN_PROGRESS
                        break
                    apply_transition(sr, next_step)
                sr.save(update_fields=["status", "updated_at"])

                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.IN_PROGRESS
                    if not job.started_date:
                        job.started_date = timezone.now()
                    job.save(update_fields=["status", "started_date"])

            # 5. SUSPENDED task
            elif task.status == Task.Status.SUSPENDED:
                sr.status = ServiceRequest.Status.SUSPENDED
                sr.save(update_fields=["status", "updated_at"])
                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.SUSPENDED
                    job.save(update_fields=["status"])

            # 5. ACCEPTED task
            elif task.acceptance_status == Task.AcceptanceStatus.ACCEPTED:
                if sr.status == ServiceRequest.Status.ASSIGNED:
                    apply_transition(sr, ServiceRequest.Status.ACCEPTED)
                    sr.save(update_fields=["status", "updated_at"])
                
                job = _get_or_create_job()
                if job:
                    job.status = EmployeeJob.Status.ACCEPTED
                    if not job.accepted_date:
                        job.accepted_date = timezone.now()
                    job.save(update_fields=["status", "accepted_date"])

    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"[sync_task_lifecycle_to_service_request] Error: {e}", exc_info=True)


def _send_feedback_link_safe(sr, token_str):
    import logging
    logger = logging.getLogger(__name__)
    try:
        from service_requests.notifications import send_completion_and_feedback_email
        send_completion_and_feedback_email(sr, token_str)
    except Exception as exc:
        logger.error(f"Failed to auto-send completion+feedback email: {exc}")


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
        company = _get_company_for_tasks(request)
        qs = Task.objects.all().select_related("assigned_to", "assigned_by")
        if company:
            qs = qs.filter(company=company)

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
        ser = TaskSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        # New tasks always start as pending_acceptance for the assignee
        task = ser.save(
            assigned_by=request.user,
            company=request.company,
            acceptance_status=Task.AcceptanceStatus.PENDING_ACCEPTANCE,
        )
        
        # Update ServiceRequest status & assigned employee if linked
        if task.service_request:
            from django.db import transaction
            from service_requests.models import ServiceRequest, EmployeeJob
            from service_requests.state_machine import apply_transition
            from employees.models import Employee

            sr = task.service_request
            employee = Employee.objects.filter(user=task.assigned_to).first()
            with transaction.atomic():
                sr.assigned_employee = employee
                if sr.status == ServiceRequest.Status.REVIEWED:
                    apply_transition(sr, ServiceRequest.Status.ASSIGNED)
                sr.save(update_fields=["status", "assigned_employee", "updated_at"])
                
                # Bridge Tasks and Employee Jobs alignment
                if employee:
                    EmployeeJob.objects.update_or_create(
                        service_request=sr,
                        defaults={
                            "employee": employee,
                            "assigned_by": request.user,
                            "status": EmployeeJob.Status.ASSIGNED,
                            "assigned_date": timezone.now(),
                        }
                    )

        # Dispatch customer verification OTP
        if task.assigned_to:
            try:
                from tasks.services.otp_service import generate_and_send_job_otp
                generate_and_send_job_otp(task)
            except Exception as exc:
                print(f"[AdminTaskListCreateView] Failed to generate/send OTP: {exc}")

            push_task_notification(
                user=task.assigned_to,
                title="New Job Assigned",
                body=f"You have been assigned a new job: {task.title}",
                task=task,
                notif_type="task_assigned",
            )
        _write_task_audit(request.user, "task_created", task)
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
        old_assignee = task.assigned_to

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
            
            # Re-sync ServiceRequest assignee
            if saved_task.service_request:
                from employees.models import Employee
                from service_requests.models import EmployeeJob
                employee = Employee.objects.filter(user=saved_task.assigned_to).first()
                sr = saved_task.service_request
                sr.assigned_employee = employee
                sr.save(update_fields=["assigned_employee", "updated_at"])
                if employee:
                    EmployeeJob.objects.update_or_create(
                        service_request=sr,
                        defaults={
                            "employee": employee,
                            "assigned_by": request.user,
                            "status": EmployeeJob.Status.ASSIGNED,
                            "assigned_date": timezone.now(),
                        }
                    )

            # Notify new assignee & dispatch new customer OTP
            if saved_task.assigned_to:
                try:
                    from tasks.services.otp_service import generate_and_send_job_otp
                    generate_and_send_job_otp(saved_task)
                except Exception as exc:
                    print(f"[AdminTaskDetailView] Failed to generate/send OTP on reassign: {exc}")

                push_task_notification(
                    user=saved_task.assigned_to,
                    title="Job Reassigned to You",
                    body=f"You have been assigned: {saved_task.title}",
                    task=saved_task,
                    notif_type="task_reassigned",
                )
            _write_task_audit(request.user, "task_reassigned", saved_task)
        else:
            _write_task_audit(request.user, "task_updated", saved_task)

        return Response(TaskSerializer(saved_task).data)

    def delete(self, request, pk):
        task = self.get_object(pk, request.company)
        if not task:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Sync ServiceRequest and EmployeeJob on delete
        if getattr(task, "service_request", None):
            from django.db import transaction
            from service_requests.models import ServiceRequest, EmployeeJob
            sr = task.service_request
            with transaction.atomic():
                sr.status = ServiceRequest.Status.REVIEWED
                sr.assigned_employee = None
                sr.save(update_fields=["status", "assigned_employee", "updated_at"])
                EmployeeJob.objects.filter(service_request=sr).delete()

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
        company = getattr(request.user, 'company', None) or getattr(request, 'company', None)
        if not company:
            return Response([])
        from employees.models import Employee
        from employees.serializers import EmployeeSerializer
        employees = (
            Employee.objects
            .filter(company=company, is_active=True)
            .exclude(user__role="admin")
            .exclude(user__role="customer")
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
        company = _get_company_for_tasks(request)

        from employees.models import Employee
        employee = Employee.objects.filter(user=request.user).first()
        if not company and employee:
            company = employee.company

        # Sync any assigned ServiceRequests for this employee that don't have a Task object yet
        try:
            from service_requests.models import ServiceRequest
            if employee:
                sr_qs = ServiceRequest.objects.filter(
                    assigned_employee=employee
                ).exclude(status__in=[ServiceRequest.Status.CLOSED, ServiceRequest.Status.REJECTED])
                if company:
                    sr_qs = sr_qs.filter(company=company)

                for sr in sr_qs:
                    if not Task.objects.filter(service_request=sr).exists():
                        cat_val = (sr.service_category or "other").lower().replace(" ", "_")
                        valid_cats = [c[0] for c in Task.Category.choices]
                        if cat_val not in valid_cats:
                            cat_val = "other"

                        new_task = Task.objects.create(
                            service_request=sr,
                            company=sr.company or company,
                            title=f"{sr.request_id} — {sr.issue_title}",
                            description=sr.description or f"Service Request {sr.request_id} for {sr.customer_name}",
                            category=cat_val,
                            priority=sr.priority if sr.priority in [p[0] for p in Task.Priority.choices] else "medium",
                            status=Task.Status.PENDING,
                            acceptance_status=Task.AcceptanceStatus.PENDING_ACCEPTANCE,
                            assigned_to=employee.user,
                            assigned_by=sr.assigned_employee.invited_by or request.user,
                            due_date=sr.preferred_date or timezone.now().date(),
                            preferred_time=sr.preferred_time or "",
                            job_address=sr.address or "",
                            client_name=sr.customer_name or "",
                            client_contact_number=sr.phone or "",
                            client_email=sr.email or "",
                        )
                        try:
                            from tasks.services.otp_service import generate_and_send_job_otp
                            generate_and_send_job_otp(new_task)
                        except Exception as otp_err:
                            print(f"[EmployeeTaskListView] Auto-sync OTP dispatch failed: {otp_err}")
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error(f"[EmployeeTaskListView] Auto-sync failed: {exc}", exc_info=True)

        qs = Task.objects.filter(assigned_to=request.user).select_related("assigned_by")
        if company:
            qs = qs.filter(company=company)

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
    parser_classes = [FormParser, MultiPartParser, JSONParser]

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
                task.accepted_at = timezone.now()
                task.save(update_fields=["acceptance_status", "accepted_at", "updated_at"])
                _write_task_audit(request.user, "task_accepted", task)
                _broadcast_travel_status(task, request.user, "task_accepted")
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
                _write_task_audit(request.user, "task_declined", task)
            return Response(TaskSerializer(task).data)

        # ── Start ─────────────────────────────────────────────────────────
        elif action == "start":
            if task.acceptance_status != Task.AcceptanceStatus.ACCEPTED:
                return Response(
                    {"detail": "You must accept this task before starting it."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if Task.objects.filter(assigned_to=request.user, status=Task.Status.IN_PROGRESS, company=company).exclude(id=task.id).exists():
                return Response(
                    {"detail": "You must complete or suspend your current active job before starting a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Customer OTP Verification
            if not task.is_otp_verified:
                if not task.start_otp:
                    from tasks.services.otp_service import generate_and_send_job_otp
                    generate_and_send_job_otp(task)
                
                entered_otp = str(request.data.get("otp", "")).strip()
                if not entered_otp:
                    return Response(
                        {"detail": "Customer OTP is required to start work. Please ask the customer for the verification code sent to their SMS/Email."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if entered_otp != task.start_otp:
                    return Response(
                        {"detail": "Invalid Customer OTP code. Please verify the 6-digit code received by the customer."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                task.is_otp_verified = True
                task.save(update_fields=["is_otp_verified", "updated_at"])
            if task.status == Task.Status.PENDING:
                from time_tracking.models import TimeLog
                from time_tracking.geo import evaluate
                from time_tracking.views import _find_active_shift, _unwrap_location

                lat   = request.data.get("lat")
                lon   = request.data.get("lon")
                photo = request.FILES.get("photo")
                notes = request.data.get("notes", "").strip()

                employee_profile = getattr(request.user, "employee_profile", None)
                timelog = None
                if employee_profile:
                    # Reuse existing active (unclosed) time log if one exists
                    timelog = TimeLog.objects.filter(employee=employee_profile, clock_out__isnull=True).first()
                    if not timelog:
                        # Perform geofence evaluation for shift start
                        distance_m = None
                        geofence_passed = False
                        admin_override_used = False
                        matched_location = None
                        
                        try:
                            active_shift = _find_active_shift(employee_profile, timezone.now())
                            decision = evaluate(
                                employee=employee_profile,
                                company=company,
                                lat=float(lat) if lat not in (None, "") else None,
                                lng=float(lon) if lon not in (None, "") else None,
                                shift=active_shift,
                                is_admin=False,
                                request_admin_override=False,
                            )
                            distance_m = decision.distance_m
                            geofence_passed = decision.geofence_passed
                            admin_override_used = decision.admin_override_used
                            matched_location = _unwrap_location(decision.matched_location)
                        except Exception as e:
                            print(f"Geofence evaluation failed: {e}")
                            if lat and lon:
                                geofence_passed = True
                        
                        timelog = TimeLog.objects.create(
                            employee=employee_profile,
                            work_date=timezone.localdate(),
                            clock_in=timezone.now(),
                            clock_in_lat=lat,
                            clock_in_lon=lon,
                            clock_in_photo=photo,
                            clock_in_notes=notes,
                            distance_from_site_meters=distance_m,
                            geofence_passed=geofence_passed,
                            admin_override_used=admin_override_used,
                            location=matched_location,
                        )
                    else:
                        # If shift is already open, log notes on the timelog as well if provided
                        if notes:
                            if timelog.clock_in_notes:
                                timelog.clock_in_notes += f" | Task start notes: {notes}"
                            else:
                                timelog.clock_in_notes = notes
                            timelog.save(update_fields=["clock_in_notes"])

                task.status     = Task.Status.IN_PROGRESS
                task.started_at = timezone.now()
                task.time_log   = timelog
                if photo:
                    task.start_photo = photo
                if notes:
                    task.employee_notes = notes
                task.save()
                _write_task_audit(request.user, "task_started", task)

                # If this started task is a gap job, write the activity logs
                parent_task = Task.objects.filter(gap_job=task, status=Task.Status.SUSPENDED).first()
                if parent_task:
                    from tasks.services.gap_job_service import log_activity, TaskActivityLog
                    log_activity(
                        task,
                        TaskActivityLog.EventType.GAP_STARTED,
                        actor=request.user,
                        notes=f"Gap job started. Suspended parent: #{parent_task.id}",
                    )
                    log_activity(
                        parent_task,
                        TaskActivityLog.EventType.GAP_STARTED,
                        actor=request.user,
                        notes=f"Gap job #{task.id} — {task.title} started.",
                    )

        # ── Complete ──────────────────────────────────────────────────────
        elif action == "complete":
            if task.status in (Task.Status.PENDING, Task.Status.IN_PROGRESS):
                from time_tracking.models import TimeLogPhoto
                photo = request.FILES.get("photo")
                notes = request.data.get("notes", "")

                task.status       = Task.Status.COMPLETED
                task.travel_status = Task.TravelStatus.DONE
                task.completed_at = timezone.now()
                if notes:
                    task.employee_notes = notes
                if not task.started_at:
                    task.started_at = task.completed_at
                
                # Check for payment collection from the frontend
                collect_payment = request.data.get("collect_payment")
                if collect_payment and task.service_request:
                    task.service_request.payment_status = "paid"
                    if hasattr(task.service_request, 'payment_collected_at'):
                        task.service_request.payment_collected_at = timezone.now()
                    task.service_request.save()
                
                face_match_pct = request.data.get("face_match_percentage")
                face_match_status = request.data.get("face_match_status")

                if photo:
                    task.end_photo = photo
                if face_match_pct is not None:
                    try:
                        task.face_match_percentage = float(face_match_pct)
                    except (ValueError, TypeError):
                        pass
                if face_match_status:
                    task.face_match_status = face_match_status

                if (not task.face_match_status or task.face_match_status == "pending") and task.start_photo and photo:
                    try:
                        from time_tracking.utils import verify_face_match
                        _, score, status_res = verify_face_match(task.start_photo, photo)
                        if task.face_match_percentage is None or task.face_match_percentage == 0:
                            task.face_match_percentage = score
                        task.face_match_status = "verified" if status_res == "matched" else (
                            "failed" if status_res == "mismatch" else (
                                "failed" if status_res == "no_face" else "skipped"
                            )
                        )
                    except Exception as e:
                        print(f"Backend face verification failed: {e}")
                
                task.submission_time = timezone.now()

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
                _write_task_audit(request.user, "task_completed", task)

                # Notify admin via WS group
                _broadcast_travel_status(task, request.user, "task_completed")

                # If this completed task is a gap job, write the activity logs and notify resume ready
                parent_task = Task.objects.filter(gap_job=task).first()
                if parent_task:
                    from tasks.services.gap_job_service import log_activity, TaskActivityLog, notify_worker_resume_ready
                    log_activity(
                        task,
                        TaskActivityLog.EventType.GAP_COMPLETED,
                        actor=request.user,
                        notes="Gap job completed.",
                    )
                    log_activity(
                        parent_task,
                        TaskActivityLog.EventType.GAP_COMPLETED,
                        actor=request.user,
                        notes=f"Gap job #{task.id} completed. Ready to resume.",
                    )
                    notify_worker_resume_ready(request.user, parent_task)

        # ── Start Travel ───────────────────────────────────────────────────
        elif action == "start_travel":
            if task.acceptance_status != Task.AcceptanceStatus.ACCEPTED:
                return Response(
                    {"detail": "You must accept this task before starting travel."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if task.status == Task.Status.COMPLETED:
                return Response({"detail": "Task is already completed."}, status=status.HTTP_400_BAD_REQUEST)
            if Task.objects.filter(assigned_to=request.user, status=Task.Status.IN_PROGRESS, company=company).exclude(id=task.id).exists():
                return Response(
                    {"detail": "You must complete or suspend your current active job before starting a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            task.travel_status = Task.TravelStatus.ON_THE_WAY
            if not task.started_at:
                task.started_at = timezone.now()
            task.save(update_fields=["travel_status", "started_at", "updated_at"])
            _write_task_audit(request.user, "task_travel_started", task)
            _broadcast_travel_status(task, request.user, "on_the_way")

        # ── Reached Site ───────────────────────────────────────────────────
        elif action == "reached_site":
            if task.travel_status not in (Task.TravelStatus.ON_THE_WAY, Task.TravelStatus.REACHED_SITE):
                return Response(
                    {"detail": "Start travel first before marking arrival."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task.travel_status   = Task.TravelStatus.REACHED_SITE
            task.reached_site_at = timezone.now()

            # Auto-generate OTP on reaching site if not verified
            from tasks.services.otp_service import generate_and_send_job_otp
            if not task.start_otp or not task.is_otp_verified:
                generate_and_send_job_otp(task)

            task.save(update_fields=["travel_status", "reached_site_at", "updated_at"])
            _write_task_audit(request.user, "task_reached_site", task)
            _broadcast_travel_status(task, request.user, "reached_site")

        # ── Verify OTP ─────────────────────────────────────────────────────
        elif action == "verify_otp":
            input_otp = request.data.get("otp") or request.data.get("input_otp")
            if not input_otp:
                return Response({"detail": "Please enter the 6-digit OTP code."}, status=status.HTTP_400_BAD_REQUEST)

            from tasks.services.otp_service import verify_task_otp
            is_valid, msg = verify_task_otp(task, input_otp, expiry_minutes=10)
            if not is_valid:
                return Response({"verified": False, "detail": msg}, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "verified": True,
                "message": msg,
                "task": TaskSerializer(task, context={"request": request}).data
            })

        # ── Resend OTP ─────────────────────────────────────────────────────
        elif action == "resend_otp":
            from tasks.services.otp_service import generate_and_send_job_otp
            generate_and_send_job_otp(task)
            _broadcast_travel_status(task, request.user, "otp_resent")
            return Response({
                "success": True,
                "message": "A new Customer OTP has been generated and sent via SMS/Email.",
                "task": TaskSerializer(task, context={"request": request}).data
            })

        # ── Start Work ─────────────────────────────────────────────────────
        elif action == "start_work":
            if task.acceptance_status != Task.AcceptanceStatus.ACCEPTED:
                return Response(
                    {"detail": "You must accept this task before starting work."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if task.status == Task.Status.COMPLETED:
                return Response({"detail": "Task is already completed."}, status=status.HTTP_400_BAD_REQUEST)
            if Task.objects.filter(assigned_to=request.user, status=Task.Status.IN_PROGRESS, company=company).exclude(id=task.id).exists():
                return Response(
                    {"detail": "You must complete or suspend your current active job before starting a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Customer OTP Verification
            if not task.is_otp_verified:
                entered_otp = str(request.data.get("otp", "")).strip()
                if entered_otp:
                    from tasks.services.otp_service import verify_task_otp
                    is_valid, msg = verify_task_otp(task, entered_otp, expiry_minutes=10)
                    if not is_valid:
                        return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response(
                        {"detail": "Customer OTP must be verified before starting work. Please enter the OTP and click Verify."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if task.status == Task.Status.PENDING:
                from time_tracking.models import TimeLog
                from time_tracking.geo import evaluate
                from time_tracking.views import _find_active_shift, _unwrap_location

                lat   = request.data.get("lat")
                lon   = request.data.get("lon")
                photo = request.FILES.get("photo")
                notes = request.data.get("notes", "").strip()

                employee_profile = getattr(request.user, "employee_profile", None)
                timelog = None
                if employee_profile:
                    timelog = TimeLog.objects.filter(employee=employee_profile, clock_out__isnull=True).first()
                    if not timelog:
                        distance_m = None
                        geofence_passed = False
                        admin_override_used = False
                        matched_location = None
                        try:
                            active_shift = _find_active_shift(employee_profile, timezone.now())
                            decision = evaluate(
                                employee=employee_profile,
                                company=getattr(request, "company", None),
                                lat=float(lat) if lat not in (None, "") else None,
                                lng=float(lon) if lon not in (None, "") else None,
                                shift=active_shift,
                                is_admin=False,
                                request_admin_override=False,
                            )
                            distance_m = decision.distance_m
                            geofence_passed = decision.geofence_passed
                            admin_override_used = decision.admin_override_used
                            matched_location = _unwrap_location(decision.matched_location)
                        except Exception as e:
                            print(f"[start_work] Geofence evaluation failed: {e}")
                            if lat and lon:
                                geofence_passed = True

                        timelog = TimeLog.objects.create(
                            employee=employee_profile,
                            work_date=timezone.localdate(),
                            clock_in=timezone.now(),
                            clock_in_lat=lat,
                            clock_in_lon=lon,
                            clock_in_photo=photo,
                            clock_in_notes=notes,
                            distance_from_site_meters=distance_m,
                            geofence_passed=geofence_passed,
                            admin_override_used=admin_override_used,
                            location=matched_location,
                        )
                    else:
                        if notes:
                            timelog.clock_in_notes = (
                                f"{timelog.clock_in_notes} | Work start: {notes}"
                                if timelog.clock_in_notes else notes
                            )
                            timelog.save(update_fields=["clock_in_notes"])

                task.status        = Task.Status.IN_PROGRESS
                task.travel_status = Task.TravelStatus.WORKING
                task.work_started_at = timezone.now()
                if not task.started_at:
                    task.started_at = task.work_started_at
                task.time_log     = timelog
                if photo:
                    task.start_photo = photo
                if request.data.get("notes"):
                    task.employee_notes = request.data.get("notes")
                task.save()
                sync_task_lifecycle_to_service_request(task, actor=request.user)
                _write_task_audit(request.user, "task_work_started", task)
                _broadcast_travel_status(task, request.user, "working")

        # ── Resend Customer OTP ───────────────────────────────────────────
        elif action in ("resend_otp", "resend-otp"):
            from tasks.services.otp_service import generate_and_send_job_otp
            generate_and_send_job_otp(task)
            return Response({
                "detail": "Customer verification OTP has been dispatched via SMS and Email.",
                "task": TaskSerializer(task).data
            })

        # ── Notes ─────────────────────────────────────────────────────────
        elif action == "notes":
            ser = TaskStatusUpdateSerializer(task, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()

        # ── Suspend ───────────────────────────────────────────────────────
        elif action == "suspend":
            if task.status != Task.Status.IN_PROGRESS:
                return Response({"detail": "Only active tasks can be suspended."}, status=status.HTTP_400_BAD_REQUEST)
            reason = request.data.get("reason", "").strip()
            amount = request.data.get("amount") or request.data.get("additional_amount") or 0
            try:
                amount = float(amount)
            except (ValueError, TypeError):
                amount = 0

            if amount == 0 and reason:
                import re
                match = re.search(r'(?:₹|Rs\.?|INR|\b)\s*(\d+(?:\.\d{1,2})?)', reason)
                if match:
                    try:
                        amount = float(match.group(1))
                    except ValueError:
                        pass

            task.status = Task.Status.SUSPENDED
            task.suspended_at = timezone.now()
            task.suspend_reason = reason
            task.save(update_fields=["status", "suspended_at", "suspend_reason", "updated_at"])

            if task.service_request:
                try:
                    from service_requests.models import WorkExtension, WorkExtensionItem, EmployeeJob
                    sr = task.service_request
                    job = EmployeeJob.objects.filter(service_request=sr).first()
                    emp = getattr(request.user, "employee_profile", None) or (job.employee if job else None)
                    if not emp:
                        from employees.models import Employee
                        emp = Employee.objects.first()
                    if job and emp:
                        ext, created = WorkExtension.objects.get_or_create(
                            service_request=sr,
                            job=job,
                            defaults={
                                "reported_by": emp,
                                "status": WorkExtension.Status.ADMIN_APPROVED,
                                "technician_estimate": amount,
                                "admin_approved_amount": amount,
                                "decision_notes": reason,
                            }
                        )
                        if not created:
                            ext.status = WorkExtension.Status.ADMIN_APPROVED
                            ext.decision_notes = reason
                            if amount > 0:
                                ext.technician_estimate = amount
                                ext.admin_approved_amount = amount
                            ext.save()

                        clean_title = reason
                        if "(" in clean_title:
                            clean_title = clean_title.split("(")[0].strip()
                        if "Requires" in clean_title:
                            clean_title = clean_title.split("Requires")[-1].strip()

                        WorkExtensionItem.objects.update_or_create(
                            extension=ext,
                            defaults={
                                "title": clean_title or reason,
                                "description": reason,
                                "estimated_price": amount,
                            }
                        )
                except Exception as e:
                    print(f"Error creating WorkExtension on suspend: {e}")

            sync_task_lifecycle_to_service_request(task, actor=request.user)
            _write_task_audit(request.user, "task_suspended", task)

        # ── Resume ────────────────────────────────────────────────────────
        elif action == "resume":
            if task.status != Task.Status.SUSPENDED:
                return Response({"detail": "Only suspended tasks can be resumed."}, status=status.HTTP_400_BAD_REQUEST)
            if Task.objects.filter(assigned_to=request.user, status=Task.Status.IN_PROGRESS, company=company).exclude(id=task.id).exists():
                return Response(
                    {"detail": "You must complete or suspend your current active job before resuming this one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            task.status = Task.Status.IN_PROGRESS
            task.save(update_fields=["status", "updated_at"])
            _write_task_audit(request.user, "task_resumed", task)

        else:
            return Response({"detail": f"Unknown action: {action}"}, status=status.HTTP_400_BAD_REQUEST)

        # Synchronize linked ServiceRequest status
        sync_task_lifecycle_to_service_request(task, actor=request.user)

        return Response(TaskSerializer(task).data)



# ── Admin: Cancel a task ────────────────────────────────────────

class AdminTaskCancelView(APIView):
    """
    POST /api/tasks/admin/<pk>/cancel/
    Admin can cancel any job. Notifies the assigned employee.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            task = Task.objects.select_related("assigned_to").get(
                pk=pk, company=request.company
            )
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if task.status == Task.Status.COMPLETED:
            return Response(
                {"detail": "Cannot cancel a completed job."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get("reason", "").strip()
        task.status = Task.Status.CANCELLED
        task.admin_notes = (
            f"[CANCELLED] {reason}" if reason else "[CANCELLED by admin]"
        )
        task.save(update_fields=["status", "admin_notes", "updated_at"])

        # Reset linked ServiceRequest and EmployeeJob
        sync_task_lifecycle_to_service_request(task, actor=request.user)


        # Clock out open timelog if any
        if task.time_log and task.time_log.clock_out is None:
            task.time_log.clock_out = timezone.now()
            task.time_log.clock_out_notes = f"Job cancelled by admin. {reason}"
            task.time_log.save(update_fields=["clock_out", "clock_out_notes"])

        # Notify employee
        if task.assigned_to:
            push_task_notification(
                user=task.assigned_to,
                title="Job Cancelled",
                body=f"Your job '{task.title}' has been cancelled by your manager.",
                task=task,
                notif_type="task_cancelled",
            )

        _write_task_audit(request.user, "task_cancelled", task)
        return Response(TaskSerializer(task).data)


# ── Admin: Force-complete a task ────────────────────────────────

class AdminTaskCompleteView(APIView):
    """
    POST /api/tasks/admin/<pk>/complete/
    Admin can mark any in-progress or pending job as completed.
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        try:
            task = Task.objects.select_related("assigned_to").get(
                pk=pk, company=request.company
            )
        except Task.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if task.status == Task.Status.COMPLETED:
            return Response(
                {"detail": "Job is already completed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if task.status == Task.Status.CANCELLED:
            return Response(
                {"detail": "Cannot complete a cancelled job."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get("notes", "").strip()
        now = timezone.now()
        task.status = Task.Status.COMPLETED
        task.completed_at = now
        if not task.started_at:
            task.started_at = now
        if notes:
            task.admin_notes = f"[ADMIN COMPLETED] {notes}"

        # Compute billed hours
        actual_seconds = int((task.completed_at - task.started_at).total_seconds())
        task.billed_hours = Task.compute_billed_hours(task.estimated_hours, actual_seconds)
        task.save()

        # Clock out open timelog
        if task.time_log and task.time_log.clock_out is None:
            task.time_log.clock_out = now
            task.time_log.clock_out_notes = "Completed by admin override."
            task.time_log.save(update_fields=["clock_out", "clock_out_notes"])

        # Sync ServiceRequest and EmployeeJob, send feedback email
        sync_task_lifecycle_to_service_request(task, actor=request.user)

        # Notify employee
        if task.assigned_to:
            push_task_notification(
                user=task.assigned_to,
                title="Job Marked Complete",
                body=f"Your job '{task.title}' has been marked complete by your manager.",
                task=task,
                notif_type="task_completed",
            )

        _write_task_audit(request.user, "task_completed_by_admin", task)
        return Response(TaskSerializer(task).data)
