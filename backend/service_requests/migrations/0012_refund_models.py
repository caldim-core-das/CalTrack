# Migration 0012 — Replace the minimal RefundRequest schema from 0009 with
# the full schema, and add RefundEvidence + RefundInvestigationNote.
#
# The real DB already has service_requests_refundrequest (created in 0009).
# We use SeparateDatabaseAndState so the migration STATE advances to the full
# schema (which 0013 depends on for AlterField), while the DATABASE operations
# safely add only missing columns (idempotent via RunPython).
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def add_missing_columns(apps, schema_editor):
    """Add new RefundRequest columns if they don't already exist (DB-vendor agnostic)."""
    from django.db import connection

    new_columns = [
        ("refund_id",           "VARCHAR(30)"),          # unique index added below
        ("paid_amount",         "DECIMAL(10,2) DEFAULT 0.0"),
        ("refund_type",         "VARCHAR(20) DEFAULT 'FULL'"),
        ("requested_amount",    "DECIMAL(10,2) DEFAULT 0.0"),
        ("approved_amount",     "DECIMAL(10,2)"),
        ("additional_notes",    "TEXT DEFAULT ''"),
        ("internal_notes",      "TEXT DEFAULT ''"),
        ("info_requested_from", "VARCHAR(20)"),
        ("assigned_employee_id","BIGINT"),
        ("customer_id",         "BIGINT"),
    ]

    with connection.cursor() as cursor:
        if connection.vendor == 'sqlite':
            cursor.execute("PRAGMA table_info(service_requests_refundrequest)")
            existing = {row[1] for row in cursor.fetchall()}

            for col_name, col_def in new_columns:
                if col_name not in existing:
                    cursor.execute(
                        f"ALTER TABLE service_requests_refundrequest ADD COLUMN {col_name} {col_def}"
                    )

            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='index' "
                "AND name='idx_refundrequest_refund_id'"
            )
            if not cursor.fetchone():
                cursor.execute(
                    "CREATE UNIQUE INDEX idx_refundrequest_refund_id "
                    "ON service_requests_refundrequest(refund_id) "
                    "WHERE refund_id IS NOT NULL"
                )
        else:
            # PostgreSQL
            for col_name, col_def in new_columns:
                cursor.execute(
                    f"ALTER TABLE service_requests_refundrequest ADD COLUMN IF NOT EXISTS {col_name} {col_def}"
                )
            cursor.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_refundrequest_refund_id "
                "ON service_requests_refundrequest(refund_id) "
                "WHERE refund_id IS NOT NULL"
            )


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0011_alter_employee_payroll_group'),
        ('service_requests', '0011_rename_original_scheduled_at_reschedulerequest_current_date_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── Update migration STATE to the full RefundRequest schema ─────────────
        # (0013 AlterField operations depend on refund_type, reason, status existing)
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='RefundRequest',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('refund_id', models.CharField(blank=True, max_length=30, null=True, unique=True)),
                        ('paid_amount', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                        ('refund_type', models.CharField(
                            choices=[('FULL', 'Full'), ('PARTIAL', 'Partial')],
                            default='FULL',
                            max_length=20,
                        )),
                        ('requested_amount', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                        ('approved_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                        ('reason', models.CharField(
                            choices=[
                                ('POOR_QUALITY', 'Poor Quality Work'),
                                ('SERVICE_NOT_COMPLETED', 'Service Not Completed'),
                                ('CANCELLED_BY_PROVIDER', 'Cancelled By Provider'),
                                ('OVERCHARGED', 'Overcharged'),
                                ('DOUBLE_PAYMENT', 'Double Payment'),
                                ('OTHER', 'Other'),
                            ],
                            default='POOR_QUALITY',
                            max_length=50,
                        )),
                        ('additional_notes', models.TextField(blank=True, default='')),
                        ('internal_notes', models.TextField(blank=True, default='')),
                        ('status', models.CharField(
                            choices=[
                                ('PENDING', 'Pending'),
                                ('INFO_REQUESTED', 'Information Requested'),
                                ('APPROVED_FULL', 'Approved — Full'),
                                ('APPROVED_PARTIAL', 'Approved — Partial'),
                                ('SENT_TO_FINANCE', 'Sent To Finance'),
                                ('REJECTED', 'Rejected'),
                                ('COMPLETED', 'Completed'),
                            ],
                            default='PENDING',
                            max_length=30,
                        )),
                        ('info_requested_from', models.CharField(
                            blank=True,
                            choices=[('CUSTOMER', 'Customer'), ('EMPLOYEE', 'Employee')],
                            max_length=20,
                            null=True,
                        )),
                        ('gateway_reference', models.CharField(blank=True, max_length=200, null=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('updated_at', models.DateTimeField(auto_now=True)),
                        ('assigned_employee', models.ForeignKey(
                            blank=True, null=True,
                            on_delete=django.db.models.deletion.SET_NULL,
                            related_name='assigned_refund_investigations',
                            to='employees.employee',
                        )),
                        ('booking', models.ForeignKey(
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='refund_requests',
                            to='service_requests.servicerequest',
                        )),
                        ('customer', models.ForeignKey(
                            blank=True, null=True,
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='refund_requests',
                            to=settings.AUTH_USER_MODEL,
                        )),
                    ],
                    options={'ordering': ['-created_at']},
                ),
            ],
            # Safely add missing columns to the existing table (SQLite-compatible)
            database_operations=[
                migrations.RunPython(add_missing_columns, reverse_code=migrations.RunPython.noop),
            ],
        ),
        # ── Add the two new models (net-new tables — always safe) ────────────────
        migrations.CreateModel(
            name='RefundEvidence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='refund_evidence/')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('refund_request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='evidence',
                    to='service_requests.refundrequest',
                )),
                ('uploaded_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='RefundInvestigationNote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('explanation', models.TextField()),
                ('work_completed_confirmed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('employee', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to='employees.employee',
                )),
                ('refund_request', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='investigation_notes',
                    to='service_requests.refundrequest',
                )),
            ],
        ),
    ]
