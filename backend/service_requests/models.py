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
        FOLLOW_UP_REQUIRED    = "follow_up_required",    "Follow-up Required"

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

    @property
    def employee_job(self):
        """Backwards-compatibility property returning the primary assigned job."""
        return self.employee_jobs.filter(is_primary=True).first()

    def get_primary_job(self):
        return self.employee_jobs.filter(is_primary=True).first()

    def is_ready_to_complete(self):
        """
        Computed completion engine.
        Returns True if:
        1. All assigned jobs are either COMPLETED or UNABLE_TO_COMPLETE.
        2. All work extensions are RESOLVED, CUSTOMER_DECLINED, or ADMIN_REJECTED.
        """
        jobs = self.employee_jobs.all()
        if not jobs.exists():
            return False

        for job in jobs:
            if job.status not in [EmployeeJob.Status.COMPLETED, EmployeeJob.Status.UNABLE_TO_COMPLETE]:
                return False

        for ext in self.work_extensions.all():
            if ext.status not in [
                WorkExtension.Status.RESOLVED,
                WorkExtension.Status.CUSTOMER_DECLINED,
                WorkExtension.Status.ADMIN_REJECTED,
            ]:
                return False

        return True

    def __str__(self):
        return f"{self.request_id} — {self.issue_title}"


class EmployeeJob(models.Model):
    """Created when admin assigns a ServiceRequest to an Employee (Primary or Specialist)."""

    class Status(models.TextChoices):
        ASSIGNED           = "assigned",           "Assigned"
        ACCEPTED           = "accepted",           "Accepted"
        ON_THE_WAY         = "on_the_way",         "On The Way"
        IN_PROGRESS        = "in_progress",        "In Progress"
        AWAITING_PARTS     = "awaiting_parts",     "Awaiting Parts"
        COMPLETED          = "completed",          "Completed"
        UNABLE_TO_COMPLETE = "unable_to_complete", "Unable To Complete"
        REJECTED           = "rejected",           "Rejected"

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="employee_jobs",
    )
    is_primary = models.BooleanField(default=True)
    source_work_extension = models.ForeignKey(
        "WorkExtension",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_jobs",
    )
    uncompletion_reason = models.TextField(blank=True, null=True)

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

    status        = models.CharField(max_length=30, choices=Status.choices, default=Status.ASSIGNED)
    notes         = models.TextField(blank=True)

    assigned_date  = models.DateTimeField(default=timezone.now)
    accepted_date  = models.DateTimeField(null=True, blank=True)
    started_date   = models.DateTimeField(null=True, blank=True)
    completed_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-assigned_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["service_request"],
                condition=models.Q(is_primary=True),
                name="unique_primary_job_per_service_request",
            )
        ]

    def __str__(self):
        primary_str = " (Primary)" if self.is_primary else " (Specialist)"
        return f"Job for {self.service_request.request_id} → {self.employee}{primary_str}"


class WorkExtension(models.Model):
    """Reported by technician when scope expansion / additional work / specialist is required."""

    class Status(models.TextChoices):
        PENDING_ADMIN_REVIEW = "pending_admin_review", "Pending Admin Review"
        ADMIN_APPROVED       = "admin_approved",       "Admin Approved"
        ADMIN_REJECTED       = "admin_rejected",       "Admin Rejected"
        CUSTOMER_ACCEPTED    = "customer_accepted",    "Customer Accepted"
        CUSTOMER_DECLINED    = "customer_declined",    "Customer Declined"
        PENDING_ASSIGNMENT   = "pending_assignment",   "Pending Assignment"
        RESOLVED             = "resolved",             "Resolved"

    class DecisionChannel(models.TextChoices):
        PORTAL = "portal", "Customer Portal"
        PHONE  = "phone",  "Customer Support Phone"

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="work_extensions",
    )
    job = models.ForeignKey(
        EmployeeJob,
        on_delete=models.CASCADE,
        related_name="extensions",
    )
    reported_by = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE,
        related_name="reported_extensions",
    )

    requires_specialist = models.BooleanField(default=False)
    required_skill = models.CharField(max_length=150, blank=True, null=True)

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_ADMIN_REVIEW,
    )

    # Pricing Audit
    technician_estimate   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    admin_approved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    final_customer_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Public tokenized security
    decision_token   = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    token_expires_at = models.DateTimeField(null=True, blank=True)

    # Decision Audit Details
    decision_channel     = models.CharField(max_length=15, choices=DecisionChannel.choices, blank=True, null=True)
    decision_recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="recorded_work_extension_decisions",
    )
    decision_notes     = models.TextField(blank=True, default="")
    decision_timestamp = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Extension #{self.id} for {self.service_request.request_id} ({self.get_status_display()})"


class WorkExtensionItem(models.Model):
    """Specific line item / material required for a WorkExtension."""

    class FulfillmentSource(models.TextChoices):
        ORGANIZATION_STOCK       = "ORGANIZATION_STOCK",       "Organization Local Stock"
        ORGANIZATION_TRANSFER    = "ORGANIZATION_TRANSFER",    "Organization Stock Transfer"
        ORGANIZATION_PROCUREMENT = "ORGANIZATION_PROCUREMENT", "Organization Procurement"
        TECHNICIAN_PURCHASE      = "TECHNICIAN_PURCHASE",      "Technician Purchase"
        CUSTOMER_SUPPLIED        = "CUSTOMER_SUPPLIED",        "Customer Supplied"

    class Status(models.TextChoices):
        PENDING            = "PENDING",            "Pending"
        RESERVED           = "RESERVED",           "Reserved"
        AWAITING_PARTS     = "AWAITING_PARTS",     "Awaiting Parts"
        PURCHASE_REQUESTED = "PURCHASE_REQUESTED", "Purchase Requested"
        PURCHASE_APPROVED  = "PURCHASE_APPROVED",  "Purchase Approved"
        FULFILLED          = "FULFILLED",          "Fulfilled"
        VERIFIED           = "VERIFIED",           "Verified"
        REJECTED           = "REJECTED",           "Rejected"

    extension = models.ForeignKey(
        WorkExtension,
        on_delete=models.CASCADE,
        related_name="items",
    )
    inventory_item = models.ForeignKey(
        "inventory.InventoryItem",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="extension_items",
    )
    item_name = models.CharField(max_length=255)
    quantity  = models.PositiveIntegerField(default=1)
    location  = models.ForeignKey(
        "time_tracking.Location",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="extension_item_locations",
    )

    fulfillment_source = models.CharField(
        max_length=30,
        choices=FulfillmentSource.choices,
        default=FulfillmentSource.ORGANIZATION_STOCK,
    )
    status = models.CharField(
        max_length=25,
        choices=Status.choices,
        default=Status.PENDING,
    )

    # 3-Tier Financial Separation
    billed_to_customer              = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    actual_cost                     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    technician_reimbursement_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Technician Purchase Prior Approval
    technician_purchase_approved_limit = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    purchase_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="approved_technician_purchases",
    )
    purchase_receipt = models.FileField(upload_to="service_requests/receipts/", null=True, blank=True)

    # Customer Supplied Verification & Warranty Policy
    verified_by_tech   = models.BooleanField(default=False)
    verification_notes = models.TextField(blank=True, default="")
    warranty_covered   = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.quantity}x {self.item_name} ({self.fulfillment_source})"


class JobReschedule(models.Model):
    """Tracks appointment date changes due to parts delays or scheduling conflicts."""

    class Reason(models.TextChoices):
        PARTS_UNAVAILABLE      = "parts_unavailable",      "Parts Unavailable"
        TECHNICIAN_UNAVAILABLE = "technician_unavailable", "Technician Unavailable"
        CUSTOMER_REQUESTED     = "customer_requested",     "Customer Requested"
        OTHER                  = "other",                  "Other"

    job = models.ForeignKey(
        EmployeeJob,
        on_delete=models.CASCADE,
        related_name="reschedules",
    )
    old_date = models.DateField()
    new_date = models.DateField()
    reason   = models.CharField(max_length=30, choices=Reason.choices, default=Reason.PARTS_UNAVAILABLE)
    notes    = models.TextField(blank=True, default="")

    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="job_reschedules",
    )

    customer_notified_at  = models.DateTimeField(null=True, blank=True)
    customer_confirmed_at = models.DateTimeField(null=True, blank=True)

    delay_count              = models.PositiveIntegerField(default=1)
    support_callback_created = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reschedule for {self.job}: {self.old_date} -> {self.new_date}"


class SupplementalInvoice(models.Model):
    """Supplemental invoice issued for approved additional scope / material balance."""

    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        PAID      = "paid",      "Paid"
        CANCELLED = "cancelled", "Cancelled"

    service_request = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="supplemental_invoices",
    )
    work_extension = models.OneToOneField(
        WorkExtension,
        on_delete=models.CASCADE,
        related_name="supplemental_invoice",
    )
    invoice_number = models.CharField(max_length=50, unique=True)
    amount         = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    payment_method = models.CharField(max_length=20, blank=True, default="ONLINE")
    transaction_id = models.CharField(max_length=200, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    paid_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Supplemental Invoice {self.invoice_number} ({self.amount})"


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

    jobs_completed_count = models.PositiveIntegerField(default=0)
    average_rating       = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    feedback_count       = models.PositiveIntegerField(default=0)
    completion_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    customer_satisfaction_score = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    last_updated         = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Performance({self.employee})"


# ── Catalog models (seeded by seed_catalog.py) ────────────────────────────────
class CatalogCategory(models.Model):
    name        = models.CharField(max_length=100)
    slug        = models.SlugField(unique=True)
    icon        = models.CharField(max_length=200, blank=True)
    image       = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    rating      = models.CharField(max_length=10, blank=True, default="4.8")
    jobs_count_str = models.CharField(max_length=20, blank=True, default="10K+")

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
    image       = models.CharField(max_length=500, blank=True)
    popular     = models.BooleanField(default=False)
    tag         = models.CharField(max_length=50, blank=True)
    includes    = models.JSONField(default=list, blank=True)
    excludes    = models.JSONField(default=list, blank=True)
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.category.name} / {self.name}"
