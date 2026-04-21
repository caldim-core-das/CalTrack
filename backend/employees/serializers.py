from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Employee

User = get_user_model()


class EmployeeUserSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")
        read_only_fields = ("id", "role")


class EmployeeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    user = EmployeeUserSerializer(read_only=True)
    job_site_name = serializers.SlugRelatedField(
        source='assigned_job_site',
        read_only=True,
        slug_field='name'
    )

    class Meta:
        model = Employee
        fields = (
            "id",
            "employee_id",
            "user",
            "phone",
            "title",
            "hourly_rate",
            "hire_date",
            "assigned_job_site",
            "job_site_name",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class EmployeeCreateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "employee_id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "phone",
            "title",
            "hourly_rate",
            "hire_date",
            "assigned_job_site",
            "is_active",
        )

    def create(self, validated_data):
        username = validated_data.pop("username")
        password = validated_data.pop("password")
        email = validated_data.pop("email", "")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")
        user = User.objects.create_user(
            username=username,
            password=password,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.EMPLOYEE,
        )
        return Employee.objects.create(user=user, **validated_data)
