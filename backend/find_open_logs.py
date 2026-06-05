import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from companies.models import Company
from time_tracking.models import Break, TimeLog
from django_tenants.utils import schema_context

for company in Company.objects.exclude(schema_name='public'):
    try:
        with schema_context(company.schema_name):
            logs = TimeLog.objects.filter(clock_out__isnull=True)
            for log in logs:
                print(f"Company: {company.schema_name}, TimeLog ID: {log.id}, Employee: {log.employee.user.username}, ClockIn: {log.clock_in}")
                breaks = Break.objects.filter(time_log=log, break_end__isnull=True)
                for b in breaks:
                    print(f"  -> Open Break ID: {b.id}, Start: {b.break_start}")
    except Exception as e:
        print(f"Failed on {company.schema_name}: {e}")
