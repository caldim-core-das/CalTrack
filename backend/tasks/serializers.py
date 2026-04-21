from rest_framework import serializers

from accounts.models import User
from .models import Task, TaskAttachment


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
    job_site_name = serializers.SlugRelatedField(
        source='job_site',
        read_only=True,
        slug_field='name'
    )
    actual_hours = serializers.ReadOnlyField()
    attachments = serializers.SerializerMethodField()

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Ensure MongoDB ObjectIds are cast to strings for JSON
        if ret.get('id'): ret['id'] = str(ret['id'])
        if ret.get('assigned_to'): ret['assigned_to'] = str(ret['assigned_to'])
        if ret.get('assigned_by'): ret['assigned_by'] = str(ret['assigned_by'])
        if ret.get('job_site'): ret['job_site'] = str(ret['job_site'])
        if ret.get('time_log'): ret['time_log'] = str(ret['time_log'])
        return ret

    class Meta:
        model  = Task
        fields = (
            "id",
            "title",
            "description",
            "category",
            "priority",
            "status",
            "attachments",
            "assigned_to",
            "assigned_to_detail",
            "assigned_by",
            "assigned_by_name",
            "due_date",
            "estimated_hours",
            "actual_hours",
            "job_site",
            "job_site_name",
            "job_address",
            "location",
            "location_lat",
            "location_lon",
            "geofence_radius",
            "client_name",
            "require_selfie",
            "require_before_after_photos",
            "time_log",
            "employee_notes",
            "admin_notes",
            "started_at",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "assigned_by", "started_at", "completed_at", "created_at", "updated_at")

    def get_assigned_by_name(self, obj):
        if obj.assigned_by:
            return obj.assigned_by.get_full_name() or obj.assigned_by.username
        return ""

    def get_attachments(self, obj):
        qs = getattr(obj, "attachments", None)
        if qs is None:
            return []
        return TaskAttachmentSerializer(qs.all(), many=True, context=self.context).data


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
