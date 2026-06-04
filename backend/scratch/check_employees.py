import os
import django
from django.db import connection

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from companies.models import Company
from employees.models import Employee

print("--- Employee Records ---")
for company in Company.objects.all():
    if company.schema_name == 'public':
        continue
    connection.set_tenant(company)
    print(f"\nSchema: {company.schema_name} (Company: {company.company_name})")
    employees = Employee.objects.all()
    if not employees.exists():
        print("  (No employees)")
    for emp in employees:
        user = emp.user
        print(f"  - ID: {emp.id}, Emp ID: {emp.employee_id}, Name: {user.first_name if user else 'None'} {user.last_name if user else 'None'}, Username: {user.username if user else 'None'}, Email: {user.email if user else 'None'}, Role: {user.role if user else 'None'}")
