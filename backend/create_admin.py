"""
Run with:
  python manage.py shell < create_admin.py

Creates (or resets) an admin user and a demo employee user in MongoDB,
including a linked Employee profile record for the employee user.
"""
import django
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from employees.models import Employee

User = get_user_model()

# ── Admin user ────────────────────────────────────────────────
admin, created = User.objects.get_or_create(username="admin")
admin.set_password("admin123")
admin.role = "admin"
admin.is_staff = True
admin.is_superuser = True
admin.is_active = True
admin.first_name = "Admin"
admin.last_name = "User"
admin.save()
print(f"{'Created' if created else 'Updated'} admin  → username: admin  / password: admin123")

# ── Employee user ─────────────────────────────────────────────
emp_user, created = User.objects.get_or_create(username="employee")
emp_user.set_password("employee123")
emp_user.role = "employee"
emp_user.is_active = True
emp_user.first_name = "Demo"
emp_user.last_name = "Employee"
emp_user.save()
print(f"{'Created' if created else 'Updated'} user   → username: employee / password: employee123")

# ── Employee profile record ────────────────────────────────────
emp_profile, prof_created = Employee.objects.get_or_create(
    user=emp_user,
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
    emp_profile.is_active = True
    emp_profile.save()
print(f"{'Created' if prof_created else 'Updated'} Employee profile → employee_id: {emp_profile.employee_id}")

print("\n✅  Done – you can now log in with these credentials.")
print("   Admin    → username: admin    / password: admin123")
print("   Employee → username: employee / password: employee123")
