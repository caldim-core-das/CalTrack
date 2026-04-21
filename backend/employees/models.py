from django.conf import settings
from django.db import models
from django_mongodb_backend.fields import ObjectIdAutoField


class Employee(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="employee_profile")
    employee_id = models.CharField(max_length=50, unique=True)
    phone = models.CharField(max_length=30, blank=True)
    title = models.CharField(max_length=100, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    hire_date = models.DateField(null=True, blank=True)
    assigned_job_site = models.ForeignKey('time_tracking.JobSite', on_delete=models.SET_NULL, null=True, blank=True, related_name="employees")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.employee_id} - {self.user.get_full_name() or self.user.username}"
