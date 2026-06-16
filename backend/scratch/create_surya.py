import os
import sys
import django

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from companies.models import Company
from employees.models import Employee
from django.contrib.auth import get_user_model

User = get_user_model()

# Set tenant context to 'demo'
tenant = Company.objects.get(schema_name='demo')
connection.set_tenant(tenant)
print("Using schema 'demo'")

# Payload parameters
email = "ssss@gmail.com"
username = "ssss"
first_name = "surya"
last_name = "—"
employee_id = "EMP-2048"

# Check if user exists
from django.db.models import Q
user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=email)).first()

if user:
    print(f"Found existing user: {user.username} (ID: {user.id})")
    user.company = tenant
    user.first_name = first_name
    user.last_name = last_name
    user.save()
else:
    print("Creating new user...")
    user = User.objects.create_user(
        username=username,
        password="TemporaryPassword123!",
        email=email,
        first_name=first_name,
        last_name=last_name,
        role="employee",
        company=tenant
    )

employee, created = Employee.objects.get_or_create(
    user=user,
    company=tenant,
    defaults={
        "employee_id": employee_id,
        "title": "Field Operations Tech (L2)",
        "hourly_rate": 18.50,
        "country": "IN",
        "is_active": True
    }
)

if created:
    print(f"Successfully created Employee profile for {user.username} (Employee ID: {employee.employee_id})")
else:
    print(f"Employee profile already exists for {user.username}")
    employee.employee_id = employee_id
    employee.title = "Field Operations Tech (L2)"
    employee.hourly_rate = 18.50
    employee.country = "IN"
    employee.is_active = True
    employee.save()
    print("Updated existing Employee profile.")
