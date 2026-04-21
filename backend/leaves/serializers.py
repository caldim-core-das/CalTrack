from rest_framework import serializers

from .models import LeaveRequest


class LeaveRequestSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    employee = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    approved_by = serializers.CharField(source='approved_by.id', read_only=True)

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
            "decision_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "paid", "status", "approved_by", "decision_at", "created_at", "updated_at")


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
