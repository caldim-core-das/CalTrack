from django.contrib import admin

from .models import LeaveRequest


@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ("employee", "leave_type", "start_date", "end_date", "paid", "status")
    list_filter = ("status", "leave_type", "paid")
    search_fields = ("employee__employee_id", "employee__user__username")
