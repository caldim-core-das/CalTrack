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
    """Master record: created by public booking, driven through state machine."""

    class Status(models.TextChoices):
        NEW_REQUEST           = "new_request",           "New Request"
        WAITING_FOR_PAYMENT   = "waiting_for_payment",   "Waiting for Payment"
        CONFIRMED             = "confirmed",             "Confirmed"
        REVIEWED              = "reviewed",              "Reviewed"
        ASSIGNED              = "assigned",              "Assigned"
        ACCEPTED              = "accepted",              "Accepted"
        ON_THE_WAY            = "on_the_way",            "On The Way"
        IN_PROGRESS           = "in_progress",           "In Progress"
        COMPLETED             = "completed",             "Completed"
        AWAITING_VERIFICATION = "awaiting_verification", "Awaiting Verification"
        VERIFIED              = "verified",              "Verified"
        FEEDBACK_PENDING      = "feedback_pending",      "Feedback Pending"
        FEEDBACK_RECEIVED     = "feedback_received",     "Feedback Received"
        CLOSED                = "closed",                "Closed"
        REJECTED              = "rejected",              "Rejected"
        REWORK_REQUESTED      = "rework_requested",      "Rework Requested"

    class Priority(models.TextChoices):
        LOW    = "low",    "Low"
        NORMAL = "normal", "Normal"
        HIGH   = "high",   "High"
        URGENT = "urgent", "Urgent"

    class PaymentMethod(models.TextChoices):
        COD    = "COD",    "Cash on Service"
        ONLINE = "ONLINE", "Online Payment"

    class PaymentStatus(models.TextChoices):
        PENDING    = "pending",    "Pending"
        PROCESSING = "processing", "Processing"
        COLLECTED  = "collected",  "Collected"
        PAID       = "paid",       "Paid"
        FAILED     = "failed",     "Failed"
        CANCELLED  = "cancelled",  "Cancelled"
        REFUNDED   = "refunded",   "Refunded"

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
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="service_requests_as_customer",
        null=True, blank=True,
    )
    customer_name = models.CharField(max_length=200)
    phone         = models.CharField(max_length=30)
    email         = models.EmailField(blank=True, null=True)

    # Service details
    service_category = models.CharField(max_length=150)
    issue_title      = models.CharField(max_length=300)
    description      = models.TextField(blank=True, default="")
    address          = models.TextField()
    preferred_date   = models.DateField()
    preferred_time   = models.CharField(max_length=50, blank=True, null=True)
    photo            = models.ImageField(upload_to="service_requests/photos/", null=True, blank=True)
    total_amount     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    cart_data        = models.JSONField(default=list, blank=True)

    # Payment workflow
    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        default=PaymentMethod.COD,
        blank=True,
    )
    payment_status = models.CharField(
        max_length=15,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        blank=True,
    )
    transaction_id       = models.CharField(max_length=200, blank=True, null=True)
    payment_gateway      = models.CharField(max_length=50, blank=True, null=True)
    payment_collected_by = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="cash_collections",
    )
    payment_collected_at = models.DateTimeField(null=True, blank=True)
    invoice_id           = models.CharField(max_length=50, blank=True, null=True)

    # Booking status workflow
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
        ON_THE_WAY  = "on_the_way",  "On The Way"
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
    rating              = models.PositiveSmallIntegerField(null=True, blank=True)
    employee_behaviour  = models.CharField(max_length=10, choices=Quality.choices, blank=True)
    work_quality        = models.CharField(max_length=10, choices=Quality.choices, blank=True)
    issue_resolved      = models.BooleanField(null=True, blank=True)
    comment             = models.TextField(blank=True)

    submitted_at  = models.DateTimeField(null=True, blank=True)
    is_submitted  = models.BooleanField(default=False)

    class Meta:
        ordering = ["-submitted_at"]

    def __str__(self):
        return f"Feedback({self.feedback_token}) for {self.service_request.request_id}"


class EmployeePerformance(models.Model):
    """Cached performance metrics per employee, recalculated on feedback events."""

    employee = models.OneToOneField(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="performance",
    )

    total_jobs_assigned   = models.PositiveIntegerField(default=0)
    total_jobs_completed  = models.PositiveIntegerField(default=0)
    average_rating        = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    issue_resolution_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    last_updated          = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Performance({self.employee})"


# ── Catalog models (seeded by seed_catalog.py) ────────────────────────────────
class CatalogCategory(models.Model):
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(unique=True)
    icon        = models.CharField(max_length=200, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CatalogService(models.Model):
    category    = models.ForeignKey(CatalogCategory, on_delete=models.CASCADE, related_name="services")
    name        = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price       = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    duration    = models.CharField(max_length=50, blank=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.category.name} / {self.name}"
