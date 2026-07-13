import os
import django
import sys
from contextlib import contextmanager
from decimal import Decimal
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee
from rest_framework.exceptions import ValidationError

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

class MockRequest:
    def __init__(self, user, company):
        self.user = user
        self.company = company

def run_tests():
    print("=== STARTING HOURLY RATE ASSIGNMENT RESTRICTION TESTS ===")
    User = get_user_model()
    company = Company.objects.exclude(schema_name="public").first()
    if not company:
        print("[FAIL] No tenant company found.")
        return

    with safe_schema_context(company.schema_name):
        # Clear previous test users and employees
        User.objects.filter(username__in=["admin_a", "admin_b", "emp_a", "emp_b", "admin_super", "emp_new"]).delete()

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
        admin_super = User.objects.create_superuser(
            username="admin_super",
            email="super@test.com",
            password="password123",
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
            hourly_rate=15.00,
            is_active=True
        )
        # Create Employee B and associate with Admin B
        emp_b = Employee.objects.create(
            user=user_emp_b,
            company=company,
            employee_id="EMPB-01",
            invited_by=admin_b,
            hourly_rate=18.00,
            is_active=True
        )

        print("[OK] Test users and employees initialized successfully.")

        from employees.serializers import EmployeeSerializer, EmployeeCreateSerializer

        # Test 3: Admin A updates Employee A (their own invite) -> Should succeed
        print("Test 3: Admin A updates Employee A (own invite)...")
        req_a = MockRequest(admin_a, company)
        serializer_a = EmployeeSerializer(instance=emp_a, data={"hourly_rate": 20.00}, partial=True, context={"request": req_a})
        assert serializer_a.is_valid(), f"Validation failed: {serializer_a.errors}"
        serializer_a.save()
        emp_a.refresh_from_db()
        assert emp_a.hourly_rate == Decimal("20.00"), f"Expected hourly rate to be 20.00, got {emp_a.hourly_rate}"
        print("[OK] Admin A successfully updated Employee A's hourly rate.")

        # Test 4: Admin A tries to update Employee B (not their invite) -> Should fail
        print("Test 4: Admin A updates Employee B (other admin's invite)...")
        serializer_a_b = EmployeeSerializer(instance=emp_b, data={"hourly_rate": 25.00}, partial=True, context={"request": req_a})
        is_valid = serializer_a_b.is_valid()
        if not is_valid:
            print("[OK] Admin A update on Employee B failed validation as expected.")
            assert "hourly_rate" in serializer_a_b.errors, "Expected hourly_rate in errors"
        else:
            try:
                serializer_a_b.save()
                raise AssertionError("Admin A should not be allowed to change Employee B's hourly rate")
            except ValidationError:
                print("[OK] Admin A update on Employee B raised ValidationError as expected.")

        # Test 5: Superuser updates Employee B (not their invite, but superuser bypass) -> Should succeed
        print("Test 5: Superuser updates Employee B...")
        req_super = MockRequest(admin_super, company)
        serializer_super = EmployeeSerializer(instance=emp_b, data={"hourly_rate": 22.00}, partial=True, context={"request": req_super})
        assert serializer_super.is_valid(), f"Validation failed: {serializer_super.errors}"
        serializer_super.save()
        emp_b.refresh_from_db()
        assert emp_b.hourly_rate == Decimal("22.00"), f"Expected hourly rate to be 22.00, got {emp_b.hourly_rate}"
        print("[OK] Superuser successfully updated Employee B's hourly rate.")

        # Test 6: Create new employee via EmployeeCreateSerializer as Admin A -> Should succeed & set invited_by = Admin A
        print("Test 6: Admin A creates a new employee...")
        create_payload = {
            "employee_id": "EMPNEW-01",
            "username": "emp_new",
            "password": "password123",
            "email": "emp_new@test.com",
            "first_name": "New",
            "last_name": "Emp",
            "role": "employee",
            "hourly_rate": 25.00,
        }
        create_serializer = EmployeeCreateSerializer(data=create_payload, context={"request": req_a})
        assert create_serializer.is_valid(), f"Validation failed: {create_serializer.errors}"
        new_emp = create_serializer.save()
        assert new_emp.invited_by == admin_a, "Expected new employee's invited_by to be admin_a"
        assert new_emp.hourly_rate == Decimal("25.00"), "Expected hourly rate to be 25.00"
        print("[OK] Admin A created new employee with correct rate and invited_by set automatically.")

        # Test 7: Admin A tries to modify hourly rate on existing employee B via EmployeeCreateSerializer (re-creation check)
        print("Test 7: Admin A tries to modify hourly rate of existing Employee B via CreateSerializer...")
        update_payload = {
            "employee_id": "EMPB-01",
            "username": "emp_b",
            "password": "password123",
            "hourly_rate": 99.00,
        }
        create_serializer_b = EmployeeCreateSerializer(data=update_payload, context={"request": req_a})
        try:
            # We want to check if create() method raises ValidationError
            if create_serializer_b.is_valid():
                create_serializer_b.save()
                raise AssertionError("Admin A should not be allowed to modify Employee B's hourly rate during create-reassociation")
            else:
                print("[OK] Serializer validation failed as expected on re-creation.")
        except ValidationError:
            print("[OK] Re-creation check raised ValidationError as expected.")

    print("\n=== ALL HOURLY RATE ASSIGNMENT RESTRICTION TESTS PASSED ===")

if __name__ == "__main__":
    run_tests()
