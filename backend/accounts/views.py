import uuid
import traceback

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, transaction
from companies.models import Company

from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import requests

from .serializers import UserSerializer
from employees.utils import generate_next_employee_id


# ── Cookie helper ─────────────────────────────────────────────────────────────

def _set_auth_cookies(response, access_token, refresh_token=None):
    """
    Attach httpOnly JWT cookies to *response*.

    Access cookie  — sent to every path (needed for all API calls).
    Refresh cookie — restricted to /api/auth/refresh/ so it is never
                     accidentally exposed to other endpoints.
    """
    secure   = getattr(settings, "AUTH_COOKIE_SECURE", not settings.DEBUG)
    samesite = getattr(settings, "AUTH_COOKIE_SAMESITE", "Strict")

    access_max_age  = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    refresh_max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

    response.set_cookie(
        settings.AUTH_COOKIE,
        str(access_token),
        max_age=access_max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
    if refresh_token is not None:
        response.set_cookie(
            settings.AUTH_COOKIE_REFRESH,
            str(refresh_token),
            max_age=refresh_max_age,
            httponly=True,
            secure=secure,
            samesite=samesite,
            path="/api/auth/refresh/",   # only sent to the refresh endpoint
        )
    return response


def _clear_auth_cookies(response):
    """Remove both auth cookies from the browser."""
    response.delete_cookie(settings.AUTH_COOKIE, path="/")
    response.delete_cookie(settings.AUTH_COOKIE_REFRESH, path="/api/auth/refresh/")
    return response
import uuid
import traceback
from django.db import transaction
from companies.models import Company
from settings_hub.models import TeamInvite
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.core.mail import send_mail
from django.conf import settings




def _ensure_pretty_employee_id(employee, company):
    if not employee or not employee.employee_id:
        return
    raw = str(employee.employee_id).strip()
    if raw.upper().startswith("EMP-"):
        next_id = generate_next_employee_id(company)
        employee.employee_id = next_id
        employee.save(update_fields=["employee_id", "updated_at"])


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["email"] = serializers.EmailField(required=False, allow_blank=True)

    def validate(self, attrs):
        username = attrs.get(self.username_field)
        email = attrs.get("email")
        if isinstance(username, str):
            username = username.strip()
            attrs[self.username_field] = username

        if (not username) and isinstance(email, str) and email.strip():
            User = get_user_model()
            user = User.objects.filter(email__iexact=email.strip()).first()
            if user:
                attrs[self.username_field] = user.username

        return super().validate(attrs)

    @classmethod
    def get_token(cls, user):
        # company is a shared model — no schema switch needed
        company = getattr(user, 'company', None)

        token = super().get_token(user)
        token["role"] = str(user.role)
        token["username"] = str(user.username)

        if company:
            token["company_id"] = str(company.id)

        return token


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access  = response.data.get("access")
            refresh = response.data.get("refresh")
            _set_auth_cookies(response, access, refresh)
            # Strip tokens from the body — they live in httpOnly cookies now
            response.data = {"success": True, "message": "Login successful."}
        return response


class RefreshView(APIView):
    """
    Rotate the access token using the httpOnly refresh cookie.
    No body needed — the browser sends the cookie automatically.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH)
        if not refresh_token:
            return Response(
                {"success": False, "message": "No refresh token — please log in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            from rest_framework_simplejwt.tokens import RefreshToken
            token = RefreshToken(refresh_token)
            access_token = token.access_token
            response = Response({"success": True})
            _set_auth_cookies(response, access_token)   # only rotate access cookie
            return response
        except Exception:
            response = Response(
                {"success": False, "message": "Session expired. Please log in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_auth_cookies(response)
            return response


class LogoutView(APIView):
    """Clear both auth cookies — works whether or not the user is authenticated."""
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        response = Response({"success": True, "message": "Logged out."})
        _clear_auth_cookies(response)
        return response


class GoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        access_token = request.data.get("access_token")
        if not access_token:
            return Response({"detail": "Missing Google access token"}, status=status.HTTP_400_BAD_REQUEST)
        
        response = requests.get(f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}")
        if not response.ok:
            return Response({"detail": "Invalid Google access token"}, status=status.HTTP_400_BAD_REQUEST)
        
        user_info = response.json()
        email = user_info.get("email")
        if not email:
            return Response({"detail": "No email provided by Google"}, status=status.HTTP_400_BAD_REQUEST)
            
        User = get_user_model()
        user = User.objects.filter(email=email).first()

        if not user:
            # Auto-create the user if they don't exist yet
            username = email.split("@")[0]
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create(
                username=username,
                email=email,
                first_name=user_info.get("given_name", ""),
                last_name=user_info.get("family_name", ""),
            )
            user.set_unusable_password()
            user.save()

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        response = Response({"success": True, "message": "Google login successful."})
        _set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        print(f"DEBUG: RegisterView - POST request received: {request.data}")
        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email", "")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        organization_name = request.data.get("organization_name")

        username = (username or "").strip()
        email = (email or "").strip()
        first_name = (first_name or "").strip()
        last_name = (last_name or "").strip()
        organization_name = (organization_name or "").strip()

        if not username or not password or not organization_name:
            return Response({"detail": "Username, password, and Organization Name are required."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction

        try:
            # All shared-schema writes in one transaction (Company, Domain, User)
            with transaction.atomic():
                # 1. Create Company (triggers tenant schema creation + migrations)
                from django.utils.text import slugify
                existing_company = Company.objects.filter(company_name=organization_name).first()
                if existing_company and existing_company.users.count() == 0:
                    company = existing_company
                else:
                    company = Company.objects.create(
                        company_name=organization_name,
                        team_size=request.data.get("team_size"),
                        selected_modules=request.data.get("selected_modules", [])
                    )
                    from companies.models import Domain
                    Domain.objects.create(
                        domain=f"{company.schema_name}.localhost",
                        tenant=company,
                        is_primary=True
                    )

                # 2. Create User as Org Admin
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role="admin",
                )
                user.company = company
                user.save()

            # 3. Create Employee in tenant schema (must be outside public transaction)
            if hasattr(connection, 'set_tenant'):
                connection.set_tenant(company)
                
            from employees.models import Employee
            Employee.objects.get_or_create(
                user=user,
                company=company,
                defaults={
                    "employee_id": generate_next_employee_id(company),
                    "title": "Admin",
                    "hourly_rate": 0,
                }
            )
            if hasattr(connection, 'set_schema_to_public'):
                connection.set_schema_to_public()

        except Exception as e:
            print(f"ERROR in RegisterView: {str(e)}")
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        response = Response(
            {"success": True, "message": "Registration successful.", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        _set_auth_cookies(response, str(refresh.access_token), str(refresh))
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)


class ProfileUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [__import__("rest_framework").parsers.MultiPartParser, __import__("rest_framework").parsers.FormParser, __import__("rest_framework").parsers.JSONParser]

    def patch(self, request):
        from .serializers import ProfileUpdateSerializer
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"success": True, "data": UserSerializer(request.user, context={"request": request}).data})
        return Response({"success": False, "message": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password", "")
        new_pw = request.data.get("new_password", "")
        confirm = request.data.get("confirm_password", "")

        if not request.user.check_password(current):
            return Response({"success": False, "message": "Current password is incorrect."}, status=400)
        if len(new_pw) < 8:
            return Response({"success": False, "message": "Password must be at least 8 characters."}, status=400)
        if new_pw != confirm:
            return Response({"success": False, "message": "Passwords do not match."}, status=400)

        request.user.set_password(new_pw)
        request.user.save(update_fields=["password"])
        return Response({"success": True, "message": "Password updated successfully."})


class EmailChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        new_email = (request.data.get("new_email") or "").strip()
        password = request.data.get("password", "")

        if not new_email:
            return Response({"success": False, "message": "Email is required."}, status=400)
        if not request.user.check_password(password):
            return Response({"success": False, "message": "Password is incorrect."}, status=400)

        User = get_user_model()
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({"success": False, "message": "That email is already in use."}, status=400)

        request.user.email = new_email
        request.user.save(update_fields=["email"])
        return Response({"success": True, "message": "Email updated."})


class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            import pyotp, qrcode, io, base64
        except ImportError:
            return Response({"success": False, "message": "2FA library not installed."}, status=500)

        secret = pyotp.random_base32()
        request.user.totp_secret = secret
        request.user.save(update_fields=["totp_secret"])

        uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=request.user.email or request.user.username,
            issuer_name="QuickTIMS"
        )
        img = qrcode.make(uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_b64 = base64.b64encode(buf.getvalue()).decode()

        return Response({"success": True, "data": {"secret": secret, "qr_code": f"data:image/png;base64,{qr_b64}"}})

    def post(self, request):
        try:
            import pyotp
        except ImportError:
            return Response({"success": False, "message": "2FA library not installed."}, status=500)

        code = request.data.get("code", "")
        if not request.user.totp_secret:
            return Response({"success": False, "message": "No 2FA setup in progress."}, status=400)

        totp = pyotp.TOTP(request.user.totp_secret)
        if not totp.verify(code):
            return Response({"success": False, "message": "Invalid verification code."}, status=400)

        request.user.two_fa_enabled = True
        request.user.save(update_fields=["two_fa_enabled"])

        import secrets as _s
        backup_codes = [_s.token_hex(4).upper() for _ in range(8)]
        return Response({"success": True, "message": "2FA enabled.", "data": {"backup_codes": backup_codes}})

    def delete(self, request):
        password = request.data.get("password", "")
        if not request.user.check_password(password):
            return Response({"success": False, "message": "Incorrect password."}, status=400)
        request.user.two_fa_enabled = False
        request.user.totp_secret = ""
        request.user.save(update_fields=["two_fa_enabled", "totp_secret"])
        return Response({"success": True, "message": "2FA disabled."})


class AcceptInviteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = request.data.get("token")
        password = request.data.get("password")
        org_schema = request.data.get("org") # Get schema from URL/request
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")

        if not token or not password:
            return Response({"detail": "Token and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Handle multi-tenant lookup
        if org_schema:
            if hasattr(connection, 'set_tenant'):
                from companies.models import Company
                company = Company.objects.filter(schema_name=org_schema).first()
                if company:
                    connection.set_tenant(company)
        
        invite = TeamInvite.objects.filter(token=token, status="pending").first()
        
        # Fallback: if not found in current schema, search all schemas
        if not invite:
            from django_tenants.utils import schema_context
            from companies.models import Company
            for company in Company.objects.all():
                with schema_context(company.schema_name):
                    invite = TeamInvite.objects.filter(token=token, status="pending").first()
                    if invite:
                        # Once found, set the tenant for the rest of the transaction
                        if hasattr(connection, 'set_tenant'):
                            connection.set_tenant(company)
                        break

        if not invite:
            return Response({"detail": "Invalid or expired invitation token."}, status=status.HTTP_400_BAD_REQUEST)
        
        if invite.is_expired:
            invite.status = "expired"
            invite.save(update_fields=["status"])
            return Response({"detail": "Invitation has expired."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(email__iexact=invite.email).exists():
            return Response({"detail": "User with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                username = invite.email.split("@")[0]
                base_username = username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}{counter}"
                    counter += 1

                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=invite.email,
                    first_name=first_name,
                    last_name=last_name,
                    role=invite.role,
                )
                user.company = invite.company
                user.save()

                invite.status = "accepted"
                from django.utils import timezone
                invite.accepted_at = timezone.now()
                invite.save(update_fields=["status", "accepted_at"])

            if hasattr(connection, 'set_tenant'):
                connection.set_tenant(invite.company)

            from employees.models import Employee
            Employee.objects.get_or_create(
                user=user,
                company=invite.company,
                defaults={
                    "employee_id": generate_next_employee_id(invite.company),
                    "title": invite.role.title(),
                    "hourly_rate": 0,
                }
            )

            if hasattr(connection, 'set_schema_to_public'):
                connection.set_schema_to_public()

        except Exception as e:
            traceback.print_exc()
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
            "message": "Login successfully"
        }, status=status.HTTP_201_CREATED)

class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email is required"}, status=400)
            
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        
        # If no user exists with the requested email, fallback to the first user in the DB
        # to allow testing password reset link delivery with any email address
        if not user:
            user = User.objects.first()
            
        reset_url = None
        if user:
            token_generator = PasswordResetTokenGenerator()
            token = token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Fallback frontend URL if not defined
            frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")
            reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"
            
            employee_id = "EMP1025"
            first_name = "Surya"
            if user.first_name:
                first_name = user.first_name
            elif user.username:
                first_name = user.username
                
            if getattr(user, "company", None):
                from django_tenants.utils import schema_context
                try:
                    with schema_context(user.company.schema_name):
                        from employees.models import Employee
                        emp = Employee.objects.filter(user=user).first()
                        if emp:
                            employee_id = emp.employee_id
                except Exception as e:
                    print(f"Error fetching employee for email reset: {e}")

            subject = "CALtrack Secure Access Recovery"
            
            body_text = (
                "━━━━━━━━━━━━━━━━━━━━━━━\n"
                "CALTRACK SECURITY HUB\n"
                "━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Hello {first_name},\n\n"
                "A password recovery request has been detected for:\n\n"
                f"Employee ID: {employee_id}\n\n"
                "If this request was initiated by you,\n"
                "activate the secure recovery gateway below.\n\n"
                f"ACTIVATE RECOVERY LINK:\n{reset_url}\n\n"
                "Security Token Lifetime:\n"
                "15 Minutes\n\n"
                "Device Activity Logged.\n\n"
                "If you did not request this action,\n"
                "ignore this message.\n\n"
                "━━━━━━━━━━━━━━━━━━━━━━━\n"
                "CALtrack Security Intelligence\n"
                "━━━━━━━━━━━━━━━━━━━━━━━"
            )
            
            html_message = f"""
            <div style="background-color: #03050d; color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; border-radius: 24px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);">
                <div style="text-align: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 25px;">
                    <div style="color: #6366f1; font-weight: 900; font-size: 20px; letter-spacing: 0.25em; text-transform: uppercase;">
                        CALTRACK SECURITY HUB
                    </div>
                </div>
                <div style="padding: 0 10px;">
                    <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px;">
                        Hello {first_name},
                    </p>
                    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 25px;">
                        A password recovery request has been detected for:
                    </p>
                    
                    <div style="background-color: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 16px; padding: 20px; margin-bottom: 30px;">
                        <span style="font-family: monospace; font-size: 11px; text-transform: uppercase; color: #818cf8; display: block; margin-bottom: 5px;">Workforce Identity</span>
                        <span style="font-family: monospace; font-size: 16px; font-weight: bold; color: #f1f5f9; letter-spacing: 1px;">{employee_id}</span>
                    </div>
                    
                    <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 25px;">
                        If this request was initiated by you, activate the secure recovery gateway below.
                    </p>
                    
                    <div style="text-align: center; margin-bottom: 35px; margin-top: 25px;">
                        <a href="{reset_url}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 16px 36px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; border-radius: 16px; display: inline-block; box-shadow: 0 10px 25px rgba(79, 70, 229, 0.3); transition: all 0.3s ease;">
                            ACTIVATE RECOVERY
                        </a>
                    </div>
                    
                    <div style="border-top: 1px solid #1e293b; padding-top: 20px; margin-top: 30px; font-family: monospace; font-size: 11px; color: #64748b; line-height: 1.8;">
                        <div style="margin-bottom: 8px;"><strong style="color: #94a3b8;">Security Token Lifetime:</strong> 15 Minutes</div>
                        <div style="margin-bottom: 8px;"><strong style="color: #94a3b8;">Status:</strong> Device Activity Logged.</div>
                        <div>If you did not request this action, ignore this message safely.</div>
                    </div>
                </div>
                <div style="text-align: center; border-top: 2px solid #1e293b; padding-top: 20px; margin-top: 35px; color: #475569; font-size: 10px; font-family: monospace; letter-spacing: 0.15em; text-transform: uppercase;">
                    CALtrack Security Intelligence
                </div>
            </div>
            """

            try:
                send_mail(
                    subject,
                    body_text,
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=False,
                    html_message=html_message
                )
            except Exception as e:
                print(f"Failed to send email: {e}")
        
        response_data = {"detail": "If an account exists with that email, a password reset link has been sent."}
        if settings.DEBUG and reset_url:
            response_data["reset_url"] = reset_url
            
        # Always return success to prevent email enumeration
        return Response(response_data)

class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uidb64 = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")
        
        if not uidb64 or not token or not new_password:
            return Response({"detail": "Missing required fields"}, status=400)
            
        User = get_user_model()
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
            
        if user is not None and PasswordResetTokenGenerator().check_token(user, token):
            user.set_password(new_password)
            user.save()
            
            # Resolve employee ID
            employee_id = "EMP1025"
            if getattr(user, "company", None):
                from django_tenants.utils import schema_context
                try:
                    with schema_context(user.company.schema_name):
                        from employees.models import Employee
                        emp = Employee.objects.filter(user=user).first()
                        if emp:
                            employee_id = emp.employee_id
                except Exception as e:
                    print(f"Error fetching employee in reset confirm: {e}")
            else:
                if user.first_name:
                    employee_id = user.username
                    
            return Response({
                "detail": "Password has been reset successfully.",
                "employee_id": employee_id
            })
        return Response({"detail": "Invalid or expired token"}, status=400)


import json
import os

class RegistrationDossierView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        file_path = os.path.join(settings.BASE_DIR, "caltrack_activation_dossier.json")
        if os.path.exists(file_path):
            try:
                if os.path.getsize(file_path) == 0:
                    return Response({})
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return Response(data)
            except Exception as e:
                print(f"Error loading registration dossier: {e}")
                return Response({})
        return Response({})

    def post(self, request):
        file_path = os.path.join(settings.BASE_DIR, "caltrack_activation_dossier.json")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(request.data, f, indent=4, ensure_ascii=False)
            return Response({"success": True})
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    def delete(self, request):
        file_path = os.path.join(settings.BASE_DIR, "caltrack_activation_dossier.json")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return Response({"success": True})
            except Exception as e:
                return Response({"error": str(e)}, status=500)
        return Response({"success": True})


from django.db.models import Q
from django_tenants.utils import schema_context

class PasswordResetVerifyIdentityView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identity = request.data.get("identity")
        if not identity:
            return Response({"detail": "Identity is required"}, status=400)
        
        identity = identity.strip()
        User = get_user_model()
        user = User.objects.filter(Q(username__iexact=identity) | Q(email__iexact=identity)).first()
        
        found_user = user
        found_employee = None
        
        # If not found directly, search all tenant schemas for employee_id
        if not found_user and hasattr(connection, 'set_tenant'):
            from companies.models import Company
            from employees.models import Employee
            for company in Company.objects.all():
                with schema_context(company.schema_name):
                    emp = Employee.objects.filter(employee_id__iexact=identity).first()
                    if emp:
                        found_user = emp.user
                        found_employee = emp
                        break
        
        # If found user via public model, try to fetch employee details
        if found_user and not found_employee and getattr(found_user, "company", None):
            with schema_context(found_user.company.schema_name):
                from employees.models import Employee
                found_employee = Employee.objects.filter(user=found_user).first()

        # Masking email helper
        def mask_email(email_str):
            if not email_str or "@" not in email_str:
                return "su***@company.com"
            parts = email_str.split("@")
            username = parts[0]
            domain = parts[1]
            if len(username) <= 2:
                masked_username = username + "***"
            else:
                masked_username = username[:2] + "***"
            return f"{masked_username}@{domain}"

        if found_user:
            emp_id = found_employee.employee_id if found_employee else identity
            name = found_user.get_full_name() or found_user.username
            department = found_employee.department if (found_employee and found_employee.department) else "Operations"
            email = found_user.email
            if not email:
                email = "suryaramya111111@gmail.com"
        else:
            # Local Dev Fallback: return mock details for testing any identity (like EMP1025)
            if settings.DEBUG:
                emp_id = identity
                name = "Surya S"
                department = "Operations"
                email = "suryaramya111111@gmail.com"
            else:
                return Response({"detail": "No workforce identity detected in system registries."}, status=404)

        return Response({
            "verified": True,
            "employee_id": emp_id,
            "name": name,
            "department": department,
            "email": email,
            "email_masked": mask_email(email)
        })

