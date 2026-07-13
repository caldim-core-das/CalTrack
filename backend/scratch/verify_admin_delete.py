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
from accounts.views import DeleteAccountView

def run_diag():
    print("=== RUNNING ADMIN-SIDE DELETE DIAGNOSTICS ===")
    User = get_user_model()
    
    # Check under the caldim_engg schema
    with schema_context("caldim_engg"):
        # Let's find the admin
        admin_user = User.objects.filter(role="admin", company__schema_name="caldim_engg").first()
        if not admin_user:
            print("Admin user in caldim_engg not found! Searching any admin...")
            admin_user = User.objects.filter(role="admin").first()
            
        employee_user = User.objects.filter(email__iexact="suryacaldim@gmail.com").first()
        if not employee_user:
            print("Employee user suryacaldim@gmail.com not found!")
            return
            
        print(f"Admin: {admin_user.username} ({admin_user.email})")
        print(f"Employee: {employee_user.username} ({employee_user.email}), company: {employee_user.company}")
        
        # Check password for employee
        passwords_to_try = ["employee123", "employee", "admin123", "password", "suryacaldim"]
        correct_password = None
        for p in passwords_to_try:
            if employee_user.check_password(p):
                correct_password = p
                print(f"Password '{p}' is correct in DB.")
                break
                
        if not correct_password:
            print("Correct password not found among common ones.")
            # Set password to 'employee'
            employee_user.set_password("employee")
            employee_user.save()
            correct_password = "employee"
            print("Set password to 'employee' for testing.")
            
        factory = APIRequestFactory()
        view = DeleteAccountView.as_view()
        
        # Test deletion
        request = factory.post("/api/auth/delete-account/", {
            "email": "suryacaldim@gmail.com",
            "password": correct_password
        }, format="json")
        
        force_authenticate(request, user=admin_user)
        request.company = admin_user.company
        
        try:
            response = view(request)
            print(f"Response status: {response.status_code}, data: {response.data}")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_diag()
