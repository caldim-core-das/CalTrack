"""
Migration: 0014_reschedule_extended_workflow

Adds extended workflow fields to RescheduleRequest:
- reschedule_id (RS-XXXX format)
- suggested_date / suggested_time_slot (admin slot suggestion)
- rejection_reason / rejection_notes (admin rejection)
- admin_reviewed_by FK
- employee_response / employee_response_note / employee_rejection_reason / employee_responded_at
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("employees", "0001_initial"),
        ("service_requests", "0013_refund_fields_sync"),
    ]

    operations = [
        # Extend RescheduleStatus choices (Django tracks this automatically — no op needed)
        # Add reschedule_id
        migrations.AddField(
            model_name="reschedulerequest",
            name="reschedule_id",
            field=models.CharField(blank=True, max_length=20, null=True, unique=True),
        ),
        # Admin slot suggestion
        migrations.AddField(
            model_name="reschedulerequest",
            name="suggested_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reschedulerequest",
            name="suggested_time_slot",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        # Admin rejection
        migrations.AddField(
            model_name="reschedulerequest",
            name="rejection_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("EMPLOYEE_UNAVAILABLE", "Employee Unavailable"),
                    ("POLICY_VIOLATION", "Policy Violation"),
                    ("OTHER", "Other"),
                ],
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="reschedulerequest",
            name="rejection_notes",
            field=models.TextField(blank=True, default=""),
        ),
        # Admin reviewer FK
        migrations.AddField(
            model_name="reschedulerequest",
            name="admin_reviewed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="admin_reviewed_reschedules",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Employee response
        migrations.AddField(
            model_name="reschedulerequest",
            name="employee_response",
            field=models.CharField(
                blank=True,
                choices=[
                    ("PENDING", "Pending"),
                    ("ACCEPTED", "Accepted"),
                    ("REJECTED", "Rejected"),
                ],
                max_length=10,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="reschedulerequest",
            name="employee_response_note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="reschedulerequest",
            name="employee_rejection_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("ALREADY_ASSIGNED", "Already Assigned"),
                    ("PERSONAL_CONFLICT", "Personal Conflict"),
                    ("OTHER", "Other"),
                ],
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="reschedulerequest",
            name="employee_responded_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Update status field choices to include new statuses
        migrations.AlterField(
            model_name="reschedulerequest",
            name="status",
            field=models.CharField(
                choices=[
                    ("TECHNICIAN_CONFIRMATION", "Technician Confirmation"),
                    ("APPROVED", "Approved"),
                    ("CUSTOMER_NOTIFIED", "Customer Notified"),
                    ("PENDING", "Pending Admin Review"),
                    ("ADMIN_REVIEW", "Admin Review"),
                    ("SLOT_SUGGESTED", "Slot Suggested by Admin"),
                    ("AWAITING_EMPLOYEE_RESPONSE", "Awaiting Employee Response"),
                    ("REASSIGNMENT_NEEDED", "Reassignment Needed"),
                    ("RESCHEDULED", "Rescheduled"),
                    ("REJECTED", "Rejected"),
                    ("CANCELLED", "Cancelled"),
                ],
                default="PENDING",
                max_length=30,
            ),
        ),
    ]
