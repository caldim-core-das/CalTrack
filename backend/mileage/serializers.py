from django.contrib.auth import get_user_model
from rest_framework import serializers

from employees.models import Employee
from .models import MileagePolicy, MileageTrip, MileageYTDTracker

User = get_user_model()


class MileagePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = MileagePolicy
        fields = [
            "id",
            "company",
            "rate_per_mile_usd",
            "rate_per_mile_gbp_first",
            "rate_per_mile_gbp_after",
            "uk_mileage_threshold",
            "uk_tax_year_start_month",
            "uk_tax_year_start_day",
            "rate_per_km_inr",
            "require_receipt_above_miles",
            "auto_approve_below_miles",
            "max_single_trip_miles",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "company", "created_at", "updated_at"]


class MileageTripSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()
    employee_id_code = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MileageTrip
        fields = [
            "id",
            "company",
            "employee",
            "employee_name",
            "employee_id_code",
            "trip_date",
            "from_location",
            "to_location",
            "from_location_name",
            "to_location_name",
            "from_lat",
            "from_lng",
            "to_lat",
            "to_lng",
            "distance_km",
            "distance_miles",
            "purpose",
            "linked_task",
            "linked_transfer",
            "linked_timelog",
            "jurisdiction",
            "tax_year",
            "ytd_miles_before",
            "miles_at_high_rate",
            "miles_at_low_rate",
            "rate_applied",
            "reimbursement_amount",
            "currency",
            "is_taxable_excess",
            "taxable_excess_amount",
            "approval_status",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "rejection_reason",
            "linked_payroll_record",
            "employee_notes",
            "admin_notes",
            "odometer_start",
            "odometer_end",
            "receipt_photo",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "company",
            "tax_year",
            "ytd_miles_before",
            "miles_at_high_rate",
            "miles_at_low_rate",
            "rate_applied",
            "reimbursement_amount",
            "currency",
            "is_taxable_excess",
            "taxable_excess_amount",
            "approved_by",
            "approved_at",
            "linked_payroll_record",
            "created_at",
            "updated_at",
        ]

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return ""

    def get_employee_id_code(self, obj):
        if obj.employee:
            return obj.employee.employee_id
        return ""

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return ""


class MileageYTDTrackerSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = MileageYTDTracker
        fields = [
            "id",
            "company",
            "employee",
            "employee_name",
            "jurisdiction",
            "tax_year",
            "total_miles",
            "miles_at_high_rate",
            "miles_at_low_rate",
            "total_reimbursed_gbp",
            "threshold_crossed_date",
            "updated_at",
        ]
        read_only_fields = fields

    def get_employee_name(self, obj):
        if obj.employee and obj.employee.user:
            return obj.employee.user.get_full_name() or obj.employee.user.username
        return ""
