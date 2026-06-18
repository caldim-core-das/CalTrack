from rest_framework.permissions import BasePermission
from .models import TrialPlan


class TrialActiveOrConverted(BasePermission):
    """
    Allows access only if the requesting user's company has:
      - An active trial (not yet expired), OR
      - A converted (paid) subscription
    """
    message = {"success": False, "message": "Your free trial has expired. Please upgrade to continue."}

    def has_permission(self, request, view):
        company = getattr(request.user, "company", None)
        if not company:
            return False
        try:
            trial = company.trial_plan
            return trial.is_active or trial.status == "converted"
        except TrialPlan.DoesNotExist:
            # No trial record = legacy account, allow through
            return True
