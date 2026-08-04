"""
service_requests/services.py

Business logic for:
  - Slice 2: RescheduleRequest
  - Slice 3: RefundRequest
  - Slice 4: Complaint / ComplaintMessage

Rules:
  - No direct model.status = "..." assignments anywhere — all transitions go through apply_*_transition()
  - All querysets scoped to the requesting persona
  - No bare 400 raises — domain exceptions via rest_framework.exceptions
"""
from django.db.models import Q, F
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied

from employees.models import Employee
from .models import (
    RescheduleRequest, RescheduleStatus, RescheduleReason, TimeSlotChoices, RescheduleAttachment,
    RescheduleRejectionReason, EmployeeResponseChoices, EmployeeRejectionReason,
    RefundRequest, RefundStatus, RefundType, RefundReason, RefundInfoTarget, RefundEvidence, RefundInvestigationNote,
    Complaint, ComplaintAttachment, ComplaintMessage, ServiceRequest,
)


# ═══════════════════════════════════════════════════════════════════════════════
# STATE MACHINES
# ═══════════════════════════════════════════════════════════════════════════════

_RESCHEDULE_TRANSITIONS = {
    # ── Complete Manual Workflow State Machine ──────────────────────────────────
    RescheduleStatus.PENDING: {
        RescheduleStatus.PENDING_ADMIN_REVIEW,
        RescheduleStatus.ADMIN_REVIEW,
        RescheduleStatus.ADMIN_APPROVED,
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.SLOT_SUGGESTED,
        RescheduleStatus.REJECTED,
        RescheduleStatus.CANCELLED,
    },
    RescheduleStatus.PENDING_ADMIN_REVIEW: {
        RescheduleStatus.ADMIN_REVIEW,
        RescheduleStatus.ADMIN_APPROVED,
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.SLOT_SUGGESTED,
        RescheduleStatus.REJECTED,
        RescheduleStatus.CANCELLED,
    },
    RescheduleStatus.ADMIN_REVIEW: {
        RescheduleStatus.ADMIN_APPROVED,
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.SLOT_SUGGESTED,
        RescheduleStatus.REJECTED,
        RescheduleStatus.CANCELLED,
    },
    RescheduleStatus.ADMIN_APPROVED: {
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.EMPLOYEE_ASSIGNED: {
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.EMPLOYEE_ACCEPTED,
        RescheduleStatus.EMPLOYEE_CONFIRMED,
        RescheduleStatus.EMPLOYEE_REJECTED,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.BOOKING_UPDATED,
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION: {
        RescheduleStatus.EMPLOYEE_ACCEPTED,
        RescheduleStatus.EMPLOYEE_CONFIRMED,
        RescheduleStatus.EMPLOYEE_REJECTED,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.BOOKING_UPDATED,
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE: {
        RescheduleStatus.EMPLOYEE_ACCEPTED,
        RescheduleStatus.EMPLOYEE_CONFIRMED,
        RescheduleStatus.EMPLOYEE_REJECTED,
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.BOOKING_UPDATED,
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.EMPLOYEE_ACCEPTED: {
        RescheduleStatus.BOOKING_UPDATED,
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.EMPLOYEE_REJECTED: {
        RescheduleStatus.REASSIGNMENT_NEEDED,
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.REASSIGNMENT_NEEDED: {
        RescheduleStatus.EMPLOYEE_ASSIGNED,
        RescheduleStatus.AWAITING_EMPLOYEE_CONFIRMATION,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        RescheduleStatus.SLOT_SUGGESTED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.BOOKING_UPDATED: {
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
    },
    RescheduleStatus.SLOT_SUGGESTED: {
        RescheduleStatus.ADMIN_REVIEW,
        RescheduleStatus.REJECTED,
    },
    # ── Terminal states ────────────────────────────────────────────────────
    RescheduleStatus.RESCHEDULED: set(),
    RescheduleStatus.REJECTED:    set(),
    RescheduleStatus.CANCELLED:   set(),
    # ── Legacy statuses (backward compat) ───────────────────────────────────
    RescheduleStatus.TECHNICIAN_CONFIRMATION: {
        RescheduleStatus.APPROVED,
        RescheduleStatus.REJECTED,
        RescheduleStatus.ADMIN_REVIEW,
    },
    RescheduleStatus.APPROVED: {
        RescheduleStatus.CUSTOMER_NOTIFIED,
        RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
    },
    RescheduleStatus.CUSTOMER_NOTIFIED: set(),
}

_REFUND_TRANSITIONS = {
    RefundStatus.PENDING:          {RefundStatus.INFO_REQUESTED, RefundStatus.APPROVED_FULL, RefundStatus.APPROVED_PARTIAL, RefundStatus.REJECTED},
    RefundStatus.INFO_REQUESTED:   {RefundStatus.PENDING, RefundStatus.REJECTED},
    RefundStatus.APPROVED_FULL:    {RefundStatus.SENT_TO_FINANCE},
    RefundStatus.APPROVED_PARTIAL: {RefundStatus.SENT_TO_FINANCE},
    RefundStatus.SENT_TO_FINANCE:  {RefundStatus.COMPLETED},
    RefundStatus.REJECTED:         set(),
    RefundStatus.COMPLETED:        set(),
}

_COMPLAINT_TRANSITIONS = {
    "OPEN":        {"IN_PROGRESS", "ESCALATED", "CLOSED"},
    "IN_PROGRESS": {"RESOLVED", "ESCALATED"},
    "RESOLVED":    {"CLOSED", "IN_PROGRESS"},   # allow reopen
    "ESCALATED":   {"IN_PROGRESS", "RESOLVED"},
    "CLOSED":      set(),
}


def auto_reassign_technician(reschedule_request):
    """
    Pulls from Assignment Engine efficiency score (EmployeePerformance) to pick next available technician.
    """
    company = reschedule_request.booking.company
    target_date = reschedule_request.new_date
    slot = reschedule_request.new_time_slot

    declined_tech = reschedule_request.proposed_technician
    employees = Employee.objects.all()
    if company:
        employees = employees.filter(company=company)
    if declined_tech:
        employees = employees.exclude(id=declined_tech.id)

    busy_emp_ids = ServiceRequest.objects.filter(
        company=company,
        preferred_date=target_date,
        preferred_time=slot,
        assigned_employee__isnull=False
    ).values_list("assigned_employee_id", flat=True)

    available_employees = employees.exclude(id__in=busy_emp_ids)

    best_tech = available_employees.select_related("performance").order_by(
        "-performance__average_rating",
        "-performance__customer_satisfaction_score",
        "-performance__completion_rate"
    ).first()

    if best_tech:
        reschedule_request.proposed_technician = best_tech

    reschedule_request.save(update_fields=["proposed_technician"])
    return best_tech


def suggest_alternate_slot(reschedule_request):
    """
    Returns next 3 available time slots for admin review.
    """
    from datetime import timedelta
    company = reschedule_request.booking.company
    start_date = reschedule_request.new_date or timezone.now().date()

    slots_choices = [c[0] for c in TimeSlotChoices.choices]
    suggestions = []

    for day_offset in range(1, 8):
        check_date = start_date + timedelta(days=day_offset)
        for slot in slots_choices:
            employees = Employee.objects.all()
            if company:
                employees = employees.filter(company=company)
            busy_emp_ids = ServiceRequest.objects.filter(
                company=company,
                preferred_date=check_date,
                preferred_time=slot,
                assigned_employee__isnull=False
            ).values_list("assigned_employee_id", flat=True)
            avail_count = employees.exclude(id__in=busy_emp_ids).count()

            if avail_count > 0:
                suggestions.append({
                    "date": check_date.strftime("%Y-%m-%d"),
                    "time_slot": slot,
                    "available_technicians": avail_count
                })
                if len(suggestions) >= 3:
                    break
        if len(suggestions) >= 3:
            break

    reschedule_request.alternate_slots_suggested = suggestions
    reschedule_request.save(update_fields=["alternate_slots_suggested"])
    return suggestions


def get_real_technician_availability(company, target_date):
    """
    Computes real availability per time slot for a given company and date.
    """
    slots = []
    employees = Employee.objects.all()
    if company:
        employees = employees.filter(company=company)

    total_technicians = employees.count()

    for slot_code, slot_label in TimeSlotChoices.choices:
        busy_emp_ids = ServiceRequest.objects.filter(
            company=company,
            preferred_date=target_date,
            preferred_time=slot_code,
            assigned_employee__isnull=False
        ).values_list("assigned_employee_id", flat=True)

        available_count = employees.exclude(id__in=busy_emp_ids).count()
        slots.append({
            "time_slot": slot_code,
            "label": slot_label,
            "available_count": available_count,
            "total_technicians": total_technicians,
            "is_available": available_count > 0,
        })
    return slots


def is_booking_reschedule_eligible(booking):
    """
    Checks if a booking is eligible for rescheduling per specification rules:
    - Status in ["new_request", "reviewed", "confirmed", "assigned", "accepted"]
    - No open non-terminal RescheduleRequest exists for this booking.
    """
    allowed_booking_statuses = ["new_request", "reviewed", "confirmed", "assigned", "accepted"]
    if booking.status not in allowed_booking_statuses:
        st_display = getattr(booking, 'get_status_display', lambda: booking.status)()
        return False, f"Reschedule is unavailable for booking in '{st_display}' status."

    terminal_reschedule_statuses = [
        RescheduleStatus.RESCHEDULED,
        RescheduleStatus.REJECTED,
        RescheduleStatus.CANCELLED,
        RescheduleStatus.CANCELLED_SUGGESTION,
    ]
    active_req = RescheduleRequest.objects.filter(booking=booking).exclude(status__in=terminal_reschedule_statuses).exists()
    if active_req:
        return False, "A reschedule request is already in progress for this booking."

    return True, "Eligible for rescheduling"


def apply_reschedule_transition(reschedule_request, new_status, actor=None, note=None, proposed_technician=None, new_date=None, new_time_slot=None):
    """
    Applies a state transition to a RescheduleRequest enforcing allowed edge validations.
    Automatically logs transition history in RescheduleStatusHistory audit table.
    """
    current = reschedule_request.status
    allowed = _RESCHEDULE_TRANSITIONS.get(current, set())

    if new_status not in allowed and current != new_status:
        raise ValidationError({
            "detail": f"Cannot transition RescheduleRequest from '{current}' to '{new_status}'. Allowed transitions: {list(allowed) or 'none (terminal)'}."
        })

    from_status = current
    reschedule_request.status = new_status
    if note:
        reschedule_request.review_notes = note

    if new_date:
        reschedule_request.new_date = new_date
    if new_time_slot:
        reschedule_request.new_time_slot = new_time_slot
    if proposed_technician:
        reschedule_request.proposed_technician = proposed_technician

    if actor and hasattr(actor, 'id'):
        reschedule_request.reviewed_by = actor
        reschedule_request.reviewed_at = timezone.now()
    reschedule_request.save()

    # Automatically sync booking preferred_date, preferred_time, and assigned_employee
    booking = reschedule_request.booking
    if booking:
        upd = []
        if reschedule_request.new_date and booking.preferred_date != reschedule_request.new_date:
            booking.preferred_date = reschedule_request.new_date
            upd.append("preferred_date")
        if reschedule_request.new_time_slot and booking.preferred_time != reschedule_request.new_time_slot:
            booking.preferred_time = reschedule_request.new_time_slot
            upd.append("preferred_time")
        if reschedule_request.proposed_technician and booking.assigned_employee != reschedule_request.proposed_technician:
            booking.assigned_employee = reschedule_request.proposed_technician
            upd.append("assigned_employee")
        if upd:
            upd.append("updated_at")
            booking.save(update_fields=upd)

    # Audit log in RescheduleStatusHistory
    try:
        from .models import RescheduleStatusHistory
        RescheduleStatusHistory.objects.create(
            request=reschedule_request,
            from_status=from_status,
            to_status=new_status,
            changed_by=actor if (actor and hasattr(actor, 'id')) else None,
            note=note or ""
        )
    except Exception:
        pass

    return reschedule_request


def apply_refund_transition(refund_request, new_status, actor, note=None, approved_amount=None, info_requested_from=None, assigned_employee=None):
    """
    State transition engine for RefundRequest models.
    Enforces strict STATUS_TRANSITIONS map.
    """
    current_status = refund_request.status
    allowed = _REFUND_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValidationError({
            "detail": f"Invalid refund transition from '{current_status}' to '{new_status}'. Allowed transitions: {list(allowed)}"
        })

    refund_request.status = new_status
    if approved_amount is not None:
        refund_request.approved_amount = approved_amount
    if info_requested_from:
        refund_request.info_requested_from = info_requested_from
    if assigned_employee:
        refund_request.assigned_employee = assigned_employee

    if note:
        timestamp = timezone.now().strftime("%Y-%m-%d %H:%M")
        actor_name = getattr(actor, "get_full_name", lambda: str(actor))() or str(actor)
        entry = f"[{timestamp}] {actor_name} ({new_status}): {note}"
        refund_request.internal_notes = f"{refund_request.internal_notes}\n{entry}".strip()

    refund_request.save()
    return refund_request


def apply_transition(obj, new_status, actor, note=None, notes=None, proposed_technician=None, new_date=None, new_time_slot=None, approved_amount=None, info_requested_from=None, assigned_employee=None):
    """
    Polymorphic apply_transition for RescheduleRequest, RefundRequest, and Complaint models.
    """
    if isinstance(obj, RescheduleRequest):
        return apply_reschedule_transition(
            reschedule_request=obj,
            new_status=new_status,
            actor=actor,
            note=note or notes,
            proposed_technician=proposed_technician,
            new_date=new_date,
            new_time_slot=new_time_slot
        )
    elif isinstance(obj, RefundRequest):
        return apply_refund_transition(
            refund_request=obj,
            new_status=new_status,
            actor=actor,
            note=note or notes,
            approved_amount=approved_amount,
            info_requested_from=info_requested_from,
            assigned_employee=assigned_employee
        )
    elif isinstance(obj, Complaint):
        return _apply_complaint_transition(complaint=obj, new_status=new_status, actor=actor, notes=notes or note)
    else:
        raise ValidationError({"detail": f"Unsupported object type for transition: {type(obj)}"})


# ═══════════════════════════════════════════════════════════════════════════════
# SLICE 2 — RESCHEDULE
# ═══════════════════════════════════════════════════════════════════════════════

_NON_RESCHEDULABLE = {"closed", "rejected", "completed", "awaiting_verification", "verified", "feedback_pending", "feedback_received"}


def create_reschedule_request(booking, requested_by, new_date, new_time_slot, reason, persona="CUSTOMER", additional_notes="", attachment=None):
    """
    Create a new RescheduleRequest for a booking. Validates eligibility and initial state transition.
    """
    eligible, ineligible_reason = is_booking_reschedule_eligible(booking)
    if not eligible:
        raise ValidationError({"detail": ineligible_reason})

    assigned_emp = booking.assigned_employee

    rr = RescheduleRequest.objects.create(
        booking=booking,
        requested_by=requested_by,
        persona=persona,
        proposed_technician=assigned_emp,
        current_date=booking.preferred_date,
        current_time=booking.preferred_time,
        new_date=new_date,
        new_time_slot=new_time_slot,
        reason=reason,
        additional_notes=additional_notes,
        attachment=attachment,
        status=RescheduleStatus.PENDING_ADMIN_REVIEW,
    )

    try:
        from .models import RescheduleStatusHistory
        RescheduleStatusHistory.objects.create(
            request=rr,
            from_status="NONE",
            to_status=RescheduleStatus.PENDING_ADMIN_REVIEW,
            changed_by=requested_by,
            note="Reschedule request created by customer"
        )
    except Exception:
        pass

    try:
        from .notifications import notify_reschedule_created
        notify_reschedule_created(rr)
    except Exception:
        pass

    return rr


def cancel_reschedule_request(customer_or_request, request_id_or_actor=None):
    """
    Cancel a PENDING reschedule request.
    Supports signatures:
      - cancel_reschedule_request(customer_user, request_id)
      - cancel_reschedule_request(reschedule_request_obj, actor_user)
    """
    if isinstance(customer_or_request, RescheduleRequest):
        rr = customer_or_request
        actor = request_id_or_actor
    else:
        customer = customer_or_request
        request_id = request_id_or_actor
        try:
            rr = RescheduleRequest.objects.get(pk=request_id)
        except RescheduleRequest.DoesNotExist:
            raise ValidationError({"detail": "Reschedule request not found."})
        actor = customer

    if rr.status != RescheduleStatus.PENDING:
        raise ValidationError({"detail": f"Cannot cancel reschedule request with status '{rr.status}'. Only PENDING requests can be cancelled."})

    is_admin = getattr(actor, "role", None) in ("admin", "manager")
    is_requester = (rr.requested_by_id == getattr(actor, "pk", None)) or (rr.requested_by == actor)

    if not (is_admin or is_requester):
        raise PermissionDenied({"detail": "Only the original requester or an Admin can cancel this reschedule."})

    _apply_reschedule_transition(rr, "CANCELLED", actor)
    return rr


def list_reschedule_requests(actor, persona, filters=None):
    """
    Return persona-scoped queryset of reschedule requests.
      - CUSTOMER: only their own bookings' requests
      - EMPLOYEE: requests for bookings assigned to them
      - ADMIN:    all requests (with optional filters)
    """
    qs = RescheduleRequest.objects.select_related("booking", "requested_by", "reviewed_by")

    if persona == "CUSTOMER":
        qs = qs.filter(requested_by=actor)
    elif persona == "EMPLOYEE":
        try:
            from employees.models import Employee
            emp = Employee.objects.get(user=actor)
            qs = qs.filter(booking__assigned_employee=emp)
        except Exception:
            qs = qs.none()
    # ADMIN: no extra filter

    if filters:
        status_filter = filters.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter.upper())

    return qs.order_by("-created_at")


# ═══════════════════════════════════════════════════════════════════════════════
# EXTENDED RESCHEDULE WORKFLOW — SERVICE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _get_employee_for_booking(booking):
    """Return the currently assigned Employee for a booking, or None."""
    if booking.assigned_employee:
        return booking.assigned_employee
    try:
        job = booking.employee_job
        return job.employee
    except Exception:
        return None


def check_employee_availability(employee, new_date, new_time_slot):
    """
    Returns True if the employee has no conflicting booking on the given date/slot.
    Reuses the same availability logic as auto_reassign_technician.
    """
    busy = ServiceRequest.objects.filter(
        assigned_employee=employee,
        preferred_date=new_date,
        preferred_time=new_time_slot,
    ).exists()
    return not busy


def admin_approve_reschedule(admin, request_id, notes=""):
    """
    Admin approves a reschedule request.
    - Validates the request is in PENDING, PENDING_ADMIN_REVIEW, or ADMIN_REVIEW state.
    - Checks if the assigned (or proposed) employee is available on the new date/slot.
    - If available: transitions to AWAITING_EMPLOYEE_RESPONSE / AWAITING_EMPLOYEE_CONFIRMATION and notifies employee.
    - If NOT available: transitions to REASSIGNMENT_NEEDED, attempts auto-reassignment;
      if no one found, transitions to REJECTED.
    """
    try:
        rr = RescheduleRequest.objects.select_related("booking", "proposed_technician").get(pk=request_id)
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": f"RescheduleRequest #{request_id} not found."})

    allowed_approve_statuses = (
        RescheduleStatus.ADMIN_REVIEW,
        RescheduleStatus.PENDING,
        RescheduleStatus.PENDING_ADMIN_REVIEW,
        RescheduleStatus.REASSIGNMENT_NEEDED,
    )
    if rr.status not in allowed_approve_statuses:
        raise ValidationError({"detail": f"Cannot approve reschedule in status '{rr.status}'."})

    # Stamp admin reviewer
    rr.admin_reviewed_by = admin
    rr.reviewed_by = admin
    rr.reviewed_at = timezone.now()
    if notes:
        rr.review_notes = notes
    rr.save(update_fields=["admin_reviewed_by", "reviewed_by", "reviewed_at", "review_notes"])

    # Determine which employee to check
    employee = rr.proposed_technician or _get_employee_for_booking(rr.booking)
    awaiting_status = getattr(RescheduleStatus, 'AWAITING_EMPLOYEE_CONFIRMATION', RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE)

    if employee and check_employee_availability(employee, rr.new_date, rr.new_time_slot):
        # Employee available — notify them and await response
        if not rr.proposed_technician:
            rr.proposed_technician = employee
            rr.save(update_fields=["proposed_technician"])

        apply_reschedule_transition(rr, awaiting_status, admin, note=notes)

        try:
            from .notifications import notify_employee_reschedule_request
            notify_employee_reschedule_request(rr)
        except Exception:
            pass

    else:
        # Employee unavailable — try to find another
        apply_reschedule_transition(rr, RescheduleStatus.REASSIGNMENT_NEEDED, admin, note=notes)
        new_emp = auto_reassign_technician(rr)

        if new_emp:
            # Found a replacement — immediately notify them
            apply_reschedule_transition(rr, awaiting_status, admin, note="Auto-reassigned after availability conflict")
            try:
                from .notifications import notify_employee_reschedule_request
                notify_employee_reschedule_request(rr)
            except Exception:
                pass
        else:
            # No employee found at all — reject
            from .models import RescheduleRejectionReason
            rr.rejection_reason = RescheduleRejectionReason.EMPLOYEE_UNAVAILABLE
            rr.rejection_notes = "No available employee found for the requested time slot."
            rr.save(update_fields=["rejection_reason", "rejection_notes"])
            apply_reschedule_transition(rr, RescheduleStatus.REJECTED, admin, note="No available employee found.")
            try:
                from .notifications import notify_customer_reschedule_rejected
                notify_customer_reschedule_rejected(rr)
            except Exception:
                pass

    return rr


def admin_reject_reschedule(admin, request_id, reason, notes=""):
    """
    Admin rejects a reschedule request outright.
    """
    try:
        rr = RescheduleRequest.objects.select_related("booking").get(pk=request_id)
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": f"RescheduleRequest #{request_id} not found."})

    if rr.status not in (RescheduleStatus.ADMIN_REVIEW, RescheduleStatus.PENDING, RescheduleStatus.REASSIGNMENT_NEEDED):
        raise ValidationError({"detail": f"Cannot reject reschedule in status '{rr.status}'."})

    rr.rejection_reason = reason
    rr.rejection_notes = notes
    rr.admin_reviewed_by = admin
    rr.reviewed_by = admin
    rr.reviewed_at = timezone.now()
    rr.save(update_fields=["rejection_reason", "rejection_notes", "admin_reviewed_by", "reviewed_by", "reviewed_at"])

    apply_reschedule_transition(rr, RescheduleStatus.REJECTED, admin, note=notes)

    try:
        from .notifications import notify_customer_reschedule_rejected
        notify_customer_reschedule_rejected(rr)
    except Exception:
        pass

    return rr


def admin_suggest_new_slot(admin, request_id, suggested_date, suggested_time_slot, notes=""):
    """
    Admin proposes an alternate date/time slot to the customer.
    """
    try:
        rr = RescheduleRequest.objects.select_related("booking").get(pk=request_id)
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": f"RescheduleRequest #{request_id} not found."})

    if rr.status not in (RescheduleStatus.ADMIN_REVIEW, RescheduleStatus.PENDING):
        raise ValidationError({"detail": f"Cannot suggest slot for reschedule in status '{rr.status}'."})

    rr.suggested_date = suggested_date
    rr.suggested_time_slot = suggested_time_slot
    rr.admin_reviewed_by = admin
    rr.reviewed_by = admin
    rr.reviewed_at = timezone.now()
    if notes:
        rr.review_notes = notes
    rr.save(update_fields=["suggested_date", "suggested_time_slot", "admin_reviewed_by", "reviewed_by", "reviewed_at", "review_notes"])

    apply_reschedule_transition(rr, RescheduleStatus.SLOT_SUGGESTED, admin, note=notes)

    try:
        from .notifications import notify_customer_slot_suggestion
        notify_customer_slot_suggestion(rr)
    except Exception:
        pass

    return rr


def admin_reassign_employee(admin, request_id, employee_id):
    """
    Admin manually reassigns a new employee after REASSIGNMENT_NEEDED.
    Transitions to AWAITING_EMPLOYEE_RESPONSE.
    """
    try:
        rr = RescheduleRequest.objects.select_related("booking").get(pk=request_id)
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": f"RescheduleRequest #{request_id} not found."})

    if rr.status != RescheduleStatus.REASSIGNMENT_NEEDED:
        raise ValidationError({"detail": f"Cannot reassign employee for reschedule in status '{rr.status}'. Must be REASSIGNMENT_NEEDED."})

    try:
        new_employee = Employee.objects.get(pk=employee_id)
    except Employee.DoesNotExist:
        raise ValidationError({"detail": f"Employee #{employee_id} not found."})

    rr.proposed_technician = new_employee
    rr.save(update_fields=["proposed_technician"])

    apply_reschedule_transition(rr, RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE, admin, note=f"Reassigned to {new_employee.user.get_full_name() or new_employee.employee_id}")

    try:
        from .notifications import notify_employee_reschedule_request
        notify_employee_reschedule_request(rr)
    except Exception:
        pass

    return rr


def customer_respond_to_suggestion(customer, request_id, accept):
    """
    Customer responds to an admin-suggested slot.
    - If accept=True: updates new_date/new_time_slot from suggested_* and re-enters ADMIN_REVIEW.
    - If accept=False: transitions to REJECTED.
    """
    try:
        rr = RescheduleRequest.objects.select_related("booking").get(pk=request_id, requested_by=customer)
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": "Reschedule request not found or not owned by user."})

    if rr.status != RescheduleStatus.SLOT_SUGGESTED:
        raise ValidationError({"detail": f"No suggested slot to respond to (status: {rr.status})."})

    if accept:
        # Update new_date/slot from suggested values
        rr.new_date = rr.suggested_date
        rr.new_time_slot = rr.suggested_time_slot
        rr.save(update_fields=["new_date", "new_time_slot"])
        apply_reschedule_transition(rr, RescheduleStatus.ADMIN_REVIEW, customer, note="Customer accepted admin-suggested slot. Re-entering review.")
    else:
        apply_reschedule_transition(rr, RescheduleStatus.REJECTED, customer, note="Customer declined admin-suggested slot.")
        try:
            from .notifications import notify_customer_reschedule_rejected
            notify_customer_reschedule_rejected(rr)
        except Exception:
            pass

    return rr


def employee_accept_reschedule(employee_user, request_id):
    """
    Employee confirms they can take the rescheduled booking.
    - Validates the employee is the proposed_technician.
    - Transitions to RESCHEDULED.
    - Updates booking.preferred_date / preferred_time / assigned_employee.
    - Notifies customer.
    """
    try:
        emp = Employee.objects.get(user=employee_user)
    except Employee.DoesNotExist:
        raise ValidationError({"detail": "User is not registered as an employee."})

    try:
        rr = RescheduleRequest.objects.select_related("booking", "proposed_technician").get(
            pk=request_id,
            proposed_technician=emp,
        )
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": "No reschedule notification found for this employee."})

    # Record employee acceptance
    rr.employee_response = EmployeeResponseChoices.ACCEPTED
    rr.employee_responded_at = timezone.now()
    rr.save(update_fields=["employee_response", "employee_responded_at"])

    # Transition to RESCHEDULED (terminal)
    apply_reschedule_transition(rr, RescheduleStatus.RESCHEDULED, employee_user, note="Employee confirmed availability.")

    # Update the actual booking
    booking = rr.booking
    booking.preferred_date = rr.new_date
    booking.preferred_time = rr.new_time_slot
    booking.assigned_employee = emp
    booking.save(update_fields=["preferred_date", "preferred_time", "assigned_employee", "updated_at"])

    # Notify customer
    try:
        from .notifications import notify_customer_rescheduled
        notify_customer_rescheduled(rr)
    except Exception:
        pass

    return rr


def employee_reject_reschedule(employee_user, request_id, reason, note=""):
    """
    Employee rejects the rescheduled booking assignment.
    - Validates the employee is the proposed_technician.
    - Transitions to REASSIGNMENT_NEEDED.
    - Notifies admin to manually find another employee.
    """
    try:
        emp = Employee.objects.get(user=employee_user)
    except Employee.DoesNotExist:
        raise ValidationError({"detail": "User is not registered as an employee."})

    try:
        rr = RescheduleRequest.objects.select_related("booking", "proposed_technician").get(
            pk=request_id,
            proposed_technician=emp,
            status=RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
        )
    except RescheduleRequest.DoesNotExist:
        raise NotFound({"detail": "No pending reschedule notification found for this employee."})

    # Record employee rejection
    rr.employee_response = EmployeeResponseChoices.REJECTED
    rr.employee_rejection_reason = reason
    rr.employee_response_note = note
    rr.employee_responded_at = timezone.now()
    rr.save(update_fields=["employee_response", "employee_rejection_reason", "employee_response_note", "employee_responded_at"])

    # Transition to REASSIGNMENT_NEEDED
    apply_reschedule_transition(rr, RescheduleStatus.REASSIGNMENT_NEEDED, employee_user, note=f"Employee rejected: {reason}. {note}")

    # Notify admin
    try:
        from .notifications import notify_admin_employee_rejection
        notify_admin_employee_rejection(rr)
    except Exception:
        pass

    return rr


def list_employee_reschedule_notifications(employee_user):
    """
    Returns all reschedule requests awaiting this employee's response.
    Scoped strictly to the given employee's proposed_technician FK.
    """
    try:
        emp = Employee.objects.get(user=employee_user)
    except Employee.DoesNotExist:
        return RescheduleRequest.objects.none()

    return RescheduleRequest.objects.filter(
        proposed_technician=emp,
        status=RescheduleStatus.AWAITING_EMPLOYEE_RESPONSE,
    ).select_related("booking", "booking__assigned_employee", "requested_by").order_by("-created_at")



# ═══════════════════════════════════════════════════════════════════════════════
# SLICE 3 — REFUND
# ═══════════════════════════════════════════════════════════════════════════════

from decimal import Decimal
from django.db import models


def get_eligible_bookings(customer):
    """
    Returns customer bookings that are PAID/COMPLETED and have no active non-terminal refund request.
    """
    NON_ELIGIBLE_REFUND_STATUSES = [
        RefundStatus.PENDING, RefundStatus.INFO_REQUESTED, RefundStatus.APPROVED_FULL,
        RefundStatus.APPROVED_PARTIAL, RefundStatus.SENT_TO_FINANCE, RefundStatus.COMPLETED
    ]
    user_email = (getattr(customer, 'email', '') or '').strip()
    refund_query = Q(customer=customer)
    booking_query = Q(customer=customer)
    if user_email:
        refund_query |= Q(booking__email__iexact=user_email)
        booking_query |= Q(email__iexact=user_email)

    active_booking_ids = RefundRequest.objects.filter(
        refund_query,
        status__in=NON_ELIGIBLE_REFUND_STATUSES
    ).values_list("booking_id", flat=True)

    return ServiceRequest.objects.filter(
        booking_query,
        payment_status__in=["paid", "collected"]
    ).exclude(id__in=active_booking_ids).order_by("-created_at")


def get_booking_refund_summary(customer, booking_id):
    """
    Calculates refund eligibility and max refundable amount for a booking.
    """
    user_email = (getattr(customer, 'email', '') or '').strip()
    booking_query = Q(pk=booking_id) & (Q(customer=customer) | Q(email__iexact=user_email))
    try:
        booking = ServiceRequest.objects.filter(booking_query).first()
        if not booking:
            raise ServiceRequest.DoesNotExist()
    except ServiceRequest.DoesNotExist:
        raise ValidationError({"detail": "Booking not found or not owned by customer."})

    paid_amount = booking.total_amount or Decimal("100.00")
    past_refunds = RefundRequest.objects.filter(
        booking=booking,
        status__in=[RefundStatus.APPROVED_FULL, RefundStatus.APPROVED_PARTIAL, RefundStatus.SENT_TO_FINANCE, RefundStatus.COMPLETED]
    ).aggregate(total=models.Sum("approved_amount"))["total"] or Decimal("0.00")

    max_refundable = max(Decimal("0.00"), paid_amount - past_refunds)
    eligible = (booking.payment_status in ["paid", "collected"]) and (max_refundable > Decimal("0.00"))
    reason = "" if eligible else "Booking is not paid or has already been fully refunded."

    return {
        "paid_amount": paid_amount,
        "max_refundable_amount": max_refundable,
        "eligible": eligible,
        "ineligibility_reason": reason
    }


def create_refund_request(customer, booking_id, refund_type, requested_amount, reason, additional_notes="", evidence_files=None):
    """
    Create a new RefundRequest and save RefundEvidence files.
    Enforces eligibility and maximum refundable amount rules.
    """
    summary = get_booking_refund_summary(customer, booking_id)
    if not summary["eligible"]:
        raise ValidationError({"detail": summary["ineligibility_reason"] or "Booking is not eligible for refund."})

    paid_amount = summary["paid_amount"]
    max_refundable = summary["max_refundable_amount"]

    try:
        req_dec = Decimal(str(requested_amount))
    except Exception:
        req_dec = paid_amount

    if refund_type == RefundType.FULL or refund_type == "FULL":
        req_dec = paid_amount

    if req_dec <= Decimal("0"):
        raise ValidationError({"detail": "Refund requested amount must be greater than 0."})

    if req_dec > max_refundable:
        raise ValidationError({"detail": f"Requested refund amount (₹{req_dec}) cannot exceed maximum refundable amount (₹{max_refundable})."})

    booking = ServiceRequest.objects.get(pk=booking_id, customer=customer)

    active_exists = RefundRequest.objects.filter(
        booking=booking,
        status__in=[RefundStatus.PENDING, RefundStatus.INFO_REQUESTED, RefundStatus.APPROVED_FULL, RefundStatus.APPROVED_PARTIAL]
    ).exists()
    if active_exists:
        raise ValidationError({"detail": "An active refund request already exists for this booking."})

    rr = RefundRequest.objects.create(
        booking=booking,
        customer=customer,
        paid_amount=paid_amount,
        refund_type=refund_type,
        requested_amount=req_dec,
        reason=reason,
        additional_notes=additional_notes,
        status=RefundStatus.PENDING,
    )

    if evidence_files:
        for f in evidence_files:
            RefundEvidence.objects.create(
                refund_request=rr,
                file=f,
                uploaded_by=customer
            )

    try:
        from .notifications import notify_refund_status_change
        notify_refund_status_change(rr)
    except Exception:
        pass

    return rr


def list_refund_requests(actor, persona, filters=None):
    """
    Return persona-scoped queryset of refund requests.
    """
    qs = RefundRequest.objects.select_related("booking", "customer", "assigned_employee").prefetch_related("evidence", "investigation_notes")

    if persona == "CUSTOMER":
        user_email = (getattr(actor, 'email', '') or '').strip()
        query = Q(customer=actor)
        if user_email:
            query |= Q(booking__email__iexact=user_email)
        qs = qs.filter(query)
    elif persona == "EMPLOYEE":
        try:
            emp = Employee.objects.get(user=actor)
            qs = qs.filter(assigned_employee=emp)
        except Exception:
            qs = qs.none()
    elif persona == "ADMIN":
        company = filters.get("company") if filters else None
        if company:
            qs = qs.filter(booking__company=company)

    if filters and filters.get("status"):
        qs = qs.filter(status=filters.get("status"))

    return qs.order_by("-created_at")


def admin_approve_refund(admin_user, refund_id, is_full=True, approved_amount=None, internal_note=""):
    """
    Approve refund request (full or partial) and transition state.
    """
    try:
        rr = RefundRequest.objects.get(pk=refund_id)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "RefundRequest not found."})

    target_status = RefundStatus.APPROVED_FULL if is_full else RefundStatus.APPROVED_PARTIAL
    app_amount = rr.requested_amount if (is_full or not approved_amount) else Decimal(str(approved_amount))

    if app_amount > rr.paid_amount:
        raise ValidationError({"detail": f"Approved amount (₹{app_amount}) cannot exceed paid amount (₹{rr.paid_amount})."})

    return apply_refund_transition(
        refund_request=rr,
        new_status=target_status,
        actor=admin_user,
        note=internal_note,
        approved_amount=app_amount
    )


def admin_reject_refund(admin_user, refund_id, internal_note=""):
    """Reject refund request."""
    try:
        rr = RefundRequest.objects.get(pk=refund_id)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "RefundRequest not found."})

    return apply_refund_transition(
        refund_request=rr,
        new_status=RefundStatus.REJECTED,
        actor=admin_user,
        note=internal_note
    )


def admin_request_more_info(admin_user, refund_id, target, note="", employee_id=None):
    """
    Request additional information from Customer or Employee.
    """
    try:
        rr = RefundRequest.objects.get(pk=refund_id)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "RefundRequest not found."})

    emp = None
    if target == RefundInfoTarget.EMPLOYEE or target == "EMPLOYEE":
        if employee_id:
            try:
                emp = Employee.objects.get(pk=employee_id)
            except Employee.DoesNotExist:
                emp = rr.booking.assigned_employee
        else:
            emp = rr.booking.assigned_employee

    return apply_refund_transition(
        refund_request=rr,
        new_status=RefundStatus.INFO_REQUESTED,
        actor=admin_user,
        note=note,
        info_requested_from=target,
        assigned_employee=emp
    )


def admin_send_to_finance(admin_user, refund_id):
    """Transition approved refund to SENT_TO_FINANCE state."""
    try:
        rr = RefundRequest.objects.get(pk=refund_id)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "RefundRequest not found."})

    return apply_refund_transition(
        refund_request=rr,
        new_status=RefundStatus.SENT_TO_FINANCE,
        actor=admin_user,
        note="Approved refund submitted to Finance department for payout processing."
    )


def admin_complete_refund(admin_user, refund_id):
    """Transition refund to COMPLETED state."""
    try:
        rr = RefundRequest.objects.get(pk=refund_id)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "RefundRequest not found."})

    return apply_refund_transition(
        refund_request=rr,
        new_status=RefundStatus.COMPLETED,
        actor=admin_user,
        note="Refund transaction completed."
    )


def employee_submit_investigation(employee_user, refund_id, explanation, work_completed_confirmed=False, photo_files=None):
    """
    Employee submits investigation note & photos, looping refund status back to PENDING for admin review.
    """
    try:
        emp = Employee.objects.get(user=employee_user)
    except Employee.DoesNotExist:
        raise ValidationError({"detail": "Employee profile not found for user."})

    try:
        rr = RefundRequest.objects.get(pk=refund_id, assigned_employee=emp)
    except RefundRequest.DoesNotExist:
        raise ValidationError({"detail": "Assigned refund investigation not found for employee."})

    note_obj = RefundInvestigationNote.objects.create(
        refund_request=rr,
        employee=emp,
        explanation=explanation,
        work_completed_confirmed=work_completed_confirmed
    )

    if photo_files:
        for p in photo_files:
            RefundEvidence.objects.create(
                refund_request=rr,
                file=p,
                uploaded_by=employee_user
            )

    return apply_refund_transition(
        refund_request=rr,
        new_status=RefundStatus.PENDING,
        actor=employee_user,
        note=f"Technician investigation submitted: {explanation[:50]}..."
    )

    return refund_request



# ═══════════════════════════════════════════════════════════════════════════════
# ════════════════════════════════════════════════════════════════════
# SLICE 4 — COMPLAINT
# ════════════════════════════════════════════════════════════════════

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from .models import ComplaintStatusHistory

COMPLAINT_ALLOWED_TRANSITIONS = {
    "OPEN": ["ASSIGNED", "CLOSED"],
    "ASSIGNED": ["UNDER_INVESTIGATION"],
    "UNDER_INVESTIGATION": ["WAITING_CUSTOMER", "WAITING_TECHNICIAN", "ADMIN_REVIEW"],
    "WAITING_CUSTOMER": ["UNDER_INVESTIGATION"],
    "WAITING_TECHNICIAN": ["UNDER_INVESTIGATION"],
    "ADMIN_REVIEW": ["RESOLVED", "ESCALATED"],
    "ESCALATED": ["ADMIN_REVIEW"],
    "RESOLVED": ["CLOSED", "UNDER_INVESTIGATION"],
    "CLOSED": [],
}

def generate_complaint_number():
    last = Complaint.objects.order_by("-id").first()
    num = 1
    if last and last.complaint_number:
        try:
            num = int(last.complaint_number.split("-")[-1]) + 1
        except Exception:
            pass
    return f"CMP-{timezone.now().year}-{str(num).zfill(6)}"

def _apply_complaint_transition(complaint, new_status, actor, notes=None):
    current = complaint.status
    allowed = COMPLAINT_ALLOWED_TRANSITIONS.get(current, [])
    if new_status not in allowed:
        raise ValidationError({"detail": f"Cannot transition from {current} to {new_status}."})
    
    with transaction.atomic():
        complaint.status = new_status
        if new_status == "RESOLVED":
            complaint.resolved_at = timezone.now()
        elif new_status == "CLOSED":
            complaint.closed_at = timezone.now()
        
        complaint.save()

        ComplaintStatusHistory.objects.create(
            complaint=complaint,
            from_status=current,
            to_status=new_status,
            changed_by=actor,
            notes=notes,
        )
    
    # Notify
    try:
        from .notifications import notify_complaint_status_change
        notify_complaint_status_change(complaint)
    except Exception:
        pass
    
    return complaint

def create_complaint(customer, booking, category, description, priority=None, attachment_files=None):
    if booking is not None:
        is_admin = getattr(customer, "is_staff", False) or getattr(customer, "is_superuser", False) or getattr(customer, "role", "") in ("admin", "manager")
        if booking.customer_id is None:
            booking.customer = customer
            booking.save(update_fields=["customer"])
        elif booking.customer_id != customer.pk and not is_admin:
            cust_email = (getattr(customer, "email", "") or "").strip().lower()
            cust_phone = getattr(customer, "phone", "")
            booking_email = (booking.email or "").strip().lower()
            booking_phone = booking.phone or ""
            
            # Automatically associate or allow customer filing complaint on the booking
            booking.customer = customer
            booking.save(update_fields=["customer"])
    
    with transaction.atomic():
        complaint = Complaint.objects.create(
            complaint_number=generate_complaint_number(),
            raised_by=customer,
            booking=booking,
            category=category,
            description=description,
            priority=priority or "MEDIUM",
            status="OPEN",
        )
        if attachment_files:
            for f in attachment_files:
                ComplaintAttachment.objects.create(
                    complaint=complaint,
                    file=f,
                    uploaded_by=customer,
                    attachment_type="IMAGE"  # Could be inferred
                )
    
    try:
        from .notifications import notify_complaint_created
        notify_complaint_created(complaint)
    except Exception:
        pass
        
    return complaint

def add_message(complaint, actor, persona, message):
    msg = ComplaintMessage.objects.create(
        complaint=complaint,
        sender=actor,
        sender_persona=persona,
        message=message,
    )
    # Notify
    try:
        from .notifications import notify_complaint_response
        notify_complaint_response(complaint, msg)
    except Exception:
        pass
    return msg

def add_customer_message(complaint, customer, message):
    is_admin = getattr(customer, "is_staff", False) or getattr(customer, "is_superuser", False) or getattr(customer, "role", "") in ("admin", "manager")
    if complaint.raised_by_id != customer.pk and not is_admin:
        user_email = (getattr(customer, 'email', '') or '').strip()
        if not (user_email and complaint.booking and complaint.booking.email and complaint.booking.email.lower() == user_email.lower()):
            raise PermissionDenied({"detail": "Not your complaint."})
    persona = "ADMIN" if is_admin else "CUSTOMER"
    return add_message(complaint, customer, persona, message)

def list_customer_complaints(customer, filters=None):
    user_email = (getattr(customer, 'email', '') or '').strip()
    query = Q(raised_by=customer)
    if user_email:
        query |= Q(booking__email__iexact=user_email)
    if getattr(customer, "is_staff", False) or getattr(customer, "is_superuser", False) or getattr(customer, "role", "") in ("admin", "manager"):
        query = Q()
    qs = Complaint.objects.filter(query)
    if filters and filters.get("status"):
        qs = qs.filter(status=filters["status"].upper())
    return qs.order_by("-created_at").distinct()

def get_complaint_detail(customer, complaint_id):
    try:
        user_email = (getattr(customer, 'email', '') or '').strip()
        query = Q(pk=complaint_id) & (Q(raised_by=customer) | Q(booking__email__iexact=user_email))
        if getattr(customer, "is_staff", False) or getattr(customer, "is_superuser", False) or getattr(customer, "role", "") in ("admin", "manager"):
            query = Q(pk=complaint_id)
        return Complaint.objects.get(query)
    except Complaint.DoesNotExist:
        raise PermissionDenied({"detail": "Complaint not found or not owned by you."})

# --- Admin
def assign_complaint(complaint, admin_actor, assigned_admin, assigned_employee=None, priority=None):
    if priority:
        complaint.priority = priority
    complaint.assigned_admin = assigned_admin
    if assigned_employee:
        complaint.assigned_employee = assigned_employee
    complaint.save()
    return apply_transition(complaint, "ASSIGNED", admin_actor)

def start_investigation(complaint, admin_actor):
    return apply_transition(complaint, "UNDER_INVESTIGATION", admin_actor)

def request_customer_info(complaint, admin_actor, message):
    add_message(complaint, admin_actor, "ADMIN", message)
    return apply_transition(complaint, "WAITING_CUSTOMER", admin_actor)

def request_technician_info(complaint, admin_actor, message):
    add_message(complaint, admin_actor, "ADMIN", message)
    return apply_transition(complaint, "WAITING_TECHNICIAN", admin_actor)

def compute_risk_score(complaint):
    score = 0
    reasons = []
    try:
        if complaint.raised_by_id:
            past_customer_complaints = Complaint.objects.filter(raised_by_id=complaint.raised_by_id).count()
            if past_customer_complaints > 2:
                score += 30
                reasons.append("Customer has more than 2 prior complaints.")
            
        if complaint.assigned_employee_id:
            past_emp_complaints = Complaint.objects.filter(assigned_employee_id=complaint.assigned_employee_id).count()
            if past_emp_complaints > 2:
                score += 40
                reasons.append("Assigned technician has more than 2 prior complaints.")
                
        if complaint.booking:
            completed_date = getattr(complaint.booking, "completed_date", None)
            if completed_date:
                try:
                    created_d = complaint.created_at.date() if hasattr(complaint.created_at, "date") else complaint.created_at
                    comp_d = completed_date.date() if hasattr(completed_date, "date") else completed_date
                    if (created_d - comp_d).days > 7:
                        score += 20
                        reasons.append("Complaint filed more than 7 days after completion.")
                except Exception:
                    pass
                    
        score = min(score, 100)
        complaint.risk_score = score
        complaint.save(update_fields=["risk_score"])
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error(f"Error computing risk score: {exc}")
        
    return getattr(complaint, "risk_score", 0) or 0, reasons

def escalate_complaint(complaint, admin_actor, notes):
    return apply_transition(complaint, "ESCALATED", admin_actor, notes)

def resolve_complaint(complaint, admin_actor, resolution_type, resolution_notes, refund_amount=None):
    with transaction.atomic():
        complaint.resolution_type = resolution_type
        complaint.resolution_notes = resolution_notes
        
        if resolution_type == "TECHNICIAN_ERROR":
            import logging
            logging.getLogger(__name__).info(f"Technician error recorded for complaint {complaint.pk}")
            
        if refund_amount and complaint.booking:
            try:
                # create_refund_request(booking, customer, amount, reason)
                refund = create_refund_request(
                    booking=complaint.booking, 
                    customer=complaint.raised_by, 
                    amount=refund_amount, 
                    reason=f"Refund for complaint {complaint.complaint_number}"
                )
                complaint.refund_request = refund
            except Exception as e:
                raise ValidationError({"detail": f"Failed to create refund: {str(e)}"})
        
        if resolution_type in ("COMPANY_ERROR", "TECHNICIAN_ERROR") and complaint.booking and not refund_amount:
            # Create rework booking
            # We clone the original booking with is_rework=True (if such a field exists, or just zero cost)
            original = complaint.booking
            rework = ServiceRequest.objects.create(
                customer=original.customer,
                customer_name=original.customer_name,
                phone=original.phone,
                service_category=original.service_category,
                issue_title=f"Rework: {original.issue_title}",
                address=original.address,
                preferred_date=timezone.now().date(),
                total_amount=0, # zero cost
                payment_status="verified",
                status="new_request"
            )
            complaint.rework_booking = rework

        complaint.save()
        return apply_transition(complaint, "RESOLVED", admin_actor, resolution_notes)

def close_complaint(complaint, admin_actor):
    return apply_transition(complaint, "CLOSED", admin_actor)

def list_admin_complaints(admin_actor, filters=None):
    res = []
    try:
        qs = Complaint.objects.select_related("booking", "raised_by", "assigned_admin", "assigned_employee")
        if filters:
            status_val = filters.get("status")
            if status_val:
                qs = qs.filter(status=status_val.upper())
            priority_val = filters.get("priority")
            if priority_val:
                qs = qs.filter(priority=priority_val.upper())
            category_val = filters.get("category")
            if category_val:
                qs = qs.filter(category=category_val.upper())
        res = list(qs.order_by("-created_at"))
    except Exception:
        res = []

    if not res:
        try:
            from django_tenants.utils import schema_context
            from companies.models import Company
            all_complaints = []
            for comp in Company.objects.exclude(schema_name="public"):
                try:
                    with schema_context(comp.schema_name):
                        sub_qs = Complaint.objects.select_related("booking", "raised_by", "assigned_admin", "assigned_employee")
                        if filters:
                            status_val = filters.get("status")
                            if status_val:
                                sub_qs = sub_qs.filter(status=status_val.upper())
                            priority_val = filters.get("priority")
                            if priority_val:
                                sub_qs = sub_qs.filter(priority=priority_val.upper())
                            category_val = filters.get("category")
                            if category_val:
                                sub_qs = sub_qs.filter(category=category_val.upper())
                        all_complaints.extend(list(sub_qs))
                except Exception:
                    pass
            all_complaints.sort(key=lambda c: c.created_at, reverse=True)
            return all_complaints
        except Exception:
            pass
    return res

# --- Employee
def submit_technician_explanation(complaint, employee, message, attachments=None):
    add_message(complaint, employee.user, "EMPLOYEE", message)
    # Could optionally automatically transition if it was WAITING_TECHNICIAN, but leaving to Admin Review
    return complaint

def list_employee_complaints(employee):
    return Complaint.objects.filter(assigned_employee=employee).order_by("-created_at")

def accept_rework(complaint, employee):
    pass

def reject_rework(complaint, employee, reason):
    add_message(complaint, employee.user, "EMPLOYEE", f"Rework Rejected: {reason}")
    pass

def complete_rework(complaint, employee, before_photos, after_photos, customer_otp, signature):
    pass

def upload_attachment(complaint, actor, file, attachment_type):
    return ComplaintAttachment.objects.create(
        complaint=complaint,
        file=file,
        attachment_type=attachment_type,
        uploaded_by=actor
    )

def complaint_volume_report(date_range=None):
    pass

def avg_resolution_time_report(date_range=None):
    pass


# ═══════════════════════════════════════════════════════════════════════════════
# BOOKING COMPLETION & PAYROLL PAYOUT HOOK
# ═══════════════════════════════════════════════════════════════════════════════

from decimal import Decimal
from django.db import transaction as db_transaction
from payroll.models import PayrollConfig
from payroll.exceptions import PayrollConfigMissingException
from payroll import services as payroll_services
from payroll.signals import wallet_credited
from .state_machine import apply_transition


def process_booking_completion_and_payout(booking, actor=None):
    """
    Executes booking completion status transition and calculates/credits employee wallet.
    All operations are wrapped in a single database transaction.atomic() block.
    If payroll calculation or crediting fails (or if PayrollConfig is missing),
    the booking completion status is rolled back.
    """
    org = getattr(booking, "company", None) or getattr(booking, "org", None)
    if not org:
        raise ValidationError("Booking has no assigned organization.")

    # Guard: Ensure active PayrollConfig exists for organization before completing
    active_config = PayrollConfig.objects.filter(org=org, is_active=True).first()
    if not active_config:
        raise PayrollConfigMissingException(
            f"Organization '{org}' has no active payroll configuration. "
            "Please configure payroll settings before completing bookings or processing payouts."
        )

    employee = getattr(booking, "assigned_employee", None)
    if not employee and hasattr(booking, "employee_job"):
        try:
            employee = booking.employee_job.employee
        except Exception:
            employee = None

    if not employee:
        raise ValidationError("Booking has no assigned employee for payroll distribution.")

    gross_amount = getattr(booking, "total_amount", Decimal("0.00"))

    with db_transaction.atomic():
        # 1. Transition booking status to COMPLETED if not already COMPLETED
        if booking.status != ServiceRequest.Status.COMPLETED:
            apply_transition(booking, ServiceRequest.Status.COMPLETED, actor=actor)
            booking.save(update_fields=["status", "updated_at"])

        # 2. Create pending wallet transaction with PayrollConfig snapshot
        tx = payroll_services.create_wallet_transaction(
            booking=booking,
            gross_amount=gross_amount,
            org=org,
            employee=employee,
        )

        # 3. Credit transaction to wallet balance
        credited_tx = payroll_services.credit_wallet_transaction(
            transaction_id=tx.id,
            org=org,
        )

        # 4. Emit domain signal
        wallet_credited.send(
            sender=booking.__class__,
            transaction=credited_tx,
            booking=booking,
            employee=employee,
            org=org,
        )

    return booking, credited_tx

