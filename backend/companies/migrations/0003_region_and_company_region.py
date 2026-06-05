"""
Migration: Add Region model and Company.region FK.

Region stores UK/US compliance rules (currency, leave entitlements,
payroll frequency, tax year, WTR/FLSA flags, minimum wage).
Company.region is auto-derived from primary_country on save.
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0002_company_shift_enforcement_mode"),
    ]

    operations = [
        # 1. Create Region table
        migrations.CreateModel(
            name="Region",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(
                    choices=[("US", "United States"), ("UK", "United Kingdom")],
                    max_length=2,
                    unique=True,
                )),
                ("name", models.CharField(max_length=100)),
                ("currency", models.CharField(max_length=3)),
                ("currency_symbol", models.CharField(max_length=5)),
                ("date_format", models.CharField(default="MM/DD/YYYY", max_length=20)),
                ("week_start", models.IntegerField(default=0)),
                ("overtime_weekly_hours", models.PositiveIntegerField(default=40)),
                ("max_weekly_hours", models.PositiveIntegerField(default=40)),
                ("statutory_leave_days", models.PositiveIntegerField(default=0)),
                ("tax_year_start_month", models.IntegerField(default=1)),
                ("tax_year_start_day", models.IntegerField(default=1)),
                ("payroll_frequency", models.CharField(default="biweekly", max_length=20)),
                ("min_wage", models.DecimalField(decimal_places=2, default=0, max_digits=7)),
                ("national_insurance_enabled", models.BooleanField(default=False)),
                ("paye_enabled", models.BooleanField(default=False)),
                ("flsa_enabled", models.BooleanField(default=False)),
                ("state_tax_enabled", models.BooleanField(default=False)),
            ],
            options={"ordering": ["code"]},
        ),

        # 2. Add FK on Company
        migrations.AddField(
            model_name="company",
            name="region",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="companies",
                to="companies.region",
            ),
        ),
    ]
