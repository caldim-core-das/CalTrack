"""
Docker Seed Script - QuickTIMS
===============================
Creates the public tenant, a demo company tenant, an admin user,
and a demo employee user - all against the local Docker PostgreSQL.

Run from backend/:
  python seed_docker.py

Credentials after running:
  Admin    -> username: admin@caltrack.com  / password: Admin@1234
  Employee -> username: emp@caltrack.com    / password: Emp@1234
"""

import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company, Domain
from employees.models import Employee
from django_tenants.utils import schema_context

User = get_user_model()


def separator(title):
    print(f"\n{'=' * 55}")
    print(f"  {title}")
    print(f"{'=' * 55}")


# == Step 1: Public tenant =====================================================
separator("Step 1: Public tenant")

public_tenant, created = Company.objects.get_or_create(
    schema_name="public",
    defaults={"company_name": "Public Tenant"},
)
Domain.objects.get_or_create(
    domain="localhost",
    tenant=public_tenant,
    defaults={"is_primary": True},
)
print(f"  [{'CREATED' if created else 'EXISTS '}] Public tenant -> domain: localhost")


# == Step 2: Demo company tenant ===============================================
separator("Step 2: Demo company tenant")

demo_company, created = Company.objects.get_or_create(
    schema_name="demo",
    defaults={"company_name": "Caldim Demo Co."},
)
if created:
    Domain.objects.create(
        domain="demo.localhost",
        tenant=demo_company,
        is_primary=True,
    )
print(f"  [{'CREATED' if created else 'EXISTS '}] Demo company -> schema: demo | domain: demo.localhost")


# == Step 3: Admin user (public schema) =======================================
separator("Step 3: Admin user")

admin_email = "admin@caltrack.com"
admin_password = "Admin@1234"

admin_user, created = User.objects.get_or_create(
    username=admin_email,
    defaults={
        "email": admin_email,
        "first_name": "Super",
        "last_name": "Admin",
        "role": "admin",
        "is_staff": True,
        "is_superuser": True,
        "is_active": True,
        "company": demo_company,
    },
)
# Always reset password so we know it for sure
admin_user.set_password(admin_password)
admin_user.role = "admin"
admin_user.is_staff = True
admin_user.is_superuser = True
admin_user.is_active = True
admin_user.save()
print(f"  [{'CREATED' if created else 'RESET  '}] Admin user -> {admin_email}")


# == Step 4: Employee user + profile (demo schema) ============================
separator("Step 4: Employee user + profile")

emp_email = "emp@caltrack.com"
emp_password = "Emp@1234"

with schema_context("demo"):
    emp_user, created = User.objects.get_or_create(
        username=emp_email,
        defaults={
            "email": emp_email,
            "first_name": "Demo",
            "last_name": "Employee",
            "role": "employee",
            "is_active": True,
            "company": demo_company,
        },
    )
    emp_user.set_password(emp_password)
    emp_user.role = "employee"
    emp_user.is_active = True
    emp_user.save()
    print(f"  [{'CREATED' if created else 'RESET  '}] Employee user -> {emp_email}")

    emp_profile, prof_created = Employee.objects.get_or_create(
        user=emp_user,
        defaults={
            "employee_id": "EMP001",
            "title": "Field Engineer",
            "phone": "9876543210",
            "hourly_rate": 25.00,
            "company": demo_company,
            "is_active": True,
        },
    )
    if not prof_created:
        emp_profile.is_active = True
        emp_profile.save()
    print(f"  [{'CREATED' if prof_created else 'EXISTS '}] Employee profile -> ID: {emp_profile.employee_id}")


# == Summary ==================================================================
separator("[DONE] Seeding complete!")
print()
print("  +--------------------------------------------------+")
print("  |          DOCKER LOGIN CREDENTIALS               |")
print("  +--------------------------------------------------+")
print("  | Role     | Username              | Password     |")
print("  +----------+-----------------------+--------------+")
print(f"  | Admin    | {admin_email:<21} | {admin_password:<12} |")
print(f"  | Employee | {emp_email:<21} | {emp_password:<12} |")
print("  +----------+-----------------------+--------------+")
print()
print("  Login endpoint: POST http://localhost:8000/api/auth/login/")
print('  Body: { "username": "admin@caltrack.com", "password": "Admin@1234" }')
print()
