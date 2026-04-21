from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django_mongodb_backend.fields import ObjectIdAutoField

from employees.models import Employee


class PayrollPeriod(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def clean(self):
        # Enforce uniqueness at the application level (MongoDB doesn't support DB-level constraints)
        qs = PayrollPeriod.objects.filter(start_date=self.start_date, end_date=self.end_date)
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
    id = ObjectIdAutoField(primary_key=True)
    period = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE, related_name="records")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="payroll_records")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2)

    regular_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    overtime_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    paid_leave_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    unpaid_leave_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)

    gross_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay = models.DecimalField(max_digits=12, decimal_places=2, default=0)

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
