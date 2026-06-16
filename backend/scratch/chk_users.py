import os
import sys
import django

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company, Domain
from django.db import connection

User = get_user_model()

print("--- USERS ---")
for u in User.objects.all():
    comp_info = ""
    if hasattr(u, 'company') and u.company:
        comp_info = f" (Company field: {u.company.schema_name})"
    else:
        comp_info = " (No Company field)"
    print(f"ID: {u.id} | Username: {u.username} | Email: {u.email} | Superuser: {u.is_superuser} | Staff: {u.is_staff}{comp_info}")

print("\n--- COMPANIES ---")
for c in Company.objects.all():
    print(f"ID: {c.id} | Schema: {c.schema_name} | Name: {c.company_name}")
    try:
        users = c.users.all()
        print(f"  Users: {[u.username for u in users]}")
    except Exception as e:
        print(f"  Error reading users relation: {e}")

print("\n--- DOMAINS ---")
for d in Domain.objects.all():
    print(f"ID: {d.id} | Domain: {d.domain} | Tenant: {d.tenant.schema_name} | Primary: {d.is_primary}")
