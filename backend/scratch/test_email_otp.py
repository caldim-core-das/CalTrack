import os
import sys
import django
from dotenv import load_dotenv
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env file explicitly
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.views import SendEmailOTPView, PasswordResetWithOTPView

User = get_user_model()
user = User.objects.filter(role="employee").first()
if not user:
    print("No employee user found in DB. Creating a dummy one.")
    user = User.objects.create_user(
        username="temp_employee_test",
        email="temp_employee_test@caltrack.com",
        password="employee123",
        role="employee"
    )

print(f"Testing with User: {user.username} | Email: {user.email}")

# Ensure clean state in cache
cache.delete(f"email_otp_{user.email.lower()}")
cache.delete(f"email_otp_rate_email_{user.email.lower()}")

# 1. Send OTP Request
factory = APIRequestFactory()
request = factory.post("/api/auth/send-email-otp/")
force_authenticate(request, user=user)

view = SendEmailOTPView.as_view()
response = view(request)
print("Send OTP Response Status:", response.status_code)
print("Send OTP Response Data:", response.data)

assert response.status_code == 200, f"Failed to send email OTP: {response.data}"
code = response.data.get("code")
print(f"Retrieved code from debug response: {code}")

# 2. Reset password request with incorrect code
request_bad = factory.post("/api/auth/password/reset-with-otp/", {
    "otp_code": "000000",
    "new_password": "newpassword123",
    "confirm_password": "newpassword123"
}, format='json')
force_authenticate(request_bad, user=user)
view_reset = PasswordResetWithOTPView.as_view()
res_bad = view_reset(request_bad)
print("Reset with Bad OTP Response Status:", res_bad.status_code)
print("Reset with Bad OTP Response Data:", res_bad.data)
assert res_bad.status_code == 400

# 3. Reset password request with correct code
request_good = factory.post("/api/auth/password/reset-with-otp/", {
    "otp_code": code,
    "new_password": "newpassword123",
    "confirm_password": "newpassword123"
}, format='json')
force_authenticate(request_good, user=user)
res_good = view_reset(request_good)
print("Reset with Good OTP Response Status:", res_good.status_code)
print("Reset with Good OTP Response Data:", res_good.data)
assert res_good.status_code == 200

# Check if password actually changed
user.refresh_from_db()
assert user.check_password("newpassword123"), "Password was not successfully updated in DB"
print("\nSUCCESS: OTP Password Reset Flow Verified Successfully!")

# Cleanup
if user.username == "temp_employee_test":
    user.delete()
    print("Cleaned up temp user.")
else:
    # Reset password back to original 'employee123' if it was a real user
    user.set_password("employee123")
    user.save()
    print("Reset password of real user back to employee123.")
