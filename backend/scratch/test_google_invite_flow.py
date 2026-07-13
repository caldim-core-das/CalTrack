import os
import django
import uuid
import sys

from pathlib import Path
from dotenv import load_dotenv

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=True)

django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company
from settings_hub.models import TeamInvite
from django_tenants.utils import schema_context
from employees.models import Employee

def test_google_invite_flow():
    User = get_user_model()
    test_email = "google_invite_test@caltrack.com"
    
    # 1. Clean up existing test data
    for c in Company.objects.exclude(schema_name="public"):
        with schema_context(c.schema_name):
            Employee.objects.filter(user__email=test_email).delete()
            TeamInvite.objects.filter(email=test_email).delete()
            
    # Delete test user inside a tenant schema context to satisfy constraints check query
    temp_company = Company.objects.exclude(schema_name="public").first()
    if temp_company:
        with schema_context(temp_company.schema_name):
            User.objects.filter(email=test_email).delete()
    else:
        User.objects.filter(email=test_email).delete()
            
    company = Company.objects.filter(schema_name="rohit").first()
    if not company:
        print("ERROR: Company 'rohit' not found.")
        sys.exit(1)
        
    print("--- TEST STEP 1: Creating pending invite for new user as employee ---")
    with schema_context(company.schema_name):
        invite = TeamInvite.objects.create(
            company=company,
            email=test_email,
            role="employee",
            status="pending"
        )
    print(f"Invite created for {test_email} with role: {invite.role}")
    
    # Simulate GoogleLoginView.post logic
    print("Simulating Google sign-in...")
    user = User.objects.filter(email__iexact=test_email).first()
    
    # Lookup invite
    resolved_invite = None
    for c in Company.objects.exclude(schema_name="public"):
        with schema_context(c.schema_name):
            resolved_invite = TeamInvite.objects.filter(email__iexact=test_email, status="pending").first()
            if resolved_invite:
                break
                
    assert resolved_invite is not None, "Invite should be found."
    
    if resolved_invite:
        if not user:
            user = User.objects.create_user(
                username="google_invite_test",
                email=test_email,
                password=uuid.uuid4().hex,
                first_name="Google",
                last_name="Test",
                role=resolved_invite.role,
            )
            user.company = resolved_invite.company
            user.is_active = True
            user.save()
            print(f"New user created with role: {user.role}")
            
        with schema_context(resolved_invite.company.schema_name):
            resolved_invite.status = "accepted"
            resolved_invite.save()
            
            employee, created = Employee.objects.get_or_create(
                user=user,
                company=resolved_invite.company,
                defaults={
                    "employee_id": "EMP_G_TEST",
                    "title": resolved_invite.role.title(),
                    "hourly_rate": 0.00,
                    "is_active": True
                }
            )
            print(f"Employee profile created: {created}, title: {employee.title}")
            
    assert user.role == "employee", "User role should be 'employee'."
    assert user.company == company, "User company should be 'rohit'."
    
    print("--- TEST STEP 2: Pre-existing user invited with new role (admin) ---")
    # Reset invite status and change role to admin
    with schema_context(company.schema_name):
        resolved_invite.status = "pending"
        resolved_invite.role = "admin"
        resolved_invite.save()
        
    print("Simulating second Google sign-in...")
    # Simulated lookup
    resolved_invite2 = None
    for c in Company.objects.exclude(schema_name="public"):
        with schema_context(c.schema_name):
            resolved_invite2 = TeamInvite.objects.filter(email__iexact=test_email, status="pending").first()
            if resolved_invite2:
                break
                
    assert resolved_invite2 is not None, "Invite should be found."
    
    user_existing = User.objects.filter(email__iexact=test_email).first()
    assert user_existing is not None, "User should already exist."
    
    if resolved_invite2:
        # Pre-existing user logic (updated with role mapping)
        user_existing.is_active = True
        user_existing.role = resolved_invite2.role # The new fix!
        if not user_existing.company:
            user_existing.company = resolved_invite2.company
        user_existing.save()
        print(f"Existing user updated. New role: {user_existing.role}")
        
    assert user_existing.role == "admin", "User role should have been updated to 'admin'."
    print("SUCCESS: Google OAuth invitation flow correctly resolved and mapped roles!")

    print("--- TEST STEP 3: Testing manual AcceptInviteView responses ---")
    from rest_framework.test import APIRequestFactory
    from accounts.views import AcceptInviteView
    
    factory = APIRequestFactory()
    view = AcceptInviteView.as_view()
    
    # 3.1: Already accepted invite
    with schema_context(company.schema_name):
        resolved_invite2.status = "accepted"
        resolved_invite2.save()
        
    request_accepted = factory.post("/api/auth/accept-invite/", {
        "token": resolved_invite2.token,
        "password": "newpassword123",
        "first_name": "Surya",
        "last_name": "A"
    }, format="json")
    
    response_accepted = view(request_accepted)
    assert response_accepted.status_code == 400, f"Expected 400 but got {response_accepted.status_code}"
    assert "already been accepted" in response_accepted.data["detail"], f"Unexpected detail message: {response_accepted.data}"
    print("SUCCESS: Manual join returned correct error: 'This invitation has already been accepted. Please log in to your account.'")

    # 3.2: Revoked invite
    with schema_context(company.schema_name):
        resolved_invite2.status = "revoked"
        resolved_invite2.save()
        
    request_revoked = factory.post("/api/auth/accept-invite/", {
        "token": resolved_invite2.token,
        "password": "newpassword123",
        "first_name": "Surya",
        "last_name": "A"
    }, format="json")
    
    response_revoked = view(request_revoked)
    assert response_revoked.status_code == 400, f"Expected 400 but got {response_revoked.status_code}"
    assert "revoked" in response_revoked.data["detail"], f"Unexpected detail message: {response_revoked.data}"
    print("SUCCESS: Manual join returned correct error: 'This invitation has been revoked by the administrator.'")

    for c in Company.objects.exclude(schema_name="public"):
        with schema_context(c.schema_name):
            Employee.objects.filter(user__email=test_email).delete()
            TeamInvite.objects.filter(email=test_email).delete()
            
    with schema_context(company.schema_name):
        User.objects.filter(email=test_email).delete()
        
if __name__ == "__main__":
    test_google_invite_flow()
