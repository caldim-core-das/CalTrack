from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from employees.models import Employee


class PayrollPeriod(models.Model):
    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, related_name="payroll_periods", null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # Enforce uniqueness at the application level (MongoDB doesn't support DB-level constraints)
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
    month = models.IntegerField()
    year = models.IntegerField()
    gross_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    generated_date = models.DateTimeField(auto_now_add=True)
    breakdown = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=50, default="Generated")

    def __str__(self):
        return f"{self.employee.employee_id} - {self.month}/{self.year}"
