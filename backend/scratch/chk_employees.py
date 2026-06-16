import os
import sys
import django

# Add the parent folder of 'scratch' (which is 'backend') to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from companies.models import Company
from employees.models import Employee

# Get all schemas
schemas = Company.objects.values_list('schema_name', flat=True)
print("Registered schemas:", list(schemas))

for schema in schemas:
    print(f"\n--- Schema: {schema} ---")
    try:
        tenant = Company.objects.get(schema_name=schema)
        connection.set_tenant(tenant)
        emps = Employee.objects.all()
        print(f"Total employees: {emps.count()}")
        for emp in emps:
            # Check if emp has a user relation
            user_info = f"{emp.user.first_name} {emp.user.last_name} ({emp.user.email})" if emp.user else "No User"
            print(f"ID: {emp.id} | Employee ID: {emp.employee_id} | Name: {user_info} | Active: {emp.is_active}")
    except Exception as e:
        print(f"Error reading employees: {e}")
