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
    WorkExtension, WorkExtensionItem, JobReschedule, SupplementalInvoice
)

class CatalogServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CatalogService
        fields = '__all__'

class CatalogCategorySerializer(serializers.ModelSerializer):
    services = CatalogServiceSerializer(many=True, read_only=True)
    rating = serializers.SerializerMethodField()
    jobs_count_str = serializers.SerializerMethodField()
    
    class Meta:
        model = CatalogCategory
        fields = '__all__'
        
    def get_rating(self, obj):
        from django.db import models
        from .models import ServiceFeedback
        avg = ServiceFeedback.objects.filter(
            service_request__service_category=str(obj.id),
            is_submitted=True,
            rating__isnull=False
        ).aggregate(models.Avg("rating"))["rating__avg"]
        return str(round(avg, 1)) if avg else "4.8"

    def get_jobs_count_str(self, obj):
        from .models import ServiceRequest
        cnt = ServiceRequest.objects.filter(
            service_category=str(obj.id),
            status__in=["completed", "closed", "verified", "awaiting_verification"]
        ).count()
        if cnt == 0:
            return "New"
        elif cnt < 100:
            return f"{cnt} bookings"
        elif cnt < 1000:
            return f"{cnt//100 * 100}+ bookings"
        else:
            return f"{round(cnt/1000, 1)}K+ bookings"


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
    start_otp              = serializers.SerializerMethodField()
    task_status            = serializers.SerializerMethodField()
    is_otp_verified        = serializers.SerializerMethodField()
    active_extension       = serializers.SerializerMethodField()
    extension_amount       = serializers.SerializerMethodField()
    base_amount            = serializers.SerializerMethodField()
    total_amount           = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "address", "preferred_date",
            "status", "status_display", "priority", "priority_display",
            "payment_method", "payment_method_display",
            "payment_status", "payment_status_display",
            "total_amount", "base_amount", "extension_amount", "transaction_id", "invoice_id",
            "assigned_employee", "start_otp", "task_status", "is_otp_verified", "active_extension", "created_at", "updated_at",
        )

    def get_start_otp(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                if not task.start_otp and not task.is_otp_verified:
                    from tasks.services.otp_service import generate_and_send_job_otp
                    return generate_and_send_job_otp(task)
                return task.start_otp or ""
        except Exception:
            pass
        return getattr(obj, "start_otp", "") or ""

    def get_task_status(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                return task.status
        except Exception:
            pass
        return ""

    def get_extension_amount(self, obj):
        try:
            from service_requests.models import WorkExtension
            ext = obj.work_extensions.all().order_by("-id").first()
            if ext:
                amt = float(ext.admin_approved_amount or ext.technician_estimate or 0)
                if amt > 0:
                    return amt
            from tasks.models import Task
            t = Task.objects.filter(service_request=obj).first()
            if t and getattr(t, "additional_amount", 0):
                return float(t.additional_amount)
        except Exception:
            pass
        return 0.0

    def get_base_amount(self, obj):
        try:
            cart = obj.cart_data
            if cart:
                if isinstance(cart, str):
                    import json
                    cart = json.loads(cart)
                if isinstance(cart, list) and len(cart) > 0:
                    return sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in cart)
        except Exception:
            pass
        return 599.0

    def get_total_amount(self, obj):
        base = self.get_base_amount(obj)
        ext = self.get_extension_amount(obj)
        return base + ext

    def get_is_otp_verified(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                return task.is_otp_verified
        except Exception:
            pass
        return False

    def get_active_extension(self, obj):
        try:
            from service_requests.models import WorkExtension
            from tasks.models import Task
            ext = obj.work_extensions.exclude(
                status__in=[WorkExtension.Status.CUSTOMER_ACCEPTED, WorkExtension.Status.CUSTOMER_DECLINED, WorkExtension.Status.RESOLVED]
            ).order_by("-id").first()

            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()

            import re
            suspend_reason = getattr(task, "suspend_reason", "") or ""
            if not suspend_reason and ext:
                suspend_reason = getattr(ext, "decision_notes", "") or ""

            admin_amount = float(ext.admin_approved_amount or ext.technician_estimate or 0) if ext else 0.0
            if admin_amount == 0 and ext and ext.items.exists():
                admin_amount = sum(float(i.estimated_price or 0) for i in ext.items.all())

            if admin_amount == 0 and suspend_reason:
                match = re.search(r'(?:₹|Rs\.?|INR|\b)\s*(\d+(?:\.\d{1,2})?)', suspend_reason)
                if match:
                    try:
                        admin_amount = float(match.group(1))
                    except ValueError:
                        pass

            items_list = []
            if ext and ext.items.exists():
                for item in ext.items.all():
                    items_list.append({
                        "id": item.id,
                        "title": item.title or suspend_reason or "Additional Service & Parts",
                        "description": item.description or suspend_reason,
                        "estimated_price": float(item.estimated_price or admin_amount or 0),
                    })
            elif suspend_reason or admin_amount > 0:
                clean_title = suspend_reason
                if "(" in clean_title:
                    clean_title = clean_title.split("(")[0].strip()
                if "Requires" in clean_title:
                    clean_title = clean_title.split("Requires")[-1].strip()

                items_list.append({
                    "title": clean_title or suspend_reason or "Additional Service & Parts",
                    "description": suspend_reason,
                    "estimated_price": admin_amount
                })

            if ext or obj.status == "suspended" or (task and task.status == "suspended"):
                return {
                    "id": ext.id if ext else None,
                    "status": ext.status if ext else "admin_approved",
                    "status_display": ext.get_status_display() if ext else "Admin Approved",
                    "reason": suspend_reason or "Technician identified additional repair scope or required replacement parts during site inspection.",
                    "technician_estimate": float(ext.technician_estimate or admin_amount) if ext else admin_amount,
                    "admin_approved_amount": admin_amount,
                    "decision_token": str(ext.decision_token) if ext else "",
                    "requires_specialist": ext.requires_specialist if ext else False,
                    "required_skill": ext.required_skill if ext else "",
                    "items": items_list,
                }
        except Exception:
            pass
        return None


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
    payment_collected_by   = serializers.SerializerMethodField()
    photo_url              = serializers.SerializerMethodField()
    allowed_transitions    = serializers.SerializerMethodField()
    has_feedback           = serializers.SerializerMethodField()
    feedback_token         = serializers.SerializerMethodField()
    feedback               = ServiceFeedbackNestedSerializer(read_only=True, allow_null=True)
    start_otp              = serializers.SerializerMethodField()
    task_status            = serializers.SerializerMethodField()
    is_otp_verified        = serializers.SerializerMethodField()
    active_extension       = serializers.SerializerMethodField()
    extension_amount       = serializers.SerializerMethodField()
    base_amount            = serializers.SerializerMethodField()
    total_amount           = serializers.SerializerMethodField()

    class Meta:
        model = ServiceRequest
        fields = (
            "id", "request_id", "customer_name", "phone", "email",
            "service_category", "service_category_display",
            "issue_title", "description", "address", "preferred_date", "preferred_time",
            "total_amount", "base_amount", "extension_amount", "cart_data",
            "payment_method", "payment_method_display",
            "payment_status", "payment_status_display",
            "transaction_id", "payment_gateway",
            "payment_collected_by", "payment_collected_at", "invoice_id",
            "photo_url", "status", "status_display", "priority", "priority_display",
            "assigned_employee", "start_otp", "task_status", "is_otp_verified", "active_extension", "allowed_transitions",
            "has_feedback", "feedback_token", "feedback",
            "created_at", "updated_at",
        )

    def get_start_otp(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                if not task.start_otp and not task.is_otp_verified:
                    from tasks.services.otp_service import generate_and_send_job_otp
                    return generate_and_send_job_otp(task)
                return task.start_otp or ""
        except Exception:
            pass
        return getattr(obj, "start_otp", "") or ""

    def get_task_status(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                return task.status
        except Exception:
            pass
        return ""

    def get_is_otp_verified(self, obj):
        try:
            from tasks.models import Task
            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()
            if task:
                return task.is_otp_verified
        except Exception:
            pass
        return False

    def get_active_extension(self, obj):
        try:
            from service_requests.models import WorkExtension
            from tasks.models import Task
            ext = obj.work_extensions.exclude(
                status__in=[WorkExtension.Status.CUSTOMER_ACCEPTED, WorkExtension.Status.CUSTOMER_DECLINED, WorkExtension.Status.RESOLVED]
            ).order_by("-id").first()

            task = Task.objects.filter(service_request=obj).first()
            if not task and obj.request_id:
                task = Task.objects.filter(title__icontains=obj.request_id).first()

            import re
            suspend_reason = getattr(task, "suspend_reason", "") or ""
            if not suspend_reason and ext:
                suspend_reason = getattr(ext, "decision_notes", "") or ""

            admin_amount = float(ext.admin_approved_amount or ext.technician_estimate or 0) if ext else 0.0
            if admin_amount == 0 and ext and ext.items.exists():
                admin_amount = sum(float(i.estimated_price or 0) for i in ext.items.all())

            if admin_amount == 0 and suspend_reason:
                match = re.search(r'(?:₹|Rs\.?|INR|\b)\s*(\d+(?:\.\d{1,2})?)', suspend_reason)
                if match:
                    try:
                        admin_amount = float(match.group(1))
                    except ValueError:
                        pass

            items_list = []
            if ext and ext.items.exists():
                for item in ext.items.all():
                    items_list.append({
                        "id": item.id,
                        "title": item.title or suspend_reason or "Additional Service & Parts",
                        "description": item.description or suspend_reason,
                        "estimated_price": float(item.estimated_price or admin_amount or 0),
                    })
            elif suspend_reason or admin_amount > 0:
                clean_title = suspend_reason
                if "(" in clean_title:
                    clean_title = clean_title.split("(")[0].strip()
                if "Requires" in clean_title:
                    clean_title = clean_title.split("Requires")[-1].strip()

                items_list.append({
                    "title": clean_title or suspend_reason or "Additional Service & Parts",
                    "description": suspend_reason,
                    "estimated_price": admin_amount
                })

            if ext or obj.status == "suspended" or (task and task.status == "suspended"):
                return {
                    "id": ext.id if ext else None,
                    "status": ext.status if ext else "admin_approved",
                    "status_display": ext.get_status_display() if ext else "Admin Approved",
                    "reason": suspend_reason or "Technician identified additional repair scope or required replacement parts during site inspection.",
                    "technician_estimate": float(ext.technician_estimate or admin_amount) if ext else admin_amount,
                    "admin_approved_amount": admin_amount,
                    "decision_token": str(ext.decision_token) if ext else "",
                    "requires_specialist": ext.requires_specialist if ext else False,
                    "required_skill": ext.required_skill if ext else "",
                    "items": items_list,
                }
        except Exception:
            pass
        return None

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

    def get_extension_amount(self, obj):
        try:
            from service_requests.models import WorkExtension
            ext = obj.work_extensions.all().order_by("-id").first()
            if ext:
                amt = float(ext.admin_approved_amount or ext.technician_estimate or 0)
                if amt > 0:
                    return amt
            from tasks.models import Task
            t = Task.objects.filter(service_request=obj).first()
            if t and getattr(t, "additional_amount", 0):
                return float(t.additional_amount)
        except Exception:
            pass
        return 0.0

    def get_base_amount(self, obj):
        try:
            cart = obj.cart_data
            if cart:
                if isinstance(cart, str):
                    import json
                    cart = json.loads(cart)
                if isinstance(cart, list) and len(cart) > 0:
                    return sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in cart)
        except Exception:
            pass
        return 599.0

    def get_total_amount(self, obj):
        base = self.get_base_amount(obj)
        ext = self.get_extension_amount(obj)
        return base + ext


class AdminChangePrioritySerializer(serializers.Serializer):
    priority = serializers.ChoiceField(choices=ServiceRequest.Priority.choices)


class AdminAssignSerializer(serializers.Serializer):
    employee_id = serializers.IntegerField()

    def validate_employee_id(self, value):
        try:
            employee = Employee.objects.select_related("user").get(id=value)
        except Employee.DoesNotExist:
            raise serializers.ValidationError("Employee not found.")
            
        if not employee.is_active:
            raise serializers.ValidationError("This employee is inactive and cannot be assigned to jobs.")
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
            Q(service_request__employee_jobs__employee=obj.employee)
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


# ── Work Extension Ecosystem ──────────────────────────────────────────

class WorkExtensionItemSerializer(serializers.ModelSerializer):
    fulfillment_source_display = serializers.CharField(source="get_fulfillment_source_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = WorkExtensionItem
        fields = (
            "id", "extension", "inventory_item", "item_name", "quantity", "location",
            "fulfillment_source", "fulfillment_source_display", "status", "status_display",
            "billed_to_customer", "actual_cost", "technician_reimbursement_amount",
            "technician_purchase_approved_limit", "purchase_approved_by", "purchase_receipt",
            "verified_by_tech", "verification_notes", "warranty_covered", "created_at",
        )
        read_only_fields = ("id", "created_at")


class WorkExtensionSerializer(serializers.ModelSerializer):
    items = WorkExtensionItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkExtension
        fields = (
            "id", "service_request", "job", "reported_by", "reported_by_name",
            "requires_specialist", "required_skill", "status", "status_display",
            "technician_estimate", "admin_approved_amount", "final_customer_amount",
            "decision_token", "token_expires_at", "decision_channel", "decision_notes",
            "decision_timestamp", "items", "created_at", "updated_at",
        )
        read_only_fields = ("id", "decision_token", "created_at", "updated_at")

    def get_reported_by_name(self, obj):
        if obj.reported_by and obj.reported_by.user:
            return obj.reported_by.user.get_full_name() or obj.reported_by.user.username
        return ""


class JobRescheduleSerializer(serializers.ModelSerializer):
    reason_display = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = JobReschedule
        fields = (
            "id", "job", "old_date", "new_date", "reason", "reason_display",
            "notes", "changed_by", "customer_notified_at", "customer_confirmed_at",
            "delay_count", "support_callback_created", "created_at",
        )
        read_only_fields = ("id", "created_at")


class SupplementalInvoiceSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = SupplementalInvoice
        fields = (
            "id", "service_request", "work_extension", "invoice_number",
            "amount", "status", "status_display", "payment_method",
            "transaction_id", "created_at", "paid_at",
        )
        read_only_fields = ("id", "created_at")

