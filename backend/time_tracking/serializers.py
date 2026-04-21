from rest_framework import serializers

from .models import Break, TimeLog, TimeLogPhoto, JobSite, Location


class JobSiteSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    class Meta:
        model = JobSite
        fields = ("id", "name", "address", "lat", "lng", "geofence_radius", "organization")
        read_only_fields = ("id", "organization")


class BreakSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    duration_seconds = serializers.SerializerMethodField()

    class Meta:
        model = Break
        fields = ("id", "break_start", "break_end", "break_type", "duration_seconds", "created_at")
        read_only_fields = ("id", "created_at")

    def get_duration_seconds(self, obj):
        if not obj.break_end:
            return 0
        return int((obj.break_end - obj.break_start).total_seconds())


class TimeLogPhotoSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = TimeLogPhoto
        fields = ("id", "photo", "photo_type", "caption", "uploaded_at")


class TimeLogSerializer(serializers.ModelSerializer):
    id                = serializers.SerializerMethodField()
    employee          = serializers.SerializerMethodField()
    employee_name     = serializers.SerializerMethodField()
    employee_username = serializers.SerializerMethodField()
    breaks            = BreakSerializer(many=True, read_only=True)
    photos            = TimeLogPhotoSerializer(many=True, read_only=True)
    worked_seconds    = serializers.SerializerMethodField()
    worked_hours      = serializers.SerializerMethodField()
    break_seconds     = serializers.SerializerMethodField()
    approved_by       = serializers.SerializerMethodField()
    task              = serializers.SerializerMethodField()

    class Meta:
        model = TimeLog
        fields = (
            "id",
            "employee",
            "employee_name",
            "employee_username",
            "work_date",
            "clock_in",
            "clock_in_lat",
            "clock_in_lon",
            "clock_in_address",
            "clock_in_notes",
            "clock_in_photo",
            "clock_out",
            "clock_out_lat",
            "clock_out_lon",
            "clock_out_address",
            "clock_out_notes",
            "clock_out_photo",
            "distance_from_site_meters",
            "geofence_passed",
            "admin_override_used",
            "status",
            "submitted_at",
            "approved_by",
            "admin_notes",
            "manual_hours_correction",
            "face_match_status",
            "face_match_score",
            "breaks",
            "photos",
            "break_seconds",
            "worked_seconds",
            "worked_hours",
            "created_at",
            "updated_at",
            "task",
        )
        read_only_fields = ("id", "created_at", "updated_at", "submitted_at", "approved_by")

    def get_id(self, obj):
        return str(obj.id)

    def get_employee(self, obj):
        return str(obj.employee_id)

    def get_employee_name(self, obj):
        user = obj.employee.user
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    def get_employee_username(self, obj):
        return obj.employee.user.username

    def get_break_seconds(self, obj):
        return obj.break_seconds()

    def get_worked_seconds(self, obj):
        return obj.worked_seconds()

    def get_worked_hours(self, obj):
        return round(obj.worked_seconds() / 3600, 2)

    def get_approved_by(self, obj):
        if not obj.approved_by_id:
            return None
        return str(obj.approved_by_id)

    def get_task(self, obj):
        # TimeLog is linked from Task via a OneToOneField
        if hasattr(obj, 'task') and obj.task:
            return {
                "id": str(obj.task.id),
                "title": obj.task.title,
                "status": obj.task.status
            }
        return None


class LocationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = Location
        fields = ("id", "name", "address", "lat", "lng", "geofence_radius", "organization", "created_at", "updated_at")
        read_only_fields = ("id", "organization", "created_at", "updated_at")
