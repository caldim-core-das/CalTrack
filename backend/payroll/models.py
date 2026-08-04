from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from employees.models import Employee


# ---------------------------------------------------------------------------
# Payroll Group — named groups for bulk payroll customization
# ---------------------------------------------------------------------------

class PayrollGroup(models.Model):
    """
    A named group of employees sharing the same payroll customization.
    Admin creates groups (e.g. "Field Engineers", "Office Staff") to apply
    the same config to many employees at once.
    """
    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="payroll_groups"
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="created_payroll_groups"
    )

    class Meta:
        unique_together = [("company", "name")]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.company.company_name})"

    @property
    def employee_count(self):
        return self.employees.filter(is_active=True).count()


# ---------------------------------------------------------------------------
# Employee Payroll Config — per-employee OR per-group customization
# ---------------------------------------------------------------------------

class EmployeePayrollConfig(models.Model):
    """
    Payroll customization config — applied at individual employee level or
    group level. Priority: Individual > Group > Region Default.

    Covers all three regions:
      India:  service revenue split + PF/ESI/TDS deductions
      US:     FLSA OT rules + optional service revenue split
      UK:     PAYE/NI + WTR OT + optional service revenue split
    """

    class FeeType(models.TextChoices):
        PERCENTAGE = "percentage", "Percentage (%)"
        FIXED = "fixed", "Fixed Amount"

    class PayFrequency(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        BIWEEKLY = "biweekly", "Bi-weekly"
        WEEKLY = "weekly", "Weekly"

    company = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="payroll_configs"
    )
    # Either employee (individual) or group — not both
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="payroll_config"
    )
    group = models.OneToOneField(
        PayrollGroup,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="payroll_config"
    )

    # ── India: Service Revenue Split ─────────────────────────────────────────
    # When a service booking is ₹1000, the split is applied to distribute it
    employee_share_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=80,
        help_text="% of service revenue paid to employee"
    )
    company_share_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=10,
        help_text="% of service revenue retained by company"
    )
    platform_fee_type = models.CharField(
        max_length=20,
        choices=FeeType.choices,
        default=FeeType.PERCENTAGE
    )
    platform_fee_value = models.DecimalField(
        max_digits=10, decimal_places=2, default=5,
        help_text="Platform fee — either % or fixed amount depending on platform_fee_type"
    )

    # ── India: Statutory Deductions (all toggleable) ─────────────────────────
    pf_enabled = models.BooleanField(default=True, help_text="Provident Fund (12%)")
    pf_pct = models.DecimalField(max_digits=5, decimal_places=2, default=12)

    esi_enabled = models.BooleanField(default=True, help_text="ESI (Employee State Insurance 0.75%)")
    esi_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0.75)

    tds_enabled = models.BooleanField(default=False, help_text="TDS (Tax Deducted at Source)")
    tds_rate = models.DecimalField(max_digits=5, decimal_places=2, default=10)

    # ── US / UK: Hours-based OT customization ────────────────────────────────
    ot_multiplier = models.DecimalField(
        max_digits=4, decimal_places=2, default=1.5,
        help_text="Overtime pay multiplier (e.g. 1.5 = time-and-a-half)"
    )
    daily_ot_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, default=8,
        help_text="Hours per day before daily OT kicks in (US CA/AK)"
    )
    weekly_ot_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, default=40,
        help_text="Hours per week before weekly OT kicks in (US 40h, UK 48h)"
    )

    # ── US / UK: Optional Service Revenue Split ───────────────────────────────
    service_split_enabled = models.BooleanField(
        default=False,
        help_text="Enable service revenue split for US/UK employees too"
    )

    # ── Extra Feature Toggles (JSON) ─────────────────────────────────────────
    # e.g. {"mileage_reimbursement": true, "bonus": false, "advance": true}
    features = models.JSONField(
        default=dict, blank=True,
        help_text="Enable/disable individual payroll features per employee"
    )

    # ── Pay Frequency Override ────────────────────────────────────────────────
    pay_frequency = models.CharField(
        max_length=20,
        choices=PayFrequency.choices,
        null=True, blank=True,
        help_text="Override the company default pay frequency for this employee/group"
    )

    # ── Additional custom deductions/bonuses ─────────────────────────────────
    custom_deductions = models.JSONField(
        default=list, blank=True,
        help_text="[{name, type: 'fixed'|'percentage', value, enabled}]"
    )
    custom_bonuses = models.JSONField(
        default=list, blank=True,
        help_text="[{name, type: 'fixed'|'percentage', value, enabled}]"
    )

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="updated_payroll_configs"
    )

    class Meta:
        constraints = [
            # Each employee can have only ONE individual config
            models.UniqueConstraint(
                fields=["company", "employee"],
                condition=models.Q(employee__isnull=False),
                name="unique_payroll_config_per_employee"
            ),
        ]

    def clean(self):
        if self.employee and self.group:
            raise ValidationError("A config must apply to either an employee or a group — not both.")
        if not self.employee and not self.group:
            raise ValidationError("A config must apply to either an employee or a group.")
        # Ensure split percentages make sense
        total = (self.employee_share_pct or 0) + (self.company_share_pct or 0)
        if self.platform_fee_type == self.FeeType.PERCENTAGE:
            total += (self.platform_fee_value or 0)
        if total > 100:
            raise ValidationError(
                f"Service split total ({total}%) exceeds 100%. "
                "Reduce employee, company or platform fee percentages."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.employee:
            return f"Config for {self.employee.employee_id}"
        elif self.group:
            return f"Config for group '{self.group.name}'"
        return f"Payroll Config #{self.pk}"


class PayrollPeriod(models.Model):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="payroll_periods", null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # Enforce uniqueness at the application level
        filters = {"start_date": self.start_date, "end_date": self.end_date}
        if self.company_id:
            filters["company"] = self.company
        qs = PayrollPeriod.objects.filter(**filters)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("A payroll period with these dates already exists.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.start_date} - {self.end_date}"


class PayrollRecord(models.Model):
    period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="records")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payroll_records")
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="payroll_records", null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)

    regular_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # CA/AK daily OT breakdown
    daily_ot_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    double_time_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    paid_leave_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    unpaid_leave_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # UK PAYE deductions
    uk_income_tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    uk_employee_ni = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    uk_employer_ni = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    uk_tax_code = models.CharField(max_length=20, blank=True, null=True)
    uk_ni_category = models.CharField(max_length=1, blank=True, null=True)

    # Holiday accrual this period (UK WTR)
    holiday_hours_accrued = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    mileage_reimbursement = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    extras = models.JSONField(default=dict, blank=True)

    # Compliance flags
    region = models.CharField(max_length=50, blank=True, null=True)  # e.g. "US FLSA (CA)"
    is_exempt = models.BooleanField(default=False)  # FLSA exempt?
    wage_floor_compliant = models.BooleanField(default=True)

    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="generated_payroll"
    )
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["employee", "generated_at"]),
        ]

    def clean(self):
        # Enforce uniqueness at the application level
        qs = PayrollRecord.objects.filter(period=self.period, employee=self.employee)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError("A payroll record for this employee and period already exists.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee.employee_id} ({self.period})"


class CurrencyMaster(models.Model):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="currencies", null=True, blank=True)
    currency_code = models.CharField(max_length=10)
    currency_symbol = models.CharField(max_length=10)
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=1.0)
    country = models.CharField(max_length=100)
    status = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.currency_code} - {self.country}"


class PayrollRule(models.Model):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="payroll_rules", null=True, blank=True)
    rule_id = models.CharField(max_length=50, blank=True, null=True)
    country = models.CharField(max_length=100)
    currency = models.ForeignKey(CurrencyMaster, on_delete=models.SET_NULL, null=True, blank=True)
    basic_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=40)
    hra_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=20)
    pf_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=12)
    esi_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.75)
    tax_formula = models.TextField(blank=True, null=True)
    pension_formula = models.TextField(blank=True, null=True)
    overtime_formula = models.TextField(blank=True, null=True)
    allowances = models.JSONField(default=dict, blank=True)
    effective_date = models.DateField(null=True, blank=True)
    status = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.country} - {self.rule_id}"


class PayrollGeneration(models.Model):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="payroll_generations", null=True, blank=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payroll_generations")
    payroll_group = models.ForeignKey(
        PayrollGroup,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="payroll_generations",
        help_text="Group this employee was part of when payroll was generated"
    )
    month = models.IntegerField()
    year = models.IntegerField()
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    generated_date = models.DateTimeField(auto_now_add=True)
    breakdown = models.JSONField(default=dict, blank=True)
    # Snapshot of the config used at generation time — for audit trail
    config_snapshot = models.JSONField(
        default=dict, blank=True,
        help_text="Stores the EmployeePayrollConfig values at the time of generation"
    )
    status = models.CharField(max_length=50, default="Generated")

    def __str__(self):
        return f"{self.employee.employee_id} - {self.month}/{self.year}"


# ---------------------------------------------------------------------------
# Organization Payroll Config (Org-level split & deductions)
# ---------------------------------------------------------------------------

class PayrollConfig(models.Model):
    """
    Org-level payroll calculation config for service split and statutory deductions.
    Only one is_active=True PayrollConfig per org is permitted at a time (enforced in service layer).
    """
    class PlatformFeeType(models.TextChoices):
        PERCENTAGE = "PERCENTAGE", "Percentage"
        FIXED = "FIXED", "Fixed Amount"

    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="org_payroll_configs"
    )
    employee_share_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=80.00,
        help_text="% of service revenue paid to employee"
    )
    company_share_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=10.00,
        help_text="% of service revenue retained by company"
    )
    platform_fee_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=5.00,
        help_text="% platform fee"
    )
    platform_fee_type = models.CharField(
        max_length=20,
        choices=PlatformFeeType.choices,
        default=PlatformFeeType.PERCENTAGE
    )
    platform_fee_fixed_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Fixed platform fee amount if platform_fee_type is FIXED"
    )
    pf_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=12.00,
        help_text="PF deduction % from employee share"
    )
    esi_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.75,
        help_text="ESI deduction % from employee share"
    )
    tds_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        help_text="TDS deduction % from employee share"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PayrollConfig #{self.pk} ({self.org}) - Active: {self.is_active}"


# ---------------------------------------------------------------------------
# Settlement Cycle Accounting
# ---------------------------------------------------------------------------

class SettlementCycle(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        PROCESSING = "PROCESSING", "Processing"
        SETTLED = "SETTLED", "Settled"

    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="settlement_cycles"
    )
    cycle_start = models.DateField()
    cycle_end = models.DateField()
    settlement_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"SettlementCycle #{self.pk} ({self.org}) - {self.cycle_start} to {self.cycle_end} [{self.status}]"


# ---------------------------------------------------------------------------
# Bank Account
# ---------------------------------------------------------------------------

class BankAccount(models.Model):
    class VerificationStatus(models.TextChoices):
        UNVERIFIED = "UNVERIFIED", "Unverified"
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        REJECTED = "REJECTED", "Rejected"

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="bank_accounts"
    )
    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="bank_accounts"
    )
    account_number = models.CharField(max_length=100)
    ifsc_code = models.CharField(max_length=20)
    upi_id = models.CharField(max_length=100, null=True, blank=True)
    is_primary = models.BooleanField(default=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_primary", "-created_at"]

    def apply_transition(self, target_status, reason=None):
        allowed_transitions = {
            self.VerificationStatus.PENDING: [self.VerificationStatus.VERIFIED, self.VerificationStatus.REJECTED, self.VerificationStatus.UNVERIFIED],
            self.VerificationStatus.UNVERIFIED: [self.VerificationStatus.PENDING],
            self.VerificationStatus.VERIFIED: [self.VerificationStatus.REJECTED, self.VerificationStatus.UNVERIFIED],
            self.VerificationStatus.REJECTED: [self.VerificationStatus.PENDING, self.VerificationStatus.UNVERIFIED],
        }
        if target_status not in allowed_transitions.get(self.verification_status, []):
            raise ValidationError(
                f"Cannot transition BankAccount #{self.pk} from {self.verification_status} to {target_status}."
            )
        self.verification_status = target_status
        if target_status == self.VerificationStatus.VERIFIED:
            from django.utils import timezone
            self.verified_at = timezone.now()
            self.rejection_reason = None
        elif target_status == self.VerificationStatus.REJECTED:
            self.rejection_reason = reason or "Verification rejected"

    def masked_account_number(self):
        acc = str(self.account_number or "")
        if len(acc) > 4:
            return "*" * (len(acc) - 4) + acc[-4:]
        return acc

    def __str__(self):
        return f"BankAccount ({self.masked_account_number()}) - {self.employee} ({self.verification_status})"


# ---------------------------------------------------------------------------
# KYC Verification Status
# ---------------------------------------------------------------------------

class KYCStatus(models.Model):
    class OverallStatus(models.TextChoices):
        UNVERIFIED = "UNVERIFIED", "Unverified"
        PARTIAL = "PARTIAL", "Partial"
        VERIFIED = "VERIFIED", "Verified"

    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="kyc_status"
    )
    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="kyc_statuses"
    )
    pan_verified = models.BooleanField(default=False)
    aadhaar_verified = models.BooleanField(default=False)
    overall_status = models.CharField(
        max_length=20,
        choices=OverallStatus.choices,
        default=OverallStatus.UNVERIFIED
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"KYCStatus for {self.employee}: {self.overall_status}"


# ---------------------------------------------------------------------------
# Wallet Transaction Ledger
# ---------------------------------------------------------------------------

class WalletTransaction(models.Model):
    """
    Immutable ledger entry for service booking splits credited to employee wallet.
    Snapshots the PayrollConfig active at calculation time.
    State transitions must pass through apply_transition().
    """
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CREDITED = "CREDITED", "Credited"
        REVERSED = "REVERSED", "Reversed"

    class Category(models.TextChoices):
        SERVICE_PAYOUT = "SERVICE_PAYOUT", "Service Payout"
        BONUS = "BONUS", "Bonus"
        INCENTIVE = "INCENTIVE", "Incentive"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="wallet_transactions"
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="wallet_transactions"
    )
    booking = models.ForeignKey(
        'service_requests.ServiceRequest',
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="wallet_transactions"
    )
    payroll_config = models.ForeignKey(
        PayrollConfig,
        on_delete=models.PROTECT,
        related_name="wallet_transactions",
        help_text="Snapshot reference to config active at calculation time"
    )
    category = models.CharField(
        max_length=30,
        choices=Category.choices,
        default=Category.SERVICE_PAYOUT
    )
    settlement_cycle = models.ForeignKey(
        SettlementCycle,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="wallet_transactions"
    )
    gross_amount = models.DecimalField(max_digits=12, decimal_places=2)
    employee_share_amount = models.DecimalField(max_digits=12, decimal_places=2)
    company_share_amount = models.DecimalField(max_digits=12, decimal_places=2)
    platform_fee_amount = models.DecimalField(max_digits=12, decimal_places=2)
    pf_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    esi_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    tds_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    net_credit_amount = models.DecimalField(max_digits=12, decimal_places=2)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    credited_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def apply_transition(self, target_status):
        allowed_transitions = {
            self.Status.PENDING: [self.Status.CREDITED, self.Status.REVERSED],
            self.Status.CREDITED: [self.Status.REVERSED],
            self.Status.REVERSED: [],
        }
        if target_status not in allowed_transitions.get(self.status, []):
            raise ValidationError(
                f"Cannot transition transaction #{self.pk} from {self.status} to {target_status}."
            )
        self.status = target_status

    def __str__(self):
        return f"WalletTransaction #{self.pk} - {self.employee} - ₹{self.net_credit_amount} ({self.status})"


# ---------------------------------------------------------------------------
# Employee Wallet Balance
# ---------------------------------------------------------------------------

class EmployeeWalletBalance(models.Model):
    """
    Denormalized running total wallet balance maintained exclusively by service layer
    when WalletTransactions move to CREDITED and SETTLED.
    """
    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="employee_wallet_balances"
    )
    employee = models.OneToOneField(
        Employee,
        on_delete=models.CASCADE,
        related_name="wallet_balance"
    )
    available_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    pending_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["org", "employee"],
                name="unique_wallet_balance_per_org_employee"
            )
        ]

    @property
    def total_balance(self):
        return (self.available_balance or Decimal("0.00")) + (self.pending_balance or Decimal("0.00"))

    def __str__(self):
        return f"Wallet balance for {self.employee}: Available ₹{self.available_balance}, Pending ₹{self.pending_balance} (Total ₹{self.total_balance})"


# ---------------------------------------------------------------------------
# Payout Dispute
# ---------------------------------------------------------------------------

class PayoutDispute(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_REVIEW = "IN_REVIEW", "In Review"
        RESOLVED = "RESOLVED", "Resolved"

    transaction = models.ForeignKey(
        WalletTransaction,
        on_delete=models.CASCADE,
        related_name="disputes"
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="payout_disputes"
    )
    org = models.ForeignKey(
        'companies.Company',
        on_delete=models.CASCADE,
        related_name="payout_disputes"
    )
    reason = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN
    )
    admin_notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def apply_transition(self, target_status, admin_notes=None):
        allowed_transitions = {
            self.Status.OPEN: [self.Status.IN_REVIEW, self.Status.RESOLVED],
            self.Status.IN_REVIEW: [self.Status.RESOLVED, self.Status.OPEN],
            self.Status.RESOLVED: [],
        }
        if target_status not in allowed_transitions.get(self.status, []):
            raise ValidationError(
                f"Cannot transition dispute #{self.pk} from {self.status} to {target_status}."
            )
        self.status = target_status
        if admin_notes:
            self.admin_notes = admin_notes

    def __str__(self):
        return f"PayoutDispute #{self.pk} for TX #{self.transaction_id} ({self.status})"


