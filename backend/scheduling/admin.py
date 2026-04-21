from django.contrib import admin

from .models import Shift


@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("employee", "shift_start", "shift_end", "title")
    list_filter = ("shift_start",)
    search_fields = ("employee__employee_id", "employee__user__username", "title")
