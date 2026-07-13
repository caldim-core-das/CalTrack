import os
import django
import sys
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
from companies.models import Company
from tasks.models import Task

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

def inspect():
    User = get_user_model()
    company = Company.objects.filter(schema_name="caldim_engg").first()
    if not company:
        print("Company caldim_engg not found!")
        return

    print(f"Company: {company.company_name} (Schema: {company.schema_name})")
    with safe_schema_context(company.schema_name):
        print("\n=== USERS ===")
        for u in User.objects.all():
            print(f"User ID: {u.id}, Username: {u.username}, Email: {u.email}, Role: {u.role}")

        print("\n=== TASKS ===")
        for t in Task.objects.all():
            assigned_user = t.assigned_to
            print(f"Task: {t.title}")
            print(f"  Status: {t.status}")
            print(f"  Assigned To: {assigned_user.username if assigned_user else 'None'} (ID: {assigned_user.id if assigned_user else 'None'})")

if __name__ == "__main__":
    inspect()
