import os
import re
import random
import string
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from .views import _set_auth_cookies

User = get_user_model()

def _generate_otp(length=6):
    return "".join(random.choices(string.digits, k=length))

def _get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }

class CustomerEmailOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            email = request.data.get("email")
            if not email:
                return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            email = email.replace(" ", "").strip().lower()
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                username = f"customer_{random.randint(100000, 999999)}_{random.randint(100000, 999999)}"
                user = User(
                    username=username,
                    email=email,
                    role=User.Role.CUSTOMER
                )
                user.set_unusable_password()
                user.save()
            
            otp = _generate_otp()
            user.email_otp = otp
            user.otp_created_at = timezone.now()
            user.save(update_fields=["email_otp", "otp_created_at"])
            
            # Send email
            subject = "Your Caltrack Login Code"
            message = f"Your Caltrack login code is: {otp}\n\nThis code will expire in 5 minutes."
            email_sent = False
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None) or "noreply@caltrack.com"

            try:
                send_mail(
                    subject,
                    message,
                    from_email,
                    [email],
                    fail_silently=False,
                )
                email_sent = True
            except Exception as e:
                print(f"Failed to send email OTP to {email}: {e}")

            # Also print to console for development
            print("\n" + "=" * 50)
            print(f"  [EMAIL GATEWAY] OTP for {email} is: {otp}")
            if email_sent:
                print(f"  [EMAIL GATEWAY] Live SMTP email delivered successfully to {email} via {from_email}!")
            else:
                print(f"  [EMAIL GATEWAY] Live SMTP delivery failed. Check .env EMAIL settings.")
            print("=" * 50 + "\n")

            res_data = {"detail": "OTP sent to email.", "email_sent": email_sent}
            if not email_sent and getattr(settings, "DEBUG", False):
                res_data["dev_otp"] = otp

            return Response(res_data)
        except Exception as e:
            print(f"Error in CustomerEmailOTPRequestView: {e}")
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomerEmailOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            email = request.data.get("email")
            otp = request.data.get("otp")
            if not email or not otp:
                return Response({"detail": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
            email = email.replace(" ", "").strip().lower()
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if user.email_otp != otp:
                return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
            
            if (timezone.now() - user.otp_created_at).total_seconds() > 300:
                return Response({"detail": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Clear OTP and return tokens
            user.email_otp = None
            user.otp_created_at = None
            user.save(update_fields=["email_otp", "otp_created_at"])
            
            tokens = _get_tokens_for_user(user)
            response = Response({"success": True, "detail": "Login successful"})
            return _set_auth_cookies(response, tokens["access"], tokens["refresh"])
        except Exception as e:
            print(f"Error in CustomerEmailOTPVerifyView: {e}")
            return Response({"detail": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _find_origin_service_request(phone_number):
    if not phone_number:
        return None
    digits = re.sub(r'\D', '', phone_number)
    last10 = digits[-10:] if len(digits) >= 10 else digits
    if not last10:
        return None

    # 1. Search active connection schema
    try:
        from service_requests.models import ServiceRequest
        sr = ServiceRequest.objects.filter(phone__icontains=last10).order_by("-id").first()
        if sr:
            return sr
    except Exception:
        pass

    # 2. Discover all PostgreSQL schemas dynamically via raw SQL
    try:
        from django.db import connection
        from django_tenants.utils import schema_context
        from service_requests.models import ServiceRequest

        schemas = []
        with connection.cursor() as cursor:
            cursor.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%%' AND schema_name != 'information_schema'")
            schemas = [row[0] for row in cursor.fetchall()]

        for s_name in schemas:
            try:
                with schema_context(s_name):
                    sr = ServiceRequest.objects.filter(phone__icontains=last10).order_by("-id").first()
                    if sr:
                        return sr
            except Exception:
                continue

        # Fallback: return the latest ServiceRequest in any schema if phone search yields nothing
        for s_name in schemas:
            try:
                with schema_context(s_name):
                    sr = ServiceRequest.objects.all().order_by("-id").first()
                    if sr:
                        return sr
            except Exception:
                continue
    except Exception as e:
        print(f"Could not query ServiceRequest across schemas: {e}")
    return None


class CustomerPhoneOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            phone = request.data.get("phone")
            if not phone:
                return Response({"detail": "Phone is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            phone = phone.strip()
            digits = re.sub(r'\D', '', phone)
            last10 = digits[-10:] if len(digits) >= 10 else digits

            from django.db.models import Q

            user = User.objects.filter(
                Q(phone=phone) | Q(phone__icontains=last10)
            ).first() if last10 else User.objects.filter(phone=phone).first()

            sr = _find_origin_service_request(phone)

            if not user:
                first_name = ""
                last_name = ""
                email = ""
                if sr:
                    if sr.customer_name:
                        parts = sr.customer_name.strip().split(' ')
                        first_name = parts[0]
                        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
                    email = sr.email or ""
                
                username = f"customer_{random.randint(100000, 999999)}_{random.randint(100000, 999999)}"
                user = User(
                    username=username,
                    phone=phone,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.CUSTOMER
                )
                user.set_unusable_password()
                user.save()
            else:
                updated = False
                if sr:
                    if not user.first_name and sr.customer_name:
                        parts = sr.customer_name.strip().split(' ')
                        user.first_name = parts[0]
                        if len(parts) > 1:
                            user.last_name = " ".join(parts[1:])
                        updated = True
                    if not user.email and sr.email:
                        user.email = sr.email.strip()
                        updated = True
                if updated:
                    user.save()
            
            otp = _generate_otp()
            user.phone_otp = otp
            user.otp_created_at = timezone.now()
            user.save(update_fields=["phone_otp", "otp_created_at"])
            
            # Print OTP to server console
            print("\n" + "=" * 50)
            print(f"  [SMS GATEWAY] OTP for {phone} is: {otp}")
            print("=" * 50 + "\n")

            res_data = {"detail": "OTP sent to phone."}
            if getattr(settings, "DEBUG", False):
                res_data["dev_otp"] = otp

            return Response(res_data)
        except Exception as e:
            print(f"Error in CustomerPhoneOTPRequestView: {e}")
            import traceback
            traceback.print_exc()
            return Response({"detail": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CustomerPhoneOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            phone = request.data.get("phone")
            otp = request.data.get("otp")
            if not phone or not otp:
                return Response({"detail": "Phone and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
            phone = phone.strip()
            digits = re.sub(r'\D', '', phone)
            last10 = digits[-10:] if len(digits) >= 10 else digits

            from django.db.models import Q

            user = User.objects.filter(
                Q(phone=phone) | Q(phone__icontains=last10)
            ).first()

            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if user.phone_otp != otp:
                return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
            
            if (timezone.now() - user.otp_created_at).total_seconds() > 300:
                return Response({"detail": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Clear OTP and sync missing name/email/phone/role
            user.phone_otp = None
            user.otp_created_at = None
            user.phone = phone
            user.role = User.Role.CUSTOMER

            sr = _find_origin_service_request(phone)
            if sr:
                if not sr.customer:
                    try:
                        sr.customer = user
                        sr.save(update_fields=['customer'])
                    except Exception:
                        pass
                if not user.first_name and sr.customer_name:
                    parts = sr.customer_name.strip().split(' ')
                    user.first_name = parts[0]
                    if len(parts) > 1:
                        user.last_name = " ".join(parts[1:])
                if not user.email and sr.email:
                    user.email = sr.email.strip()

            user.save()
            
            tokens = _get_tokens_for_user(user)
            response = Response({"success": True, "detail": "Login successful"})
            return _set_auth_cookies(response, tokens["access"], tokens["refresh"])
        except Exception as e:
            print(f"Error in CustomerPhoneOTPVerifyView: {e}")
            return Response({"detail": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CustomerGoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        access_token = request.data.get("access_token")
        email = request.data.get("email")
        name = request.data.get("name", "")

        if access_token:
            import requests
            try:
                # Call Google UserInfo API using the access token
                google_res = requests.get(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10
                )
                if google_res.status_code == 200:
                    profile = google_res.json()
                    email = profile.get("email")
                    name = profile.get("name", "")
                else:
                    return Response({"detail": f"Failed to authenticate with Google: {google_res.text}"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"detail": f"Google connection error: {str(e)}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        email = email.lower().strip()
        user = User.objects.filter(email=email, role=User.Role.CUSTOMER).first()
        if not user:
            # Create a new customer profile
            username = f"customer_{random.randint(100000, 999999)}_{random.randint(100000, 999999)}"
            first_name = name.split(" ")[0] if name else "Google"
            last_name = " ".join(name.split(" ")[1:]) if name and len(name.split(" ")) > 1 else "User"
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=User.Role.CUSTOMER
            )
        
        tokens = _get_tokens_for_user(user)
        response = Response({
            "success": True, 
            "detail": "Google login successful",
            "user": {
                "name": f"{user.first_name} {user.last_name}".strip(),
                "email": user.email,
                "phone": user.phone or ""
            }
        })
        return _set_auth_cookies(response, tokens["access"], tokens["refresh"])

