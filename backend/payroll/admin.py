from django.contrib import admin

from .models import PayrollPeriod, PayrollRecord


@admin.register(PayrollPeriod)
class PayrollPeriodAdmin(admin.ModelAdmin):
    list_display = ("start_date", "end_date", "created_at")
    list_filter = ("start_date", "end_date")


@admin.register(PayrollRecord)
class PayrollRecordAdmin(admin.ModelAdmin):
    list_display = ("employee", "period", "hourly_rate", "regular_hours", "overtime_hours", "gross_pay", "net_pay")
    list_filter = ("period",)
    search_fields = ("employee__employee_id", "employee__user__username")
