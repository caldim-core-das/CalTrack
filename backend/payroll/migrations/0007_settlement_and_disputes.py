from django.db import migrations, models
import django.db.models.deletion


def move_total_to_pending(apps, schema_editor):
    EmployeeWalletBalance = apps.get_model('payroll', 'EmployeeWalletBalance')
    for balance in EmployeeWalletBalance.objects.all():
        balance.pending_balance = balance.total_balance
        balance.save()


class Migration(migrations.Migration):

    dependencies = [
        ('companies', '0001_initial'),
        ('employees', '0001_initial'),
        ('payroll', '0006_payrollconfig_wallettransaction_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SettlementCycle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('cycle_start', models.DateField()),
                ('cycle_end', models.DateField()),
                ('settlement_date', models.DateField()),
                ('status', models.CharField(choices=[('OPEN', 'Open'), ('PROCESSING', 'Processing'), ('SETTLED', 'Settled')], default='OPEN', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('org', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='settlement_cycles', to='companies.company')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='wallettransaction',
            name='category',
            field=models.CharField(choices=[('SERVICE_PAYOUT', 'Service Payout'), ('BONUS', 'Bonus'), ('INCENTIVE', 'Incentive'), ('ADJUSTMENT', 'Adjustment')], default='SERVICE_PAYOUT', max_length=30),
        ),
        migrations.AddField(
            model_name='wallettransaction',
            name='settlement_cycle',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_transactions', to='payroll.settlementcycle'),
        ),
        migrations.AddField(
            model_name='employeewalletbalance',
            name='available_balance',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.AddField(
            model_name='employeewalletbalance',
            name='pending_balance',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.RunPython(move_total_to_pending, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='employeewalletbalance',
            name='total_balance',
        ),
        migrations.CreateModel(
            name='BankAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('account_number', models.CharField(max_length=100)),
                ('ifsc_code', models.CharField(max_length=20)),
                ('upi_id', models.CharField(blank=True, max_length=100, null=True)),
                ('is_primary', models.BooleanField(default=True)),
                ('verification_status', models.CharField(choices=[('UNVERIFIED', 'Unverified'), ('PENDING', 'Pending'), ('VERIFIED', 'Verified'), ('REJECTED', 'Rejected')], default='PENDING', max_length=20)),
                ('verified_at', models.DateTimeField(blank=True, null=True)),
                ('rejection_reason', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bank_accounts', to='employees.employee')),
                ('org', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bank_accounts', to='companies.company')),
            ],
            options={
                'ordering': ['-is_primary', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='KYCStatus',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pan_verified', models.BooleanField(default=False)),
                ('aadhaar_verified', models.BooleanField(default=False)),
                ('overall_status', models.CharField(choices=[('UNVERIFIED', 'Unverified'), ('PARTIAL', 'Partial'), ('VERIFIED', 'Verified')], default='UNVERIFIED', max_length=20)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='kyc_status', to='employees.employee')),
                ('org', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kyc_statuses', to='companies.company')),
            ],
        ),
        migrations.CreateModel(
            name='PayoutDispute',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('reason', models.TextField()),
                ('status', models.CharField(choices=[('OPEN', 'Open'), ('IN_REVIEW', 'In Review'), ('RESOLVED', 'Resolved')], default='OPEN', max_length=20)),
                ('admin_notes', models.TextField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payout_disputes', to='employees.employee')),
                ('org', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payout_disputes', to='companies.company')),
                ('transaction', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='disputes', to='payroll.wallettransaction')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
