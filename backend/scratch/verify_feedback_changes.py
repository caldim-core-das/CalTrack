import os
import sys
import django
from datetime import date

# Set up Django environment
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
os.environ["DJANGO_SECRET_KEY"] = "dev-only-secret-key-change-me"
django.setup()

from django.contrib.auth import get_user_model
from companies.models import Company
from service_requests.models import ServiceRequest, ServiceFeedback
from service_requests.state_machine import apply_transition
from django.test import RequestFactory
from service_requests.views import AdminSRResendFeedbackView, FeedbackTokenView

def verify():
    print("Running feedback changes verification test...")
    from django_tenants.utils import tenant_context
    company = Company.objects.exclude(schema_name="public").first()
    if not company:
        company = Company.objects.first()
    if not company:
        print("[FAIL] No company found.")
        return
    
    with tenant_context(company):
        # 1. Create a ServiceRequest in 'assigned' status
        sr = ServiceRequest.objects.create(
            company=company,
            customer_name="Verification Customer",
            phone="1234567890",
            email="test_verify@example.com",
            service_category="plumbing",
            issue_title="Leakage verification",
            description="Verify leak transitions.",
            address="123 Verification St",
            preferred_date=date.today(),
            status=ServiceRequest.Status.ASSIGNED
        )
        print(f"[OK] Created SR with request_id={sr.request_id}, status={sr.status}")

        # 2. Verify that AdminSRResendFeedbackView post allows 'assigned' status
        factory = RequestFactory()
        request = factory.post(f"/api/admin/service-requests/{sr.id}/resend-feedback/")
        
        # Mock authentication and admin role check
        User = get_user_model()
        admin_user = User.objects.filter(role="admin").first()
        if not admin_user:
            admin_user = User.objects.create_user(
                username="test_admin_verify", 
                email="admin_verify@example.com", 
                password="testpassword123",
                role="admin"
            )
        request.user = admin_user
        
        # Set company on request for multi-tenancy middleware compatibility
        request.company = company
        
        view = AdminSRResendFeedbackView.as_view(authentication_classes=[], permission_classes=[])
        response = view(request, pk=sr.id)
        
        print(f"[STATUS] ResendFeedback view response status code: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.data}"
        print(f"[OK] ResendFeedback view succeeded: {response.data}")

        # Verify Feedback object was created
        feedback = ServiceFeedback.objects.get(service_request=sr)
        print(f"[OK] Feedback object created with token: {feedback.feedback_token}")

        # 3. Verify that submitting feedback from 'assigned' status transitions to 'feedback_received'
        feedback_request = factory.post(
            f"/api/feedback/{feedback.feedback_token}/",
            data={
                "rating": 5,
                "employee_behaviour": "good",
                "work_quality": "good",
                "issue_resolved": True,
                "comment": "Excellent work!"
            },
            content_type="application/json"
        )
        # Set company on feedback request
        feedback_request.company = company
        
        fb_view = FeedbackTokenView.as_view(authentication_classes=[])
        fb_response = fb_view(feedback_request, token=str(feedback.feedback_token))
        
        print(f"[STATUS] Feedback submit response status code: {fb_response.status_code}")
        assert fb_response.status_code == 200, f"Expected 200, got {fb_response.status_code}: {fb_response.data}"
        
        # Reload and verify ServiceRequest status
        sr.refresh_from_db()
        print(f"[OK] ServiceRequest status after feedback submission: {sr.status}")
        assert sr.status == ServiceRequest.Status.FEEDBACK_RECEIVED, f"Expected feedback_received, got {sr.status}"

        # Clean up test records
        feedback.delete()
        sr.delete()
        print("[SUCCESS] All feedback flow changes verified successfully!")

if __name__ == "__main__":
    verify()
