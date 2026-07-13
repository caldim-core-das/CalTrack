import sys

def verify_db():
    log_file = open("check_results.log", "w", encoding="utf-8")
    original_stdout = sys.stdout
    sys.stdout = log_file
    try:
        print("\n==================================================")
        print("VERIFYING WORKFLOW DB STATES")
        print("==================================================")
        
        from service_requests.models import ServiceRequest, ServiceFeedback
        from tasks.models import Task

        sr_list = ServiceRequest.objects.filter(customer_name="Integration Test Customer")
        if not sr_list.exists():
            print("[INFO] No Integration Test Customer record found.")
            return

        for sr in sr_list:
            print(f"ServiceRequest ID: {sr.request_id}")
            print(f"  - Customer Name: {sr.customer_name}")
            print(f"  - Status:        {sr.status}")
            print(f"  - Assignee:      {sr.assigned_employee.user.username if sr.assigned_employee else 'None'}")
            
            # Find linked tasks
            tasks = Task.objects.filter(service_request=sr)
            print(f"  - Linked Tasks:  {tasks.count()}")
            for t in tasks:
                print(f"    * Task Title:  {t.title}")
                print(f"    * Task Status: {t.status}")
                print(f"    * Acceptance:  {t.acceptance_status}")
            
            # Find feedback
            try:
                fb = ServiceFeedback.objects.get(service_request=sr)
                print(f"  - Feedback Token:{fb.feedback_token}")
                print(f"  - Is Submitted:  {fb.is_submitted}")
            except ServiceFeedback.DoesNotExist:
                print("  - Feedback:      None")
                
        print("==================================================")
    except Exception as e:
        print(f"Verification error: {e}")
    finally:
        sys.stdout = original_stdout
        log_file.close()

if __name__ == "__main__":
    verify_db()
