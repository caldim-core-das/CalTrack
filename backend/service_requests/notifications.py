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


# ─────────────────────────────────────────────────────────────────────────────
# Slice 2 — Reschedule Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_reschedule_created(reschedule_request) -> None:
    """Notify admin when a new reschedule request is created."""
    booking = reschedule_request.booking
    requester = reschedule_request.requested_by

    # Find admin email via company
    admin_email = None
    if booking.company:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        admin = User.objects.filter(company=booking.company, role__in=["admin", "manager"]).first()
        if admin and admin.email:
            admin_email = admin.email

    if not admin_email:
        logger.info("[Reschedule] No admin email found for booking %s", booking.request_id)
        return

    subject = f"[CalTrack] Reschedule Request — {booking.request_id}"
    try:
        send_mail(
            subject,
            (
                f"A reschedule request has been submitted.\n\n"
                f"Booking: {booking.request_id}\n"
                f"Requested By: {requester.get_full_name() or requester.email}\n"
                f"Original Date: {reschedule_request.original_scheduled_at}\n"
                f"Requested Date: {reschedule_request.requested_scheduled_at}\n"
                f"Reason: {reschedule_request.reason}\n\n"
                f"Please review and approve or reject in the admin panel."
            ),
            settings.DEFAULT_FROM_EMAIL,
            [admin_email],
            fail_silently=True,
        )
        logger.info("[Reschedule] Notification sent to %s for booking %s", admin_email, booking.request_id)
    except Exception as exc:
        logger.error("[Reschedule] Failed to notify admin: %s", exc)


def notify_reschedule_decision(reschedule_request) -> None:
    """Notify customer when their reschedule request is approved or rejected."""
    booking = reschedule_request.booking
    customer_email = reschedule_request.requested_by.email
    if not customer_email:
        return

    decision = reschedule_request.status  # APPROVED or REJECTED
    subject = f"[CalTrack] Reschedule {decision.title()} — {booking.request_id}"
    if decision == "APPROVED":
        body = (
            f"Great news! Your reschedule request for booking {booking.request_id} has been APPROVED.\n\n"
            f"New Date: {reschedule_request.requested_scheduled_at}\n"
            f"Notes: {reschedule_request.review_notes or 'N/A'}"
        )
    else:
        body = (
            f"Unfortunately, your reschedule request for booking {booking.request_id} has been REJECTED.\n\n"
            f"Notes: {reschedule_request.review_notes or 'N/A'}\n\n"
            f"Please contact support if you need further assistance."
        )

    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [customer_email], fail_silently=True)
        logger.info("[Reschedule] Decision notification sent to %s", customer_email)
    except Exception as exc:
        logger.error("[Reschedule] Failed to send decision notification: %s", exc)



# ─────────────────────────────────────────────────────────────────────────────
# Slice 2 Extended — New Reschedule Workflow Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_employee_reschedule_request(reschedule_request) -> None:
    """Notify the proposed_technician that they have a reschedule to confirm."""
    emp = reschedule_request.proposed_technician
    if not emp or not emp.user.email:
        return

    booking = reschedule_request.booking
    subject = f"[CalTrack] New Schedule Confirmation Required — {booking.request_id}"
    body = _render_html_template(
        title="Reschedule Confirmation Required",
        greeting=f"Hello {emp.user.get_full_name() or emp.user.username},",
        intro_text="A booking has been rescheduled and requires your confirmation.",
        details_dict={
            "Booking ID": booking.request_id,
            "Service": booking.issue_title,
            "Previous Date": str(reschedule_request.current_date or "N/A"),
            "Previous Slot": reschedule_request.current_time or "N/A",
            "New Date": str(reschedule_request.new_date),
            "New Slot": reschedule_request.new_time_slot,
            "Customer Reason": reschedule_request.get_reason_display(),
        },
        footer_note="Please accept or decline this reschedule in your employee app.",
    )
    try:
        send_mail(subject, f"Reschedule confirmation needed for booking {booking.request_id}.",
                  settings.DEFAULT_FROM_EMAIL, [emp.user.email], html_message=body, fail_silently=True)
        logger.info("[Reschedule] Employee notification sent to %s", emp.user.email)
    except Exception as exc:
        logger.error("[Reschedule] Failed to notify employee: %s", exc)


def notify_admin_employee_rejection(reschedule_request) -> None:
    """Notify admin when employee rejects a reschedule — admin needs to find replacement."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    booking = reschedule_request.booking
    admin = None
    if booking.company:
        admin = User.objects.filter(company=booking.company, role__in=["admin", "manager"]).first()
    if not admin:
        admin = User.objects.filter(role__in=["admin", "manager"]).first()

    if not admin or not admin.email:
        return

    emp = reschedule_request.proposed_technician
    emp_name = emp.user.get_full_name() if emp else "Employee"
    subject = f"[CalTrack] Employee Declined Reschedule — {booking.request_id} (Action Required)"
    body = (
        f"An employee has declined the reschedule assignment.\n\n"
        f"Booking: {booking.request_id}\n"
        f"Employee: {emp_name}\n"
        f"Reason: {reschedule_request.get_employee_rejection_reason_display() if reschedule_request.employee_rejection_reason else 'Not specified'}\n"
        f"Notes: {reschedule_request.employee_response_note or 'N/A'}\n\n"
        f"Please log in to the admin panel to reassign another technician."
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [admin.email], fail_silently=True)
        logger.info("[Reschedule] Admin notified of employee rejection for %s", booking.request_id)
    except Exception as exc:
        logger.error("[Reschedule] Failed to notify admin of rejection: %s", exc)


def notify_customer_slot_suggestion(reschedule_request) -> None:
    """Notify customer that admin has suggested an alternate slot."""
    customer_email = reschedule_request.requested_by.email
    if not customer_email:
        return

    booking = reschedule_request.booking
    subject = f"[CalTrack] Admin Suggested a New Slot — {booking.request_id}"
    body = _render_html_template(
        title="New Slot Suggested",
        greeting=f"Hello {reschedule_request.requested_by.get_full_name() or 'Customer'},",
        intro_text="Our team has reviewed your reschedule request and would like to suggest an alternate time slot.",
        details_dict={
            "Booking ID": booking.request_id,
            "Your Requested Date": str(reschedule_request.new_date),
            "Suggested New Date": str(reschedule_request.suggested_date or "N/A"),
            "Suggested New Slot": reschedule_request.suggested_time_slot or "N/A",
            "Admin Notes": reschedule_request.review_notes or "N/A",
        },
        footer_note="Please log in to your account to accept or decline this suggestion.",
    )
    try:
        send_mail(subject, "Admin has suggested a new schedule slot for your booking.",
                  settings.DEFAULT_FROM_EMAIL, [customer_email], html_message=body, fail_silently=True)
        logger.info("[Reschedule] Slot suggestion notification sent to %s", customer_email)
    except Exception as exc:
        logger.error("[Reschedule] Failed to notify customer of slot suggestion: %s", exc)


def notify_customer_rescheduled(reschedule_request) -> None:
    """Notify customer that their booking has been successfully rescheduled (terminal success)."""
    customer_email = reschedule_request.requested_by.email
    if not customer_email:
        return

    booking = reschedule_request.booking
    emp = reschedule_request.proposed_technician
    subject = f"[CalTrack] Booking Rescheduled Successfully — {booking.request_id}"
    body = _render_html_template(
        title="Booking Rescheduled",
        greeting=f"Hello {reschedule_request.requested_by.get_full_name() or 'Customer'},",
        intro_text="Great news! Your booking has been successfully rescheduled and confirmed.",
        details_dict={
            "Booking ID": booking.request_id,
            "Service": booking.issue_title,
            "New Date": str(reschedule_request.new_date),
            "New Time Slot": reschedule_request.new_time_slot,
            "Assigned Technician": emp.user.get_full_name() if emp else "To be assigned",
        },
        footer_note="We look forward to serving you. You will receive a reminder closer to the appointment.",
    )
    try:
        send_mail(subject, f"Your booking {booking.request_id} has been rescheduled.",
                  settings.DEFAULT_FROM_EMAIL, [customer_email], html_message=body, fail_silently=True)
        logger.info("[Reschedule] Customer rescheduled notification sent to %s", customer_email)
    except Exception as exc:
        logger.error("[Reschedule] Failed to send rescheduled notification: %s", exc)


def notify_customer_reschedule_rejected(reschedule_request) -> None:
    """Notify customer that their reschedule request was rejected."""
    customer_email = reschedule_request.requested_by.email
    if not customer_email:
        return

    booking = reschedule_request.booking
    subject = f"[CalTrack] Reschedule Request Rejected — {booking.request_id}"
    body = (
        f"Unfortunately, your reschedule request for booking {booking.request_id} could not be approved.\n\n"
        f"Reason: {reschedule_request.get_rejection_reason_display() if reschedule_request.rejection_reason else 'N/A'}\n"
        f"Notes: {reschedule_request.rejection_notes or reschedule_request.review_notes or 'N/A'}\n\n"
        f"Please contact support if you need further assistance."
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [customer_email], fail_silently=True)
        logger.info("[Reschedule] Rejection notification sent to %s", customer_email)
    except Exception as exc:
        logger.error("[Reschedule] Failed to send rejection notification: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Slice 3 — Refund Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_refund_status_change(refund_request) -> None:
    """Notify customer on APPROVED, REJECTED, PROCESSED, FAILED."""
    customer = refund_request.requested_by
    if not customer.email:
        return

    status = refund_request.status
    booking = refund_request.booking
    subject = f"[CalTrack] Refund {status.title()} — {booking.request_id}"

    status_messages = {
        "APPROVED":  f"Your refund of ₹{refund_request.amount} for booking {booking.request_id} has been APPROVED and will be processed shortly.",
        "REJECTED":  f"Your refund request for booking {booking.request_id} has been REJECTED.\nNotes: {refund_request.admin_notes or 'N/A'}",
        "PROCESSED": f"Your refund of ₹{refund_request.amount} for booking {booking.request_id} has been PROCESSED.\nReference: {refund_request.gateway_reference or 'N/A'}",
        "FAILED":    f"Your refund for booking {booking.request_id} FAILED to process. Our team will retry.\nNotes: {refund_request.admin_notes or 'N/A'}",
    }
    body = status_messages.get(status, f"Your refund request status is now: {status}.")

    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [customer.email], fail_silently=True)
        logger.info("[Refund] Status notification sent to %s — %s", customer.email, status)
    except Exception as exc:
        logger.error("[Refund] Failed to send status notification: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Slice 4 — Complaint Notifications
# ─────────────────────────────────────────────────────────────────────────────

def notify_complaint_created(complaint) -> None:
    """Notify admin when a new complaint is created."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # Get admin from same company as the linked booking (if any)
    admin = None
    if complaint.booking and complaint.booking.company:
        admin = User.objects.filter(company=complaint.booking.company, role__in=["admin", "manager"]).first()
    if not admin:
        admin = User.objects.filter(role__in=["admin", "manager"]).first()

    if not admin or not admin.email:
        return

    customer = complaint.raised_by
    booking_ref = complaint.booking.request_id if complaint.booking else "General"
    subject = f"[CalTrack] New Complaint — {complaint.get_category_display()} (Booking: {booking_ref})"
    body = (
        f"A new complaint has been filed.\n\n"
        f"Category: {complaint.get_category_display()}\n"
        f"Customer: {customer.get_full_name() or customer.email}\n"
        f"Booking: {booking_ref}\n"
        f"Description: {complaint.description}\n\n"
        f"Please review in the admin panel."
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [admin.email], fail_silently=True)
        logger.info("[Complaint] Created notification sent to %s", admin.email)
    except Exception as exc:
        logger.error("[Complaint] Failed to send created notification: %s", exc)


def notify_complaint_status_change(complaint) -> None:
    """Notify customer when complaint status changes."""
    customer_email = complaint.raised_by.email
    if not customer_email:
        return

    subject = f"[CalTrack] Complaint Update — {complaint.get_status_display()}"
    body = (
        f"Your complaint has been updated.\n\n"
        f"Category: {complaint.get_category_display()}\n"
        f"New Status: {complaint.get_status_display()}\n"
        f"Resolution Notes: {complaint.resolution_notes or 'N/A'}"
    )
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [customer_email], fail_silently=True)
    except Exception as exc:
        logger.error("[Complaint] Failed to send status change notification: %s", exc)


def notify_complaint_response(complaint, response) -> None:
    """Notify customer (and employee if relevant) when a new response is added."""
    recipients = set()

    # Notify customer unless the responder IS the customer
    customer_email = complaint.raised_by.email
    if customer_email and response.responder_id != complaint.raised_by_id:
        recipients.add(customer_email)

    # If response is from admin/customer, notify assigned employee
    if complaint.assigned_employee and complaint.assigned_employee.user.email:
        if response.persona in ("ADMIN", "CUSTOMER"):
            recipients.add(complaint.assigned_employee.user.email)

    for email in recipients:
        try:
            send_mail(
                f"[CalTrack] New Response on Your Complaint",
                f"A new response has been added to your complaint.\n\n{response.message}",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
        except Exception as exc:
            logger.error("[Complaint] Failed to send response notification: %s", exc)


def notify_complaint_assigned(complaint) -> None:
    """Notify assigned employee that a complaint has been assigned to them."""
    if not complaint.assigned_employee:
        return
    emp_email = getattr(complaint.assigned_employee.user, "email", None)
    if not emp_email:
        return

    customer = complaint.raised_by
    try:
        send_mail(
            "[CalTrack] Complaint Assigned To You",
            (
                f"A complaint has been assigned to you.\n\n"
                f"Category: {complaint.get_category_display()}\n"
                f"Customer: {customer.get_full_name() or customer.email}\n"
                f"Description: {complaint.description}\n\n"
                f"Please review and respond via the app."
            ),
            settings.DEFAULT_FROM_EMAIL,
            [emp_email],
            fail_silently=True,
        )
        logger.info("[Complaint] Assignment notification sent to %s", emp_email)
    except Exception as exc:
        logger.error("[Complaint] Failed to send assignment notification: %s", exc)
