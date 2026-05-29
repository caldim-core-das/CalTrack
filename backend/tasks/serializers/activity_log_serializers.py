from rest_framework import serializers
from tasks.models import TaskActivityLog


class TaskActivityLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()
    event_label = serializers.SerializerMethodField()
    icon = serializers.SerializerMethodField()

    class Meta:
        model = TaskActivityLog
        fields = (
            "id", "event_type", "event_label", "icon",
            "actor_name", "notes", "lat", "lon", "timestamp",
        )

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return "System"

    def get_event_label(self, obj):
        return obj.get_event_type_display()

    def get_icon(self, obj):
        icons = {
            "started":           "▶️",
            "paused":            "⏸️",
            "resumed":           "▶️",
            "gap_started":       "⚡",
            "gap_completed":     "✅",
            "completed":         "🏁",
            "nearby_suggested":  "📍",
            "nearby_accepted":   "✔️",
            "nearby_rejected":   "✖️",
            "completion_pct":    "📊",
            "sla_warning":       "⚠️",
        }
        return icons.get(obj.event_type, "•")
