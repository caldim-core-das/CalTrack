import logging
import os
import random
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def generate_otp_code(length=6) -> str:
    """Generate a random numeric OTP string of given length."""
    return "".join([str(random.randint(0, 9)) for _ in range(length)])


def send_customer_otp_sms(phone_number: str, otp: str, task_title: str) -> bool:
    """
    Sends customer OTP via Twilio SMS if configured, otherwise prints to console.
    """
    if not phone_number:
        logger.info("[OTP SMS] No phone number provided for customer.")
        return False

    normalized_phone = phone_number.strip()
    sms_body = (
        f"Your verification OTP for QuickTIMS service '{task_title}' is: {otp}. "
        f"Please share this code with your technician upon arrival to start work."
    )

    sent_real_sms = False
    delivery_error = ""

    try:
        from twilio.rest import Client as TwilioClient
        account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        auth_token = os.getenv("TWILIO_AUTH_TOKEN")
        from_number = os.getenv("TWILIO_FROM_NUMBER")

        if account_sid and auth_token and from_number and not account_sid.startswith("your_"):
            client = TwilioClient(account_sid, auth_token)
            client.messages.create(
                body=sms_body,
                from_=from_number,
                to=normalized_phone
            )
            sent_real_sms = True
    except ImportError:
        delivery_error = "Twilio client library not installed"
    except Exception as e:
        delivery_error = str(e)
        logger.error(f"[OTP SMS] Twilio delivery failed for {normalized_phone}: {e}")

    print("\n" + "=" * 60)
    print(f"  [CUSTOMER SMS GATEWAY] Job OTP for {normalized_phone}: {otp}")
    if delivery_error:
        print(f"  [CUSTOMER SMS GATEWAY] Real SMS skipped/failed ({delivery_error})")
    print("=" * 60 + "\n")

    return sent_real_sms


def send_customer_otp_email(email_address: str, otp: str, task_title: str, customer_name: str = "") -> bool:
    """
    Sends customer OTP via email using Django send_mail with branded HTML formatting.
    """
    if not email_address:
        logger.info("[OTP Email] No email address provided for customer.")
        return False

    recipient = email_address.strip()
    name = customer_name.strip() or "Valued Customer"

    subject = f"Your Service Verification Code: {otp} - QuickTIMS"

    plain_body = (
        f"Dear {name},\n\n"
        f"A technician has been assigned to your service request '{task_title}'.\n\n"
        f"Your Work Start Verification Code (OTP) is: {otp}\n\n"
        f"Please share this OTP with the technician when they arrive so they can begin work.\n\n"
        f"Thank you for choosing QuickTIMS!\n"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Service Verification OTP</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 30px 0;">
<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width: 550px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
<tr><td style="background-color: #5d5fef; padding: 28px 24px; text-align: center;">
<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">QuickTIMS</h1>
<p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 13px;">SERVICE VERIFICATION PORTAL</p>
</td></tr>
<tr><td style="padding: 32px 28px; color: #334155; font-size: 15px; line-height: 1.6;">
<h2 style="color: #0f172a; margin-top: 0; font-size: 18px;">Hello, {name}</h2>
<p style="margin-top: 0; color: #475569;">A technician has been assigned to your job: <strong style="color: #0f172a;">{task_title}</strong>.</p>
<div style="background-color: #f8fafc; border: 2px dashed #5d5fef; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
  <p style="margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600;">Work Start Verification Code</p>
  <div style="font-size: 32px; font-weight: 800; color: #5d5fef; letter-spacing: 6px;">{otp}</div>
</div>
<p style="color: #475569; font-size: 14px;">Please share this 6-digit code with the technician upon their arrival. The technician must enter this code to begin work on your request.</p>
</td></tr>
<tr><td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center; color: #64748b; font-size: 12px;">
<p style="margin: 0;">This is an automated security notification from QuickTIMS Service Management.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

    try:
        send_mail(
            subject=subject,
            message=plain_body,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@quicktims.com"),
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info(f"[OTP Email] Successfully sent OTP email to {recipient}")
        return True
    except Exception as exc:
        logger.error(f"[OTP Email] Failed to send OTP email to {recipient}: {exc}")
        return False


def generate_and_send_job_otp(task) -> str:
    """
    Generates a new 6-digit OTP for the task, updates database fields,
    and dispatches the code via both SMS and Email to the customer.
    """
    otp = generate_otp_code(6)
    task.start_otp = otp
    task.otp_created_at = timezone.now()
    task.is_otp_verified = False
    task.save(update_fields=["start_otp", "otp_created_at", "is_otp_verified"])

    # Resolve phone number
    phone = (
        task.client_contact_number
        or (task.service_request.phone if getattr(task, "service_request", None) else "")
    )
    # Resolve email
    email = (
        task.client_email
        or (task.service_request.email if getattr(task, "service_request", None) else "")
    )
    customer_name = (
        task.client_name
        or (task.service_request.customer_name if getattr(task, "service_request", None) else "")
    )

    if phone:
        send_customer_otp_sms(phone, otp, task.title)
    if email:
        send_customer_otp_email(email, otp, task.title, customer_name)

    logger.info(f"[OTP Service] Generated & dispatched OTP {otp} for Task #{task.id}")
    return otp


def verify_task_otp(task, input_otp: str, expiry_minutes: int = 10):
    """
    Verifies the provided OTP against task.start_otp with a 10-minute expiry check.
    Returns (is_valid: bool, message: str).
    """
    from datetime import timedelta

    if getattr(task, "is_otp_verified", False):
        return True, "OTP is already verified."

    if not getattr(task, "start_otp", None):
        return False, "No OTP has been generated for this task yet. Please request a new OTP."

    if not getattr(task, "otp_created_at", None):
        return False, "OTP timestamp is missing. Please tap 'Resend OTP' to get a fresh code."

    # Expiry check (default 10 minutes)
    now = timezone.now()
    if now - task.otp_created_at > timedelta(minutes=expiry_minutes):
        return False, f"OTP has expired (valid for {expiry_minutes} minutes). Please tap 'Resend OTP' to send a new code to the customer."

    cleaned_input = str(input_otp or "").strip()
    cleaned_start = str(task.start_otp or "").strip()

    if cleaned_input and cleaned_input == cleaned_start:
        task.is_otp_verified = True
        task.save(update_fields=["is_otp_verified"])
        logger.info(f"[OTP Service] Successfully verified OTP for Task #{task.id}")
        return True, "Customer OTP verified successfully!"

    logger.warning(f"[OTP Service] Invalid OTP entered for Task #{task.id}")
    return False, "Invalid OTP. Please check the code with the customer and try again."

