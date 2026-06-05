import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from companies.models import Company
from time_tracking.models import Break
from django_tenants.utils import schema_context

for company in Company.objects.all():
    with schema_context(company.schema_name):
        breaks = Break.objects.filter(break_end__isnull=True)
        for b in breaks:
            print(f"Company: {company.schema_name}, Break ID: {b.id}, Employee: {b.time_log.employee.user.username}, ClockIn: {b.time_log.clock_in}, ClockOut: {b.time_log.clock_out}")

