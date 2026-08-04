from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdminRole, is_admin_role

from .models import Employee
from .serializers import EmployeeCreateSerializer, EmployeeSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and getattr(user, 'company', None):
            company = user.company
        else:
            company = getattr(self.request, 'company', None)

        if not company:
            return Employee.objects.none()

        # Clean up any invalid Employee entries that were auto-created for customer accounts
        Employee.objects.filter(company=company, user__role="customer").delete()

        # Ensure active staff/employee Users (roles: employee, manager, admin, kiosk) have an Employee profile
        from django.contrib.auth import get_user_model
        User = get_user_model()
        staff_roles = ["employee", "manager", "admin", "kiosk"]
        active_users = User.objects.filter(company=company, is_active=True, role__in=staff_roles)

        for u in active_users:
            emp = Employee.objects.filter(company=company, user=u).first()
            if emp:
                # Reactivate employee record if the user is still active
                if not emp.is_active:
                    emp.is_active = True
                    emp.save(update_fields=["is_active"])
            else:
                # Create a new employee record
                count = Employee.objects.filter(company=company).count() + 1
                emp_id = f"EMP-{count:03d}"
                while Employee.objects.filter(company=company, employee_id=emp_id).exists():
                    count += 1
                    emp_id = f"EMP-{count:03d}"

                Employee.objects.create(
                    company=company,
                    user=u,
                    employee_id=emp_id,
                    title=u.role.title() if hasattr(u, 'role') and u.role else "Team Member",
                    country=getattr(company, 'primary_country', 'US') or "US",
                    state=getattr(company, 'default_state', '') or "",
                    is_active=True
                )

        return Employee.objects.select_related("user").filter(
            company=company
        ).exclude(user__role="customer").order_by("employee_id")

    def get_permissions(self):
        if self.action in {"list", "create", "update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def retrieve(self, request, *args, **kwargs):
        employee = self.get_object()
        if not is_admin_role(request.user) and employee.user_id != request.user.id:
            return Response({"detail": "Not found."}, status=404)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        employee = Employee.objects.select_related("user").filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        return Response(EmployeeSerializer(employee).data)

    @action(detail=False, methods=["post"], url_path="set-presence",
            permission_classes=[permissions.IsAuthenticated])
    def set_presence(self, request):
        """
        Mark the authenticated user's Employee record as online/offline.
        Called by the frontend on app load (after JWT verification).
        Body: { "is_online": true, "availability": "available" }
        """
        if getattr(request.user, "role", None) == "customer":
            return Response({
                "is_online": False,
                "availability": "offline",
                "message": "Customer accounts do not have employee presence."
            }, status=200)

        company = getattr(request, "company", None) or getattr(request.user, "company", None)
        if not company:
            return Response({"detail": "No company context."}, status=400)

        employee = Employee.objects.filter(user=request.user, company=company).first()
        if not employee:
            return Response({
                "is_online": False,
                "availability": "offline",
                "message": "Employee profile not found."
            }, status=200)

        is_online = bool(request.data.get("is_online", True))
        availability = request.data.get("availability", "available") if is_online else "offline"
        now = timezone.now()

        update_fields = ["is_online", "last_activity_at", "current_availability"]
        employee.is_online = is_online
        employee.last_activity_at = now
        employee.current_availability = availability

        if is_online:
            employee.last_login_at = now
            update_fields.append("last_login_at")
        else:
            employee.last_logout_at = now
            update_fields.append("last_logout_at")

        employee.save(update_fields=update_fields)

        # Create PresenceLog entry
        try:
            from .models import PresenceLog
            if is_online:
                PresenceLog.objects.create(
                    employee=employee,
                    login_at=now,
                    company=company
                )
            else:
                open_logs = PresenceLog.objects.filter(
                    employee=employee, logout_at__isnull=True, company=company
                )
                for log in open_logs:
                    log.logout_at = now
                    if log.login_at:
                        log.duration_seconds = int((now - log.login_at).total_seconds())
                    log.save(update_fields=["logout_at", "duration_seconds"])
        except Exception:
            pass

        # Broadcast to admin WebSocket group
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"live_admin_{company.id}",
                    {
                        "type": "employee_presence_change",
                        "data": {
                            "employee_id": str(employee.id),
                            "user_id": request.user.id,
                            "username": request.user.username,
                            "full_name": request.user.get_full_name() or request.user.username,
                            "is_online": is_online,
                            "availability": availability,
                            "login_at": now.isoformat() if is_online else None,
                            "logout_at": now.isoformat() if not is_online else None,
                        }
                    }
                )
        except Exception:
            pass

        return Response({
            "is_online": employee.is_online,
            "availability": employee.current_availability,
            "last_activity_at": now.isoformat(),
        })


    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """
        Returns a rich history profile for a single employee:
          - leave_history: all leave requests with accurate day count
          - task_stats: completed / in_progress / pending / cancelled / upcoming
          - task_history: last 20 tasks
          - performance: placeholder ratings for feedback, functionality, attitude, self_respect
        """
        try:
            employee = self.get_object()
            if not is_admin_role(request.user) and (not employee.user or employee.user_id != request.user.id):
                return Response({"detail": "Not found."}, status=404)

            from leaves.models import LeaveRequest
            from tasks.models import Task
            from time_tracking.models import TimeLog

            today = timezone.localdate()

            # ── Leave History ──────────────────────────────────────────────────
            leaves_qs = LeaveRequest.objects.filter(employee=employee).select_related("approved_by").order_by("-start_date")
            leave_history = []
            for lv in leaves_qs:
                if not getattr(lv, 'start_date', None) or not getattr(lv, 'end_date', None):
                    continue
                requested_days = max(1, (lv.end_date - lv.start_date).days + 1)
                actual_days = None
                actual_end_date = None
                returned_early = False
                early_return_date = None

                if lv.status == LeaveRequest.Status.APPROVED:
                    clock_in_during_leave = TimeLog.objects.filter(
                        employee=employee,
                        work_date__gte=lv.start_date,
                        work_date__lte=lv.end_date,
                        clock_in__isnull=False,
                    ).order_by("work_date").first()

                    if clock_in_during_leave:
                        early_return_date = str(clock_in_during_leave.work_date)
                        actual_days = max(0, (clock_in_during_leave.work_date - lv.start_date).days)
                        actual_end_date = str(clock_in_during_leave.work_date - timezone.timedelta(days=1)) if actual_days > 0 else str(lv.start_date)
                        returned_early = True
                    else:
                        effective_end = min(lv.end_date, today)
                        actual_days = max(0, (effective_end - lv.start_date).days + 1)
                        actual_end_date = str(effective_end)
                        returned_early = False

                leave_history.append({
                    "id": lv.id,
                    "leave_type": lv.leave_type,
                    "status": lv.status,
                    "start_date": str(lv.start_date),
                    "end_date": str(lv.end_date),
                    "actual_end_date": actual_end_date,
                    "requested_days": requested_days,
                    "actual_days_taken": actual_days,
                    "days_saved": max(0, requested_days - actual_days) if actual_days is not None else None,
                    "returned_early": returned_early,
                    "early_return_date": early_return_date,
                    "reason": lv.reason,
                    "paid": lv.paid,
                    "approved_by": lv.approved_by.get_full_name() or lv.approved_by.username if lv.approved_by else None,
                    "decision_at": lv.decision_at.isoformat() if lv.decision_at else None,
                    "decision_date": str(lv.decision_at.date()) if lv.decision_at else None,
                    "decision_time": lv.decision_at.strftime("%I:%M %p") if lv.decision_at else None,
                    "created_at": lv.created_at.isoformat() if lv.created_at else today.isoformat(),
                    "submitted_date": str(lv.created_at.date()) if lv.created_at else str(today),
                    "submitted_time": lv.created_at.strftime("%I:%M %p") if lv.created_at else "12:00 PM",
                })

            # ── Leave Summary ──────────────────────────────────────────────────
            approved_leaves = [l for l in leave_history if l["status"] == "approved"]
            total_approved_days = sum(l["actual_days_taken"] or 0 for l in approved_leaves)
            total_requested_days = sum(l["requested_days"] for l in approved_leaves)

            leave_summary = {
                "total_requests": len(leave_history),
                "approved": len(approved_leaves),
                "pending": sum(1 for l in leave_history if l["status"] == "pending"),
                "rejected": sum(1 for l in leave_history if l["status"] == "rejected"),
                "cancelled": sum(1 for l in leave_history if l["status"] == "cancelled"),
                "total_approved_days": total_approved_days,
                "total_requested_days": total_requested_days,
                "days_returned_early": max(0, total_requested_days - total_approved_days),
            }

            # ── Task Stats ─────────────────────────────────────────────────────
            all_tasks = Task.objects.filter(assigned_to=employee.user) if employee.user else Task.objects.none()
            total_billed = 0.0
            for t in all_tasks.filter(status=Task.Status.COMPLETED):
                val = t.billed_hours if t.billed_hours is not None else getattr(t, 'estimated_hours', 0.0)
                try:
                    total_billed += float(val or 0.0)
                except (ValueError, TypeError):
                    pass

            task_stats = {
                "total": all_tasks.count(),
                "completed": all_tasks.filter(status=Task.Status.COMPLETED).count(),
                "in_progress": all_tasks.filter(status=Task.Status.IN_PROGRESS).count(),
                "pending": all_tasks.filter(status=Task.Status.PENDING).count(),
                "cancelled": all_tasks.filter(status=Task.Status.CANCELLED).count(),
                "upcoming": all_tasks.filter(status=Task.Status.PENDING, due_date__gte=today).count(),
                "overdue": all_tasks.filter(
                    status__in=[Task.Status.PENDING, Task.Status.IN_PROGRESS],
                    due_date__lt=today
                ).count(),
                "total_billed_hours": float(total_billed),
            }

            # ── Recent Task History (last 20) ─────────────────────────────────
            recent_tasks = all_tasks.order_by("-created_at")[:20]
            task_history = []
            for t in recent_tasks:
                b_hours = None
                if t.status == Task.Status.COMPLETED:
                    val = t.billed_hours if t.billed_hours is not None else getattr(t, 'estimated_hours', 0.0)
                    try:
                        b_hours = float(val or 0.0)
                    except (ValueError, TypeError):
                        b_hours = 0.0

                task_history.append({
                    "id": t.id,
                    "title": getattr(t, 'title', ''),
                    "category": getattr(t, 'category', ''),
                    "priority": getattr(t, 'priority', ''),
                    "status": getattr(t, 'status', ''),
                    "acceptance_status": getattr(t, 'acceptance_status', ''),
                    "due_date": str(t.due_date) if getattr(t, 'due_date', None) else None,
                    "started_at": t.started_at.isoformat() if getattr(t, 'started_at', None) else None,
                    "completed_at": t.completed_at.isoformat() if getattr(t, 'completed_at', None) else None,
                    "billed_hours": b_hours,
                    "location": getattr(t, 'location', None) or getattr(t, 'job_address', None) or '',
                    "client_name": getattr(t, 'client_name', None) or '',
                })

            # ── Performance Ratings ────────────────────────────────────────────
            perf_entries = [
                e for e in (employee.exempt_history or [])
                if isinstance(e, dict) and e.get("type") == "performance"
            ]
            latest_perf = perf_entries[-1] if perf_entries else {}
            performance = {
                "feedback_rate": latest_perf.get("feedback_rate"),
                "functionality": latest_perf.get("functionality"),
                "attitude": latest_perf.get("attitude"),
                "self_respect": latest_perf.get("self_respect"),
                "overall": latest_perf.get("overall"),
                "notes": latest_perf.get("notes", ""),
                "rated_at": latest_perf.get("rated_at"),
                "history": perf_entries,
            }

            return Response({
                "employee": {
                    "id": employee.id,
                    "employee_id": getattr(employee, 'employee_id', str(employee.id)),
                    "full_name": (employee.user.get_full_name() or employee.user.username) if employee.user else "Employee",
                    "username": employee.user.username if employee.user else "",
                    "email": employee.user.email if employee.user else "",
                    "title": getattr(employee, 'title', ''),
                    "hire_date": str(employee.hire_date) if getattr(employee, 'hire_date', None) else None,
                    "is_active": getattr(employee, 'is_active', True),
                    "hourly_rate": float(employee.hourly_rate) if getattr(employee, 'hourly_rate', None) is not None else 0.0,
                    "country": getattr(employee, 'country', 'US'),
                },
                "leave_summary": leave_summary,
                "leave_history": leave_history,
                "task_stats": task_stats,
                "task_history": task_history,
                "performance": performance,
            })
        except Exception as err:
            import logging
            logging.getLogger(__name__).error(f"Error in employee history view: {err}", exc_info=True)
            return Response({
                "employee": {
                    "id": pk,
                    "employee_id": str(pk),
                    "full_name": "Employee",
                    "hourly_rate": 0.0,
                },
                "leave_summary": {"total_requests": 0, "approved": 0, "pending": 0, "rejected": 0, "cancelled": 0},
                "leave_history": [],
                "task_stats": {"total": 0, "completed": 0, "in_progress": 0, "pending": 0, "cancelled": 0, "upcoming": 0, "overdue": 0, "total_billed_hours": 0.0},
                "task_history": [],
                "performance": {},
            }, status=200)
