"""
service_requests/services/decision_service.py

Unified Customer Decision Engine.
Processes customer decisions (ACCEPT / DECLINE) originating from either:
1. Self-service Customer Portal (tokenized web page)
2. Customer Support Phone CSRs (phone-recorded with mandatory CSR notes)

Both channels trigger the EXACT same underlying business state transitions.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ..models import WorkExtension, EmployeeJob, ServiceRequest


@transaction.atomic
def record_customer_decision(
    extension: WorkExtension,
    decision: str,
    channel: str,
    user=None,
    notes: str = ""
) -> WorkExtension:
    """
    Executes unified customer decision logic.
    :param extension: WorkExtension instance
    :param decision: "ACCEPT" or "DECLINE"
    :param channel: "portal" or "phone"
    :param user: User instance recording decision (required for CSR phone decisions)
    :param notes: Decision notes (mandatory for phone decisions)
    """
    decision_upper = decision.upper()
    if decision_upper not in ["ACCEPT", "DECLINE"]:
        raise ValidationError("Decision must be either 'ACCEPT' or 'DECLINE'.")

    channel_lower = channel.lower()
    if channel_lower not in [WorkExtension.DecisionChannel.PORTAL, WorkExtension.DecisionChannel.PHONE]:
        raise ValidationError("Invalid decision channel.")

    if channel_lower == WorkExtension.DecisionChannel.PHONE:
        if not notes or not notes.strip():
            raise ValidationError("Mandatory audit notes are required for phone decisions.")

    # Idempotency / State guard
    if extension.status not in [WorkExtension.Status.ADMIN_APPROVED, WorkExtension.Status.PENDING_ADMIN_REVIEW]:
        if extension.status in [WorkExtension.Status.CUSTOMER_ACCEPTED, WorkExtension.Status.RESOLVED]:
            raise ValidationError("Decision already recorded: Extension was previously accepted.")
        elif extension.status == WorkExtension.Status.CUSTOMER_DECLINED:
            raise ValidationError("Decision already recorded: Extension was previously declined.")

    # Record decision audit info
    extension.decision_channel = channel_lower
    extension.decision_recorded_by = user
    extension.decision_notes = notes or ""
    extension.decision_timestamp = timezone.now()

    if decision_upper == "ACCEPT":
        extension.final_customer_amount = extension.admin_approved_amount
        if extension.requires_specialist:
            extension.status = WorkExtension.Status.PENDING_ASSIGNMENT
            sr = extension.service_request
            sr.status = ServiceRequest.Status.FOLLOW_UP_REQUIRED
            sr.save(update_fields=["status", "updated_at"])
        else:
            extension.status = WorkExtension.Status.CUSTOMER_ACCEPTED

        # Reserve any associated items that were pending
        for item in extension.items.all():
            if item.status == "PENDING":
                item.status = "RESERVED"
                item.save()

    else: # DECLINE
        extension.status = WorkExtension.Status.CUSTOMER_DECLINED
        
        # Check if original work is impossible without declined extra work
        job = extension.job
        if extension.requires_specialist or "critical" in (notes or "").lower():
            job.status = EmployeeJob.Status.UNABLE_TO_COMPLETE
            job.uncompletion_reason = f"Customer declined necessary additional work: {notes or 'No reason provided'}"
            job.save()

    extension.save()
    return extension
