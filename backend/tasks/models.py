from django.conf import settings
from django.db import models
from django.utils import timezone


class Task(models.Model):
    """
    A task assigned by an admin to one or more employees.
    Designed for field workers (electricians, plumbers, etc.)
    who complete multiple tasks at different locations in a day.
    """


    class Priority(models.TextChoices):
        LOW    = "low",    "Low"
        MEDIUM = "medium", "Medium"
        HIGH   = "high",   "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        PENDING     = "pending",     "Pending"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED   = "completed",   "Completed"
        CANCELLED   = "cancelled",   "Cancelled"

    class AcceptanceStatus(models.TextChoices):
        PENDING_ACCEPTANCE = "pending_acceptance", "Pending Acceptance"
        ACCEPTED           = "accepted",           "Accepted"
        DECLINED           = "declined",           "Declined"

    class Category(models.TextChoices):
        ELECTRICIAN  = "electrician",  "Electrician"
        PLUMBER      = "plumber",      "Plumber"
        CARPENTER    = "carpenter",    "Carpenter"
        HVAC         = "hvac",         "HVAC"
        MAINTENANCE  = "maintenance",  "Maintenance"
        INSPECTION   = "inspection",   "Inspection"
        CLEANING     = "cleaning",     "Cleaning"
        INSTALLATION = "installation", "Installation"
        REPAIR       = "repair",       "Repair"
        OTHER        = "other",        "Other"

    # Core fields
    title            = models.CharField(max_length=200)
    description      = models.TextField(blank=True)
    category         = models.CharField(max_length=50, choices=Category.choices, default=Category.OTHER)
    priority         = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status           = models.CharField(max_length=20, choices=Status.choices,   default=Status.PENDING)
    
    # Multi-tenant
    company          = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="tasks", null=True, blank=True)

    # Assignment
    assigned_to      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_tasks",
    )
    assigned_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_tasks",
    )

    # Scheduling
    due_date         = models.DateField(default=timezone.localdate)
    estimated_hours  = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)

    # Location
    job_site         = models.ForeignKey(
        'time_tracking.JobSite',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="tasks",
        help_text="Link to an established job site, if applicable."
    )
    job_address      = models.TextField(blank=True, help_text="Full address of the job location.")
    location         = models.CharField(max_length=300, blank=True)
    location_lat     = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lon     = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    geofence_radius  = models.PositiveIntegerField(null=True, blank=True, help_text="Radius in meters to verify location.")
    client_name      = models.CharField(max_length=200, blank=True)

    # Verification Settings
    require_selfie   = models.BooleanField(default=False)
    require_before_after_photos = models.BooleanField(default=False)

    # Time tracking link
    time_log = models.OneToOneField(
        'time_tracking.TimeLog',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="task",
        help_text="The time log associated with this task."
    )

    # Employee notes / completion
    employee_notes   = models.TextField(blank=True)
    admin_notes      = models.TextField(blank=True)

    # ── Accept / Decline workflow ─────────────────────────────────────────
    # Every newly-created task starts as pending_acceptance.
    # The assigned employee must explicitly accept before they can start it.
    # On decline the admin is alerted and can immediately reassign, which
    # resets acceptance_status back to pending_acceptance for the new assignee.
    acceptance_status = models.CharField(
        max_length=20,
        choices=AcceptanceStatus.choices,
        default=AcceptanceStatus.PENDING_ACCEPTANCE,
    )
    decline_reason = models.TextField(blank=True)
    declined_at    = models.DateTimeField(null=True, blank=True)
    declined_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="declined_tasks",
    )

    # ── Billed hours (stored on completion for payroll) ───────────────────
    # Populated by the complete action using the sub-1-hour rounding rules:
    #   actual ≤ 15 min  → billed 0.5 h
    #   actual ≤ 45 min  → billed 1.0 h
    #   actual  > 45 min → billed = actual_hours (normal)
    # Only applied when estimated_hours < 1. Otherwise billed = actual_hours.
    billed_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    # Timestamps
    started_at       = models.DateTimeField(null=True, blank=True)
    completed_at     = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "-priority", "created_at"]

    def __str__(self):
        return f"{self.title} → {self.assigned_to.username}"

    @property
    def actual_hours(self):
        """Hours elapsed from start to completion (or now if in progress)."""
        if not self.started_at:
            return 0
        end = self.completed_at or timezone.now()
        delta = end - self.started_at
        return round(delta.total_seconds() / 3600, 2)

    @staticmethod
    def compute_billed_hours(estimated_hours, actual_seconds):
        """
        Sub-1-hour rounding rule:
          If estimated_hours < 1:
            actual ≤ 15 min  → bill 0.5 h
            actual ≤ 45 min  → bill 1.0 h
            actual  > 45 min → bill actual_hours (normal rounding, ceil to 0.5)
          If estimated_hours ≥ 1:
            bill = actual_hours (standard, no special rounding)
        Returns a Decimal-compatible float rounded to 2 dp.
        """
        from decimal import Decimal
        actual_minutes = actual_seconds / 60
        if float(estimated_hours) < 1.0:
            if actual_minutes <= 15:
                return Decimal("0.50")
            elif actual_minutes <= 45:
                return Decimal("1.00")
            else:
                # Still round up to nearest 0.5 for fairness
                raw = actual_seconds / 3600
                import math
                return Decimal(str(round(math.ceil(raw * 2) / 2, 2)))
        else:
            raw = actual_seconds / 3600
            return Decimal(str(round(raw, 2)))


class TaskAttachment(models.Model):

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="tasks/attachments/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="task_attachments",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
