from django.db import models
from django_mongodb_backend.fields import ObjectIdAutoField

from employees.models import Employee


class Shift(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="shifts")
    shift_start = models.DateTimeField()
    shift_end = models.DateTimeField()
    title = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["employee", "shift_start"]),
        ]

    def __str__(self):
        return f"{self.employee.employee_id}: {self.shift_start} - {self.shift_end}"
