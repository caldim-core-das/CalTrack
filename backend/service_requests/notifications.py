"""
service_requests/notifications.py

Notification helpers for the service request pipeline.
In dev: prints to console (matches EMAIL_BACKEND = console).
In prod: sends via the configured SMTP backend.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


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
            fail_silently=False,
        )
        logger.info("[ServiceRequests] Booking confirmation sent to %s for %s", recipient, service_request.request_id)
    except Exception as exc:
        logger.error("[ServiceRequests] Failed to send booking confirmation email for %s: %s", service_request.request_id, exc)

