"""
service_requests/models.py

Five models for the Service Request → Job → Proof → Feedback → Performance pipeline.
FKs reference the existing Employee and User models — no duplication.
"""
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


def _generate_request_id():
    """Generate SR-XXXX style human-readable ID."""
    last = ServiceRequest.objects.order_by("-id").first()
    if last and last.request_id:
        try:
            num = int(last.request_id.split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"SR-{str(num).zfill(4)}"


# ── Service categories (static list) ─────────────────────────────────────────
SERVICE_CATEGORIES = [
    ("plumbing", "Plumbing"),
    ("electrical", "Electrical"),
    ("carpentry", "Carpentry"),
    ("hvac", "HVAC"),
    ("cleaning", "Cleaning"),
    ("pest_control", "Pest Control"),
    ("painting", "Painting"),
    ("appliance_repair", "Appliance Repair"),
    ("security", "Security Systems"),
    ("general", "General Maintenance"),
]


class ServiceRequest(models.Model):
    """Master record: created by public booking, driven through 11-state machine."""

    class Status(models.TextChoices):
        NEW_REQUEST          = "new_request",          "New Request"
        REVIEWED             = "reviewed",             "Reviewed"
        ASSIGNED             = "assigned",             "Assigned"
        ACCEPTED             = "accepted",             "Accepted"
        IN_PROGRESS          = "in_progress",          "In Progress"
        COMPLETED            = "completed",            "Completed"
        AWAITING_VERIFICATION = "awaiting_verification", "Awaiting Verification"
        VERIFIED             = "verified",             "Verified"
        FEEDBACK_PENDING     = "feedback_pending",     "Feedback Pending"
        FEEDBACK_RECEIVED    = "feedback_received",    "Feedback Received"
        CLOSED               = "closed",               "Closed"
        REJECTED             = "rejected",             "Rejected"
        REWORK_REQUESTED     = "rework_requested",     "Rework Requested"

    class Priority(models.TextChoices):
        LOW    = "low",    "Low"
        NORMAL = "normal", "Normal"
        HIGH   = "high",   "High"
        URGENT = "urgent", "Urgent"

    # Human-readable ID (SR-0001, SR-0002, ...)
    request_id = models.CharField(max_length=20, unique=True, blank=True)

    # Multi-tenant
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="service_requests",
        null=True, blank=True,
    )

    # Customer info (public submission — no account required)
    customer_name = models.CharField(max_length=200)
    phone         = models.CharField(max_length=30)
    email         = models.EmailField(blank=True, null=True)

    # Service details
    service_category = models.CharField(max_length=50, choices=SERVICE_CATEGORIES)
    issue_title      = models.CharField(max_length=300)
    description      = models.TextField(blank=True, default="")
    address          = models.TextField()
    preferred_date   = models.DateField()
    photo            = models.ImageField(upload_to="service_requests/photos/", null=True, blank=True)

    # Workflow
    status   = models.CharField(max_length=30, choices=Status.choices, default=Status.NEW_REQUEST)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)

    # Assigned employee (set when status → Assigned)
    assigned_employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_service_requests",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.request_id:
            self.request_id = _generate_request_id()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.request_id} — {self.issue_title}"


class EmployeeJob(models.Model):
    """Created when admin assigns a ServiceRequest to an Employee."""

    class Status(models.TextChoices):
        ASSIGNED    = "assigned",    "Assigned"
        ACCEPTED    = "accepted",    "Accepted"
        IN_PROGRESS = "in_progress", "In Progress"
        COMPLETED   = "completed",   "Completed"
        REJECTED    = "rejected",    "Rejected"

    service_request = models.OneToOneField(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="employee_job",
    )
    employee = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_jobs",
    )

    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.ASSIGNED)
    notes         = models.TextField(blank=True)

    assigned_date  = models.DateTimeField(default=timezone.now)
    accepted_date  = models.DateTimeField(null=True, blank=True)
    started_date   = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_date"]

    def __str__(self):
        return f"Job for {self.service_request.request_id} → {self.employee}"


class JobCompletionProof(models.Model):
    """Photos / docs uploaded by employee before or after completing work."""

    job      = models.ForeignKey(EmployeeJob, on_delete=models.CASCADE, related_name="proofs")
    photo    = models.ImageField(upload_to="service_requests/proofs/", null=True, blank=True)
    document = models.FileField(upload_to="service_requests/docs/", null=True, blank=True)
    note     = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"Proof for {self.job}"


class ServiceFeedback(models.Model):
    """Public feedback form submitted via token link after verification."""

    class Quality(models.TextChoices):
        GOOD    = "good",    "Good"
        AVERAGE = "average", "Average"
        POOR    = "poor",    "Poor"

    service_request = models.OneToOneField(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="feedback",
    )

    # Token generated when admin verifies — used as public URL key
    feedback_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    # Populated only on submission
    rating             = models.PositiveSmallIntegerField(null=True, blank=True)  # 1-5
    employee_behaviour = models.CharField(max_length=10, choices=Quality.choices, blank=True)
    work_quality       = models.CharField(max_length=10, choices=Quality.choices, blank=True)
    issue_resolved     = models.BooleanField(null=True, blank=True)
    comment            = models.TextField(blank=True)
    submitted_at       = models.DateTimeField(null=True, blank=True)

    # Track whether submitted
    is_submitted = models.BooleanField(default=False)

    class Meta:
        ordering = ["-id"]

    def __str__(self):
        return f"Feedback for {self.service_request.request_id}"


class EmployeePerformance(models.Model):
    """
    Denormalized aggregate stats per employee.
    Recalculated via signal whenever a ServiceFeedback is submitted.
    One record per employee — upserted, never deleted.
    """
    employee = models.OneToOneField(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="performance",
    )

    jobs_completed_count       = models.PositiveIntegerField(default=0)
    average_rating             = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    feedback_count             = models.PositiveIntegerField(default=0)
    completion_rate            = models.DecimalField(max_digits=5, decimal_places=2, default=0)  # percentage
    customer_satisfaction_score = models.DecimalField(max_digits=3, decimal_places=2, default=0)  # 0-5
    last_updated               = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Performance: {self.employee}"
