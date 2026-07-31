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


# ─── Slice 2: Reschedule ──────────────────────────────────────────────────────

class RescheduleStatus(models.TextChoices):
    # ── Complete Manual Workflow Statuses ──────────────────────────────────────
    PENDING                     = "PENDING",                     "Pending Admin Review"
    PENDING_ADMIN_REVIEW        = "PENDING_ADMIN_REVIEW",        "Pending Admin Review"
    ADMIN_REVIEW                = "ADMIN_REVIEW",                "Under Admin Review"
    ADMIN_APPROVED              = "ADMIN_APPROVED",              "Admin Approved"
    EMPLOYEE_ASSIGNMENT_IN_PROGRESS = "EMPLOYEE_ASSIGNMENT_IN_PROGRESS", "Employee Assignment in Progress"
    EMPLOYEE_ASSIGNED           = "EMPLOYEE_ASSIGNED",           "Employee Assigned"
    AWAITING_EMPLOYEE_RESPONSE  = "AWAITING_EMPLOYEE_RESPONSE",  "Awaiting Employee Confirmation"
    AWAITING_EMPLOYEE_CONFIRMATION = "AWAITING_EMPLOYEE_CONFIRMATION", "Awaiting Employee Confirmation"
    TECHNICIAN_CONFIRMATION     = "TECHNICIAN_CONFIRMATION",     "Technician Confirmation"
    EMPLOYEE_CONFIRMED          = "EMPLOYEE_CONFIRMED",          "Employee Confirmed"
    EMPLOYEE_ACCEPTED           = "EMPLOYEE_ACCEPTED",           "Employee Accepted"
    EMPLOYEE_REJECTED           = "EMPLOYEE_REJECTED",           "Employee Rejected"
    REASSIGNMENT_NEEDED         = "REASSIGNMENT_NEEDED",         "Reassignment Needed"
    BOOKING_UPDATED             = "BOOKING_UPDATED",             "Booking Being Updated"
    APPROVED                    = "APPROVED",                    "Approved"
    CUSTOMER_NOTIFIED           = "CUSTOMER_NOTIFIED",           "Customer Notified"
    SLOT_SUGGESTED              = "SLOT_SUGGESTED",              "Slot Suggested by Admin"
    CUSTOMER_ACCEPTED_SUGGESTION = "CUSTOMER_ACCEPTED_SUGGESTION", "Customer Accepted Suggestion"
    CANCELLED_SUGGESTION        = "CANCELLED_SUGGESTION",        "Cancelled Suggestion"
    RESCHEDULED                 = "RESCHEDULED",                 "Rescheduled Successfully"
    REJECTED                    = "REJECTED",                    "Rejected"
    CANCELLED                   = "CANCELLED",                   "Cancelled"


class RescheduleRejectionReason(models.TextChoices):
    EMPLOYEE_UNAVAILABLE  = "EMPLOYEE_UNAVAILABLE",  "Employee Unavailable"
    OUTSIDE_WORKING_HOURS = "OUTSIDE_WORKING_HOURS", "Outside Working Hours"
    SERVICE_AREA_CLOSED   = "SERVICE_AREA_CLOSED",   "Service Area Closed"
    DUPLICATE_REQUEST     = "DUPLICATE_REQUEST",     "Duplicate Request"
    INVALID_REQUEST       = "INVALID_REQUEST",       "Invalid Request"
    POLICY_VIOLATION      = "POLICY_VIOLATION",      "Policy Violation"
    OTHER                 = "OTHER",                 "Other"


class EmployeeResponseChoices(models.TextChoices):
    PENDING  = "PENDING",  "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    REJECTED = "REJECTED", "Rejected"


class EmployeeRejectionReason(models.TextChoices):
    ALREADY_ASSIGNED      = "ALREADY_ASSIGNED",      "Already Assigned"
    LEAVE                 = "LEAVE",                 "On Leave"
    EMERGENCY             = "EMERGENCY",             "Personal Emergency"
    OUTSIDE_WORKING_HOURS = "OUTSIDE_WORKING_HOURS", "Outside Working Hours"
    DISTANCE_TOO_FAR      = "DISTANCE_TOO_FAR",      "Distance Too Far"
    PERSONAL_CONFLICT     = "PERSONAL_CONFLICT",     "Personal Conflict"
    OTHER                 = "OTHER",                 "Other"


class RescheduleReason(models.TextChoices):
    SCHEDULE_CONFLICT = "schedule_conflict", "Schedule Conflict"
    EMERGENCY         = "emergency",         "Emergency"
    WEATHER_DELAY     = "weather_delay",     "Weather Delay"
    TECHNICAL_ISSUE   = "technical_issue",   "Technical Issue"
    CUSTOMER_REQUEST  = "customer_request",  "Customer Request"
    OTHER             = "other",             "Other"


class TimeSlotChoices(models.TextChoices):
    SLOT_09_10 = "09-10", "09:00 - 10:00"
    SLOT_10_11 = "10-11", "10:00 - 11:00"
    SLOT_11_12 = "11-12", "11:00 - 12:00"
    SLOT_14_15 = "14-15", "14:00 - 15:00"
    SLOT_15_16 = "15-16", "15:00 - 16:00"


class RescheduleAttachment(models.Model):
    """File attachment uploaded for a reschedule request."""
    file          = models.FileField(upload_to="reschedules/attachments/")
    original_name = models.CharField(max_length=255, blank=True)
    uploaded_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reschedule_attachments",
    )
    uploaded_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"RescheduleAttachment {self.pk} - {self.original_name}"


def _generate_reschedule_id():
    """Generate RS-XXXX style human-readable ID."""
    last = RescheduleRequest.objects.order_by("-id").first()
    if last and last.reschedule_id:
        try:
            num = int(last.reschedule_id.split("-")[1]) + 1
        except (IndexError, ValueError):
            num = 1
    else:
        num = 1
    return f"RS-{str(num).zfill(4)}"


class RescheduleRequest(models.Model):
    """Customer, Admin, or System driven reschedule request for a booking."""

    class Persona(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        ADMIN    = "ADMIN",    "Admin"
        EMPLOYEE = "EMPLOYEE", "Employee"

    # Human-readable ID (RS-0001, RS-0002, ...)
    reschedule_id         = models.CharField(max_length=20, unique=True, blank=True, null=True)

    booking               = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="reschedule_requests",
    )
    requested_by          = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reschedule_requests_made",
    )
    persona               = models.CharField(max_length=10, choices=Persona.choices, default=Persona.CUSTOMER)

    # Immutable snapshot copied from booking at request time
    current_date          = models.DateField(null=True, blank=True)
    current_time          = models.CharField(max_length=50, blank=True, null=True)

    # Proposed new date & slot
    new_date              = models.DateField()
    new_time_slot         = models.CharField(max_length=20, choices=TimeSlotChoices.choices, default=TimeSlotChoices.SLOT_09_10)

    reason                = models.CharField(max_length=50, choices=RescheduleReason.choices, default=RescheduleReason.SCHEDULE_CONFLICT)
    additional_notes      = models.TextField(blank=True, default="")
    attachment            = models.ForeignKey(
        RescheduleAttachment,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reschedule_requests",
    )

    status                = models.CharField(max_length=60, choices=RescheduleStatus.choices, default=RescheduleStatus.PENDING)

    # Admin review & technician proposal (legacy + extended)
    proposed_technician   = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="proposed_reschedules",
    )
    technician_response_note  = models.TextField(blank=True, default="")
    alternate_slots_suggested = models.JSONField(default=list, blank=True)

    reviewed_by           = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reschedule_reviews",
    )
    reviewed_at           = models.DateTimeField(null=True, blank=True)
    review_notes          = models.TextField(blank=True, default="")

    # ── Extended workflow fields ────────────────────────────────────────────
    approved_date         = models.DateField(null=True, blank=True)
    approved_time         = models.CharField(max_length=20, null=True, blank=True)

    customer_response     = models.CharField(
        max_length=20,
        choices=[("PENDING", "Pending"), ("ACCEPTED", "Accepted"), ("REJECTED", "Rejected")],
        null=True, blank=True,
    )

    # Admin suggests alternate slot
    suggested_date        = models.DateField(null=True, blank=True)
    suggested_time_slot   = models.CharField(max_length=20, null=True, blank=True)

    # Admin rejection reason
    rejection_reason      = models.CharField(
        max_length=30,
        choices=RescheduleRejectionReason.choices,
        null=True, blank=True,
    )
    rejection_notes       = models.TextField(blank=True, default="")
    admin_remarks         = models.TextField(blank=True, default="")

    # Admin who took the final approval/rejection action
    admin_reviewed_by     = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="admin_reviewed_reschedules",
    )

    # Employee response tracking
    employee_response     = models.CharField(
        max_length=20,
        choices=EmployeeResponseChoices.choices,
        null=True, blank=True,
    )
    employee_response_note = models.TextField(blank=True, default="")
    employee_rejection_reason = models.CharField(
        max_length=30,
        choices=EmployeeRejectionReason.choices,
        null=True, blank=True,
    )
    employee_responded_at = models.DateTimeField(null=True, blank=True)

    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.reschedule_id:
            self.reschedule_id = _generate_reschedule_id()
        super().save(*args, **kwargs)

    def __str__(self):
        rid = self.reschedule_id or f"#{self.pk}"
        return f"RescheduleRequest({rid}) for {self.booking.request_id} [{self.status}]"


class RescheduleSuggestedSlot(models.Model):
    """Slot suggested by admin for customer review."""
    request     = models.ForeignKey(RescheduleRequest, on_delete=models.CASCADE, related_name="suggested_slots")
    date        = models.DateField()
    time_slot   = models.CharField(max_length=20)
    is_selected = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "time_slot"]

    def __str__(self):
        return f"SuggestedSlot for {self.request.reschedule_id}: {self.date} ({self.time_slot})"


class RescheduleStatusHistory(models.Model):
    """Audit log tracking every status transition of a reschedule request."""
    request     = models.ForeignKey(RescheduleRequest, on_delete=models.CASCADE, related_name="history")
    from_status = models.CharField(max_length=50)
    to_status   = models.CharField(max_length=50)
    changed_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="reschedule_history_actions",
    )
    note        = models.TextField(blank=True, default="")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"RescheduleHistory {self.request.reschedule_id}: {self.from_status} -> {self.to_status}"



# ─── Slice 3: Refund ──────────────────────────────────────────────────────────

class RefundStatus(models.TextChoices):
    PENDING         = "PENDING",         "Pending Admin Review"
    INFO_REQUESTED  = "INFO_REQUESTED",  "Information Requested"
    APPROVED_FULL   = "APPROVED_FULL",   "Approved Full"
    APPROVED_PARTIAL= "APPROVED_PARTIAL", "Approved Partial"
    REJECTED        = "REJECTED",        "Rejected"
    SENT_TO_FINANCE = "SENT_TO_FINANCE", "Sent to Finance"
    COMPLETED       = "COMPLETED",       "Completed"


class RefundType(models.TextChoices):
    FULL    = "FULL",    "Full Refund"
    PARTIAL = "PARTIAL", "Partial Refund"


class RefundReason(models.TextChoices):
    POOR_QUALITY         = "POOR_QUALITY",         "Poor Quality"
    SERVICE_NOT_COMPLETED = "SERVICE_NOT_COMPLETED", "Service Not Completed"
    CANCELLED_BY_PROVIDER = "CANCELLED_BY_PROVIDER", "Cancelled By Provider"
    OVERCHARGED          = "OVERCHARGED",          "Overcharged"
    OTHER                = "OTHER",                "Other"


class RefundInfoTarget(models.TextChoices):
    CUSTOMER = "CUSTOMER", "Customer"
    EMPLOYEE = "EMPLOYEE", "Employee"


class RefundRequest(models.Model):
    """
    Customer refund request — spans Customer, Admin, and Employee personas.
    Tracks financial snapshots, evidence, status lifecycle, internal notes, and employee investigations.
    """
    refund_id            = models.CharField(max_length=30, blank=True, null=True, unique=True)
    booking              = models.ForeignKey(
        ServiceRequest,
        on_delete=models.CASCADE,
        related_name="refund_requests",
    )
    customer             = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="refund_requests",
        null=True,
        blank=True
    )
    paid_amount          = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    refund_type          = models.CharField(max_length=20, choices=RefundType.choices, default=RefundType.FULL)
    requested_amount     = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    approved_amount      = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    reason               = models.CharField(max_length=50, choices=RefundReason.choices, default=RefundReason.POOR_QUALITY)
    additional_notes     = models.TextField(blank=True, default="")
    internal_notes       = models.TextField(blank=True, default="")
    status               = models.CharField(max_length=30, choices=RefundStatus.choices, default=RefundStatus.PENDING)
    info_requested_from  = models.CharField(max_length=20, choices=RefundInfoTarget.choices, null=True, blank=True)
    assigned_employee    = models.ForeignKey(
        "employees.Employee",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_refund_investigations"
    )
    gateway_reference    = models.CharField(max_length=200, blank=True, null=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.refund_id:
            import uuid, datetime
            stamp = datetime.date.today().strftime("%Y%m%d")
            rand_code = uuid.uuid4().hex[:4].upper()
            self.refund_id = f"RF-{stamp}-{rand_code}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"RefundRequest({self.refund_id}) for {self.booking.request_id} — ₹{self.requested_amount} [{self.status}]"


class RefundEvidence(models.Model):
    """Evidence file (photos/documents) uploaded for a refund request."""
    refund_request = models.ForeignKey(
        RefundRequest,
        on_delete=models.CASCADE,
        related_name="evidence"
    )
    file           = models.FileField(upload_to="refund_evidence/")
    uploaded_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    uploaded_at    = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"RefundEvidence({self.pk}) for {self.refund_request.refund_id}"


class RefundInvestigationNote(models.Model):
    """Technician / Employee investigation response note."""
    refund_request             = models.ForeignKey(
        RefundRequest,
        on_delete=models.CASCADE,
        related_name="investigation_notes"
    )
    employee                   = models.ForeignKey(
        "employees.Employee",
        on_delete=models.CASCADE
    )
    explanation                = models.TextField()
    work_completed_confirmed   = models.BooleanField(default=False)
    created_at                 = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"InvestigationNote({self.pk}) by {self.employee.employee_id}"


# ─── Slice 4: Complaint ───────────────────────────────────────────────────────

class Complaint(models.Model):
    """Customer complaint — can be booking-specific or general."""

    class Category(models.TextChoices):
        POOR_SERVICE         = "POOR_SERVICE",         "Poor Service"
        TECHNICIAN_LATE      = "TECHNICIAN_LATE",      "Technician Late"
        TECHNICIAN_BEHAVIOUR = "TECHNICIAN_BEHAVIOUR", "Technician Behaviour"
        INCOMPLETE_WORK      = "INCOMPLETE_WORK",      "Incomplete Work"
        WRONG_BILLING        = "WRONG_BILLING",        "Wrong Billing"
        DAMAGED_PROPERTY     = "DAMAGED_PROPERTY",     "Damaged Property"
        QUALITY_ISSUE        = "QUALITY_ISSUE",        "Quality Issue"
        OTHER                = "OTHER",                "Other"

    class Priority(models.TextChoices):
        LOW      = "LOW",      "Low"
        MEDIUM   = "MEDIUM",   "Medium"
        HIGH     = "HIGH",     "High"
        CRITICAL = "CRITICAL", "Critical"

    class Status(models.TextChoices):
        OPEN                = "OPEN",                "Open"
        ASSIGNED            = "ASSIGNED",            "Assigned"
        UNDER_INVESTIGATION = "UNDER_INVESTIGATION", "Under Investigation"
        WAITING_CUSTOMER    = "WAITING_CUSTOMER",    "Waiting on Customer"
        WAITING_TECHNICIAN  = "WAITING_TECHNICIAN",  "Waiting on Technician"
        ADMIN_REVIEW        = "ADMIN_REVIEW",        "Admin Review"
        ESCALATED           = "ESCALATED",           "Escalated"
        RESOLVED            = "RESOLVED",            "Resolved"
        CLOSED              = "CLOSED",              "Closed"
        
    class ResolutionType(models.TextChoices):
        COMPLAINT_VALID   = "COMPLAINT_VALID",   "Complaint Valid"
        COMPLAINT_INVALID = "COMPLAINT_INVALID", "Complaint Invalid"
        CUSTOMER_ERROR    = "CUSTOMER_ERROR",    "Customer Error"
        TECHNICIAN_ERROR  = "TECHNICIAN_ERROR",  "Technician Error"
        COMPANY_ERROR     = "COMPANY_ERROR",     "Company Error"

    complaint_number  = models.CharField(max_length=50, unique=True, blank=True, null=True)
    booking           = models.ForeignKey(
        ServiceRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="complaints"
    )
    raised_by         = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="complaints_raised"
    )
    category          = models.CharField(max_length=30, choices=Category.choices, default=Category.OTHER)
    description       = models.TextField()
    priority          = models.CharField(max_length=15, choices=Priority.choices, default=Priority.MEDIUM)
    status            = models.CharField(max_length=30, choices=Status.choices, default=Status.OPEN)
    
    assigned_admin    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_admin_complaints"
    )
    assigned_employee = models.ForeignKey(
        "employees.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_complaints"
    )
    risk_score        = models.IntegerField(null=True, blank=True)
    
    resolution_type   = models.CharField(max_length=30, choices=ResolutionType.choices, null=True, blank=True)
    resolution_notes  = models.TextField(blank=True, default="")
    
    refund_request    = models.ForeignKey(
        "RefundRequest", on_delete=models.SET_NULL, null=True, blank=True, related_name="linked_complaints"
    )
    rework_booking    = models.ForeignKey(
        ServiceRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name="rework_source_complaints"
    )

    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)
    resolved_at       = models.DateTimeField(null=True, blank=True)
    closed_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Complaint({self.complaint_number}) [{self.get_status_display()}]"


class ComplaintAttachment(models.Model):
    """Files/photos attached to a complaint."""
    class AttachmentType(models.TextChoices):
        IMAGE   = "IMAGE",   "Image"
        VIDEO   = "VIDEO",   "Video"
        INVOICE = "INVOICE", "Invoice"

    complaint       = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="attachments")
    file            = models.FileField(upload_to="service_requests/complaints/")
    attachment_type = models.CharField(max_length=15, choices=AttachmentType.choices, default=AttachmentType.IMAGE)
    uploaded_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at      = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"Attachment for {self.complaint.complaint_number}"


class ComplaintMessage(models.Model):
    """The shared conversation thread for complaints."""

    class Persona(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Customer"
        ADMIN    = "ADMIN",    "Admin"
        EMPLOYEE = "EMPLOYEE", "Employee"

    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="messages")
    sender    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_complaint_messages")
    sender_persona = models.CharField(max_length=10, choices=Persona.choices)
    message   = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class ComplaintStatusHistory(models.Model):
    """Audit trail for complaint statuses."""
    complaint   = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name="status_history")
    from_status = models.CharField(max_length=30)
    to_status   = models.CharField(max_length=30)
    changed_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    notes       = models.TextField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
