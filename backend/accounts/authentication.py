"""
accounts/authentication.py

Custom DRF authentication backend that reads the JWT from an httpOnly cookie.
Falls back to the standard Authorization: Bearer <token> header so that
API clients (mobile apps, curl, Postman) still work unchanged.
"""
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    """
    Priority order:
      1. Authorization: Bearer <token>  header  (API clients, backward-compat)
      2. qt_access cookie               (web browser — httpOnly, JS-invisible)
    """

    def authenticate(self, request):
        # 1. Try standard header / cookie authentication
        auth_res = self._authenticate_credentials(request)
        if not auth_res:
            return None
            
        user, validated = auth_res
        
        # 2. Perform trial status check
        exempt_prefixes = [
            "/api/auth/",
            "/api/trial/",
            "/api/settings/billing/subscription/",
            "/api/settings/invoices/",
        ]
        path = request.path
        if not any(path.startswith(prefix) for prefix in exempt_prefixes):
            company = getattr(user, "company", None)
            if company:
                from trial_management.models import TrialPlan
                try:
                    trial = company.trial_plan
                    if not trial.is_active and trial.status not in [TrialPlan.Status.CONVERTED, TrialPlan.Status.CONVERTED_TO_PAID]:
                        from rest_framework.exceptions import PermissionDenied
                        raise PermissionDenied({
                            "success": False, 
                            "message": "Your free trial has expired. Please upgrade to continue."
                        })
                except TrialPlan.DoesNotExist:
                    pass
        
        return user, validated

    def _authenticate_credentials(self, request):
        # 1. Try the Authorization header first (standard simplejwt path)
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated = self.get_validated_token(raw_token)
                return self.get_user(validated), validated

        # 2. Fall back to the httpOnly cookie
        cookie_name = getattr(settings, "AUTH_COOKIE", "qt_access")
        raw_token = request.COOKIES.get(cookie_name)
        if not raw_token:
            return None

        try:
            validated = self.get_validated_token(raw_token)
            return self.get_user(validated), validated
        except Exception:
            # Expired / tampered cookie — return None so the view gets 401
            return None
