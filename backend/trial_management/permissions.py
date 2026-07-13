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
        # 1. Exempt public requests / unauthenticated requests
        if not request.user or not request.user.is_authenticated:
            return True

        # 2. Exempt specific endpoints needed for trial status, billing, and authentication
        exempt_prefixes = [
            "/api/auth/",
            "/api/trial/",
            "/api/settings/billing/subscription/",
            "/api/settings/invoices/",
        ]
        path = request.path
        if any(path.startswith(prefix) for prefix in exempt_prefixes):
            return True

        # 4. Check the company's trial status
        company = getattr(request.user, "company", None)
        if not company:
            # If the user is authenticated but has no company, they might be in an onboarding/setup phase
            return True

        try:
            trial = company.trial_plan
            # Trial is active or user has converted to paid plan
            return trial.is_active or trial.status in [
                TrialPlan.Status.CONVERTED,
                TrialPlan.Status.CONVERTED_TO_PAID,
            ]
        except TrialPlan.DoesNotExist:
            # No trial record = legacy or special account, allow through
            return True
