"""
Data migration: seed the two supported regions (US and UK).

US  — USD, biweekly payroll, FLSA 40 h/week OT, federal min wage $7.25,
       tax year Jan 1, Sunday week start, no statutory leave.

UK  — GBP, monthly payroll, WTR 48 h/week cap, NI + PAYE,
       28 days statutory leave, tax year Apr 6, Monday week start,
       National Living Wage £11.44/hr (2024–25 rate).
"""
from django.db import migrations


US_REGION = dict(
    code="US",
    name="United States",
    currency="USD",
    currency_symbol="$",
    date_format="MM/DD/YYYY",
    week_start=6,           # Sunday
    overtime_weekly_hours=40,
    max_weekly_hours=40,
    statutory_leave_days=0,
    tax_year_start_month=1,
    tax_year_start_day=1,
    payroll_frequency="biweekly",
    min_wage="7.25",
    national_insurance_enabled=False,
    paye_enabled=False,
    flsa_enabled=True,
    state_tax_enabled=True,
)

UK_REGION = dict(
    code="UK",
    name="United Kingdom",
    currency="GBP",
    currency_symbol="£",
    date_format="DD/MM/YYYY",
    week_start=0,           # Monday
    overtime_weekly_hours=48,
    max_weekly_hours=48,
    statutory_leave_days=28,
    tax_year_start_month=4,
    tax_year_start_day=6,
    payroll_frequency="monthly",
    min_wage="11.44",
    national_insurance_enabled=True,
    paye_enabled=True,
    flsa_enabled=False,
    state_tax_enabled=False,
)


def seed_regions(apps, schema_editor):
    Region = apps.get_model("companies", "Region")
    for data in (US_REGION, UK_REGION):
        Region.objects.update_or_create(code=data["code"], defaults=data)


def unseed_regions(apps, schema_editor):
    Region = apps.get_model("companies", "Region")
    Region.objects.filter(code__in=["US", "UK"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("companies", "0003_region_and_company_region"),
    ]

    operations = [
        migrations.RunPython(seed_regions, reverse_code=unseed_regions),
    ]
