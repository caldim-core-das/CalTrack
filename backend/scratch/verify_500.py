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
from payroll.views import PayrollRecordViewSet

def run_diag():
    print("=== RUNNING PAYROLL DIAGNOSTICS ===")
    User = get_user_model()
    
    with schema_context("demo"):
        user = User.objects.filter(email__iexact="suryacaldim@gmail.com").first()
        if not user:
            print("User suryacaldim@gmail.com not found!")
            return
            
        print(f"Loaded user: {user.username} ({user.email}), role: {user.role}, company: {user.company}")
        
        factory = APIRequestFactory()
        view = PayrollRecordViewSet.as_view({'get': 'list'})
        
        request = factory.get("/api/payroll/records/")
        # Attach the company manually as the middleware would
        request.company = user.company
        
        force_authenticate(request, user=user)
        
        try:
            response = view(request)
            print(f"Response status: {response.status_code}")
            if response.status_code == 500:
                print(f"Response data: {response.data}")
            else:
                print("Response data sample:", str(response.data)[:300])
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_diag()
