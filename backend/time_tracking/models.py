from django.db import models
from django_mongodb_backend.fields import ObjectIdAutoField

from employees.models import Employee


class JobSite(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    organization = models.ForeignKey('accounts.Organization', on_delete=models.CASCADE, related_name="job_sites")
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    lat = models.DecimalField(max_digits=9, decimal_places=6)
    lng = models.DecimalField(max_digits=9, decimal_places=6)
    geofence_radius = models.PositiveIntegerField(null=True, blank=True)  # override org default

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class TimeLog(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="time_logs")
    work_date = models.DateField(db_index=True)
    clock_in = models.DateTimeField()
    clock_in_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_in_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_in_address = models.TextField(blank=True)
    clock_in_notes = models.TextField(blank=True)
    clock_in_photo = models.ImageField(upload_to="time_logs/photos/", null=True, blank=True)

    clock_out = models.DateTimeField(null=True, blank=True)
    clock_out_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_lon = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    clock_out_address = models.TextField(blank=True)
    clock_out_notes = models.TextField(blank=True)
    clock_out_photo = models.ImageField(upload_to="time_logs/photos/", null=True, blank=True)

    # Geofencing
    distance_from_site_meters = models.IntegerField(null=True, blank=True)
    geofence_passed = models.BooleanField(default=False)
    admin_override_used = models.BooleanField(default=False)

    # Approval Workflow
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name="approved_logs")
    admin_notes = models.TextField(blank=True) # Reason for rejection or manual correction info
    
    # Correction fields (if admin edits hours)
    # Face Verification
    FACE_MATCH_CHOICES = [
        ('pending', 'Pending'),
        ('matched', 'Matched'),
        ('mismatch', 'Mismatch'),
        ('skipped', 'Skipped'),
    ]
    face_match_status = models.CharField(max_length=20, choices=FACE_MATCH_CHOICES, default='pending')
    face_match_score = models.FloatField(null=True, blank=True)

    manual_hours_correction = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["employee", "work_date"]),
        ]

    @property
    def is_open(self) -> bool:
        return self.clock_out is None

    def break_seconds(self) -> int:
        total = 0
        for b in self.breaks.all():
            if b.break_end:
                total += int((b.break_end - b.break_start).total_seconds())
        return total

    def worked_seconds(self) -> int:
        if not self.clock_out:
            return 0
        raw = int((self.clock_out - self.clock_in).total_seconds())
        return max(0, raw - self.break_seconds())


class Break(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name="breaks")
    break_start = models.DateTimeField()
    break_end = models.DateTimeField(null=True, blank=True)

    BREAK_TYPES = [
        ("lunch", "Lunch"),
        ("short", "Short"),
        ("personal", "Personal"),
    ]
    break_type = models.CharField(max_length=20, choices=BREAK_TYPES, default="lunch")

    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_open(self) -> bool:
        return self.break_end is None


class TimeLogPhoto(models.Model):
    id = ObjectIdAutoField(primary_key=True)
    time_log = models.ForeignKey(TimeLog, on_delete=models.CASCADE, related_name="photos")
    photo = models.ImageField(upload_to="job_photos/")
    photo_type = models.CharField(max_length=20, choices=[
        ("before", "Before"),
        ("after", "After"), 
        ("progress", "Progress"),
    ])
    caption = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)


class Location(models.Model):
    """Saved locations from Settings > Locations (separate collection from JobSite)."""
    id = ObjectIdAutoField(primary_key=True)
    organization = models.ForeignKey(
        'accounts.Organization', on_delete=models.CASCADE,
        related_name="saved_locations", null=True, blank=True
    )
    name = models.CharField(max_length=255)
    address = models.TextField(blank=True)
    lat = models.FloatField()
    lng = models.FloatField()
    geofence_radius = models.PositiveIntegerField(default=300)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

