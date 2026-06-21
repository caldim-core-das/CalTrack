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
        SUSPENDED   = "suspended",   "Suspended"

    class TravelStatus(models.TextChoices):
        ON_THE_WAY   = "on_the_way",   "On The Way"
        REACHED_SITE = "reached_site", "Reached Site"
        WORKING      = "working",      "Working"
        DONE         = "done",         "Done"

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
    subcategory      = models.CharField(max_length=100, blank=True)
    service_type     = models.CharField(max_length=100, blank=True)
    required_tools   = models.TextField(blank=True, help_text="Comma-separated or list of tools required.")
    required_spare_parts = models.TextField(blank=True, help_text="Comma-separated or list of spare parts needed.")
    priority         = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status           = models.CharField(max_length=20, choices=Status.choices,   default=Status.PENDING)

    # Inventory linking
    class InventoryStatus(models.TextChoices):
        FULFILLED = "fulfilled", "Fulfilled"
        PARTIAL = "partial", "Partial"
        MISSING = "missing", "Missing"
        PENDING_TRANSFER = "pending_transfer", "Pending Transfer"
        
    required_items   = models.ManyToManyField('inventory.InventoryItem', through='TaskRequiredItem', blank=True, related_name='tasks_requiring')
    inventory_status = models.CharField(max_length=30, choices=InventoryStatus.choices, default=InventoryStatus.FULFILLED)
    blocking_reason  = models.TextField(blank=True)
    
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
    service_request  = models.ForeignKey(
        'service_requests.ServiceRequest',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="tasks",
        help_text="The service request this job/task was created from."
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
    landmark         = models.CharField(max_length=200, blank=True)
    area             = models.CharField(max_length=100, blank=True)
    city             = models.CharField(max_length=100, blank=True)
    state            = models.CharField(max_length=100, blank=True)
    pincode          = models.CharField(max_length=20, blank=True)
    location         = models.CharField(max_length=300, blank=True)
    location_lat     = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_lon     = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    geofence_radius  = models.PositiveIntegerField(null=True, blank=True, help_text="Radius in meters to verify location.")
    
    # Client details
    client_name      = models.CharField(max_length=200, blank=True, help_text="Customer/client name.")
    client_company_name = models.CharField(max_length=200, blank=True)
    client_contact_number = models.CharField(max_length=50, blank=True)
    client_alternate_number = models.CharField(max_length=50, blank=True)
    client_email     = models.EmailField(blank=True)

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
    accepted_at    = models.DateTimeField(null=True, blank=True)
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

    # ── Suspension and Gap Jobs (Phase 1) ──────────────────────────────────
    suspended_at         = models.DateTimeField(null=True, blank=True)
    total_active_seconds = models.PositiveIntegerField(default=0, help_text="Cumulative active time in seconds, excluding suspension time.")
    suspend_reason       = models.CharField(max_length=200, null=True, blank=True)
    resume_deadline      = models.DateTimeField(null=True, blank=True)
    gap_job              = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='parent_tasks',
        help_text="Link to the gap job accepted while this task was suspended."
    )
    is_pushed_gap_job    = models.BooleanField(
        default=False,
        help_text="True when admin explicitly pushed this task as a gap job to an employee who has a suspended task."
    )

    # ── Smart Workflow (Phase 2) ──────────────────────────────────────────
    sla_deadline         = models.DateTimeField(
        null=True, blank=True,
        help_text="Deadline by which the job must be completed (SLA). Used to block pauses and prioritise dispatch."
    )
    completion_percentage = models.PositiveSmallIntegerField(
        default=0,
        help_text="Employee-reported completion percentage (0–100). Triggers smart nearby suggestions at >=80."
    )

    # ── Travel / Journey Workflow (Phase 3) ──────────────────────────────────
    # Sub-status that tracks the employee's physical journey to the client site.
    # Transitions: None → on_the_way → reached_site → working → done
    # Note: 'working' also sets status=in_progress; 'done' mirrors status=completed.
    travel_status = models.CharField(
        max_length=20,
        choices=TravelStatus.choices,
        blank=True,
        null=True,
        db_index=True,
        help_text="Journey phase for field tasks: on_the_way → reached_site → working → done"
    )
    reached_site_at  = models.DateTimeField(
        null=True, blank=True,
        help_text="When the employee tapped 'I've Arrived' at the client location."
    )
    work_started_at  = models.DateTimeField(
        null=True, blank=True,
        help_text="When the employee tapped 'Start Work' — distinct from task.started_at which is set by /start/."
    )

    # Face Verification Fields
    start_photo = models.ImageField(blank=True, null=True, upload_to='tasks/start_photos/')
    end_photo = models.ImageField(blank=True, null=True, upload_to='tasks/end_photos/')
    face_match_percentage = models.FloatField(blank=True, null=True)
    face_match_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('verified', 'Verified'),
            ('failed', 'Failed'),
            ('skipped', 'Skipped')
        ],
        default='pending'
    )
    submission_time = models.DateTimeField(blank=True, null=True)

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

    def save(self, *args, **kwargs):
        if self.status == Task.Status.COMPLETED and self.billed_hours is None:
            est_hours = self.estimated_hours if self.estimated_hours is not None else 1.00
            if self.started_at and self.completed_at:
                actual_seconds = int((self.completed_at - self.started_at).total_seconds())
                self.billed_hours = self.compute_billed_hours(est_hours, actual_seconds)
            else:
                self.billed_hours = est_hours
        super().save(*args, **kwargs)



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


class TaskActivityLog(models.Model):
    """
    Immutable timeline of significant events for a Task.
    Each row represents one atomic workflow step.
    """

    class EventType(models.TextChoices):
        STARTED          = "started",           "Started"
        PAUSED           = "paused",            "Paused"
        RESUMED          = "resumed",           "Resumed"
        GAP_STARTED      = "gap_started",       "Gap Job Started"
        GAP_COMPLETED    = "gap_completed",     "Gap Job Completed"
        COMPLETED        = "completed",         "Completed"
        NEARBY_SUGGESTED = "nearby_suggested",  "Nearby Job Suggested"
        NEARBY_ACCEPTED  = "nearby_accepted",   "Nearby Job Accepted"
        NEARBY_REJECTED  = "nearby_rejected",   "Nearby Job Rejected"
        COMPLETION_PCT   = "completion_pct",    "Completion % Updated"
        SLA_WARNING      = "sla_warning",       "SLA Warning Issued"

    task       = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="activity_logs")
    event_type = models.CharField(max_length=30, choices=EventType.choices)
    actor      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="task_activity_logs",
    )
    notes      = models.TextField(blank=True)
    lat        = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    lon        = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    timestamp  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"[{self.task_id}] {self.event_type} @ {self.timestamp}"

class TaskRequiredItem(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    inventory_item = models.ForeignKey('inventory.InventoryItem', on_delete=models.CASCADE)
    quantity_needed = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('task', 'inventory_item')


