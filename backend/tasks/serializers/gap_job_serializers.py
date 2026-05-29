from rest_framework import serializers
from tasks.models import Task

class GapJobListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    address = serializers.SerializerMethodField()
    distance_km = serializers.FloatField(read_only=True)
    distance_m = serializers.IntegerField(read_only=True)
    priority = serializers.CharField(read_only=True)
    sla_status = serializers.CharField(read_only=True)
    sla_minutes_remaining = serializers.IntegerField(read_only=True)
    estimated_duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "client_name",
            "address",
            "distance_km",
            "distance_m",
            "priority",
            "sla_status",
            "sla_minutes_remaining",
            "estimated_duration_minutes",
            "status",
        )

    def get_address(self, obj):
        return obj.job_address or obj.location

    def get_estimated_duration_minutes(self, obj):
        if obj.estimated_hours:
            return int(float(obj.estimated_hours) * 60)
        return 60

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("id"):
            ret["id"] = str(ret["id"])
        return ret


class SuspendedTaskSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    gap_job = GapJobListSerializer(read_only=True)
    sla_status = serializers.CharField(read_only=True)
    sla_minutes_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Task
        fields = (
            "id",
            "title",
            "status",
            "suspended_at",
            "resume_deadline",
            "total_active_seconds",
            "suspend_reason",
            "gap_job",
            "sla_status",
            "sla_minutes_remaining",
        )

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if ret.get("id"):
            ret["id"] = str(ret["id"])
        return ret
