from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee
from tasks.models import Task
from time_tracking.models import TimeLog
from payroll.models import PayrollRecord, PayrollPeriod
from leaves.models import LeaveRequest
from scheduling.models import Shift

User = get_user_model()

print("--- COMPANIES ---")
for c in Company.objects.all():
    print(f"ID: {c.id} | Name: {c.company_name} | Schema: {c.schema_name}")

print("\n--- USERS & THEIR COMPANIES ---")
for u in User.objects.all():
    print(f"Username: {u.username} | Company: {u.company}")

print("\n--- EMPLOYEES ---")
for e in Employee.objects.all():
    print(f"ID: {e.id} | Code: {e.employee_id} | User: {e.user.username} | Title: {e.title} | Company: {e.company}")

print("\n--- TASKS ---")
for t in Task.objects.all():
    print(f"ID: {t.id} | Title: {t.title} | Status: {t.status} | Company: {t.company}")

print("\n--- TIME LOGS ---")
for tl in TimeLog.objects.all():
    print(f"ID: {tl.id} | Employee: {tl.employee.user.username} | Work Date: {tl.work_date} | Clock In: {tl.clock_in} | Clock Out: {tl.clock_out} | Hours: {tl.worked_seconds()/3600 if tl.clock_out else 'running'}")

print("\n--- PAYROLL RECORDS ---")
for pr in PayrollRecord.objects.all():
    print(f"ID: {pr.id} | Employee: {pr.employee.user.username} | Period: {pr.period} | Net Pay: {pr.net_pay} | Gross Pay: {pr.gross_pay}")

print("\n--- LEAVE REQUESTS ---")
for lr in LeaveRequest.objects.all():
    print(f"ID: {lr.id} | User: {lr.employee.user.username} | Status: {lr.status}")

print("\n--- SHIFTS ---")
for s in Shift.objects.all():
    print(f"ID: {s.id} | Employee: {s.employee.user.username if s.employee else 'unassigned'} | Start: {s.shift_start} | End: {s.shift_end}")
