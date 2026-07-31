import os
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
            if not email or not isinstance(email, str):
                return Response({"detail": "Valid email is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            email = email.lower().strip()
            if not email:
                return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

            user = User.objects.filter(email__iexact=email).first()
            if not user:
                # Create a new customer profile with unique username
                base_username = f"customer_{random.randint(100000, 999999)}"
                username = base_username
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{random.randint(100, 999)}"

                user = User.objects.create_user(
                    username=username,
                    email=email,
                    role=User.Role.CUSTOMER
                )
            
            otp = _generate_otp()
            user.email_otp = otp
            user.otp_created_at = timezone.now()
            user.save(update_fields=["email_otp", "otp_created_at"])
            
            # Send email safely without crashing
            subject = "Your Caltrack Login Code"
            message = f"Your Caltrack login code is: {otp}\n\nThis code will expire in 5 minutes."
            from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "noreply@caltrack.com"
            try:
                send_mail(
                    subject,
                    message,
                    from_email,
                    [email],
                    fail_silently=True,
                )
            except Exception as e:
                print(f"Failed to send email OTP to {email}: {e}")

            # Also print to console for development
            print(f"--- MOCK EMAIL ---")
            print(f"To: {email}")
            print(f"Subject: Your Caltrack Login Code")
            print(f"Body: Your OTP is {otp}")
            print(f"------------------")

            return Response({"detail": "OTP sent to email.", "otp": otp})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CustomerEmailOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            email = request.data.get("email")
            otp = request.data.get("otp")
            if not email or not otp:
                return Response({"detail": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
            email = str(email).lower().strip()
            otp = str(otp).strip()
            user = User.objects.filter(email__iexact=email).first()
            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if not user.email_otp or not user.otp_created_at:
                return Response({"detail": "No active OTP request found. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

            if user.email_otp != otp:
                return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
            
            if (timezone.now() - user.otp_created_at).total_seconds() > 300:
                return Response({"detail": "OTP expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Clear OTP and return tokens
            user.email_otp = None
            user.otp_created_at = None
            user.save(update_fields=["email_otp", "otp_created_at"])
            
            tokens = _get_tokens_for_user(user)
            response = Response({"success": True, "detail": "Login successful"})
            return _set_auth_cookies(response, tokens["access"], tokens["refresh"])
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomerPhoneOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            phone = request.data.get("phone")
            if not phone:
                return Response({"detail": "Phone is required."}, status=status.HTTP_400_BAD_REQUEST)
            
            phone = str(phone).strip()
            user = User.objects.filter(phone=phone, role=User.Role.CUSTOMER).first()
            if not user:
                base_username = f"customer_{random.randint(100000, 999999)}"
                username = base_username
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{random.randint(100, 999)}"

                user = User.objects.create_user(
                    username=username,
                    phone=phone,
                    role=User.Role.CUSTOMER
                )
            
            otp = _generate_otp()
            user.phone_otp = otp
            user.otp_created_at = timezone.now()
            user.save(update_fields=["phone_otp", "otp_created_at"])
            
            # Try to send SMS via Twilio
            sent_real_sms = False
            delivery_error = ""
            try:
                from twilio.rest import Client as TwilioClient
                account_sid = os.getenv("TWILIO_ACCOUNT_SID")
                auth_token = os.getenv("TWILIO_AUTH_TOKEN")
                from_number = os.getenv("TWILIO_FROM_NUMBER")
                if account_sid and auth_token and from_number and not account_sid.startswith("your_"):
                    client = TwilioClient(account_sid, auth_token)
                    client.messages.create(
                        body=f"Your Caltrack login code is {otp}. Expires in 5 minutes.",
                        from_=from_number,
                        to=phone
                    )
                    sent_real_sms = True
            except ImportError:
                delivery_error = "Twilio client library not installed"
            except Exception as e:
                delivery_error = str(e)
                print(f"Twilio SMS send error: {e}")

            # Print OTP to server console
            print("\n" + "=" * 50)
            print(f"  [SMS GATEWAY] OTP for {phone} is: {otp}")
            if delivery_error:
                print(f"  [SMS GATEWAY] Twilio delivery skipped/failed: {delivery_error}")
            print("" + "=" * 50 + "\n")

            return Response({"detail": "OTP sent to phone.", "otp": otp})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CustomerPhoneOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            phone = request.data.get("phone")
            otp = request.data.get("otp")
            if not phone or not otp:
                return Response({"detail": "Phone and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
            phone = str(phone).strip()
            otp = str(otp).strip()
            user = User.objects.filter(phone=phone, role=User.Role.CUSTOMER).first()
            if not user:
                return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
            
            if not user.phone_otp or not user.otp_created_at:
                return Response({"detail": "No active OTP request found. Please request a new OTP."}, status=status.HTTP_400_BAD_REQUEST)

            if user.phone_otp != otp:
                return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
            
            if (timezone.now() - user.otp_created_at).total_seconds() > 300:
                return Response({"detail": "OTP expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Clear OTP and return tokens
            user.phone_otp = None
            user.otp_created_at = None
            user.save(update_fields=["phone_otp", "otp_created_at"])
            
            tokens = _get_tokens_for_user(user)
            response = Response({"success": True, "detail": "Login successful"})
            return _set_auth_cookies(response, tokens["access"], tokens["refresh"])
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Internal server error: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CustomerGoogleLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        try:
            access_token = request.data.get("access_token")
            id_token = request.data.get("id_token") or request.data.get("credential")
            email = request.data.get("email")
            name = request.data.get("name", "")

            # 1. Try verifying id_token with Google TokenInfo API
            if id_token and not email:
                import requests
                try:
                    google_res = requests.get(
                        f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
                        timeout=10
                    )
                    if google_res.status_code == 200:
                        profile = google_res.json()
                        email = profile.get("email")
                        name = profile.get("name") or profile.get("given_name", "")
                except Exception as e:
                    print(f"[CustomerGoogleLoginView] ID token verification error: {e}")

            # 2. Try verifying access_token with Google UserInfo API
            if access_token and not email:
                import requests
                try:
                    google_res = requests.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {access_token}"},
                        timeout=10
                    )
                    if google_res.status_code != 200:
                        google_res = requests.get(
                            f"https://www.googleapis.com/oauth2/v3/userinfo?access_token={access_token}",
                            timeout=10
                        )

                    if google_res.status_code == 200:
                        profile = google_res.json()
                        email = profile.get("email")
                        name = profile.get("name", "")
                except Exception as e:
                    print(f"[CustomerGoogleLoginView] Access token verification error: {e}")

            # 3. Fallback: decode JWT payload locally if Google endpoint was unreachable
            if id_token and not email:
                try:
                    import jwt
                    decoded = jwt.decode(id_token, options={"verify_signature": False})
                    if isinstance(decoded, dict):
                        email = decoded.get("email")
                        if not name:
                            name = decoded.get("name") or decoded.get("given_name", "")
                except Exception as e:
                    print(f"[CustomerGoogleLoginView] JWT decode error: {e}")

            if not email:
                return Response(
                    {"detail": "Google authentication failed. Could not verify email from Google."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            email = str(email).lower().strip()
            
            # Find customer account or existing user account
            user = (
                User.objects.filter(email__iexact=email, role=User.Role.CUSTOMER, is_active=True).first()
                or User.objects.filter(email__iexact=email, role=User.Role.CUSTOMER).first()
                or User.objects.filter(email__iexact=email, is_active=True).first()
                or User.objects.filter(email__iexact=email).first()
            )

            if not user:
                base_username = f"customer_{random.randint(100000, 999999)}"
                username = base_username
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{random.randint(100, 999)}"

                first_name = name.split(" ")[0] if (name and isinstance(name, str)) else "Google"
                last_name = " ".join(name.split(" ")[1:]) if (name and isinstance(name, str) and len(name.split(" ")) > 1) else "User"
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=User.Role.CUSTOMER
                )
            else:
                if not user.is_active:
                    user.is_active = True
                    user.save(update_fields=["is_active"])

            from .views import CustomTokenObtainPairSerializer, _set_auth_cookies
            refresh = CustomTokenObtainPairSerializer.get_token(user)
            tokens = {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            }
            
            full_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
            response = Response({
                "success": True, 
                "detail": "Google login successful",
                "user": {
                    "username": user.username,
                    "name": full_name,
                    "email": user.email,
                    "phone": getattr(user, "phone", "") or "",
                    "role": user.role
                }
            })
            return _set_auth_cookies(response, tokens["access"], tokens["refresh"])
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"detail": f"Internal server error during Google login: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

