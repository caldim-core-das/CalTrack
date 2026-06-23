from django.conf import settings
from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.db import connection


class CompanyMiddleware(MiddlewareMixin):
    """
    Middleware to switch the DB schema to the user's company tenant.

    ROOT CAUSE FIX:
    Django's AuthenticationMiddleware only handles session-based auth.
    DRF JWT authentication runs INSIDE the view — AFTER all Django middleware.
    So request.user is always AnonymousUser at middleware time for JWT API calls.

    Solution: Read company_id directly from the JWT Bearer token header
    BEFORE checking request.user. This ensures the correct schema is set
    before any view code (or DRF authentication) runs.
    """

    def process_request(self, request):
        # ── Step 0: Bypass tenant schema resolution for public/shared endpoints ──
        path = request.path
        prefix = getattr(settings, "FORCE_SCRIPT_NAME", "") or ""
        if prefix and path.startswith(prefix):
            path = path[len(prefix):]

        if path.startswith('/api/auth/') or path.startswith('/api/company/create'):
            request.company = None
            request.tenant = None
            if hasattr(connection, 'set_schema_to_public'):
                connection.set_schema_to_public()
            print(f"DEBUG: CompanyMiddleware - Public/shared path '{request.path}', keeping public schema.")
            return None

        company = None

        # ── Step 1: Read company_id directly from JWT Bearer token or Cookie ────
        # DRF authenticates AFTER middleware, so we decode the token ourselves.
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token_str = None
        if auth_header.startswith('Bearer '):
            token_str = auth_header.split(' ')[1]
        elif 'qt_access' in request.COOKIES:
            token_str = request.COOKIES['qt_access']

        if token_str:
            try:
                from rest_framework_simplejwt.tokens import AccessToken
                token = AccessToken(token_str)
                company_id = token.get('company_id')
                if company_id:
                    from companies.models import Company
                    company = Company.objects.filter(id=company_id).first()
                    if company:
                        print(f"DEBUG: CompanyMiddleware - Found company via JWT: {company.schema_name}")
            except Exception as e:
                print(f"DEBUG: CompanyMiddleware - JWT token read failed: {e}")

        # ── Step 1.5: Read company from query parameter or Referer (for public requests) ──
        if not company:
            org_name = request.GET.get('org') or request.POST.get('org')
            if not org_name:
                referer = request.META.get('HTTP_REFERER')
                if referer:
                    from urllib.parse import urlparse, parse_qs
                    try:
                        parsed_url = urlparse(referer)
                        params = parse_qs(parsed_url.query)
                        if 'org' in params:
                            org_name = params['org'][0]
                    except Exception:
                        pass
            if org_name:
                from companies.models import Company
                company = Company.objects.filter(schema_name=org_name).first()
                if company:
                    print(f"DEBUG: CompanyMiddleware - Found company via parameter/referer: {company.schema_name}")

        # ── Step 1.6: Resolve company for public feedback requests ─────────────────
        if not company and request.path.startswith('/api/feedback/'):
            # Extract token from path e.g. /api/feedback/<token>/
            parts = [p for p in request.path.split('/') if p]
            if len(parts) >= 3:
                token = parts[2]
                try:
                    from django_tenants.utils import schema_context
                    from companies.models import Company
                    from service_requests.models import ServiceFeedback

                    for c in Company.objects.exclude(schema_name='public'):
                        try:
                            with schema_context(c.schema_name):
                                if ServiceFeedback.objects.filter(feedback_token=token).exists():
                                    company = c
                                    print(f"DEBUG: CompanyMiddleware - Found company via feedback token in schema {c.schema_name}")
                                    break
                        except Exception:
                            pass
                except ImportError:
                    pass

        # ── Step 2: Fallback for session-based auth (admin panel, etc.) ─────────
        if not company:
            user = getattr(request, 'user', None)
            if user and user.is_authenticated:
                company = getattr(user, 'company', None)
                if not company:
                    try:
                        from companies.models import Company
                        company = Company.objects.filter(users=user).first()
                    except Exception:
                        pass

        # ── Step 2.5: Fallback to request.tenant (django-tenants) ───────────────
        if not company and getattr(request, 'tenant', None):
            tenant = request.tenant
            if tenant.schema_name != 'public':
                company = tenant

        # ── Step 2.7: Dev-only fallback to first tenant when DEBUG is True ─────────
        if not company and settings.DEBUG:
            from companies.models import Company
            company = Company.objects.exclude(schema_name='public').first()
            if company:
                print(f"DEBUG: CompanyMiddleware - Dev fallback to first tenant: {company.schema_name}")

        # ── Step 3: Switch the DB schema to this company's tenant ───────────────
        if company:
            request.company = company
            request.tenant = company
            if hasattr(connection, 'set_tenant'):
                connection.set_tenant(company)
                print(f"DEBUG: CompanyMiddleware - Schema set to: {company.schema_name}")
            else:
                print(f"DEBUG: CompanyMiddleware - set_tenant not supported on this backend.")
        else:
            request.company = None
            request.tenant = None
            print(f"DEBUG: CompanyMiddleware - No tenant resolved for: {request.path}")

        # ── Step 4: Block tenant API calls that arrived without a valid company ──
        # Applies to requests that provided a Bearer token or cookie.
        if not company and token_str:
            excluded_paths = [
                '/api/auth/',
                '/api/company/create',
                '/api/booking/',
                '/api/feedback/',
            ]
            path = request.path
            prefix = getattr(settings, "FORCE_SCRIPT_NAME", "") or ""
            if prefix and path.startswith(prefix):
                path = path[len(prefix):]
            if path.startswith('/api/') and not any(
                path.startswith(p) for p in excluded_paths
            ):
                return JsonResponse(
                    {"error": "No company associated with this account."},
                    status=403
                )

        return None
