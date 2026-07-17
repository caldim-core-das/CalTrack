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
        email = request.data.get("email")
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        email = email.lower().strip()
        user = User.objects.filter(email=email, role=User.Role.CUSTOMER).first()
        if not user:
            # Create a new customer profile
            username = f"customer_{random.randint(100000, 999999)}_{random.randint(100000, 999999)}"
            user = User.objects.create_user(
                username=username,
                email=email,
                role=User.Role.CUSTOMER
            )
        
        otp = _generate_otp()
        user.email_otp = otp
        user.otp_created_at = timezone.now()
        user.save(update_fields=["email_otp", "otp_created_at"])
        
        # Send email
        subject = "Your Caltrack Login Code"
        message = f"Your Caltrack login code is: {otp}\n\nThis code will expire in 5 minutes."
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Failed to send email OTP to {email}: {e}")

        # Also print to console for development
        print(f"--- MOCK EMAIL ---")
        print(f"To: {email}")
        print(f"Subject: Your Caltrack Login Code")
        print(f"Body: Your OTP is {otp}")
        print(f"------------------")

        return Response({"detail": "OTP sent to email."})

class CustomerEmailOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        email = request.data.get("email")
        otp = request.data.get("otp")
        if not email or not otp:
            return Response({"detail": "Email and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        email = email.lower().strip()
        user = User.objects.filter(email=email, role=User.Role.CUSTOMER).first()
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


class CustomerPhoneOTPRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        phone = request.data.get("phone")
        if not phone:
            return Response({"detail": "Phone is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        phone = phone.strip()
        user = User.objects.filter(phone=phone, role=User.Role.CUSTOMER).first()
        if not user:
            # Create a new customer profile
            username = f"customer_{random.randint(100000, 999999)}_{random.randint(100000, 999999)}"
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

        return Response({"detail": "OTP sent to phone."})

class CustomerPhoneOTPVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        phone = request.data.get("phone")
        otp = request.data.get("otp")
        if not phone or not otp:
            return Response({"detail": "Phone and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
        
        phone = phone.strip()
        user = User.objects.filter(phone=phone, role=User.Role.CUSTOMER).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        
        if user.phone_otp != otp:
            return Response({"detail": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)
        
        if (timezone.now() - user.otp_created_at).total_seconds() > 300:
            return Response({"detail": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Clear OTP and return tokens
        user.phone_otp = None
        user.otp_created_at = None
        user.save(update_fields=["phone_otp", "otp_created_at"])
        
        tokens = _get_tokens_for_user(user)
        response = Response({"success": True, "detail": "Login successful"})
        return _set_auth_cookies(response, tokens["access"], tokens["refresh"])


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

