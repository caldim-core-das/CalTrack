from rest_framework import serializers
from .models import PayrollPeriod, PayrollRecord, PayrollGroup, EmployeePayrollConfig


class PayrollPeriodSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

    class Meta:
        model = PayrollPeriod
        fields = ("id", "start_date", "end_date", "created_at")
        read_only_fields = ("id", "created_at")


class PayrollRecordSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    employee = serializers.CharField(source="employee.employee_id", read_only=True)
    employee_pk = serializers.IntegerField(source="employee.id", read_only=True)
    employee_name = serializers.SerializerMethodField()
    employee_country = serializers.CharField(source="employee.country", read_only=True)
    employee_currency = serializers.CharField(source="employee.currency", read_only=True)
    generated_by = serializers.CharField(source="generated_by.id", read_only=True)
    period = PayrollPeriodSerializer(read_only=True)

    def get_employee_name(self, obj):
        """Return full name, falling back to username if not set."""
        try:
            name = obj.employee.user.get_full_name()
            return name.strip() if name.strip() else obj.employee.user.username
        except Exception:
            return ""

    class Meta:
        model = PayrollRecord
        fields = (
            "id", "period", "employee", "employee_pk", "employee_name",
            "employee_country", "employee_currency",
            "hourly_rate", "regular_hours", "overtime_hours",
            "daily_ot_hours", "double_time_hours",
            "paid_leave_hours", "unpaid_leave_hours",
            "gross_pay", "uk_income_tax", "uk_employee_ni",
            "uk_employer_ni", "uk_tax_code", "uk_ni_category",
            "holiday_hours_accrued", "net_pay", "mileage_reimbursement", "extras", "region",
            "is_exempt", "wage_floor_compliant",
            "generated_by", "generated_at",
        )
        read_only_fields = ("id", "gross_pay", "net_pay", "mileage_reimbursement", "generated_by", "generated_at")


class PayrollGenerateSerializer(serializers.Serializer):
    employee = serializers.CharField()
    start = serializers.DateField()
    end = serializers.DateField()

from .models import CurrencyMaster, PayrollRule, PayrollGeneration

class CurrencyMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CurrencyMaster
        fields = '__all__'
        read_only_fields = ['company']

class PayrollRuleSerializer(serializers.ModelSerializer):
    currency_details = CurrencyMasterSerializer(source='currency', read_only=True)
    class Meta:
        model = PayrollRule
        fields = '__all__'
        read_only_fields = ['company']

class PayrollGenerationSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.user.get_full_name', read_only=True)
    employee_id_code = serializers.CharField(source='employee.employee_id', read_only=True)
    payroll_group_name = serializers.CharField(source='payroll_group.name', read_only=True, default=None)
    class Meta:
        model = PayrollGeneration
        fields = '__all__'
        read_only_fields = ['company']


# ── Payroll Group ──────────────────────────────────────────────────────────

class PayrollGroupSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True)
    created_by_name = serializers.SerializerMethodField()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    class Meta:
        model = PayrollGroup
        fields = (
            "id", "company", "name", "description", "is_active",
            "employee_count", "created_by", "created_by_name",
            "created_at", "updated_at",
        )
        read_only_fields = ("id", "company", "employee_count", "created_by", "created_at", "updated_at")


# ── Employee Payroll Config ────────────────────────────────────────────────

class EmployeePayrollConfigSerializer(serializers.ModelSerializer):
    employee_id_code = serializers.SerializerMethodField()
    employee_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    config_source = serializers.SerializerMethodField()

    def get_employee_id_code(self, obj):
        return obj.employee.employee_id if obj.employee else None

    def get_employee_name(self, obj):
        if obj.employee:
            name = obj.employee.user.get_full_name()
            return name.strip() if name.strip() else obj.employee.user.username
        return None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None

    def get_config_source(self, obj):
        return getattr(obj, "_source", "individual" if obj.employee else "group")

    class Meta:
        model = EmployeePayrollConfig
        fields = (
            "id", "company", "employee", "employee_id_code", "employee_name",
            "group", "group_name", "config_source",
            # India service split
            "employee_share_pct", "company_share_pct",
            "platform_fee_type", "platform_fee_value",
            # India statutory deductions
            "pf_enabled", "pf_pct",
            "esi_enabled", "esi_pct",
            "tds_enabled", "tds_rate",
            # US/UK hours
            "ot_multiplier", "daily_ot_threshold", "weekly_ot_threshold",
            "service_split_enabled",
            # Feature toggles
            "features",
            # Pay frequency
            "pay_frequency",
            # Custom items
            "custom_deductions", "custom_bonuses",
            "updated_at", "updated_by",
        )
        read_only_fields = (
            "id", "company", "employee_id_code", "employee_name",
            "group_name", "config_source", "updated_at",
        )


