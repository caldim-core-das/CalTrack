# Generated manually — creates RefundRequest, RefundEvidence, RefundInvestigationNote
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('employees', '0011_alter_employee_payroll_group'),
        ('service_requests', '0011_rename_original_scheduled_at_reschedulerequest_current_date_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
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
                    blank=True,
                    null=True,
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
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='refund_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
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
