"""
service_requests/serializers.py

All request/response validation using DRF Serializers.
No Pydantic. No inline logic — validation only.
"""
from rest_framework import serializers

from employees.models import Employee
from .models import (
    EmployeeJob, EmployeePerformance, JobCompletionProof,
    ServiceFeedback, ServiceRequest, SERVICE_CATEGORIES,
)


# ── Public ────────────────────────────────────────────────────────────────────

class ServiceRequestPublicCreateSerializer(serializers.ModelSerializer):
    """Used by the public booking form — no auth required."""

    class Meta:
        model = ServiceRequest
        fields = (
            "customer_name", "phone", "email",
            "service_category", "issue_title", "description", "address",
            "preferred_date", "photo",
        )

    def validate_service_category(self, value):
        valid = [c[0] for c in SERVICE_CATEGORIES]
        if value not in valid:
            raise serializers.ValidationError(f"Invalid category. Choose from: {valid}")
        return value

    def validate_preferred_date(self, value):
        from django.utils.timezone import localdate
        if value < localdate():
            raise serializers.ValidationError("Preferred date cannot be in the past.")
        return value

    def validate_phone(self, value):
        import re
        cleaned = re.sub(r"[\s\-\(\)\+]", "", value)
        if not cleaned.isdigit() or len(cleaned) < 7:
            raise serializers.ValidationError("Enter a valid phone number.")
        return value


class FeedbackTokenSummarySerializer(serializers.ModelSerializer):
    """Read-only summary shown to customer when they open the feedback link."""
    service_category_display = serializers.CharField(
        source="get_service_category_display", read_only=True
    )

    class Meta:
        model = ServiceRequest
        fields = (
            "request_id", "customer_name", "service_category",
            "service_category_display", "issue_title", "address",
            "preferred_date", "created_at",
        )


class ServiceFeedbackSubmitSerializer(serializers.ModelSerializer):
    """Validates customer feedback submission."""

    class Meta:
        model = ServiceFeedback
        fields = ("rating", "employee_behaviour", "work_quality", "issue_resolved", "comment")

    def validate_rating(self, value):
        if value not in range(1, 6):
            raise serializers.ValidationError("Rating must be between 1 and 5.")
        return value


# ── Shared nested ─────────────────────────────────────────────────────────────

class EmployeeMinimalSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    username  = serializers.CharField(source="user.username", read_only=True)
    email     = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = Employee
        fields = ("id", "employee_id", "full_name", "username", "email", "title")

    def get_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class JobProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCompletionProof
        fields = ("id", "photo", "document", "note", "uploaded_at")


# ── Admin ─────────────────────────────────────────────────────────────────────

class ServiceRequestListSerializer(serializers.ModelSerializer):
    """Lightweight — used in list view."""
    service_category_display = serializers.CharField(
        source="get_service_category_display", read_only=True
    )
    status_display    = serializers.CharField(source="get_status_display", read_only=True)
    priority_display  = serializers.CharField(source="get_priority_display", read_only=True)
    assigned_employee = EmployeeMinimalSerializer(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "address", "preferred_date",
            "status", "status_display", "priority", "priority_display",
            "assigned_employee", "created_at", "updated_at",
        )


class ServiceRequestDetailSerializer(serializers.ModelSerializer):
    """Full detail — includes photo URL + allowed next transitions."""
    service_category_display = serializers.CharField(
        source="get_service_category_display", read_only=True
    )
    status_display    = serializers.CharField(source="get_status_display", read_only=True)
    priority_display  = serializers.CharField(source="get_priority_display", read_only=True)
    assigned_employee = EmployeeMinimalSerializer(read_only=True)
    photo_url         = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()
    has_feedback      = serializers.SerializerMethodField()
    feedback_token    = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "description", "address", "preferred_date",
            "photo_url", "status", "status_display", "priority", "priority_display",
            "assigned_employee", "allowed_transitions",
            "has_feedback", "feedback_token",
            "created_at", "updated_at",
        )

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

    def get_allowed_transitions(self, obj):
        from .state_machine import get_allowed_transitions
        return get_allowed_transitions(obj)

    def get_has_feedback(self, obj):
        return hasattr(obj, "feedback")

    def get_feedback_token(self, obj):
        try:
            return str(obj.feedback.feedback_token)
        except Exception:
            return None


class AdminChangePrioritySerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=ServiceRequest.Priority.choices)


class AdminAssignSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()

    def validate_employee_id(self, value):
        if not Employee.objects.filter(id=value).exists():
            raise serializers.ValidationError("Employee not found.")
        return value


# ── Admin Feedback ─────────────────────────────────────────────────────────────

class ServiceFeedbackAdminSerializer(serializers.ModelSerializer):
    request_id       = serializers.CharField(source="service_request.request_id", read_only=True)
    customer_name    = serializers.CharField(source="service_request.customer_name", read_only=True)
    service_category = serializers.CharField(source="service_request.get_service_category_display", read_only=True)
    employee_name    = serializers.SerializerMethodField()

    class Meta:
        model = ServiceFeedback
        fields = (
            "id", "request_id", "customer_name", "service_category",
            "employee_name", "rating", "employee_behaviour", "work_quality",
            "issue_resolved", "comment", "submitted_at",
        )

    def get_employee_name(self, obj):
        try:
            emp = obj.service_request.employee_job.employee
            return emp.user.get_full_name() or emp.user.username
        except Exception:
            return ""


# ── Employee ───────────────────────────────────────────────────────────────────

class EmployeeJobListSerializer(serializers.ModelSerializer):
    request_id       = serializers.CharField(source="service_request.request_id", read_only=True)
    customer_name    = serializers.CharField(source="service_request.customer_name", read_only=True)
    service_category = serializers.CharField(source="service_request.get_service_category_display", read_only=True)
    address          = serializers.CharField(source="service_request.address", read_only=True)
    preferred_date   = serializers.DateField(source="service_request.preferred_date", read_only=True)
    sr_status        = serializers.CharField(source="service_request.status", read_only=True)
    priority         = serializers.CharField(source="service_request.priority", read_only=True)
    proofs_count     = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeJob
        fields = (
            "id", "request_id", "customer_name", "service_category",
            "address", "preferred_date", "sr_status", "priority",
            "status", "assigned_date", "accepted_date", "started_date",
            "completed_date", "notes", "proofs_count",
        )

    def get_proofs_count(self, obj):
        return obj.proofs.count()


class EmployeeJobDetailSerializer(serializers.ModelSerializer):
    service_request = ServiceRequestDetailSerializer(read_only=True)
    proofs          = JobProofSerializer(many=True, read_only=True)
    has_feedback    = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeJob
        fields = (
            "id", "service_request", "status",
            "notes", "assigned_date", "accepted_date", "started_date",
            "completed_date", "proofs", "has_feedback",
        )

    def get_has_feedback(self, obj):
        try:
            return obj.service_request.feedback.is_submitted
        except Exception:
            return False


class JobProofUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCompletionProof
        fields = ("photo", "document", "note")


class EmployeeJobNotesSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


# ── Performance ────────────────────────────────────────────────────────────────

class EmployeePerformanceSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    feedback_list = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePerformance
        fields = (
            "employee_name",
            "jobs_completed_count", "average_rating", "feedback_count",
            "completion_rate", "customer_satisfaction_score", "last_updated",
            "feedback_list",
        )

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_feedback_list(self, obj):
        feedbacks = ServiceFeedback.objects.filter(
            is_submitted=True,
            service_request__employee_job__employee=obj.employee,
        ).select_related("service_request").order_by("-submitted_at")[:20]
        return [
            {
                "request_id":        f.service_request.request_id,
                "rating":            f.rating,
                "employee_behaviour": f.employee_behaviour,
                "work_quality":      f.work_quality,
                "issue_resolved":    f.issue_resolved,
                "comment":           f.comment,
                "submitted_at":      f.submitted_at,
            }
            for f in feedbacks
        ]
