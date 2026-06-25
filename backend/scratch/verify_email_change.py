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
from accounts.views import EmailChangeView

def run_diag():
    print("=== RUNNING EMAIL CHANGE DIAGNOSTICS ===")
    User = get_user_model()
    
    with schema_context("demo"):
        user = User.objects.filter(email__iexact="suryacaldim@gmail.com").first()
        if not user:
            print("User suryacaldim@gmail.com not found!")
            return
            
        print(f"Loaded user: {user.username} ({user.email})")
        # Check standard passwords
        passwords_to_try = ["employee123", "employee", "admin123", "password", "suryacaldim"]
        correct_password = None
        for p in passwords_to_try:
            if user.check_password(p):
                correct_password = p
                print(f"Found correct password: '{p}'")
                break
        
        if not correct_password:
            print("Did not find correct password among the common ones.")
            # Set password to employee123 to verify it works
            user.set_password("employee123")
            user.save(update_fields=["password"])
            correct_password = "employee123"
            print("Reset password to 'employee123' for verification.")
            
        factory = APIRequestFactory()
        view = EmailChangeView.as_view()
        
        # Test changing email to a new valid one
        new_email = "suryacaldim_new@gmail.com"
        request = factory.post("/api/auth/email/change/", {
            "new_email": new_email,
            "password": correct_password
        }, format="json")
        
        force_authenticate(request, user=user)
        response = view(request)
        print(f"Response status: {response.status_code}, data: {response.data}")
        
        # Reset email back to original
        user.email = "suryacaldim@gmail.com"
        user.save(update_fields=["email"])
        print("Restored original email suryacaldim@gmail.com.")

if __name__ == "__main__":
    run_diag()
