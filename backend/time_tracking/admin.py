from django.contrib import admin

from .models import Break, TimeLog, JobSite


@admin.register(TimeLog)
class TimeLogAdmin(admin.ModelAdmin):
    list_display = ("employee", "work_date", "clock_in", "clock_out")
    list_filter = ("work_date",)
    search_fields = ("employee__employee_id", "employee__user__username")


@admin.register(Break)
class BreakAdmin(admin.ModelAdmin):
    list_display = ("time_log", "break_start", "break_end")


@admin.register(JobSite)
class JobSiteAdmin(admin.ModelAdmin):
    list_display = ("name", "organization", "lat", "lng", "geofence_radius")
    list_filter = ("organization",)
    search_fields = ("name", "address")
