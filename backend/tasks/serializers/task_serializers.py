from rest_framework import serializers

from accounts.models import User
from tasks.models import Task, TaskAttachment, TaskActivityLog
from service_requests.models import ServiceRequest



class AssignedToSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    class Meta:
        model  = User
        fields = ("id", "username", "first_name", "last_name")


class TaskSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        required=False,
        allow_null=True,
        pk_field=serializers.CharField()
    )
    assigned_by = serializers.PrimaryKeyRelatedField(
        read_only=True,
        pk_field=serializers.CharField()
    )
    
    assigned_to_detail = AssignedToSerializer(source="assigned_to", read_only=True)
    assigned_by_name = serializers.SerializerMethodField()
    service_request = serializers.PrimaryKeyRelatedField(
        queryset=ServiceRequest.objects.all(),
        required=False,
        allow_null=True,
        pk_field=serializers.CharField()
    )
    job_site_name = serializers.SlugRelatedField(
        source='job_site',
        read_only=True,
        slug_field='name'
    )
    actual_hours  = serializers.ReadOnlyField()
    billed_hours  = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True, allow_null=True)
    attachments   = serializers.SerializerMethodField()
    sla_status            = serializers.SerializerMethodField()
    sla_minutes_remaining = serializers.SerializerMethodField()
    required_items        = serializers.SerializerMethodField()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure MongoDB ObjectIds are cast to strings for JSON
        if ret.get('id'): ret['id'] = str(ret['id'])
        if ret.get('assigned_to'): ret['assigned_to'] = str(ret['assigned_to'])
        if ret.get('assigned_by'): ret['assigned_by'] = str(ret['assigned_by'])
        if ret.get('job_site'): ret['job_site'] = str(ret['job_site'])
        if ret.get('time_log'): ret['time_log'] = str(ret['time_log'])
        if ret.get('service_request'): ret['service_request'] = str(ret['service_request'])
        return ret

    class Meta:
        model  = Task
        fields = (
            "id",
            "title",
            "description",
            "category",
            "subcategory",
            "service_type",
            "required_tools",
            "required_spare_parts",
            "priority",
            "status",
            # SLA & Smart Workflow
            "sla_deadline",
            "completion_percentage",
            "sla_status",
            "sla_minutes_remaining",
            # Accept / Decline
            "acceptance_status",
            "accepted_at",
            "decline_reason",
            "declined_at",
            "attachments",
            "assigned_to",
            "assigned_to_detail",
            "assigned_by",
            "assigned_by_name",
            "due_date",
            "estimated_hours",
            "actual_hours",
            "billed_hours",
            "job_site",
            "job_site_name",
            "job_address",
            "landmark",
            "area",
            "city",
            "state",
            "pincode",
            "location",
            "location_lat",
            "location_lon",
            "geofence_radius",
            "client_name",
            "client_company_name",
            "client_contact_number",
            "client_alternate_number",
            "client_email",
            "require_selfie",
            "require_before_after_photos",
            "time_log",
            "employee_notes",
            "admin_notes",
            "service_request",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
            "inventory_status",
            "blocking_reason",
            "required_items",
            # Suspended / Gap job fields
            "suspended_at",
            "resume_deadline",
            "total_active_seconds",
            "suspend_reason",
            "gap_job",
            "is_pushed_gap_job",
            # Travel / Journey Workflow
            "travel_status",
            "reached_site_at",
            "work_started_at",
            # Identity / Photos
            "start_photo",
            "end_photo",
            "face_match_percentage",
            "face_match_status",
            "submission_time",
        )
        read_only_fields = (
            "id", "assigned_by",
            "acceptance_status", "accepted_at", "decline_reason", "declined_at",
            "billed_hours",
            "started_at", "completed_at", "created_at", "updated_at",
            "suspended_at", "resume_deadline", "total_active_seconds", "suspend_reason", "gap_job",
            "is_pushed_gap_job",
            "sla_status", "sla_minutes_remaining",
            "travel_status", "reached_site_at", "work_started_at",
            "start_photo", "end_photo", "face_match_percentage", "face_match_status", "submission_time",
            "inventory_status", "blocking_reason", "required_items",
        )

    def validate_assigned_to(self, value):
        if value:
            from employees.models import Employee
            employee = Employee.objects.filter(user=value).first()
            if employee:
                if value.role != "admin":
                    if not employee.hourly_rate or employee.hourly_rate <= 0:
                        raise serializers.ValidationError("This employee must configure their hourly rate before tasks can be assigned to them.")
        return value

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.get_full_name() or obj.assigned_by.username
        return ""

    def get_attachments(self, obj):
        qs = getattr(obj, "attachments", None)
        if qs is None:
            return []
        return TaskAttachmentSerializer(qs.all(), many=True, context=self.context).data

    def get_sla_status(self, obj):
        from tasks.services.gap_job_service import get_sla_status
        status, _ = get_sla_status(obj)
        return status

    def get_sla_minutes_remaining(self, obj):
        from tasks.services.gap_job_service import get_sla_status
        _, mins = get_sla_status(obj)
        return mins

    def get_required_items(self, obj):
        reqs = getattr(obj, "taskrequireditem_set", None)
        if reqs is None:
            return []
        return [
            {
                "item_id": str(r.inventory_item.id),
                "name": r.inventory_item.name,
                "quantity_needed": r.quantity_needed,
            }
            for r in reqs.all()
        ]

    def create(self, validated_data):
        task = super().create(validated_data)
        self._handle_required_items(task)
        return task

    def update(self, instance, validated_data):
        task = super().update(instance, validated_data)
        self._handle_required_items(task)
        return task

    def _handle_required_items(self, task):
        if "required_items" in self.initial_data:
            from tasks.models import TaskRequiredItem
            from inventory.models import InventoryItem
            from inventory.services import check_task_inventory

            # Clear existing items
            TaskRequiredItem.objects.filter(task=task).delete()

            required_items_data = self.initial_data.get("required_items")
            if isinstance(required_items_data, list):
                for item_data in required_items_data:
                    item_id = item_data.get("item_id") or item_data.get("id")
                    quantity = int(item_data.get("quantity_needed", 1))
                    if item_id:
                        try:
                            inv_item = InventoryItem.objects.get(id=item_id, org=task.company)
                            TaskRequiredItem.objects.create(
                                task=task,
                                inventory_item=inv_item,
                                quantity_needed=quantity,
                            )
                        except (InventoryItem.DoesNotExist, ValueError):
                            pass

            # Recalculate inventory status
            check_task_inventory(task)


class TaskAttachmentSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = TaskAttachment
        fields = ("id", "original_name", "url", "uploaded_at")

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("id"):
            ret["id"] = str(ret["id"])
        return ret

    def get_url(self, obj):
        try:
            return obj.file.url if obj.file else ""
        except Exception:
            return ""


class TaskStatusUpdateSerializer(serializers.ModelSerializer):
    """Minimal serializer for employee status updates."""
    class Meta:
        model  = Task
        fields = ("status", "employee_notes")
