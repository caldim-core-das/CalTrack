"""
Run with:
  python manage.py shell < create_admin.py

Creates (or resets) an admin user and a demo employee user in the database,
including a linked Employee profile record for the employee user.
"""
import django
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.db import connection
from companies.models import Company
from employees.models import Employee

User = get_user_model()

# Set tenant context to 'demo_v2' for tenant-specific models (Employee)
try:
    tenant = Company.objects.get(schema_name='demo_v2')
    if hasattr(connection, 'set_tenant'):
        connection.set_tenant(tenant)
        print("Set tenant context to 'demo'")
    else:
        print("set_tenant not supported on this database backend, continuing without tenant context setting")
except Company.DoesNotExist:
    print("Demo tenant not found, continuing with public schema (Employee creation may fail)")

from accounts.services import create_organization_admin_user

# ── Admin user ────────────────────────────────────────────────
admin, created = create_organization_admin_user(
    email="admin",
    password="admin123",
    first_name="Admin",
    last_name="User",
    is_superuser=True
)
try:
    if 'tenant' in locals() and tenant:
        admin.company = tenant
        admin.save()
        print(f"Associated admin with company: {tenant.company_name}")
    else:
        company = Company.objects.first()
        if company:
            admin.company = company
            admin.save()
            print(f"Associated admin with company: {company.company_name}")
except Exception as e:
    print(f"Could not associate admin with company: {e}")
print(f"{'Created' if created else 'Updated'} admin  -> username: admin  / password: admin123")

# ── Employee user ─────────────────────────────────────────────
emp_user, created = User.objects.get_or_create(username="employee")
emp_user.set_password("employee123")
emp_user.role = "employee"
emp_user.is_active = True
emp_user.first_name = "Demo"
emp_user.last_name = "Employee"
emp_user.save()
print(f"{'Created' if created else 'Updated'} user   -> username: employee / password: employee123")

# ── Employee profile record ────────────────────────────────────
emp_profile, prof_created = Employee.objects.get_or_create(
    user=emp_user,
    company=tenant,
    defaults={
        "employee_id": "EMP001",
        "phone": "9999999999",
        "title": "Software Engineer",
        "hourly_rate": 20.00,
        "is_active": True,
    }
)
if not prof_created:
    # Ensure key fields are set even if profile already existed
    emp_profile.employee_id = emp_profile.employee_id or "EMP001"
    emp_profile.company = tenant
    emp_profile.is_active = True
    emp_profile.save()
print(f"{'Created' if prof_created else 'Updated'} Employee profile -> employee_id: {emp_profile.employee_id}")

print("\n[OK]  Done – you can now log in with these credentials.")
print("   Admin    -> username: admin    / password: admin123")
print("   Employee -> username: employee / password: employee123")
