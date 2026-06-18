# backend/trial_management/models.py

from django.db import models
from django.utils import timezone
from datetime import timedelta


class TrialPlan(models.Model):

    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not Started"
        ACTIVE    = "active",    "Active"
        EXPIRED   = "expired",   "Expired"
        CONVERTED = "converted", "Converted"
        CONVERTED_TO_PAID = "converted_to_paid", "Converted To Paid"
        CANCELLED = "cancelled", "Cancelled"

    company = models.OneToOneField(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="trial_plan",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    trial_start = models.DateTimeField(null=True, blank=True)
    trial_end   = models.DateTimeField(null=True, blank=True)
    trial_type  = models.CharField(max_length=50, default="14-day")

    # Idempotent reminder flags
    reminder_10d_sent   = models.BooleanField(default=False)
    reminder_5d_sent    = models.BooleanField(default=False)
    reminder_3d_sent    = models.BooleanField(default=False)
    reminder_1d_sent    = models.BooleanField(default=False)
    expired_email_sent  = models.BooleanField(default=False)

    # Conversion fields
    upgraded_at       = models.DateTimeField(null=True, blank=True)
    subscription_plan = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["trial_end"]),
            models.Index(fields=["company", "status"]),
        ]

    @property
    def days_remaining(self):
        if not self.trial_end:
            return 0
        delta = self.trial_end - timezone.now()
        return max(0, delta.days)

    @property
    def is_active(self):
        return self.status == self.Status.ACTIVE and self.trial_end and timezone.now() < self.trial_end

    @classmethod
    def activate_for_company(cls, company):
        now = timezone.now()
        return cls.objects.create(
            company=company,
            trial_start=now,
            trial_end=now + timedelta(days=14),
        )


class TrialEmailLog(models.Model):
    """Immutable record of every trial-related email sent."""

    MILESTONE_CHOICES = [
        ("activated", "Trial Activated"),
        ("10d",       "10 Days Remaining"),
        ("5d",        "5 Days Remaining"),
        ("3d",        "3 Days Remaining"),
        ("1d",        "1 Day Remaining"),
        ("expired",   "Trial Expired"),
    ]

    trial_plan      = models.ForeignKey(TrialPlan, on_delete=models.CASCADE, related_name="email_logs")
    company_id      = models.IntegerField(db_index=True)
    recipient_email = models.EmailField()
    milestone       = models.CharField(max_length=30, choices=MILESTONE_CHOICES)
    subject         = models.CharField(max_length=300)
    sent_at         = models.DateTimeField(auto_now_add=True)
    success         = models.BooleanField(default=True)
    error_message   = models.TextField(blank=True)

    class Meta:
        ordering = ["-sent_at"]


class TrialAuditLog(models.Model):
    """Immutable event trail."""

    class Event(models.TextChoices):
        TRIAL_STARTED         = "trial_started",          "Trial Started"
        REMINDER_SENT         = "reminder_sent",           "Reminder Sent"
        TRIAL_EXPIRED         = "trial_expired",           "Trial Expired"
        UPGRADE_CLICKED       = "upgrade_clicked",         "Upgrade Clicked"
        SUBSCRIPTION_PURCHASED = "subscription_purchased", "Subscription Purchased"

    trial_plan  = models.ForeignKey(TrialPlan, on_delete=models.CASCADE, related_name="audit_logs")
    company_id  = models.IntegerField(db_index=True)
    actor_id    = models.IntegerField(null=True, blank=True, db_index=True)
    event       = models.CharField(max_length=50, choices=Event.choices)
    metadata    = models.JSONField(null=True, blank=True)
    ip_address  = models.GenericIPAddressField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("TrialAuditLog entries are immutable.")
        super().save(*args, **kwargs)


class TrialNotification(models.Model):
    """In-app notification center entries for trial alerts."""

    class NotificationType(models.TextChoices):
        BANNER    = "banner",    "Trial Banner"
        BELL      = "bell",      "Notification Bell"
        COUNTDOWN = "countdown", "Countdown Alert"

    trial_plan        = models.ForeignKey(TrialPlan, on_delete=models.CASCADE, related_name="notifications")
    company_id        = models.IntegerField(db_index=True)
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices)
    title             = models.CharField(max_length=200)
    body              = models.TextField()
    is_read           = models.BooleanField(default=False)
    expires_at        = models.DateTimeField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["company_id", "is_read"]),
        ]
        ordering = ["-created_at"]
