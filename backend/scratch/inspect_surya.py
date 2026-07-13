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
from employees.models import Employee

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
    companies = Company.objects.all()
    print("=== INSPECTING EMPLOYEES ACROSS TENANTS ===")
    for company in companies:
        if company.schema_name == "public":
            continue
        print(f"\nCompany: {company.company_name} (Schema: {company.schema_name})")
        with safe_schema_context(company.schema_name):
            employees = Employee.objects.all()
            for emp in employees:
                print(f"  Employee ID: {emp.employee_id}")
                print(f"    User: {emp.user.username} (Email: {emp.user.email})")
                print(f"    Role: {emp.user.role}")
                print(f"    Is Active (User): {emp.user.is_active}")
                print(f"    Is Active (Employee): {emp.is_active}")
                print(f"    Invited By: {emp.invited_by.username if emp.invited_by else 'None'}")
                print(f"    Hourly Rate: {emp.hourly_rate}")
                print(f"    Is Online: {emp.is_online}")
                print(f"    Presence Availability: {emp.current_availability}")

if __name__ == "__main__":
    inspect()
