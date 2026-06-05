import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from companies.models import Company
from time_tracking.models import Break, TimeLog
from django_tenants.utils import schema_context

for company in Company.objects.exclude(schema_name='public'):
    try:
        with schema_context(company.schema_name):
            breaks = Break.objects.filter(break_end__isnull=True)
            for b in breaks:
                print(f"Company: {company.schema_name}, Break ID: {b.id}, TimeLog ID: {b.time_log.id}, ClockOut: {b.time_log.clock_out}")
    except Exception as e:
        pass
