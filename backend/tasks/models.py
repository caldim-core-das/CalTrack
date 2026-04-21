from django.conf import settings
from django.db import models
from django.utils import timezone
from django_mongodb_backend.fields import ObjectIdAutoField


class Task(models.Model):
    """
    A task assigned by an admin to one or more employees.
    Designed for field workers (electricians, plumbers, etc.)
    who complete multiple tasks at different locations in a day.
    """

    id = ObjectIdAutoField(primary_key=True)

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


class TaskAttachment(models.Model):
    id = ObjectIdAutoField(primary_key=True)

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
