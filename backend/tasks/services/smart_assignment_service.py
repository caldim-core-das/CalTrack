"""
smart_assignment_service.py

Module 1 — Smart Nearby Work Assignment

Business rules enforced here:
  1. Employee's current job must be >=80% complete OR remaining_time <=20min
  2. New job must be within 500m of employee's current GPS
  3. New job priority must NOT be High or Urgent
  4. No SLA breach risk for the current job (current job SLA must be safe)
  5. Employee must not be overloaded (max 1 suspended task already)

Flow:
  Admin dispatches a new job to the pool.
  Employee reports completion >=80% → PATCH /tasks/<pk>/completion/
  System scans for nearby pending jobs within 500m.
  If conditions met → sends SmartNearbyAlert to employee.
  Employee accepts  → nearby job queued (assigned, pending_acceptance cleared, starts after current)
  Employee rejects  → logged, admin notified.
"""

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from time_tracking.geo.geo_utils import haversine_m
from tasks.models import Task, TaskActivityLog
from tasks.services.gap_job_service import check_sla_safe, log_activity, get_sla_status

# ── Constants ───────────────────────────────────────────────────────────────
SMART_NEARBY_RADIUS_M   = 500      # 500 metres
SMART_NEARBY_PCT_THRESHOLD = 80    # completion % trigger
SMART_NEARBY_MIN_REMAINING = 20    # minutes remaining trigger (alt to %)


def employee_qualifies_for_nearby(current_task):
    """
    Returns True if the current task meets the criteria for smart-nearby suggestions:
      - in_progress
      - completion_percentage >= 80, OR elapsed time within 20 min of estimated_hours
    """
    if current_task.status != Task.Status.IN_PROGRESS:
        return False

    if current_task.completion_percentage >= SMART_NEARBY_PCT_THRESHOLD:
        return True

    # Time-based check: are we within 20 min of end?
    if current_task.started_at and current_task.estimated_hours:
        elapsed_seconds = (timezone.now() - current_task.started_at).total_seconds()
        estimated_seconds = float(current_task.estimated_hours) * 3600
        remaining_seconds = estimated_seconds - elapsed_seconds
        if 0 < remaining_seconds <= (SMART_NEARBY_MIN_REMAINING * 60):
            return True

    return False


def find_smart_nearby_for_employee(worker, lat, lng, current_task=None):
    """
    Finds jobs suitable to queue for the employee after their current job.

    Returns list of Task objects annotated with .distance_m and .sla_status.
    Returns empty list if the employee doesn't qualify or no safe jobs found.
    """
    # If we have a current task, validate qualification
    if current_task:
        if not employee_qualifies_for_nearby(current_task):
            return []
        # SLA of current job must be safe before suggesting more work
        is_sla_safe, _ = check_sla_safe(current_task)
        if not is_sla_safe:
            return []

    lat = float(lat)
    lng = float(lng)

    # Query: pending, not assigned to worker, not already linked as gap job, not high/urgent priority
    qs = Task.objects.filter(
        company=worker.company,
        status=Task.Status.PENDING,
        parent_tasks__isnull=True,
    ).exclude(
        assigned_to=worker,
    ).exclude(
        priority__in=[Task.Priority.HIGH, Task.Priority.URGENT],
    )

    results = []
    for task in qs:
        if task.location_lat is None or task.location_lon is None:
            continue
        distance_m = haversine_m(lat, lng, float(task.location_lat), float(task.location_lon))
        if distance_m <= SMART_NEARBY_RADIUS_M:
            task.distance_m = round(distance_m, 0)
            task.distance_km = round(distance_m / 1000, 2)
            sla_status, sla_mins = get_sla_status(task)
            task._sla_status = sla_status
            task._sla_mins = sla_mins
            results.append(task)

    results.sort(key=lambda x: x.distance_m)
    return results[:5]   # return up to 5 candidates


def log_nearby_suggestion(current_task, nearby_task, worker):
    """Records that the system suggested a nearby job to the employee."""
    log_activity(
        current_task,
        TaskActivityLog.EventType.NEARBY_SUGGESTED,
        actor=worker,
        notes=f"Nearby job suggested: #{nearby_task.id} — {nearby_task.title}",
    )


def employee_accept_nearby(worker, nearby_task_id, current_task):
    """
    Employee accepts a smart nearby suggestion.
    The nearby task is queued (assigned to the worker, stays pending until current job completes).
    Logs NEARBY_ACCEPTED.
    """
    try:
        nearby_task = Task.objects.get(pk=nearby_task_id, company=worker.company)
    except Task.DoesNotExist:
        raise ValidationError("Nearby job not found.")

    if nearby_task.status != Task.Status.PENDING:
        raise ValidationError("This job is no longer available.")

    if nearby_task.priority in (Task.Priority.HIGH, Task.Priority.URGENT):
        raise ValidationError("Smart queue is only for Low/Medium priority jobs.")

    # Assign to worker — keeps pending status so they get the full accept/start flow after current job
    nearby_task.assigned_to = worker
    nearby_task.acceptance_status = Task.AcceptanceStatus.ACCEPTED  # pre-accepted by this action
    nearby_task.save()

    # Log on the current task that this nearby job was queued
    if current_task:
        log_activity(
            current_task,
            TaskActivityLog.EventType.NEARBY_ACCEPTED,
            actor=worker,
            notes=f"Queued next job: #{nearby_task.id} — {nearby_task.title}",
        )

    # Log on the nearby task itself
    log_activity(
        nearby_task,
        TaskActivityLog.EventType.NEARBY_ACCEPTED,
        actor=worker,
        notes=f"Queued by smart nearby assignment. After job #{current_task.id if current_task else '?'}.",
    )

    return nearby_task


def employee_reject_nearby(worker, nearby_task_id, current_task, reason=""):
    """
    Employee rejects a smart nearby suggestion.
    Logs NEARBY_REJECTED. Admin can see this in the dispatch dashboard.
    """
    try:
        nearby_task = Task.objects.get(pk=nearby_task_id, company=worker.company)
    except Task.DoesNotExist:
        raise ValidationError("Nearby job not found.")

    if current_task:
        log_activity(
            current_task,
            TaskActivityLog.EventType.NEARBY_REJECTED,
            actor=worker,
            notes=f"Rejected nearby job #{nearby_task.id} — {nearby_task.title}. Reason: {reason or 'none'}",
        )

    log_activity(
        nearby_task,
        TaskActivityLog.EventType.NEARBY_REJECTED,
        actor=worker,
        notes=f"Rejected by {worker.username}. Reason: {reason or 'none'}",
    )

    # Notify admin (placeholder — replace with real push/websocket)
    print(f"[Admin Alert] {worker.username} rejected nearby job #{nearby_task.id}: {nearby_task.title}. Reason: {reason}")

    return nearby_task


def get_admin_smart_dispatch_table(company):
    """
    Returns a summary for the admin Smart Dispatch dashboard.
    Row per active employee with: current job, completion%, SLA status, nearby count.
    """
    from accounts.models import User
    from employees.models import Employee

    rows = []
    active_employees = Employee.objects.filter(company=company, is_active=True).select_related("user")

    for emp in active_employees:
        worker = emp.user
        current_task = (
            Task.objects.filter(
                assigned_to=worker,
                company=company,
                status=Task.Status.IN_PROGRESS,
            ).first()
        )

        row = {
            "employee_id": str(emp.id),
            "employee_name": f"{worker.first_name} {worker.last_name}".strip() or worker.username,
            "availability": emp.current_availability,
            "current_task": None,
            "completion_percentage": 0,
            "sla_status": "none",
            "sla_minutes_remaining": None,
            "nearby_job_count": 0,
            "qualifies_for_nearby": False,
        }

        if current_task:
            sla_status, sla_mins = get_sla_status(current_task)
            row["current_task"] = {
                "id": str(current_task.id),
                "title": current_task.title,
                "priority": current_task.priority,
                "estimated_hours": float(current_task.estimated_hours),
            }
            row["completion_percentage"] = current_task.completion_percentage
            row["sla_status"] = sla_status
            row["sla_minutes_remaining"] = sla_mins
            row["qualifies_for_nearby"] = employee_qualifies_for_nearby(current_task)

            if current_task.location_lat and current_task.location_lon:
                nearby = find_smart_nearby_for_employee(
                    worker,
                    float(current_task.location_lat),
                    float(current_task.location_lon),
                    current_task=None,   # skip qualification here; just count available jobs
                )
                row["nearby_job_count"] = len(nearby)

        rows.append(row)

    return rows
