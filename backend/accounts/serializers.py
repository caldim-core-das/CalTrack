from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    company = serializers.CharField(source="company_id", read_only=True)
    company_name = serializers.SerializerMethodField()
    company_domain = serializers.SerializerMethodField()
    company_schema = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    company_permissions = serializers.SerializerMethodField()
    employee_country = serializers.SerializerMethodField()
    company_country = serializers.SerializerMethodField()
    company_currency = serializers.SerializerMethodField()
    company_currency_symbol = serializers.SerializerMethodField()
    employee_roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name", "role",
            "company", "company_name", "company_domain", "company_schema", "bio", "phone", "timezone", "language",
            "avatar_url", "two_fa_enabled", "company_permissions", "employee_country", "company_country", "employee_roles",
            "company_currency", "company_currency_symbol"
        )

    def get_company_permissions(self, obj):
        try:
            return obj.company.module_permissions if obj.company else None
        except Exception:
            return None

    def get_employee_country(self, obj):
        try:
            if obj.company:
                from django_tenants.utils import schema_context
                with schema_context(obj.company.schema_name):
                    from employees.models import Employee
                    employee = Employee.objects.filter(user=obj).first()
                    if employee and employee.country:
                        return employee.country
            return obj.company.primary_country if obj.company else None
        except Exception:
            return None

    def get_employee_roles(self, obj):
        try:
            if obj.role == "employee" and obj.company:
                from django_tenants.utils import schema_context
                with schema_context(obj.company.schema_name):
                    from employees.models import Employee
                    employee = Employee.objects.filter(user=obj).first()
                    if employee and employee.service_roles:
                        return employee.service_roles
            return []
        except Exception:
            return []

    def get_company_country(self, obj):
        try:
            return obj.company.primary_country if obj.company else None
        except Exception:
            return None

    def get_company_name(self, obj):
        try:
            return obj.company.company_name if obj.company else ""
        except Exception:
            return ""

    def get_company_domain(self, obj):
        try:
            if obj.company:
                dom = obj.company.domains.first()
                return dom.domain if dom else ""
            return ""
        except Exception:
            return ""

    def get_company_schema(self, obj):
        try:
            return obj.company.schema_name if obj.company else ""
        except Exception:
            return ""

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_company_currency(self, obj):
        try:
            return obj.company.region.currency if obj.company and obj.company.region else "USD"
        except Exception:
            return "USD"

    def get_company_currency_symbol(self, obj):
        try:
            return obj.company.region.currency_symbol if obj.company and obj.company.region else "$"
        except Exception:
            return "$"


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("first_name", "last_name", "email", "bio", "phone", "timezone", "language", "avatar")


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs.get("username"), password=attrs.get("password"))
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs
