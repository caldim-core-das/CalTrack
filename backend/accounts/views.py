from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
import requests
from django.contrib.auth import get_user_model

from .serializers import UserSerializer


def _generate_next_employee_id(organization):
    from employees.models import Employee
    prefix = "EMP"
    qs = Employee.objects.all()
    if organization is not None:
        qs = qs.filter(user__organization=organization)
    max_n = 0
    for v in qs.values_list("employee_id", flat=True):
        if not v:
            continue
        s = str(v).strip().upper().replace(" ", "")
        if not s.startswith(prefix):
            continue
        tail = s[len(prefix):]
        if not tail.isdigit():
            continue
        n = int(tail)
        if n > max_n:
            max_n = n
    n = max_n + 1
    while True:
        cand = f"{prefix}{n:03d}"
        if not Employee.objects.filter(employee_id=cand).exists():
            return cand
        n += 1


def _ensure_pretty_employee_id(employee, organization):
    if not employee or not employee.employee_id:
        return
    raw = str(employee.employee_id).strip()
    if raw.upper().startswith("EMP-"):
        next_id = _generate_next_employee_id(organization)
        employee.employee_id = next_id
        employee.save(update_fields=["employee_id", "updated_at"])


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        from employees.models import Employee
        emp = Employee.objects.filter(user=user).first()
        _ensure_pretty_employee_id(emp, user.organization)
        token = super().get_token(user)
        token["role"] = str(user.role)
        token["username"] = str(user.username)
        return token


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    pass


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
            
            # Auto-create Employee profile to prevent Time Tracker error
            from employees.models import Employee
            emp, _ = Employee.objects.get_or_create(
                user=user,
                defaults={
                    "employee_id": _generate_next_employee_id(user.organization),
                    "title": "Staff",
                    "hourly_rate": 0,
                }
            )
            _ensure_pretty_employee_id(emp, user.organization)
            
        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        email = request.data.get("email", "")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        role = request.data.get("role", "employee")

        if not username or not password:
            return Response({"detail": "Username and password required."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username is already taken."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role if role in ["admin", "employee"] else "employee"
        )

        # Create Profile
        from employees.models import Employee
        emp, _ = Employee.objects.get_or_create(
            user=user,
            defaults={
                "employee_id": _generate_next_employee_id(user.organization),
                "title": "New Hire",
                "hourly_rate": 0,
            }
        )
        _ensure_pretty_employee_id(emp, user.organization)

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
