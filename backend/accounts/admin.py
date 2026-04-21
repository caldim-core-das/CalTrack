from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Organization


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Role", {"fields": ("role", "organization")}),)
    list_display = ("username", "email", "first_name", "last_name", "role", "organization", "is_staff", "is_active")
    list_filter = ("role", "organization", "is_staff", "is_active")


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "geofence_enabled", "geofence_radius_meters", "geofence_strict_mode")
    search_fields = ("name",)
    