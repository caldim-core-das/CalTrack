# Generated for WorkExtension System Phase 0 Migration

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("employees", "0006_employee_bank_details_employee_currency_and_more"),
        ("inventory", "0002_inventory_extensions"),
        ("service_requests", "0008_remove_employeeperformance_issue_resolution_rate_and_more"),
        ("time_tracking", "0006_timelog_tl_status_date_idx_timelog_tl_emp_status_idx"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="employeejob",
            name="service_request",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="employee_jobs",
                to="service_requests.servicerequest",
            ),
        ),
        migrations.AlterField(
            model_name="employeejob",
            name="status",
            field=models.CharField(
                choices=[
                    ("assigned", "Assigned"),
                    ("accepted", "Accepted"),
                    ("on_the_way", "On The Way"),
                    ("in_progress", "In Progress"),
                    ("awaiting_parts", "Awaiting Parts"),
                    ("completed", "Completed"),
                    ("unable_to_complete", "Unable To Complete"),
                    ("rejected", "Rejected"),
                ],
                default="assigned",
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name="employeejob",
            name="is_primary",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="employeejob",
            name="uncompletion_reason",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="WorkExtension",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("requires_specialist", models.BooleanField(default=False)),
                ("required_skill", models.CharField(blank=True, max_length=150, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending_admin_review", "Pending Admin Review"),
                            ("admin_approved", "Admin Approved"),
                            ("admin_rejected", "Admin Rejected"),
                            ("customer_accepted", "Customer Accepted"),
                            ("customer_declined", "Customer Declined"),
                            ("pending_assignment", "Pending Assignment"),
                            ("resolved", "Resolved"),
                        ],
                        default="pending_admin_review",
                        max_length=30,
                    ),
                ),
                ("technician_estimate", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("admin_approved_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("final_customer_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("decision_token", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("token_expires_at", models.DateTimeField(blank=True, null=True)),
                (
                    "decision_channel",
                    models.CharField(
                        blank=True,
                        choices=[("portal", "Customer Portal"), ("phone", "Customer Support Phone")],
                        max_length=15,
                        null=True,
                    ),
                ),
                ("decision_notes", models.TextField(blank=True, default="")),
                ("decision_timestamp", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "decision_recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recorded_work_extension_decisions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "job",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="extensions",
                        to="service_requests.employeejob",
                    ),
                ),
                (
                    "reported_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reported_extensions",
                        to="employees.employee",
                    ),
                ),
                (
                    "service_request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="work_extensions",
                        to="service_requests.servicerequest",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="employeejob",
            name="source_work_extension",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="created_jobs",
                to="service_requests.workextension",
            ),
        ),
        migrations.AddConstraint(
            model_name="employeejob",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_primary", True)),
                fields=("service_request",),
                name="unique_primary_job_per_service_request",
            ),
        ),
        migrations.CreateModel(
            name="WorkExtensionItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("item_name", models.CharField(max_length=255)),
                ("quantity", models.PositiveIntegerField(default=1)),
                (
                    "fulfillment_source",
                    models.CharField(
                        choices=[
                            ("ORGANIZATION_STOCK", "Organization Local Stock"),
                            ("ORGANIZATION_TRANSFER", "Organization Stock Transfer"),
                            ("ORGANIZATION_PROCUREMENT", "Organization Procurement"),
                            ("TECHNICIAN_PURCHASE", "Technician Purchase"),
                            ("CUSTOMER_SUPPLIED", "Customer Supplied"),
                        ],
                        default="ORGANIZATION_STOCK",
                        max_length=30,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Pending"),
                            ("RESERVED", "Reserved"),
                            ("AWAITING_PARTS", "Awaiting Parts"),
                            ("PURCHASE_REQUESTED", "Purchase Requested"),
                            ("PURCHASE_APPROVED", "Purchase Approved"),
                            ("FULFILLED", "Fulfilled"),
                            ("VERIFIED", "Verified"),
                            ("REJECTED", "Rejected"),
                        ],
                        default="PENDING",
                        max_length=25,
                    ),
                ),
                ("billed_to_customer", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("actual_cost", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("technician_reimbursement_amount", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("technician_purchase_approved_limit", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("purchase_receipt", models.FileField(blank=True, null=True, upload_to="service_requests/receipts/")),
                ("verified_by_tech", models.BooleanField(default=False)),
                ("verification_notes", models.TextField(blank=True, default="")),
                ("warranty_covered", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "extension",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="service_requests.workextension",
                    ),
                ),
                (
                    "inventory_item",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="extension_items",
                        to="inventory.inventoryitem",
                    ),
                ),
                (
                    "location",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="extension_item_locations",
                        to="time_tracking.location",
                    ),
                ),
                (
                    "purchase_approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="approved_technician_purchases",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.CreateModel(
            name="JobReschedule",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("old_date", models.DateField()),
                ("new_date", models.DateField()),
                (
                    "reason",
                    models.CharField(
                        choices=[
                            ("parts_unavailable", "Parts Unavailable"),
                            ("technician_unavailable", "Technician Unavailable"),
                            ("customer_requested", "Customer Requested"),
                            ("other", "Other"),
                        ],
                        default="parts_unavailable",
                        max_length=30,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("customer_notified_at", models.DateTimeField(blank=True, null=True)),
                ("customer_confirmed_at", models.DateTimeField(blank=True, null=True)),
                ("delay_count", models.PositiveIntegerField(default=1)),
                ("support_callback_created", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "changed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="job_reschedules",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "job",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="reschedules",
                        to="service_requests.employeejob",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="SupplementalInvoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("invoice_number", models.CharField(max_length=50, unique=True)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                (
                    "status",
                    models.CharField(
                        choices=[("pending", "Pending"), ("paid", "Paid"), ("cancelled", "Cancelled")],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("payment_method", models.CharField(blank=True, default="ONLINE", max_length=20)),
                ("transaction_id", models.CharField(blank=True, max_length=200, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                (
                    "service_request",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="supplemental_invoices",
                        to="service_requests.servicerequest",
                    ),
                ),
                (
                    "work_extension",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="supplemental_invoice",
                        to="service_requests.workextension",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
