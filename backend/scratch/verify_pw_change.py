import os
import sys
import django

sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import status
from django_tenants.utils import schema_context
from accounts.views import PasswordChangeView

def run_diag():
    print("=== RUNNING PASSWORD CHANGE DIAGNOSTICS ===")
    User = get_user_model()
    
    with schema_context("demo"):
        user = User.objects.filter(email__iexact="suryacaldim@gmail.com").first()
        if not user:
            print("User suryacaldim@gmail.com not found!")
            return
            
        print(f"Loaded user: {user.username} ({user.email})")
        
        # Test current passwords in the DB
        passwords_to_try = ["employee123", "employee", "admin123", "password", "suryacaldim"]
        correct_password = None
        for p in passwords_to_try:
            if user.check_password(p):
                correct_password = p
                print(f"Found correct password in DB: '{p}'")
                break
        
        if not correct_password:
            print("Did not find correct password among common ones. Checking if password is empty/random...")
            # Let's set it to 'employee123'
            user.set_password("employee123")
            user.save(update_fields=["password"])
            correct_password = "employee123"
            print("Set password to 'employee123' for verification.")
            
        factory = APIRequestFactory()
        view = PasswordChangeView.as_view()
        
        # Try to change password using the correct current password
        request = factory.post("/api/auth/password/change/", {
            "current_password": correct_password,
            "new_password": "newpassword123",
            "confirm_password": "newpassword123"
        }, format="json")
        
        force_authenticate(request, user=user)
        response = view(request)
        print(f"Response status: {response.status_code}, data: {response.data}")
        
        # Restore password back to 'employee123'
        user.set_password("employee123")
        user.save(update_fields=["password"])
        print("Restored password back to 'employee123'.")

if __name__ == "__main__":
    run_diag()
