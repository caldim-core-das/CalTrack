from rest_framework import serializers

from .models import LeaveRequest


class LeaveRequestSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    employee = serializers.CharField(source="employee.employee_id", read_only=True, default="")
    employee_name = serializers.SerializerMethodField()
    approved_by = serializers.CharField(source='approved_by.id', read_only=True, default=None, allow_null=True)
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = LeaveRequest
        fields = (
            "id",
            "employee",
            "employee_name",
            "leave_type",
            "start_date",
            "end_date",
            "reason",
            "paid",
            "status",
            "approved_by",
            "approved_by_name",
            "decision_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "paid", "status", "approved_by", "decision_at", "created_at", "updated_at")

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return ""


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = ("id", "leave_type", "start_date", "end_date", "reason")
        read_only_fields = ("id",)

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date must be on/after start date."})
        return attrs
