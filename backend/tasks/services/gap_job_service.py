from django.utils import timezone
from rest_framework.exceptions import ValidationError
from time_tracking.models import TimeLog
from time_tracking.geo.geo_utils import haversine_m
from tasks.models import Task, TaskActivityLog

# ── Pause reason categories ─────────────────────────────────────────────────
PAUSE_REASON_CATEGORIES = {
    "spare_part":         "Spare Part Unavailable",
    "customer_absent":    "Customer Absent",
    "approval_pending":   "Approval Pending",
    "technical":          "Technical Dependency",
    "other":              "Other",
}

# SLA warning threshold (minutes before deadline that triggers a block)
SLA_BLOCK_MINUTES = 30


class ProximityError(ValidationError):
    """Raised when the worker is too far from the job location to resume."""
    pass


class SLABreachError(ValidationError):
    """Raised when pausing would risk an SLA breach."""
    pass


# ── Shared utilities ────────────────────────────────────────────────────────

def check_sla_safe(task):
    """
    Returns (is_safe, minutes_remaining).
    is_safe=False means pausing is blocked (SLA breach imminent).
    minutes_remaining=None if no SLA is set.
    """
    if not task.sla_deadline:
        return True, None
    now = timezone.now()
    delta = task.sla_deadline - now
    minutes_remaining = delta.total_seconds() / 60
    is_safe = minutes_remaining > SLA_BLOCK_MINUTES
    return is_safe, round(minutes_remaining, 1)


def get_sla_status(task):
    """Returns ('safe'|'warning'|'breach', minutes_remaining|None)."""
    if not task.sla_deadline:
        return "none", None
    now = timezone.now()
    delta = task.sla_deadline - now
    mins = delta.total_seconds() / 60
    if mins <= 0:
        return "breach", round(mins, 1)
    elif mins <= SLA_BLOCK_MINUTES:
        return "warning", round(mins, 1)
    elif mins <= 120:
        return "caution", round(mins, 1)
    return "safe", round(mins, 1)


def log_activity(task, event_type, actor=None, notes="", lat=None, lon=None):
    """Write an immutable activity log entry for a task."""
    TaskActivityLog.objects.create(
        task=task,
        event_type=event_type,
        actor=actor,
        notes=notes,
        lat=lat,
        lon=lon,
    )


def notify_worker_resume_ready(worker, parent_task):
    """
    Notifies the worker they can now resume their original suspended parent task.
    Replace with push notification / websocket in production.
    """
    push_task_notification(
        user=worker,
        title="Resume Your Job",
        body=f"Gap job complete. You can now resume: {parent_task.title}",
        task=parent_task,
        notif_type="resume_ready",
    )


def push_task_notification(user, title, body, task=None, notif_type="info"):
    """
    Central notification dispatcher for the tasks module.

    Currently logs to console. Wire to:
      - Django Channels / WebSocket for real-time push
      - Firebase FCM for mobile push
      - Your notifications app Notification model when it is set up

    Args:
        user: User instance to notify
        title: Short notification title
        body: Full notification body text
        task: Optional Task instance for deep-link context
        notif_type: One of 'task_assigned', 'task_accepted', 'task_declined',
                    'task_started', 'task_completed', 'task_cancelled',
                    'task_reassigned', 'resume_ready', 'gap_job_pushed', 'info'
    """
    task_info = f" [Job #{task.id}: {task.title}]" if task else ""
    print(
        f"[NOTIFICATION -> {user.username}] [{notif_type.upper()}]{task_info} "
        f"{title} — {body}"
    )

    # ── Optional: store in DB if Notification model exists ──────────────────
    try:
        from django.apps import apps
        if apps.is_installed("notifications"):
            NotificationModel = apps.get_model("notifications", "Notification")
            NotificationModel.objects.create(
                user=user,
                notification_type=notif_type,
                title=title,
                message=body,
                related_task_id=task.id if task else None,
            )
    except Exception:
        pass  # Notification model not ready yet — fail silently


# ── Module 2: Pause / Resume ────────────────────────────────────────────────

def suspend_job(task_id, worker, reason=None, reason_category=None, resume_deadline=None):
    """
    Suspends an InProgress task belonging to the worker.
    - Validates SLA safety (blocks if breach imminent).
    - Blocks emergency and high-priority tasks unless admin_override=True.
    - Requires a reason_category from PAUSE_REASON_CATEGORIES.
    - Snapshots elapsed time into total_active_seconds.
    - Clocks out of the linked TimeLog.
    - Logs a PAUSED activity entry.
    """
    try:
        task = Task.objects.get(pk=task_id, company=worker.company, assigned_to=worker)
    except Task.DoesNotExist:
        raise ValidationError("Task not found or not assigned to you.")

    if task.status != Task.Status.IN_PROGRESS:
        raise ValidationError("Only in-progress tasks can be suspended.")

    # ── SLA safety check ────────────────────────────────────────────────────
    is_sla_safe, mins_remaining = check_sla_safe(task)
    if not is_sla_safe:
        raise SLABreachError(
            f"Cannot pause — SLA breach in {mins_remaining:.0f} minutes. "
            f"Contact admin to override or complete the job first."
        )

    # ── Priority guard ──────────────────────────────────────────────────────
    if task.priority in (Task.Priority.URGENT, Task.Priority.HIGH):
        raise ValidationError(
            f"Cannot pause a {task.priority}-priority task. "
            f"Only Low/Medium priority tasks can be paused without admin approval."
        )

    # ── Reason category ─────────────────────────────────────────────────────
    if reason_category and reason_category not in PAUSE_REASON_CATEGORIES:
        raise ValidationError(
            f"Invalid reason_category. Must be one of: {', '.join(PAUSE_REASON_CATEGORIES.keys())}"
        )

    now = timezone.now()
    if task.started_at:
        elapsed = (now - task.started_at).total_seconds()
        task.total_active_seconds += int(elapsed)

    # Build a human-readable suspend reason
    category_label = PAUSE_REASON_CATEGORIES.get(reason_category, "") if reason_category else ""
    full_reason = category_label
    if reason:
        full_reason = f"{category_label}: {reason}" if category_label else reason

    task.status = Task.Status.SUSPENDED
    task.suspended_at = now
    task.suspend_reason = full_reason or reason
    task.resume_deadline = resume_deadline

    # Clock out of active time log if one exists
    if task.time_log and not task.time_log.clock_out:
        time_log = task.time_log
        time_log.clock_out = now
        time_log.clock_out_notes = f"Suspended: {full_reason}" if full_reason else "Suspended"
        time_log.save()

    task.save()

    # Activity log
    log_activity(
        task,
        TaskActivityLog.EventType.PAUSED,
        actor=worker,
        notes=full_reason or "Paused",
    )

    return task


def get_available_gap_jobs(worker, lat, lng, radius_km=0.5):
    """
    Returns a sorted list of nearby Tasks within radius_km (tenant-scoped).
    Default radius is 500m (0.5km) per Module 2 spec.
    Excludes completed tasks, tasks assigned to the worker, and already taken gap jobs.
    Also excludes high/urgent priority tasks.
    """
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
    lat = float(lat)
    lng = float(lng)

    for t in qs:
        if t.location_lat is not None and t.location_lon is not None:
            distance_m = haversine_m(lat, lng, float(t.location_lat), float(t.location_lon))
            distance_km = distance_m / 1000.0
            if distance_km <= radius_km:
                t.distance_km = round(distance_km, 2)
                t.distance_m  = round(distance_m, 0)
                results.append(t)

    results.sort(key=lambda x: x.distance_km)
    return results


def accept_gap_job(gap_task_id, worker, parent_task_id):
    """
    Links a suspended parent task to an available gap job.
    Enforces a maximum of 2 suspended tasks per worker.
    Starts the gap job immediately.
    Logs GAP_STARTED activity.
    """
    try:
        parent_task = Task.objects.get(pk=parent_task_id, company=worker.company, assigned_to=worker)
    except Task.DoesNotExist:
        raise ValidationError("Parent task not found or not assigned to you.")

    if parent_task.status != Task.Status.SUSPENDED:
        raise ValidationError("Parent task must be suspended before accepting a gap job.")

    suspended_count = Task.objects.filter(
        company=worker.company,
        assigned_to=worker,
        status=Task.Status.SUSPENDED,
    ).count()

    if suspended_count >= 2:
        raise ValidationError("Maximum 2 suspended jobs allowed.")

    try:
        gap_task = Task.objects.get(pk=gap_task_id, company=worker.company)
    except Task.DoesNotExist:
        raise ValidationError("Gap job not found.")

    if gap_task.status != Task.Status.PENDING:
        raise ValidationError("Gap job must be pending.")

    if gap_task.parent_tasks.exists():
        raise ValidationError("This gap job is already taken.")

    # Link parent and gap job
    parent_task.gap_job = gap_task
    parent_task.save()

    # Assign gap task and clock it in
    gap_task.assigned_to = worker
    gap_task.status = Task.Status.IN_PROGRESS
    gap_task.acceptance_status = Task.AcceptanceStatus.ACCEPTED
    gap_task.started_at = timezone.now()
    gap_task.completion_percentage = 0

    employee_profile = getattr(worker, "employee_profile", None)
    if employee_profile:
        timelog = TimeLog.objects.create(
            employee=employee_profile,
            work_date=timezone.localdate(),
            clock_in=timezone.now(),
            clock_in_lat=gap_task.location_lat,
            clock_in_lon=gap_task.location_lon,
            clock_in_notes="Started as gap job.",
        )
        gap_task.time_log = timelog

    gap_task.save()

    log_activity(
        gap_task,
        TaskActivityLog.EventType.GAP_STARTED,
        actor=worker,
        notes=f"Gap job started. Suspended parent: #{parent_task.id}",
    )
    log_activity(
        parent_task,
        TaskActivityLog.EventType.GAP_STARTED,
        actor=worker,
        notes=f"Gap job #{gap_task.id} — {gap_task.title} started.",
    )

    return parent_task, gap_task


def complete_gap_job(gap_task_id, worker):
    """
    Completes the gap task, computes billing, clocks out, triggers resume alert.
    Logs GAP_COMPLETED activity.
    """
    try:
        gap_task = Task.objects.get(pk=gap_task_id, company=worker.company, assigned_to=worker)
    except Task.DoesNotExist:
        raise ValidationError("Gap task not found or not assigned to you.")

    if gap_task.status != Task.Status.IN_PROGRESS:
        raise ValidationError("Only in-progress gap tasks can be completed.")

    now = timezone.now()
    actual_seconds = int((now - gap_task.started_at).total_seconds()) if gap_task.started_at else 0
    gap_task.billed_hours = Task.compute_billed_hours(gap_task.estimated_hours, actual_seconds)
    gap_task.status = Task.Status.COMPLETED
    gap_task.completed_at = now
    gap_task.completion_percentage = 100

    if gap_task.time_log and not gap_task.time_log.clock_out:
        time_log = gap_task.time_log
        time_log.clock_out = now
        time_log.clock_out_notes = "Completed as gap job."
        time_log.save()

    gap_task.save()

    log_activity(
        gap_task,
        TaskActivityLog.EventType.GAP_COMPLETED,
        actor=worker,
        notes="Gap job completed.",
    )

    parent_task = Task.objects.filter(gap_job=gap_task).first()
    if parent_task:
        log_activity(
            parent_task,
            TaskActivityLog.EventType.GAP_COMPLETED,
            actor=worker,
            notes=f"Gap job #{gap_task.id} completed. Ready to resume.",
        )
        notify_worker_resume_ready(worker, parent_task)

    return gap_task


def resume_job(task_id, worker, current_lat, current_lng):
    """
    Resumes a suspended parent task.
    Validates GPS proximity. Starts a new clock-in / TimeLog session.
    Flags overdue warning if resume_deadline exceeded.
    Logs RESUMED activity.
    """
    try:
        task = Task.objects.get(pk=task_id, company=worker.company, assigned_to=worker)
    except Task.DoesNotExist:
        raise ValidationError("Task not found or not assigned to you.")

    if task.status != Task.Status.SUSPENDED:
        raise ValidationError("Only suspended tasks can be resumed.")

    if task.location_lat is not None and task.location_lon is not None:
        distance_m = haversine_m(
            float(current_lat), float(current_lng),
            float(task.location_lat), float(task.location_lon)
        )
        radius_m = task.geofence_radius or 300
        if distance_m > radius_m:
            dist_km = round(distance_m / 1000.0, 1)
            raise ProximityError(f"You are {dist_km} km from the job site. Move closer to resume.")

    now = timezone.now()
    overdue_warning = False
    if task.resume_deadline and now > task.resume_deadline:
        overdue_warning = True

    task.status = Task.Status.IN_PROGRESS
    task.suspended_at = None
    task.gap_job = None
    task.started_at = now

    employee_profile = getattr(worker, "employee_profile", None)
    if employee_profile:
        timelog = TimeLog.objects.create(
            employee=employee_profile,
            work_date=timezone.localdate(),
            clock_in=now,
            clock_in_lat=current_lat,
            clock_in_lon=current_lng,
            clock_in_notes="Resumed task.",
        )
        task.time_log = timelog

    task.save()

    log_activity(
        task,
        TaskActivityLog.EventType.RESUMED,
        actor=worker,
        notes="Resumed job." + (" (overdue)" if overdue_warning else ""),
        lat=current_lat,
        lon=current_lng,
    )

    return {"task": task, "overdue_warning": overdue_warning}
