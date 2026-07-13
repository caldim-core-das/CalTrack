import os
import django
import sys
from datetime import date

def run_test():
    log_file = open("test_workflow_results.log", "w", encoding="utf-8")
    original_stdout = sys.stdout
    sys.stdout = log_file
    try:
        print("\n==================================================")
        print("STARTING WORKFLOW INTEGRATION TEST")
        print("==================================================")
        
        from django.contrib.auth import get_user_model
        from companies.models import Company
        from employees.models import Employee
        from service_requests.models import ServiceRequest, ServiceFeedback
        from tasks.models import Task
        from service_requests.state_machine import apply_transition
        from django.db import transaction

        User = get_user_model()
        company = Company.objects.first()
        if not company:
            print("[FAIL] No company found in DB.")
            return

        print(f"[OK] Found company: {company.company_name}")

        # 1. Create client booking (ServiceRequest)
        sr = ServiceRequest.objects.create(
            company=company,
            customer_name="Integration Test Customer",
            phone="9876543210",
            email="test_integration@example.com",
            service_category="hvac",
            issue_title="Programmatic HVAC Issue",
            description="Testing automated transition pipeline.",
            address="456 Workflow Lane",
            preferred_date=date.today()
        )
        print(f"[OK] ServiceRequest created: {sr.request_id} (Status: {sr.status})")

        # 2. Admin reviews service request
        apply_transition(sr, ServiceRequest.Status.REVIEWED)
        sr.save()
        print(f"[OK] ServiceRequest transitioned to: {sr.status}")

        # 3. Fetch employee user and create task manually
        emp_user = User.objects.filter(role="employee").first()
        if not emp_user:
            print("[FAIL] No employee user found in DB.")
            return
        
        admin_user = User.objects.filter(role="admin").first() or emp_user
        employee_profile = Employee.objects.filter(user=emp_user).first()
        if not employee_profile:
            print("[FAIL] No Employee profile found for user.")
            return

        # Simulate creation of Task (like AdminTaskListCreateView POST)
        task = Task.objects.create(
            title=f"Service Request: {sr.issue_title}",
            description=sr.description,
            category="hvac",
            assigned_to=emp_user,
            assigned_by=admin_user,
            service_request=sr,
            company=company,
            client_name=sr.customer_name,
            client_contact_number=sr.phone,
            client_email=sr.email,
            job_address=sr.address,
            due_date=sr.preferred_date,
            acceptance_status=Task.AcceptanceStatus.PENDING_ACCEPTANCE
        )
        print(f"[OK] Task created: {task.title} (Assigned to: {emp_user.username})")

        # Simulate update logic in AdminTaskListCreateView post-save
        with transaction.atomic():
            sr.assigned_employee = employee_profile
            if sr.status == ServiceRequest.Status.REVIEWED:
                apply_transition(sr, ServiceRequest.Status.ASSIGNED)
            sr.save(update_fields=["status", "assigned_employee", "updated_at"])
        
        # Verify ServiceRequest status
        sr.refresh_from_db()
        print(f"[OK] ServiceRequest status after Task creation: {sr.status} (Assigned employee: {sr.assigned_employee.user.username})")
        if sr.status != ServiceRequest.Status.ASSIGNED:
            print("[FAIL] ServiceRequest is not in ASSIGNED state.")
            return

        # 4. Simulate employee accepting task (EmployeeTaskActionView 'accept')
        task.acceptance_status = Task.AcceptanceStatus.ACCEPTED
        task.save()
        
        # Sync to SR
        if sr.status == ServiceRequest.Status.ASSIGNED:
            apply_transition(sr, ServiceRequest.Status.ACCEPTED)
            sr.save(update_fields=["status", "updated_at"])
        
        sr.refresh_from_db()
        print(f"[OK] Employee accepted task. ServiceRequest status: {sr.status}")
        if sr.status != ServiceRequest.Status.ACCEPTED:
            print("[FAIL] ServiceRequest is not in ACCEPTED state.")
            return

        # 5. Simulate employee starting travel/work (EmployeeTaskActionView 'start')
        task.status = Task.Status.IN_PROGRESS
        task.save()
        
        # Sync to SR
        if sr.status == ServiceRequest.Status.ACCEPTED:
            apply_transition(sr, ServiceRequest.Status.IN_PROGRESS)
            sr.save(update_fields=["status", "updated_at"])
        
        sr.refresh_from_db()
        print(f"[OK] Employee started task. ServiceRequest status: {sr.status}")
        if sr.status != ServiceRequest.Status.IN_PROGRESS:
            print("[FAIL] ServiceRequest is not in IN_PROGRESS state.")
            return

        # 6. Simulate employee completing task (EmployeeTaskActionView 'complete')
        task.status = Task.Status.COMPLETED
        task.save()
        
        # Sync to SR (direct assignment to feedback_pending, and feedback link generation)
        if sr.status != ServiceRequest.Status.FEEDBACK_PENDING:
            with transaction.atomic():
                sr.status = ServiceRequest.Status.FEEDBACK_PENDING
                sr.save(update_fields=["status", "updated_at"])
                feedback, feedback_created = ServiceFeedback.objects.get_or_create(service_request=sr)
            
            print(f"[OK] Feedback link generated: {feedback.feedback_token} (Created: {feedback_created})")

        sr.refresh_from_db()
        print(f"[OK] Employee completed task. ServiceRequest status: {sr.status}")
        if sr.status != ServiceRequest.Status.FEEDBACK_PENDING:
            print("[FAIL] ServiceRequest is not in FEEDBACK_PENDING state.")
            return

        print("==================================================")
        print("WORKFLOW INTEGRATION TEST PASSED SUCCESSFULLY!")
        print("==================================================")
    except Exception as e:
        print(f"[FAIL] Exception during test execution: {e}")
        import traceback
        traceback.print_exc()
    finally:
        sys.stdout = original_stdout
        log_file.close()

if __name__ == "__main__":
    run_test()
