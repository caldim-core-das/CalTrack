import uuid

from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
import requests
from django.contrib.auth import get_user_model
from django.db import connection

from .serializers import UserSerializer
from employees.utils import generate_next_employee_id
import uuid
import traceback
from django.db import transaction
from companies.models import Company




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
            # Note: Employee profile is NOT created here because company is required.
            # The user will be prompted to create/join a company via the onboarding flow,
            # and an Employee profile will be created at that point.
            
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
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
