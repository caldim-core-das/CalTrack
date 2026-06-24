import os
import django
import sys
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
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

def run_verification():
    print("=== STARTING EMPLOYEE VISIBILITY RESTRICTION TESTS ===")
    User = get_user_model()
    company = Company.objects.exclude(schema_name="public").first()
    if not company:
        print("[FAIL] No tenant company found.")
        return

    with safe_schema_context(company.schema_name):
        # Clear previous test users and employees
        User.objects.filter(username__in=["admin_a", "admin_b", "emp_a", "emp_b", "admin_super"]).delete()

        # 1. Create two admins (Admin A, Admin B)
        admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@test.com",
            password="password123",
            role=User.Role.ADMIN,
            company=company
        )
        admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@test.com",
            password="password123",
            role=User.Role.ADMIN,
            company=company
        )

        # 2. Create two employees
        user_emp_a = User.objects.create_user(
            username="emp_a",
            email="emp_a@test.com",
            password="password123",
            role=User.Role.EMPLOYEE,
            company=company
        )
        user_emp_b = User.objects.create_user(
            username="emp_b",
            email="emp_b@test.com",
            password="password123",
            role=User.Role.EMPLOYEE,
            company=company
        )

        # Create Employee A and associate with Admin A
        emp_a = Employee.objects.create(
            user=user_emp_a,
            company=company,
            employee_id="EMPA-01",
            invited_by=admin_a,
            is_active=True
        )
        # Create Employee B and associate with Admin B
        emp_b = Employee.objects.create(
            user=user_emp_b,
            company=company,
            employee_id="EMPB-01",
            invited_by=admin_b,
            is_active=True
        )

        print("[OK] Test users and employees created successfully.")

        # Test 3: Verify EmployeeViewSet.get_queryset equivalent for Admin A
        # Let's mock a request object with user = admin_a
        class MockRequest:
            def __init__(self, user, company):
                self.user = user
                self.company = company

        from employees.views import EmployeeViewSet
        view = EmployeeViewSet()
        
        # Test Admin A
        view.request = MockRequest(admin_a, company)
        qs_a = view.get_queryset()
        print(f"Admin A sees {qs_a.count()} employees: {[e.user.username for e in qs_a]}")
        assert qs_a.count() == 1, "Admin A should see exactly 1 employee"
        assert qs_a.first().id == emp_a.id, "Admin A should see Employee A"

        # Test Admin B
        view.request = MockRequest(admin_b, company)
        qs_b = view.get_queryset()
        print(f"Admin B sees {qs_b.count()} employees: {[e.user.username for e in qs_b]}")
        assert qs_b.count() == 1, "Admin B should see exactly 1 employee"
        assert qs_b.first().id == emp_b.id, "Admin B should see Employee B"

        # Test Superuser (who is also an admin but has is_superuser = True)
        superuser = User.objects.create_superuser(
            username="admin_super",
            email="super@test.com",
            password="password123",
            company=company
        )
        view.request = MockRequest(superuser, company)
        qs_super = view.get_queryset()
        print(f"Superuser sees {qs_super.count()} employees: {[e.user.username for e in qs_super]}")
        assert qs_super.count() >= 2, "Superuser should see both employees"

        # Test 4: Verify AdminAvailableEmployeesView queryset filtering
        from tasks.views.task_views import AdminAvailableEmployeesView
        from rest_framework.test import APIRequestFactory
        from rest_framework.test import force_authenticate

        factory = APIRequestFactory()
        task_view = AdminAvailableEmployeesView.as_view()

        # Admin A Request
        req_a = factory.get("/api/tasks/admin/available-employees/")
        force_authenticate(req_a, user=admin_a)
        req_a.company = company
        res_a = task_view(req_a)
        print("Admin A available employees API returned:", len(res_a.data))
        assert len(res_a.data) == 1, "Admin A available employees should be 1"
        assert res_a.data[0]['user']['username'] == "emp_a", "Admin A should see emp_a"

        # Admin B Request
        req_b = factory.get("/api/tasks/admin/available-employees/")
        force_authenticate(req_b, user=admin_b)
        req_b.company = company
        res_b = task_view(req_b)
        print("Admin B available employees API returned:", len(res_b.data))
        assert len(res_b.data) == 1, "Admin B available employees should be 1"
        assert res_b.data[0]['user']['username'] == "emp_b", "Admin B should see emp_b"

    print("\n=== ALL EMPLOYEE VISIBILITY RESTRICTION TESTS PASSED ===")

if __name__ == "__main__":
    run_verification()
