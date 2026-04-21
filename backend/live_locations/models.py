from django.db import models
from django_mongodb_backend.fields import ObjectIdAutoField
from employees.models import Employee
from time_tracking.models import TimeLog

class EmployeeLocation(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="locations")
    time_log = models.ForeignKey(TimeLog, on_delete=models.SET_NULL, null=True, blank=True, related_name="locations")
    
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['employee', 'timestamp']),
            models.Index(fields=['time_log']),
        ]

    def __str__(self):
        return f"{self.employee} at {self.timestamp}"
