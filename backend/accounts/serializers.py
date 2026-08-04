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
    company_region = serializers.SerializerMethodField()
    companyCountry = serializers.SerializerMethodField()
    primaryCountry = serializers.SerializerMethodField()
    employee_roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "first_name", "last_name", "role",
            "company", "company_name", "company_domain", "company_schema", "bio", "phone", "timezone", "language",
            "avatar_url", "two_fa_enabled", "company_permissions", "employee_country", "company_country", "company_region",
            "companyCountry", "primaryCountry", "employee_roles", "company_currency", "company_currency_symbol"
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
            if getattr(obj, 'company', None):
                return obj.company.primary_country or "IN"
            if getattr(obj, 'company_id', None):
                from companies.models import Company
                comp = Company.objects.filter(id=obj.company_id).first()
                if comp:
                    return comp.primary_country or "IN"
            return "IN"
        except Exception:
            return "IN"

    def get_company_region(self, obj):
        return self.get_company_country(obj)

    def get_companyCountry(self, obj):
        return self.get_company_country(obj)

    def get_primaryCountry(self, obj):
        return self.get_company_country(obj)

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
            try:
                url = obj.avatar.url
                if url:
                    if 'demo.localhost' in url:
                        idx = url.find('/media/')
                        if idx != -1:
                            return "http://localhost:8000" + url[idx:]
                    request = self.context.get("request")
                    if request:
                        uri = request.build_absolute_uri(url)
                        if 'demo.localhost' in uri:
                            idx = uri.find('/media/')
                            if idx != -1:
                                return "http://localhost:8000" + uri[idx:]
                        return uri
                    return url
            except Exception:
                return None
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
    avatar = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ("first_name", "last_name", "email", "bio", "phone", "timezone", "language", "avatar")
        extra_kwargs = {
            "email": {"validators": []}
        }

    def validate_email(self, value):
        if not value:
            return value
        val_clean = value.strip().lower()
        user = None
        if self.context and self.context.get('request'):
            user = self.context.get('request').user
        if not user:
            user = getattr(self, 'instance', None)

        if user and user.pk:
            if user.email and user.email.strip().lower() == val_clean:
                return val_clean
            existing = User.objects.filter(email__iexact=val_clean).exclude(pk=user.pk).exists()
            if existing:
                raise serializers.ValidationError("A user with this email address already exists.")
        else:
            existing = User.objects.filter(email__iexact=val_clean).exists()
            if existing:
                raise serializers.ValidationError("A user with this email address already exists.")
        return val_clean

    def update(self, instance, validated_data):
        avatar_val = validated_data.pop('avatar', None)
        if avatar_val:
            if isinstance(avatar_val, str):
                if '/media/' in avatar_val:
                    instance.avatar.name = avatar_val.split('/media/')[-1]
                else:
                    instance.avatar.name = avatar_val
            else:
                instance.avatar = avatar_val

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(username=attrs.get("username"), password=attrs.get("password"))
        if not user:
            raise serializers.ValidationError("Invalid credentials.")
        attrs["user"] = user
        return attrs
