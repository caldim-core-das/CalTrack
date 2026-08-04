"""
service_requests/serializers.py

All request/response validation using DRF Serializers.
No Pydantic. No inline logic — validation only.
"""
from rest_framework import serializers

from employees.models import Employee
from .models import (
    EmployeeJob, EmployeePerformance, JobCompletionProof,
    ServiceFeedback, ServiceRequest, CatalogCategory, CatalogService,
    RescheduleRequest, RescheduleAttachment, RescheduleStatus, RescheduleReason, TimeSlotChoices,
    RescheduleSuggestedSlot, RescheduleStatusHistory,
    RefundRequest, RefundEvidence, RefundInvestigationNote,
)

class CatalogServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogService
        fields = '__all__'

class CatalogCategorySerializer(serializers.ModelSerializer):
    services = CatalogServiceSerializer(many=True, read_only=True)
    
    class Meta:
        model = CatalogCategory
        fields = '__all__'
        
    def to_internal_value(self, data):
        data_copy = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'desc' in data_copy and not data_copy.get('description'):
            data_copy['description'] = data_copy['desc']
        if 'jobs' in data_copy and not data_copy.get('jobs_count_str'):
            data_copy['jobs_count_str'] = data_copy['jobs']
        return super().to_internal_value(data_copy)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if not ret.get('rating'):
            from django.db import models
            from .models import ServiceFeedback
            avg = ServiceFeedback.objects.filter(
                service_request__service_category=str(instance.id),
                is_submitted=True,
                rating__isnull=False
            ).aggregate(models.Avg("rating"))["rating__avg"]
            ret['rating'] = str(round(avg, 1)) if avg else "4.8"
            
        if not ret.get('jobs_count_str'):
            from .models import ServiceRequest
            cnt = ServiceRequest.objects.filter(
                service_category=str(instance.id),
                status__in=["completed", "closed", "verified", "awaiting_verification"]
            ).count()
            if cnt == 0:
                ret['jobs_count_str'] = "10K+"
            elif cnt < 100:
                ret['jobs_count_str'] = f"{cnt} bookings"
            elif cnt < 1000:
                ret['jobs_count_str'] = f"{cnt//100 * 100}+ bookings"
            else:
                ret['jobs_count_str'] = f"{round(cnt/1000, 1)}K+ bookings"
                
        ret['desc'] = instance.description or ""
        ret['jobs'] = ret['jobs_count_str']
        return ret


# ── Public ────────────────────────────────────────────────────────────────────

class ServiceRequestPublicCreateSerializer(serializers.ModelSerializer):
    """Used by the public booking form — no auth required."""

    class Meta:
        model = ServiceRequest
        fields = (
            "customer_name", "phone", "email",
            "service_category", "issue_title", "description", "address",
            "preferred_date", "preferred_time", "total_amount", "cart_data",
            "photo", "payment_method",
        )
        extra_kwargs = {
            "description":    {"required": False, "allow_blank": True},
            "email":          {"required": False, "allow_blank": True, "allow_null": True},
            "photo":          {"required": False, "allow_null": True},
            "payment_method": {"required": False, "allow_null": True, "allow_blank": True},
            "preferred_time": {"required": False, "allow_blank": True, "allow_null": True},
            "cart_data":      {"required": False},
        }

    def validate_cart_data(self, value):
        import json
        if isinstance(value, str):
            try:
                return json.loads(value)
            except ValueError:
                raise serializers.ValidationError("Value must be valid JSON.")
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
    status_display         = serializers.CharField(source="get_status_display", read_only=True)
    priority_display       = serializers.CharField(source="get_priority_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    assigned_employee      = EmployeeMinimalSerializer(read_only=True)
    latest_reschedule      = serializers.SerializerMethodField()

    def get_latest_reschedule(self, obj):
        rr = getattr(obj, "reschedule_requests", None)
        if not rr:
            return None
        last_rr = rr.order_by("-id").first()
        if not last_rr:
            return None
        tech_name = ""
        tech_id = None
        if last_rr.proposed_technician:
            tech_id = last_rr.proposed_technician.user_id or last_rr.proposed_technician.id
            if last_rr.proposed_technician.user:
                tech_name = last_rr.proposed_technician.user.get_full_name() or last_rr.proposed_technician.user.username
            else:
                tech_name = f"Employee #{last_rr.proposed_technician.id}"
        return {
            "id": last_rr.id,
            "status": last_rr.status,
            "new_date": str(last_rr.new_date) if last_rr.new_date else None,
            "new_time_slot": last_rr.new_time_slot or "",
            "proposed_technician_id": str(tech_id) if tech_id else None,
            "proposed_technician_name": tech_name,
        }

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "description", "address", "preferred_date", "preferred_time",
            "status", "status_display", "priority", "priority_display",
            "payment_method", "payment_method_display",
            "payment_status", "payment_status_display",
            "total_amount", "transaction_id", "invoice_id",
            "assigned_employee", "latest_reschedule", "created_at", "updated_at",
        )


class ServiceFeedbackNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceFeedback
        fields = (
            "rating", "employee_behaviour", "work_quality",
            "issue_resolved", "comment", "submitted_at",
            "is_submitted", "feedback_token"
        )


class ServiceRequestDetailSerializer(serializers.ModelSerializer):
    """Full detail — includes photo URL + payment info + allowed next transitions."""
    service_category_display = serializers.CharField(
        source="get_service_category_display", read_only=True
    )
    status_display         = serializers.CharField(source="get_status_display", read_only=True)
    priority_display       = serializers.CharField(source="get_priority_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    payment_status_display = serializers.CharField(source="get_payment_status_display", read_only=True)
    assigned_employee      = EmployeeMinimalSerializer(read_only=True)
    latest_reschedule      = serializers.SerializerMethodField()
    payment_collected_by   = serializers.SerializerMethodField()
    photo_url              = serializers.SerializerMethodField()
    allowed_transitions    = serializers.SerializerMethodField()
    has_feedback           = serializers.SerializerMethodField()
    feedback_token         = serializers.SerializerMethodField()
    feedback               = ServiceFeedbackNestedSerializer(read_only=True, allow_null=True)

    def get_latest_reschedule(self, obj):
        rr = getattr(obj, "reschedule_requests", None)
        if not rr:
            return None
        last_rr = rr.order_by("-id").first()
        if not last_rr:
            return None
        tech_name = ""
        tech_id = None
        if last_rr.proposed_technician:
            tech_id = last_rr.proposed_technician.user_id or last_rr.proposed_technician.id
            if last_rr.proposed_technician.user:
                tech_name = last_rr.proposed_technician.user.get_full_name() or last_rr.proposed_technician.user.username
            else:
                tech_name = f"Employee #{last_rr.proposed_technician.id}"
        return {
            "id": last_rr.id,
            "status": last_rr.status,
            "new_date": str(last_rr.new_date) if last_rr.new_date else None,
            "new_time_slot": last_rr.new_time_slot or "",
            "proposed_technician_id": str(tech_id) if tech_id else None,
            "proposed_technician_name": tech_name,
        }

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "description", "address", "preferred_date", "preferred_time",
            "total_amount", "cart_data",
            "payment_method", "payment_method_display",
            "payment_status", "payment_status_display",
            "transaction_id", "payment_gateway",
            "payment_collected_by", "payment_collected_at", "invoice_id",
            "photo_url", "status", "status_display", "priority", "priority_display",
            "assigned_employee", "latest_reschedule", "allowed_transitions",
            "has_feedback", "feedback_token", "feedback",
            "created_at", "updated_at",
        )

    def get_payment_collected_by(self, obj):
        if obj.payment_collected_by:
            emp = obj.payment_collected_by
            return {
                "id": emp.id,
                "employee_id": emp.employee_id,
                "full_name": emp.user.get_full_name() or emp.user.username,
            }
        return None

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
        try:
            employee = Employee.objects.select_related("user").get(id=value)
        except Employee.DoesNotExist:
            raise serializers.ValidationError("Employee not found.")
            
        if employee.user.role != "admin":
            if not employee.hourly_rate or employee.hourly_rate <= 0:
                raise serializers.ValidationError("This employee has not configured their hourly rate yet. Jobs cannot be assigned until a rate is set.")
        return value


# ── Admin Feedback ─────────────────────────────────────────────────────────────

class ServiceFeedbackAdminSerializer(serializers.ModelSerializer):
    request_id       = serializers.CharField(source="service_request.request_id", read_only=True)
    customer_name    = serializers.CharField(source="service_request.customer_name", read_only=True)
    issue_title      = serializers.CharField(source="service_request.issue_title", read_only=True)
    service_category = serializers.CharField(source="service_request.get_service_category_display", read_only=True)
    employee_name    = serializers.SerializerMethodField()

    class Meta:
        model = ServiceFeedback
        fields = (
            "id", "request_id", "customer_name", "issue_title", "service_category",
            "employee_name", "rating", "employee_behaviour", "work_quality",
            "issue_resolved", "comment", "submitted_at",
        )

    def get_employee_name(self, obj):
        try:
            sr = obj.service_request
            if sr.assigned_employee:
                return sr.assigned_employee.user.get_full_name() or sr.assigned_employee.user.username
            emp = sr.employee_job.employee
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
    employee_name   = serializers.SerializerMethodField()
    recent_feedback = serializers.SerializerMethodField()
    feedback_list   = serializers.SerializerMethodField()

    class Meta:
        model = EmployeePerformance
        fields = (
            "employee_name",
            "jobs_completed_count", "average_rating", "feedback_count",
            "completion_rate", "customer_satisfaction_score", "last_updated",
            "recent_feedback", "feedback_list",
        )

    def get_employee_name(self, obj):
        return obj.employee.user.get_full_name() or obj.employee.user.username

    def get_recent_feedback(self, obj):
        from django.db.models import Q
        feedbacks = ServiceFeedback.objects.filter(
            is_submitted=True
        ).filter(
            Q(service_request__assigned_employee=obj.employee) |
            Q(service_request__employee_job__employee=obj.employee)
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

    def get_feedback_list(self, obj):
        return self.get_recent_feedback(obj)


# ── Reschedule ─────────────────────────────────────────────────────────────────

class RescheduleAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RescheduleAttachment
        fields = ("id", "file", "original_name", "uploaded_at")


class RescheduleSuggestedSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = RescheduleSuggestedSlot
        fields = ("id", "date", "time_slot", "is_selected", "created_at")


class RescheduleStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RescheduleStatusHistory
        fields = ("id", "from_status", "to_status", "changed_by", "changed_by_name", "note", "created_at")

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return "System"


class RescheduleRequestSerializer(serializers.ModelSerializer):
    booking_id = serializers.PrimaryKeyRelatedField(
        queryset=ServiceRequest.objects.all(), source="booking", write_only=True
    )
    reschedule_id = serializers.CharField(read_only=True)
    request_id = serializers.CharField(source="booking.request_id", read_only=True)
    issue_title = serializers.CharField(source="booking.issue_title", read_only=True)
    customer_name = serializers.CharField(source="booking.customer_name", read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    proposed_technician_name = serializers.SerializerMethodField()
    admin_reviewed_by_name = serializers.SerializerMethodField()
    attachment = RescheduleAttachmentSerializer(read_only=True)
    suggested_slots = RescheduleSuggestedSlotSerializer(many=True, read_only=True)
    history = RescheduleStatusHistorySerializer(many=True, read_only=True)
    available_slots = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RescheduleRequest
        fields = (
            "id", "reschedule_id", "booking_id", "request_id", "issue_title", "customer_name",
            "requested_by", "requested_by_name", "persona",
            "current_date", "current_time",
            "new_date", "new_time_slot", "approved_date", "approved_time", "reason", "additional_notes",
            "attachment", "status", "status_display",
            "proposed_technician", "proposed_technician_name",
            "technician_response_note", "alternate_slots_suggested",
            # Extended workflow fields
            "suggested_date", "suggested_time_slot", "suggested_slots",
            "customer_response", "admin_remarks",
            "rejection_reason", "rejection_notes",
            "admin_reviewed_by", "admin_reviewed_by_name",
            "employee_response", "employee_response_note", "employee_rejection_reason",
            "employee_responded_at", "history",
            "available_slots", "step_index", "step_label", "review_notes", "reviewed_at", "created_at", "updated_at",
        )

    step_index = serializers.SerializerMethodField()
    step_label = serializers.SerializerMethodField()

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return "Unknown"

    def get_proposed_technician_name(self, obj):
        if obj.proposed_technician and obj.proposed_technician.user:
            return obj.proposed_technician.user.get_full_name() or obj.proposed_technician.user.username
        return None

    def get_admin_reviewed_by_name(self, obj):
        if obj.admin_reviewed_by:
            return obj.admin_reviewed_by.get_full_name() or obj.admin_reviewed_by.username
        return None

    def get_available_slots(self, obj):
        from .services import get_real_technician_availability
        company = getattr(obj.booking, "company", None)
        return get_real_technician_availability(company, obj.new_date)

    def get_step_index(self, obj):
        status_map = {
            "PENDING": 1,
            "PENDING_ADMIN_REVIEW": 1,
            "ADMIN_REVIEW": 2,
            "ADMIN_APPROVED": 3,
            "EMPLOYEE_ASSIGNMENT_IN_PROGRESS": 4,
            "EMPLOYEE_ASSIGNED": 5,
            "AWAITING_EMPLOYEE_RESPONSE": 6,
            "AWAITING_EMPLOYEE_CONFIRMATION": 6,
            "EMPLOYEE_CONFIRMED": 6,
            "EMPLOYEE_ACCEPTED": 7,
            "BOOKING_UPDATED": 7,
            "RESCHEDULED": 8,
            "REJECTED": 9,
            "CANCELLED": 0,
        }
        return status_map.get(obj.status, 1)

    def get_step_label(self, obj):
        labels = {
            1: "Request Submitted",
            2: "Under Admin Review",
            3: "Admin Approved",
            4: "Employee Assignment",
            5: "Employee Assigned",
            6: "Waiting for Employee Confirmation",
            7: "Booking Being Updated",
            8: "Rescheduled Successfully",
            9: "Request Rejected",
            0: "Request Cancelled",
        }
        idx = self.get_step_index(obj)
        return labels.get(idx, "Request Submitted")


class AdminRescheduleListSerializer(serializers.ModelSerializer):
    """Rich admin view of a reschedule request — all fields for dashboard table."""
    reschedule_id           = serializers.CharField(read_only=True)
    booking_request_id      = serializers.CharField(source="booking.request_id", read_only=True)
    customer_name           = serializers.CharField(source="booking.customer_name", read_only=True)
    customer_email          = serializers.SerializerMethodField()
    service                 = serializers.CharField(source="booking.issue_title", read_only=True)
    service_category        = serializers.CharField(source="booking.service_category", read_only=True)
    previous_date           = serializers.DateField(source="current_date", read_only=True)
    previous_slot           = serializers.CharField(source="current_time", read_only=True)
    requested_date          = serializers.DateField(source="new_date", read_only=True)
    requested_slot          = serializers.CharField(source="new_time_slot", read_only=True)
    employee_name           = serializers.SerializerMethodField()
    employee_id             = serializers.SerializerMethodField()
    status_display          = serializers.CharField(source="get_status_display", read_only=True)
    requested_by_name       = serializers.SerializerMethodField()
    proposed_technician_name = serializers.SerializerMethodField()
    admin_reviewed_by_name  = serializers.SerializerMethodField()
    rejection_reason_display = serializers.SerializerMethodField()

    class Meta:
        model = RescheduleRequest
        fields = (
            "id", "reschedule_id",
            "booking_request_id", "customer_name", "customer_email",
            "service", "service_category",
            "previous_date", "previous_slot", "requested_date", "requested_slot",
            "reason", "additional_notes",
            "employee_id", "employee_name",
            "status", "status_display",
            "suggested_date", "suggested_time_slot",
            "rejection_reason", "rejection_reason_display", "rejection_notes",
            "admin_reviewed_by_name",
            "employee_response", "employee_response_note", "employee_rejection_reason",
            "proposed_technician", "proposed_technician_name",
            "requested_by_name", "review_notes", "reviewed_at", "created_at", "updated_at",
        )

    def get_customer_email(self, obj):
        try:
            return obj.requested_by.email or obj.booking.email
        except Exception:
            return None

    def get_employee_name(self, obj):
        emp = obj.proposed_technician or (obj.booking.assigned_employee if obj.booking else None)
        if emp and emp.user:
            return emp.user.get_full_name() or emp.user.username
        return None

    def get_employee_id(self, obj):
        emp = obj.proposed_technician or (obj.booking.assigned_employee if obj.booking else None)
        return emp.id if emp else None

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return "Customer"

    def get_proposed_technician_name(self, obj):
        if obj.proposed_technician and obj.proposed_technician.user:
            return obj.proposed_technician.user.get_full_name() or obj.proposed_technician.user.username
        return None

    def get_admin_reviewed_by_name(self, obj):
        if obj.admin_reviewed_by:
            return obj.admin_reviewed_by.get_full_name() or obj.admin_reviewed_by.username
        return None

    def get_rejection_reason_display(self, obj):
        if obj.rejection_reason:
            return obj.get_rejection_reason_display()
        return None


class EmployeeRescheduleNotificationSerializer(serializers.ModelSerializer):
    """Employee-side view of a pending reschedule confirmation."""
    reschedule_id    = serializers.CharField(read_only=True)
    booking_id_str   = serializers.CharField(source="booking.request_id", read_only=True)
    service          = serializers.CharField(source="booking.issue_title", read_only=True)
    address          = serializers.CharField(source="booking.address", read_only=True)
    old_date         = serializers.DateField(source="current_date", read_only=True)
    old_slot         = serializers.CharField(source="current_time", read_only=True)
    new_date         = serializers.DateField(read_only=True)
    new_slot         = serializers.CharField(source="new_time_slot", read_only=True)
    reason           = serializers.CharField(read_only=True)
    customer_reason  = serializers.CharField(source="get_reason_display", read_only=True)
    status           = serializers.CharField(read_only=True)
    status_display   = serializers.CharField(source="get_status_display", read_only=True)
    created_at       = serializers.DateTimeField(read_only=True)

    class Meta:
        model = RescheduleRequest
        fields = (
            "id", "reschedule_id", "booking_id_str", "service", "address",
            "old_date", "old_slot", "new_date", "new_slot",
            "reason", "customer_reason", "additional_notes",
            "status", "status_display", "created_at",
        )


# ── Refund Serializers ────────────────────────────────────────────────────────

class RefundEvidenceSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RefundEvidence
        fields = ("id", "file", "uploaded_by", "uploaded_by_name", "uploaded_at")

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return "System"


class RefundInvestigationNoteSerializer(serializers.ModelSerializer):
    employee_id = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = RefundInvestigationNote
        fields = ("id", "employee_id", "employee_name", "explanation", "work_completed_confirmed", "created_at")

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return "Technician"


class EligibleBookingSerializer(serializers.ModelSerializer):
    request_id = serializers.CharField(read_only=True)
    issue_title = serializers.CharField(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = ("id", "request_id", "issue_title", "service_category", "preferred_date", "estimated_cost", "payment_status")


class CustomerRefundRequestSerializer(serializers.ModelSerializer):
    booking_id = serializers.PrimaryKeyRelatedField(source="booking", read_only=True)
    booking_request_id = serializers.CharField(source="booking.request_id", read_only=True)
    service_name = serializers.CharField(source="booking.issue_title", read_only=True)
    evidence = RefundEvidenceSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RefundRequest
        fields = (
            "id", "refund_id", "booking_id", "booking_request_id", "service_name",
            "paid_amount", "refund_type", "requested_amount", "approved_amount",
            "reason", "additional_notes", "status", "status_display",
            "info_requested_from", "evidence", "created_at", "updated_at"
        )


class AdminRefundRequestSerializer(serializers.ModelSerializer):
    booking_id = serializers.PrimaryKeyRelatedField(source="booking", read_only=True)
    booking_request_id = serializers.CharField(source="booking.request_id", read_only=True)
    customer_name = serializers.CharField(source="customer.get_full_name", read_only=True)
    customer_email = serializers.CharField(source="customer.email", read_only=True)
    assigned_employee_id = serializers.SerializerMethodField()
    assigned_employee_name = serializers.SerializerMethodField()
    evidence = RefundEvidenceSerializer(many=True, read_only=True)
    investigation_notes = RefundInvestigationNoteSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = RefundRequest
        fields = (
            "id", "refund_id", "booking_id", "booking_request_id",
            "customer_name", "customer_email", "paid_amount", "refund_type",
            "requested_amount", "approved_amount", "reason", "additional_notes",
            "internal_notes", "status", "status_display", "info_requested_from",
            "assigned_employee_id", "assigned_employee_name", "gateway_reference",
            "evidence", "investigation_notes", "created_at", "updated_at"
        )

    def get_assigned_employee_id(self, obj):
        return obj.assigned_employee.id if obj.assigned_employee else None

    def get_assigned_employee_name(self, obj):
        if obj.assigned_employee and obj.assigned_employee.user:
            return obj.assigned_employee.user.get_full_name() or obj.assigned_employee.employee_id
        return None


class EmployeeRefundInvestigationSerializer(serializers.ModelSerializer):
    booking_id = serializers.PrimaryKeyRelatedField(source="booking", read_only=True)
    booking_request_id = serializers.CharField(source="booking.request_id", read_only=True)
    customer_name = serializers.CharField(source="customer.get_full_name", read_only=True)
    issue_title = serializers.CharField(source="booking.issue_title", read_only=True)
    service_category = serializers.CharField(source="booking.service_category", read_only=True)
    evidence = RefundEvidenceSerializer(many=True, read_only=True)
    investigation_notes = RefundInvestigationNoteSerializer(many=True, read_only=True)

    class Meta:
        model = RefundRequest
        fields = (
            "id", "refund_id", "booking_id", "booking_request_id", "customer_name",
            "issue_title", "service_category", "paid_amount", "requested_amount",
            "reason", "additional_notes", "status", "info_requested_from",
            "evidence", "investigation_notes", "created_at"
        )

