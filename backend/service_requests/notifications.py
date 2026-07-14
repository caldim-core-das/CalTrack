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


def _get_category_display_name(service_request) -> str:
    """
    Resolve the human-readable category name from the service request.
    Tries the CatalogCategory table first, then falls back to the static
    SERVICE_CATEGORIES choices, and finally humanises the raw slug.
    """
    raw = (service_request.service_category or "").strip()
    if not raw:
        return "Service"

    # 1. Try CatalogCategory table (slug lookup)
    try:
        from service_requests.models import CatalogCategory
        cat = CatalogCategory.objects.filter(slug=raw).first()
        if cat and cat.name:
            return cat.name
    except Exception:
        pass

    # 2. Try the static SERVICE_CATEGORIES list
    try:
        from service_requests.models import SERVICE_CATEGORIES
        for slug, label in SERVICE_CATEGORIES:
            if slug == raw:
                return label
    except Exception:
        pass

    # 3. Humanise the slug (ac_heating -> Ac Heating)
    return raw.replace("_", " ").title()


def _render_html_template(title, greeting, intro_text, details_dict, cta_url=None, cta_text=None, footer_note=None):
    """Build a premium HTML email template."""
    details_html = ""
    if details_dict:
        details_html = '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0; font-size: 14px; text-align: left;">'
        for label, val in details_dict.items():
            details_html += f'<div style="margin-bottom: 10px; color: #475569; line-height: 1.5;"><strong style="color: #0f172a; min-width: 140px; display: inline-block;">{label}:</strong> {val}</div>'
        details_html += '</div>'

    cta_html = ""
    if cta_url and cta_text:
        cta_html = f'<div style="text-align: center; margin: 32px 0;"><a href="{cta_url}" target="_blank" style="background-color: #5d5fef; color: #ffffff; padding: 14px 28px; font-weight: bold; border-radius: 8px; text-decoration: none; display: inline-block; font-size: 15px;">{cta_text}</a></div>'

    footer_note_html = ""
    if footer_note:
        footer_note_html = f'<p style="color: #64748b; font-size: 12px; margin-top: 24px; font-style: italic; line-height: 1.5;">{footer_note}</p>'

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>{title}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 40px 0;">
<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
<tr><td align="center">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; border-collapse: collapse;">
<tr><td style="background-color: #5d5fef; padding: 36px 32px; text-align: center;">
<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase;">QuickTIMS</h1>
<p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 14px;">SERVICE MANAGEMENT PORTAL</p>
</td></tr>
<tr><td style="padding: 40px 32px; color: #334155; font-size: 15px; line-height: 1.6;">
<h2 style="color: #0f172a; margin-top: 0; font-size: 18px; font-weight: 700;">{greeting}</h2>
<p style="margin-top: 0; color: #475569;">{intro_text}</p>
{details_html}
{cta_html}
{footer_note_html}
</td></tr>
<tr><td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center; color: #64748b; font-size: 12px;">
<p style="margin: 0 0 8px 0; font-weight: 600;">QuickTIMS Service Portal</p>
<p style="margin: 0;">This is an automated notification. Please do not reply directly to this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""
    return html


# -- Primary: combined completion + feedback email ----------------------------

def send_completion_and_feedback_email(service_request, feedback_token: str) -> None:
    """
    Single combined email sent automatically when employee marks job complete.
    Includes: work completion summary + unique feedback link button.
    """
    recipient = service_request.email
    if not recipient:
        logger.info(
            "[ServiceRequests] No email for %s -- completion+feedback email skipped.",
            service_request.request_id,
        )
        return

    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    feedback_url = f"{frontend_url}/feedback/{feedback_token}"

    technician_name = "Our technician"
    if service_request.assigned_employee and service_request.assigned_employee.user:
        u = service_request.assigned_employee.user
        technician_name = u.get_full_name() or u.username

    category_name = _get_category_display_name(service_request)
    completed_on  = timezone.now().strftime("%d %b %Y, %I:%M %p")
    amount_str    = f"${service_request.total_amount:,.2f}" if service_request.total_amount else "N/A"

    subject = (
        f"Work Completed - {service_request.issue_title} "
        f"[{service_request.request_id}]"
    )

    plain_body = (
        f"Dear {service_request.customer_name},\n\n"
        f"Great news! Your service request ({service_request.request_id}) has been completed.\n\n"
        f"Service Details:\n"
        f"  Request ID    : {service_request.request_id}\n"
        f"  Service       : {service_request.issue_title}\n"
        f"  Category      : {category_name}\n"
        f"  Completed By  : {technician_name}\n"
        f"  Completed On  : {completed_on}\n"
        f"  Total Amount  : {amount_str}\n\n"
        f"We would love to hear your feedback! Please rate our service:\n"
        f"{feedback_url}\n\n"
        f"This link is unique to your request and can only be used once.\n\n"
        f"Thank you for choosing our service!\n"
        f"The Service Team\n"
    )

    details = {
        "Request ID"   : service_request.request_id,
        "Service"      : service_request.issue_title,
        "Category"     : category_name,
        "Completed By" : technician_name,
        "Completed On" : completed_on,
        "Total Amount" : amount_str,
    }

    html_body = _render_html_template(
        title=f"Work Completed - {service_request.request_id}",
        greeting=f"Great news, {service_request.customer_name}!",
        intro_text=(
            "Your service request has been successfully completed by our technician. "
            "Below is a summary of the work done. We would love to hear how we did - "
            "please take a moment to rate your experience using the button below."
        ),
        details_dict=details,
        cta_url=feedback_url,
        cta_text="Rate Our Service",
        footer_note=(
            "This feedback link is unique to your request and can only be used once. "
            "If you have any concerns, please contact our support team."
        ),
    )

    try:
        send_mail(
            subject=subject,
            message=plain_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            html_message=html_body,
            fail_silently=False,
        )
        logger.info(
            "[ServiceRequests] Completion+feedback email sent to %s for %s",
            recipient,
            service_request.request_id,
        )
    except Exception as exc:
        logger.error(
            "[ServiceRequests] Failed to send completion+feedback email for %s: %s",
            service_request.request_id,
            exc,
        )


# -- Legacy / admin helpers ---------------------------------------------------

def send_feedback_link(service_request, feedback_token: str) -> None:
    """
    Kept for backward compatibility (admin resend-feedback/ endpoint).
    Sends only the feedback link email when admin manually resends.
    """
    frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
    link = f"{frontend_url}/feedback/{feedback_token}"
    category_name = _get_category_display_name(service_request)

    subject = f"How was your service? [{service_request.request_id}]"
    body = (
        f"Dear {service_request.customer_name},\n\n"
        f"Your service request ({service_request.request_id}) has been completed "
        f"and verified by our team.\n\n"
        f"We would love to hear your feedback. Please click the link below:\n\n"
        f"{link}\n\n"
        f"This link is unique to your request and can only be used once.\n\n"
        f"Thank you for choosing our service.\n"
    )

    details = {
        "Request ID"      : service_request.request_id,
        "Service Category": category_name,
        "Issue Title"     : service_request.issue_title,
    }

    html_body = _render_html_template(
        title="Share Your Feedback",
        greeting=f"Dear {service_request.customer_name},",
        intro_text="Thank you for choosing us! Your service request has been successfully completed and verified. We would love to hear about your experience.",
        details_dict=details,
        cta_url=link,
        cta_text="Rate Our Service",
        footer_note="Note: This feedback link is unique to your request and can only be used once to submit your review."
    )

    recipient = service_request.email
    if not recipient:
        logger.info(
            "[ServiceRequests] No email for %s -- feedback link: %s",
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
        logger.error(
            "[ServiceRequests] Failed to send feedback email for %s: %s",
            service_request.request_id,
            exc,
        )


def send_booking_confirmation(service_request) -> None:
    """Send a booking confirmation email to the customer."""
    category_name = _get_category_display_name(service_request)
    subject = f"Booking Confirmation [{service_request.request_id}]"
    body = (
        f"Dear {service_request.customer_name},\n\n"
        f"Thank you for submitting a service booking request with us.\n\n"
        f"Booking Details:\n"
        f"- Request ID: {service_request.request_id}\n"
        f"- Service Category: {category_name}\n"
        f"- Issue Title: {service_request.issue_title}\n"
        f"- Preferred Date: {service_request.preferred_date}\n\n"
        f"We will review your request and assign a technician shortly.\n\n"
        f"Best regards,\n"
        f"The Service Team\n"
    )

    details = {
        "Request ID"      : service_request.request_id,
        "Service Category": category_name,
        "Issue Title"     : service_request.issue_title,
        "Preferred Date"  : str(service_request.preferred_date),
    }

    html_body = _render_html_template(
        title="Booking Confirmation",
        greeting=f"Dear {service_request.customer_name},",
        intro_text="Thank you for submitting a service booking request with us. Our team is currently reviewing the details and will assign a technician shortly.",
        details_dict=details,
        footer_note="We will send you another update as soon as a technician is assigned to your ticket."
    )

    recipient = service_request.email
    if not recipient:
        logger.info("[ServiceRequests] No email for %s -- booking confirmation skipped.", service_request.request_id)
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
    """DEPRECATED no-op. Use send_completion_and_feedback_email() instead."""
    pass
