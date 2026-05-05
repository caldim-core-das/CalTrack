from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin
from django.db import connection


class CompanyMiddleware(MiddlewareMixin):
    """
    Middleware to extract company from authenticated user and attach to request.
    If company is missing for an authenticated user, it rejects the request.

    Resolution order:
      1. user.company FK (fastest – already on the User row)
      2. Company M2M lookup (users=request.user)
      3. company_id claim embedded in the JWT Access Token at login time
         (avoids querying tenant-only Employee table in the public schema,
          which causes a 500 ProgrammingError when schema = public)
    """

    def process_request(self, request):
        # AuthenticationMiddleware must run before this.
        if not request.user.is_authenticated:
            return None

        print(f"DEBUG: CompanyMiddleware - Request by user {request.user.username} for {request.path}")

        # 1. Direct FK on User model (fastest path)
        company = getattr(request.user, 'company', None)

        # 2. M2M reverse lookup on Company (shared/public model – safe to query)
        if not company:
            from companies.models import Company
            company = Company.objects.filter(users=request.user).first()

        # 3. Fallback: read company_id from the JWT Bearer token claim.
        #    The claim is embedded at login time in CustomTokenObtainPairSerializer.
        #    This is safe because Company is a shared model (public schema).
        #    We intentionally do NOT fall back to querying Employee here because
        #    Employee is a tenant-only model; calling it while the connection is in
        #    the public schema raises ProgrammingError -> Django 500.
        if not company:
            try:
                auth_header = request.META.get('HTTP_AUTHORIZATION', '')
                if auth_header.startswith('Bearer '):
                    from rest_framework_simplejwt.tokens import AccessToken
                    token = AccessToken(auth_header.split(' ')[1])
                    company_id = token.get('company_id')
                    if company_id:
                        from companies.models import Company
                        company = Company.objects.filter(id=company_id).first()
                        if company:
                            # Sync back so future requests hit path 1 directly
                            request.user.company = company
                            request.user.save(update_fields=['company'])
                            print(
                                f"DEBUG: CompanyMiddleware - Restored company from JWT claim: "
                                f"{company.schema_name}"
                            )
            except Exception as e:
                print(f"DEBUG: CompanyMiddleware - JWT company_id fallback failed: {e}")

        if company:
            request.company = company
            request.tenant = company
            print(f"DEBUG: CompanyMiddleware - Setting tenant to {company.schema_name}")
            connection.set_tenant(company)

        if not company:
            excluded_paths = [
                '/api/accounts/',
                '/api/company/create',
            ]
            if request.path.startswith('/api/') and not any(
                request.path.startswith(p) for p in excluded_paths
            ):
                return JsonResponse({"error": "No company associated with user"}, status=403)

        return None
