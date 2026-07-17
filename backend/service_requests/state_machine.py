"""
service_requests/state_machine.py

Single source of truth for all status transitions.
Call apply_transition(sr, new_status) before every save.
Raises rest_framework.exceptions.ValidationError on illegal moves.
"""
from rest_framework.exceptions import ValidationError

from .models import ServiceRequest

S = ServiceRequest.Status

# Map: current_status → set of allowed next statuses
ALLOWED_TRANSITIONS = {
    # Online bookings start here; COD bookings skip this
    S.WAITING_FOR_PAYMENT:    {S.CONFIRMED, S.REJECTED},
    S.NEW_REQUEST:            {S.CONFIRMED, S.REVIEWED, S.ASSIGNED, S.REJECTED, S.FEEDBACK_RECEIVED},
    S.CONFIRMED:              {S.REVIEWED, S.ASSIGNED, S.REJECTED, S.FEEDBACK_RECEIVED},
    S.REVIEWED:               {S.ASSIGNED, S.REJECTED, S.FEEDBACK_RECEIVED},
    S.ASSIGNED:               {S.ACCEPTED, S.REJECTED, S.FEEDBACK_RECEIVED},
    S.ACCEPTED:               {S.ON_THE_WAY, S.IN_PROGRESS, S.FEEDBACK_RECEIVED},
    S.ON_THE_WAY:             {S.IN_PROGRESS, S.FEEDBACK_RECEIVED},
    S.IN_PROGRESS:            {S.COMPLETED, S.FEEDBACK_RECEIVED},
    S.COMPLETED:              {S.AWAITING_VERIFICATION, S.FEEDBACK_RECEIVED},
    S.AWAITING_VERIFICATION:  {S.VERIFIED, S.REWORK_REQUESTED, S.FEEDBACK_RECEIVED},
    S.VERIFIED:               {S.FEEDBACK_PENDING, S.FEEDBACK_RECEIVED},
    S.FEEDBACK_PENDING:       {S.FEEDBACK_RECEIVED},
    S.FEEDBACK_RECEIVED:      {S.CLOSED},
    S.REWORK_REQUESTED:       {S.IN_PROGRESS, S.FEEDBACK_RECEIVED},
    # Terminal states — no further transitions
    S.CLOSED:                 set(),
    S.REJECTED:               set(),
}


def apply_transition(service_request, new_status: str, actor=None) -> None:
    """
    Validate and apply a status transition.

    Args:
        service_request: ServiceRequest instance
        new_status:      Target status string (use ServiceRequest.Status values)
        actor:           The User performing the action (for logging, optional)

    Raises:
        ValidationError: if the transition is not allowed
    """
    current = service_request.status
    allowed = ALLOWED_TRANSITIONS.get(current, set())

    if new_status not in allowed:
        raise ValidationError(
            {
                "detail": (
                    f"Cannot move from '{current}' to '{new_status}'. "
                    f"Allowed transitions: {[s.value for s in allowed] or 'none (terminal state)'}."
                )
            }
        )

    service_request.status = new_status


def get_allowed_transitions(service_request) -> list:
    """Return list of allowed next status values for a given ServiceRequest."""
    current = service_request.status
    return [s.value for s in ALLOWED_TRANSITIONS.get(current, set())]
