import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from companies.models import Company
from time_tracking.models import Break
from django_tenants.utils import schema_context
from django.utils import timezone

for company in Company.objects.exclude(schema_name='public'):
    try:
        with schema_context(company.schema_name):
            breaks = Break.objects.filter(break_end__isnull=True, time_log__clock_out__isnull=False)
            for b in breaks:
                print(f"Closing Break ID {b.id} using TimeLog ClockOut {b.time_log.clock_out}")
                b.break_end = b.time_log.clock_out
                b.save(update_fields=['break_end'])
    except Exception as e:
        pass
