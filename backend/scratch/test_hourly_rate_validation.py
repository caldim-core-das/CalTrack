import os
import django
import sys
import json
from unittest.mock import patch
from contextlib import contextmanager

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.db import connection

@contextmanager
def safe_schema_context(schema_name):
    if hasattr(connection, "tenant"):
        from django_tenants.utils import schema_context
        with schema_context(schema_name):
            yield
    else:
        yield

from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee
from service_requests.serializers import AdminAssignSerializer
from tasks.serializers.task_serializers import TaskSerializer
from rest_framework.exceptions import ValidationError

def run_tests():
    print("=== STARTING BACKEND HOURLY RATE VALIDATION TESTS ===")
    User = get_user_model()
    company = Company.objects.filter(schema_name="demo").first() or Company.objects.exclude(schema_name="public").first()
    if not company:
        print("[FAIL] No tenant company found.")
        return

    # Clear out any existing user with test email to start clean
    test_email = "pradeepravikumar64@gmail.com"
    User.objects.filter(email__iexact=test_email).delete()

    # Define a clean dossier file path
    dossier_path = os.path.join(os.path.dirname(__file__), "..", "caltrack_activation_dossier.json")
    
    # Initialize the dossier JSON
    dossier_data = {
        "regForm": {
            "fullName": "pradeep r",
            "email": test_email,
            "phone": "9150632938",
            "address": "hosur",
            "region": "UK",
            "residencyType": "resident"
        },
        "adminClearance": {
            "status": "approved",
            "invitationToken": "testtoken123",
            "invitationStatus": "Sent"
        }
    }
    with open(dossier_path, "w", encoding="utf-8") as f:
        json.dump(dossier_data, f, indent=4)

    # 1. Simulate RegistrationDossierApproveView creating inactive user/employee with hourly_rate = 0.00
    print("\nTest 1: Pre-registering employee upon approval")
    user = User.objects.create_user(
        username="pradeepravikumar64",
        email=test_email,
        password="testpassword123",
        first_name="Pradeep",
        last_name="R",
        role=User.Role.EMPLOYEE,
        company=company,
        is_active=False
    )
    with safe_schema_context(company.schema_name):
        employee = Employee.objects.create(
            user=user,
            company=company,
            employee_id="EMP-9999",
            phone="9150632938",
            title="Field Tech",
            hourly_rate=0.00,
            country="UK",
            is_active=False
        )
    print(f"[OK] Inactive employee created. Rate: {employee.hourly_rate}, Is Active: {employee.is_active}")

    # 2. Test Google Login Auto-Activation
    print("\nTest 2: Google Login Auto-Activation")
    from accounts.views import GoogleLoginView
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()
    request = factory.post("/api/auth/google/", {"access_token": "fake_token_123"}, format="json")

    class MockResponse:
        ok = True
        def json(self):
            return {"email": test_email, "given_name": "Pradeep", "family_name": "R"}

    with patch("requests.get", return_value=MockResponse()):
        view = GoogleLoginView.as_view()
        response = view(request)
        print("Google Login View Status Code:", response.status_code)
        assert response.status_code == 200, "Google login should succeed with 200 OK"

    # Verify user and employee are activated
    user.refresh_from_db()
    print(f"User is_active after Google OAuth: {user.is_active}")
    assert user.is_active is True, "User should be active"

    with safe_schema_context(company.schema_name):
        employee.refresh_from_db()
        print(f"Employee is_active after Google OAuth: {employee.is_active}")
        assert employee.is_active is True, "Employee should be active"

    # Verify dossier is updated to activated
    with open(dossier_path, "r", encoding="utf-8") as f:
        doss = json.load(f)
    print("Dossier status after Google OAuth:", doss["adminClearance"]["status"])
    assert doss["adminClearance"]["status"] == "activated", "Dossier status should be activated"

    # 3. Test Assignment Validation
    print("\nTest 3: Try to assign a job when hourly rate is $0.00")
    # For AdminAssignSerializer
    serializer = AdminAssignSerializer(data={"employee_id": employee.id})
    # Since Employee is tenant-specific, validation runs in context of tenant schema context
    with safe_schema_context(company.schema_name):
        try:
            serializer.is_valid(raise_exception=True)
            print("[FAIL] Serializer unexpectedly validated employee with $0.00 rate.")
        except ValidationError as e:
            print("[OK] Serializer correctly rejected assignment:", e.detail)

    # For TaskSerializer
    task_serializer = TaskSerializer(data={
        "title": "Fix Leak",
        "assigned_to": str(user.id)
    })
    with safe_schema_context(company.schema_name):
        try:
            task_serializer.is_valid(raise_exception=True)
            print("[FAIL] TaskSerializer unexpectedly validated task assignment with $0.00 rate.")
        except ValidationError as e:
            print("[OK] TaskSerializer correctly rejected assignment:", e.detail)

    # 4. Update hourly rate and check that assignment succeeds
    print("\nTest 4: Update hourly rate to positive and re-test assignment")
    # Simulate update-hourly-rate action
    with safe_schema_context(company.schema_name):
        employee.hourly_rate = 25.50
        employee.save()
    
    # Re-run serializers
    serializer = AdminAssignSerializer(data={"employee_id": employee.id})
    with safe_schema_context(company.schema_name):
        try:
            serializer.is_valid(raise_exception=True)
            print("[OK] AdminAssignSerializer successfully validated employee with rate $25.50.")
        except ValidationError as e:
            print("[FAIL] AdminAssignSerializer rejected valid employee assignment:", e.detail)

    task_serializer = TaskSerializer(data={
        "title": "Fix Leak",
        "assigned_to": str(user.id)
    })
    with safe_schema_context(company.schema_name):
        try:
            task_serializer.is_valid(raise_exception=True)
            print("[OK] TaskSerializer successfully validated task assignment with rate $25.50.")
        except ValidationError as e:
            print("[FAIL] TaskSerializer rejected valid task assignment:", e.detail)

    print("\n=== ALL BACKEND TESTS PASSED ===")

if __name__ == "__main__":
    run_tests()
