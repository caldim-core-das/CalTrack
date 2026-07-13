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
from employees.models import Employee

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

def find_data():
    companies = Company.objects.all()
    for company in companies:
        if company.schema_name == "public":
            continue
        with safe_schema_context(company.schema_name):
            # Check for task
            tasks = Task.objects.filter(title__icontains="ac6")
            if tasks.exists():
                print(f"[FOUND TASK] Schema: {company.schema_name}")
                for t in tasks:
                    print(f"  Task: {t.title}, Assigned To: {t.assigned_to.username if t.assigned_to else 'None'}")
            
            # Check for user suryars
            users = get_user_model().objects.filter(username__icontains="suryars")
            if users.exists():
                print(f"[FOUND USER] Schema: {company.schema_name}")
                for u in users:
                    print(f"  User: {u.username}, Email: {u.email}")

if __name__ == "__main__":
    find_data()
