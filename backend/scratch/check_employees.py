import os
import django
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from employees.models import Employee
from companies.models import Company

def check():
    User = get_user_model()
    print("=== USERS ===")
    for u in User.objects.all():
        print(f"ID: {u.id}, Username: {u.username}, Email: {u.email}, Active: {u.is_active}, Role: {u.role}, Company: {u.company}")
        
    print("\n=== EMPLOYEES ===")
    for e in Employee.objects.all():
        print(f"ID: {e.id}, EmpId: {e.employee_id}, User: {e.user.username if e.user else 'None'}, Active: {e.is_active}, Rate: {e.hourly_rate}, Title: {e.title}, Company: {e.company}")

if __name__ == "__main__":
    check()
