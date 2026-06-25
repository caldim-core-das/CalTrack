"""
service_requests/notifications.py

Notification helpers for the service request pipeline.
In dev: prints to console (matches EMAIL_BACKEND = console).
In prod: sends via the configured SMTP backend.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

logger = logging.getLogger(__name__)


def _render_html_template(title, greeting, intro_text, details_dict, cta_url=None, cta_text=None, footer_note=None):
    # Form details rows
    details_html = ""
    if details_dict:
        details_html = '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0; font-size: 14px; text-align: left;">'
        for label, val in details_dict.items():
            details_html += f'<div style="margin-bottom: 10px; color: #475569; line-height: 1.5;"><strong style="color: #0f172a; min-width: 140px; display: inline-block;">{label}:</strong> {val}</div>'
        details_html += '</div>'

    cta_html = ""
    if cta_url and cta_text:
        cta_html = f"""
        <div style="text-align: center; margin: 32px 0;">
            <a href="{cta_url}" target="_blank" style="background-color: #5d5fef; color: #ffffff; padding: 14px 28px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(93, 95, 239, 0.2); font-size: 15px;">{cta_text}</a>
        </div>
        """

    footer_note_html = ""
    if footer_note:
        footer_note_html = f'<p style="color: #64748b; font-size: 12px; margin-top: 24px; font-style: italic; line-height: 1.5;">{footer_note}</p>'

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); text-align: left; border-collapse: collapse;">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #5d5fef; padding: 36px 32px; text-align: center;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">QuickTIMS</h1>
                            <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px; font-weight: 500; letter-spacing: 0.5px;">SERVICE MANAGEMENT PORTAL</p>
                        </td>
                    </tr>
                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px 32px; color: #334155; font-size: 15px; line-height: 1.6;">
                            <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 16px; font-size: 18px; font-weight: 700;">{greeting}</h2>
                            <p style="margin-top: 0; margin-bottom: 16px; color: #475569;">{intro_text}</p>
                            
                            {details_html}
                            {cta_html}
                            {footer_note_html}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; color: #64748b; font-size: 12px;">
                            <p style="margin: 0 0 8px 0; font-weight: 600;">QuickTIMS Service Portal</p>
                            <p style="margin: 0; line-height: 1.5;">This is an automated notification. Please do not reply directly to this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""
    return html


def send_feedback_link(service_request, feedback_token: str) -> None:
    """
    Send a feedback link to the customer after their job is verified.
    Stubbed for dev (console backend), real email in prod.
    """
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/feedback/{feedback_token}"

    subject = f"How was your service? [{service_request.request_id}]"
    body = (
        f"Dear {service_request.customer_name},\n\n"
        f"Your service request ({service_request.request_id}) has been completed "
        f"and verified by our team.\n\n"
        f"We'd love to hear your feedback. Please click the link below:\n\n"
        f"{link}\n\n"
        f"This link is unique to your request and can only be used once.\n\n"
        f"Thank you for choosing our service.\n"
    )

    details = {
        "Request ID": service_request.request_id,
        "Service Category": service_request.service_category.replace('_', ' ').capitalize(),
        "Issue Title": service_request.issue_title,
    }
    
    html_body = _render_html_template(
        title="Share Your Feedback",
        greeting=f"Dear {service_request.customer_name},",
        intro_text="Thank you for choosing us! Your service request has been successfully completed and verified. We are dedicated to providing excellent support, and we would love to hear about your experience.",
        details_dict=details,
        cta_url=link,
        cta_text="Rate Our Service",
        footer_note="Note: This feedback link is unique to your request and can only be used once to submit your review."
    )

    recipient = service_request.email
    if not recipient:
        logger.info(
            "[ServiceRequests] No email for %s — feedback link: %s",
            service_request.request_id,
            link,
        )
        return

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info(
            "[ServiceRequests] Feedback link sent to %s for %s",
            recipient,
            service_request.request_id,
        )
    except Exception as exc:
        # Log but never raise — verification must complete even if email fails
        logger.error(
            "[ServiceRequests] Failed to send feedback email for %s: %s",
            service_request.request_id,
            exc,
        )


def send_booking_confirmation(service_request) -> None:
    """
    Send a booking confirmation email to the customer.
    """
    subject = f"Booking Confirmation [{service_request.request_id}]"
    body = (
        f"Dear {service_request.customer_name},\n\n"
        f"Thank you for submitting a service booking request with us.\n\n"
        f"Booking Details:\n"
        f"- Request ID: {service_request.request_id}\n"
        f"- Service Category: {service_request.service_category.replace('_', ' ').capitalize()}\n"
        f"- Issue Title: {service_request.issue_title}\n"
        f"- Preferred Date: {service_request.preferred_date}\n\n"
        f"We will review your request and assign a technician shortly.\n\n"
        f"Best regards,\n"
        f"The Service Team\n"
    )

    details = {
        "Request ID": service_request.request_id,
        "Service Category": service_request.service_category.replace('_', ' ').capitalize(),
        "Issue Title": service_request.issue_title,
        "Preferred Date": str(service_request.preferred_date),
    }

    html_body = _render_html_template(
        title="Booking Confirmation",
        greeting=f"Dear {service_request.customer_name},",
        intro_text="Thank you for submitting a service booking request with us. Our team is currently reviewing the details and will assign a technician shortly. Here is a summary of your ticket details:",
        details_dict=details,
        footer_note="We will send you another update as soon as a technician is assigned to your ticket."
    )

    recipient = service_request.email
    if not recipient:
        logger.info("[ServiceRequests] No email for %s — booking confirmation skipped.", service_request.request_id)
        return

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info("[ServiceRequests] Booking confirmation sent to %s for %s", recipient, service_request.request_id)
    except Exception as exc:
        logger.error("[ServiceRequests] Failed to send booking confirmation email for %s: %s", service_request.request_id, exc)


def send_work_completion_email(service_request) -> None:
    """
    Send a work completion email notification to the customer.
    """
    subject = f"Service Request Completed [{service_request.request_id}]"
    
    assigned_emp_name = "Our technician"
    if service_request.assigned_employee and service_request.assigned_employee.user:
        user = service_request.assigned_employee.user
        assigned_emp_name = user.get_full_name() or user.username

    body = (
        f"Dear {service_request.customer_name},\n\n"
        f"We are pleased to inform you that the work for your service request ({service_request.request_id}) has been completed.\n\n"
        f"Service Details:\n"
        f"- Request ID: {service_request.request_id}\n"
        f"- Service Category: {service_request.service_category.replace('_', ' ').capitalize()}\n"
        f"- Issue Title: {service_request.issue_title}\n"
        f"- Completed By: {assigned_emp_name}\n"
        f"- Completion Date: {timezone.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        f"Thank you for choosing our service!\n\n"
        f"Best regards,\n"
        f"The Service Team\n"
    )

    details = {
        "Request ID": service_request.request_id,
        "Service Category": service_request.service_category.replace('_', ' ').capitalize(),
        "Issue Title": service_request.issue_title,
        "Completed By": assigned_emp_name,
        "Completion Date": timezone.now().strftime('%Y-%m-%d %H:%M:%S'),
    }

    html_body = _render_html_template(
        title="Service Request Completed",
        greeting=f"Dear {service_request.customer_name},",
        intro_text="We are pleased to inform you that the work for your service request has been completed. Below are the service completion details:",
        details_dict=details,
        footer_note="Thank you for your business! If you have any concerns regarding the completed work, please reach out to our support team."
    )

    recipient = service_request.email
    if not recipient:
        logger.info("[ServiceRequests] No email for %s — work completion notification skipped.", service_request.request_id)
        return

    try:
        send_mail(
            subject=subject,
            message=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info("[ServiceRequests] Work completion email sent to %s for %s", recipient, service_request.request_id)
    except Exception as exc:
        logger.error("[ServiceRequests] Failed to send work completion email for %s: %s", service_request.request_id, exc)


