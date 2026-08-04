import os
import django
from datetime import timedelta
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'), override=True)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.utils import timezone
from tasks.models import Task
from tasks.services.otp_service import generate_and_send_job_otp, verify_task_otp

def run_tests():
    print("--- TESTING OTP WORKFLOW ---")
    task = Task.objects.first()
    if not task:
        print("No task found in database to test.")
        return

    # Reset OTP state
    task.is_otp_verified = False
    task.start_otp = ""
    task.otp_created_at = None
    task.save()

    # 1. Generate OTP
    otp1 = generate_and_send_job_otp(task)
    print(f"Generated OTP 1: {otp1} | DB start_otp: {task.start_otp}")

    # 2. Test Invalid OTP
    valid, msg = verify_task_otp(task, "000000")
    print(f"Invalid OTP test: valid={valid}, msg='{msg}'")
    assert not valid, "Should fail for wrong OTP"

    # 3. Test Resend / Invalidation of old OTP
    otp2 = generate_and_send_job_otp(task)
    print(f"Generated OTP 2 (Resend): {otp2} | DB start_otp: {task.start_otp}")
    valid_old, msg_old = verify_task_otp(task, otp1)
    print(f"Old OTP test: valid={valid_old}, msg='{msg_old}'")
    assert not valid_old or otp1 == otp2, "Old OTP should be invalidated"

    # 4. Test Expiry (10 min TTL)
    task.otp_created_at = timezone.now() - timedelta(minutes=11)
    task.save()
    valid_exp, msg_exp = verify_task_otp(task, otp2)
    print(f"Expired OTP test (11 mins old): valid={valid_exp}, msg='{msg_exp}'")
    assert not valid_exp, "Should fail for expired OTP"

    # 5. Test Successful Verification
    task.otp_created_at = timezone.now()
    task.save()
    valid_ok, msg_ok = verify_task_otp(task, otp2)
    print(f"Correct OTP test: valid={valid_ok}, msg='{msg_ok}'")
    assert valid_ok, "Should pass for valid OTP"
    assert task.is_otp_verified, "Task should be marked verified"

    print("\n✅ ALL OTP TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
