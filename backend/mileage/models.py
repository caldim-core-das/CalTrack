from django.conf import settings
from django.db import models

from employees.models import Employee


class MileagePolicy(models.Model):
    """Per-organisation mileage reimbursement configuration."""

    company = models.OneToOneField(
        "companies.Company", on_delete=models.CASCADE, related_name="mileage_policy"
    )

    # IRS (USD) — 2024 rate: $0.67/mile
    rate_per_mile_usd = models.DecimalField(max_digits=7, decimal_places=4, default=0.6700)

    # HMRC (GBP) — first 10,000 miles: £0.45, above: £0.25
    rate_per_mile_gbp_first = models.DecimalField(max_digits=7, decimal_places=4, default=0.4500)
    rate_per_mile_gbp_after = models.DecimalField(max_digits=7, decimal_places=4, default=0.2500)
    uk_mileage_threshold = models.IntegerField(default=10000)

    # UK tax year start (default: 6 April)
    uk_tax_year_start_month = models.IntegerField(default=4)
    uk_tax_year_start_day = models.IntegerField(default=6)

    # India (INR) — per km
    rate_per_km_inr = models.DecimalField(max_digits=7, decimal_places=4, default=3.5000)

    # Controls
    require_receipt_above_miles = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Require receipt when trip exceeds this many miles"
    )
    auto_approve_below_miles = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Auto-approve trips under this many miles"
    )
    max_single_trip_miles = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True,
        help_text="Maximum allowed miles for a single trip"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Mileage Policy"
        verbose_name_plural = "Mileage Policies"

    def __str__(self):
        return f"MileagePolicy [{self.company}]"


class MileageTrip(models.Model):
    """A single reimbursable mileage trip record."""

    class Purpose(models.TextChoices):
        TASK_TRAVEL = "task_travel", "Task Travel"
        TOOL_COLLECTION = "tool_collection", "Tool Collection"
        EMERGENCY = "emergency", "Emergency"
        TRAINING = "training", "Training"
        CLIENT_VISIT = "client_visit", "Client Visit"

    class Jurisdiction(models.TextChoices):
        US = "US", "United States (IRS)"
        UK = "UK", "United Kingdom (HMRC)"
        IN = "IN", "India"

    class ApprovalStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        PAID = "paid", "Paid"

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="mileage_trips"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="mileage_trips"
    )
    trip_date = models.DateField()

    # Locations — nullable FKs to JobSite + text fallbacks for custom addresses
    from_location = models.ForeignKey(
        "time_tracking.JobSite",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mileage_trips_from",
    )
    to_location = models.ForeignKey(
        "time_tracking.JobSite",
        on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mileage_trips_to",
    )
    from_location_name = models.CharField(max_length=300, blank=True)
    to_location_name = models.CharField(max_length=300, blank=True)

    from_lat = models.FloatField(null=True, blank=True)
    from_lng = models.FloatField(null=True, blank=True)
    to_lat = models.FloatField(null=True, blank=True)
    to_lng = models.FloatField(null=True, blank=True)

    distance_km = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    distance_miles = models.DecimalField(max_digits=10, decimal_places=4, default=0)

    purpose = models.CharField(
        max_length=30, choices=Purpose.choices, default=Purpose.TASK_TRAVEL
    )

    # Optional linked records
    linked_task = models.ForeignKey(
        "tasks.Task", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mileage_trips",
    )
    linked_transfer = models.ForeignKey(
        "inventory.InventoryTransfer", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mileage_trips",
    )
    linked_timelog = models.ForeignKey(
        "time_tracking.TimeLog", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mileage_trips",
    )

    # Jurisdiction & tax year
    jurisdiction = models.CharField(
        max_length=2, choices=Jurisdiction.choices, default=Jurisdiction.US
    )
    tax_year = models.CharField(max_length=9, blank=True)  # e.g. "2024-2025"

    # Calculated reimbursement snapshot
    ytd_miles_before = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    miles_at_high_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    miles_at_low_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    rate_applied = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    reimbursement_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="USD")

    # UK excess taxability
    is_taxable_excess = models.BooleanField(default=False)
    taxable_excess_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Approval workflow
    approval_status = models.CharField(
        max_length=20, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="approved_mileage_trips",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Payroll linkage
    linked_payroll_record = models.ForeignKey(
        "payroll.PayrollRecord", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="mileage_trips",
    )

    # Notes
    employee_notes = models.TextField(blank=True)
    admin_notes = models.TextField(blank=True)

    # Odometer
    odometer_start = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    odometer_end = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)

    # Receipt photo (requires Pillow)
    receipt_photo = models.ImageField(upload_to="mileage/receipts/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-trip_date", "-created_at"]
        verbose_name = "Mileage Trip"
        verbose_name_plural = "Mileage Trips"

    def __str__(self):
        return (
            f"{self.employee} | {self.trip_date} | "
            f"{self.distance_miles} mi | {self.approval_status}"
        )


class MileageYTDTracker(models.Model):
    """Per-employee, per-jurisdiction, per-tax-year YTD mileage accumulator."""

    company = models.ForeignKey(
        "companies.Company", on_delete=models.CASCADE, related_name="mileage_ytd_trackers"
    )
    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="mileage_ytd"
    )
    jurisdiction = models.CharField(max_length=2, choices=MileageTrip.Jurisdiction.choices)
    tax_year = models.CharField(max_length=9)  # e.g. "2024-2025"

    total_miles = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    miles_at_high_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    miles_at_low_rate = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    total_reimbursed_gbp = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    threshold_crossed_date = models.DateField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [["company", "employee", "jurisdiction", "tax_year"]]
        verbose_name = "Mileage YTD Tracker"
        verbose_name_plural = "Mileage YTD Trackers"

    def __str__(self):
        return f"{self.employee} | {self.jurisdiction} | {self.tax_year} | {self.total_miles} mi"
