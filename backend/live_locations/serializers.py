from rest_framework import serializers
from .models import EmployeeLocation

class EmployeeLocationSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_id_code = serializers.SerializerMethodField()
    clock_in = serializers.SerializerMethodField()
    clock_in_photo = serializers.SerializerMethodField()
    clock_in_address = serializers.SerializerMethodField()
    worked_seconds = serializers.SerializerMethodField()
    job_site_name = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeLocation
        fields = (
            'id', 'employee', 'employee_id_code', 'employee_name', 'time_log',
            'lat', 'lng', 'timestamp', 'clock_in', 'clock_in_photo',
            'clock_in_address', 'worked_seconds', 'job_site_name'
        )
        read_only_fields = ('id', 'timestamp')

    def get_employee_id_code(self, obj):
        return obj.employee.employee_id

    def get_employee_name(self, obj):
        user = obj.employee.user
        return f"{user.first_name} {user.last_name}".strip() or user.username

    def get_clock_in(self, obj):
        return obj.time_log.clock_in

    def get_clock_in_photo(self, obj):
        if obj.time_log.clock_in_photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.time_log.clock_in_photo.url)
            return obj.time_log.clock_in_photo.url
        return None

    def get_clock_in_address(self, obj):
        return obj.time_log.clock_in_address

    def get_worked_seconds(self, obj):
        if not obj.time_log.clock_out:
            from django.utils import timezone
            delta = timezone.now() - obj.time_log.clock_in
            return int(delta.total_seconds())
        return obj.time_log.worked_seconds()

    def get_job_site_name(self, obj):
        if obj.employee.assigned_job_site:
            return obj.employee.assigned_job_site.name
        return "Corporate"
