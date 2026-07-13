import os
import sys
import django

# Add current path to sys.path to find quicktims settings
sys.path.append(os.getcwd())

# Initialize Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from django_tenants.utils import schema_context

def run_tests():
    print("=== STARTING DELETE ACCOUNT API TESTS (WITH SCHEMA CONTEXT) ===")
    
    with schema_context("demo"):
        User = get_user_model()
        
        # 1. Create a dummy employee user for testing self-deletion
        test_emp_email = "test_emp_delete@test.com"
        # Clean up existing if any
        User.objects.filter(email__iexact=test_emp_email).delete()
        
        test_emp = User.objects.create_user(
            username="test_emp_delete",
            email=test_emp_email,
            password="test_password_123",
            role="employee"
        )
        print(f"Created test employee: {test_emp.username} ({test_emp.email})")

        # 2. Create a dummy admin user to act as requester and checking permissions
        test_admin_email = "test_admin_delete@test.com"
        User.objects.filter(email__iexact=test_admin_email).delete()
        test_admin = User.objects.create_user(
            username="test_admin_delete",
            email=test_admin_email,
            password="admin_password_123",
            role="admin"
        )
        print(f"Created test admin: {test_admin.username} ({test_admin.email})")

        factory = APIRequestFactory()
        view = DeleteAccountView.as_view()

        # TEST A: Request missing email or password
        print("\nTEST A: Missing parameters")
        request = factory.post("/api/auth/delete-account/", {}, format="json")
        force_authenticate(request, user=test_emp)
        response = view(request)
        print(f"Status: {response.status_code}, Msg: {response.data}")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Both email and password are required" in response.data["message"]

        # TEST B: Incorrect password
        print("\nTEST B: Incorrect password")
        request = factory.post("/api/auth/delete-account/", {
            "email": test_emp_email,
            "password": "wrong_password"
        }, format="json")
        force_authenticate(request, user=test_emp)
        response = view(request)
        print(f"Status: {response.status_code}, Msg: {response.data}")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Incorrect password" in response.data["message"]

        # TEST C: Attempting to delete an Admin account
        print("\nTEST C: Attempting to delete admin account")
        request = factory.post("/api/auth/delete-account/", {
            "email": test_admin_email,
            "password": "admin_password_123"
        }, format="json")
        force_authenticate(request, user=test_admin)
        response = view(request)
        print(f"Status: {response.status_code}, Msg: {response.data}")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Only employee accounts can be deleted" in response.data["message"]

        # TEST D: Successful deletion by employee (Self-deletion)
        print("\nTEST D: Successful employee self-deletion")
        request = factory.post("/api/auth/delete-account/", {
            "email": test_emp_email,
            "password": "test_password_123"
        }, format="json")
        force_authenticate(request, user=test_emp)
        response = view(request)
        print(f"Status: {response.status_code}, Msg: {response.data}")
        assert response.status_code == status.HTTP_200_OK
        assert not User.objects.filter(email__iexact=test_emp_email).exists()
        print("Employee account successfully deleted and verified gone from DB.")

        # TEST E: Successful deletion of another employee by Admin
        print("\nTEST E: Admin deleting another employee")
        # Re-create the employee
        test_emp2_email = "test_emp2_delete@test.com"
        User.objects.filter(email__iexact=test_emp2_email).delete()
        test_emp2 = User.objects.create_user(
            username="test_emp2_delete",
            email=test_emp2_email,
            password="test_password_456",
            role="employee"
        )
        request = factory.post("/api/auth/delete-account/", {
            "email": test_emp2_email,
            "password": "test_password_456"
        }, format="json")
        force_authenticate(request, user=test_admin)
        response = view(request)
        print(f"Status: {response.status_code}, Msg: {response.data}")
        assert response.status_code == status.HTTP_200_OK
        assert not User.objects.filter(email__iexact=test_emp2_email).exists()
        print("Admin successfully deleted another employee using employee's email and password.")

        # Clean up test accounts
        User.objects.filter(email__iexact=test_admin_email).delete()
        print("\n=== ALL TESTS PASSED SUCCESSFULLY ===")

from accounts.views import DeleteAccountView

if __name__ == "__main__":
    run_tests()
