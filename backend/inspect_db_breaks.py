import os, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.contrib.auth import get_user_model
from employees.models import Employee
from time_tracking.models import TimeLog, Break
from django_tenants.utils import schema_context

User = get_user_model()
u = User.objects.get(username='jasminedorathyV')

with schema_context('caldim_5'):
    emp = Employee.objects.get(user=u)
    logs = TimeLog.objects.filter(employee=emp).order_by('-clock_in')[:3]
    for log in logs:
        print('TimeLog:', log.id, 'ClockIn:', log.clock_in, 'ClockOut:', log.clock_out)
        for b in Break.objects.filter(time_log=log):
            print('  Break:', b.id, 'Start:', b.break_start, 'End:', b.break_end)
