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


# ── Org Payroll Config & Preview Serializers ───────────────────────────────

from .models import PayrollConfig, WalletTransaction, EmployeeWalletBalance
from decimal import Decimal


class PayrollConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayrollConfig
        fields = (
            "id",
            "org",
            "employee_share_percent",
            "company_share_percent",
            "platform_fee_percent",
            "platform_fee_type",
            "platform_fee_fixed_amount",
            "pf_percent",
            "esi_percent",
            "tds_percent",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "org", "created_at", "updated_at")

    def validate(self, data):
        emp_share = data.get("employee_share_percent", getattr(self.instance, "employee_share_percent", Decimal("80.00")))
        comp_share = data.get("company_share_percent", getattr(self.instance, "company_share_percent", Decimal("10.00")))
        fee_type = data.get("platform_fee_type", getattr(self.instance, "platform_fee_type", PayrollConfig.PlatformFeeType.PERCENTAGE))

        if fee_type == PayrollConfig.PlatformFeeType.PERCENTAGE:
            plat_fee = data.get("platform_fee_percent", getattr(self.instance, "platform_fee_percent", Decimal("5.00")))
        else:
            plat_fee = Decimal("0.00")

        total = Decimal(str(emp_share or 0)) + Decimal(str(comp_share or 0)) + Decimal(str(plat_fee or 0))
        if total > Decimal("100.00"):
            raise serializers.ValidationError(
                f"Total share percentages ({total}%) exceed 100%."
            )
        return data


class PayrollConfigPreviewSerializer(serializers.Serializer):
    gross_amount = serializers.DecimalField(max_digits=12, decimal_places=2, required=True)
    employee_share_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("80.00"))
    company_share_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    platform_fee_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("5.00"))
    platform_fee_type = serializers.ChoiceField(choices=PayrollConfig.PlatformFeeType.choices, default=PayrollConfig.PlatformFeeType.PERCENTAGE)
    platform_fee_fixed_amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    pf_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("12.00"))
    esi_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.75"))
    tds_percent = serializers.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))

    def validate(self, data):
        fee_type = data.get("platform_fee_type", PayrollConfig.PlatformFeeType.PERCENTAGE)
        emp_share = Decimal(str(data.get("employee_share_percent", 0)))
        comp_share = Decimal(str(data.get("company_share_percent", 0)))

        if fee_type == PayrollConfig.PlatformFeeType.PERCENTAGE:
            plat_fee = Decimal(str(data.get("platform_fee_percent", 0)))
        else:
            plat_fee = Decimal("0.00")

        if emp_share + comp_share + plat_fee > Decimal("100.00"):
            raise serializers.ValidationError("Total revenue shares exceed 100%.")
        return data


from .models import BankAccount, KYCStatus, SettlementCycle, PayoutDispute


class BankAccountSerializer(serializers.ModelSerializer):
    masked_account_number = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = (
            "id", "account_number", "masked_account_number", "ifsc_code",
            "upi_id", "is_primary", "verification_status", "verified_at",
            "rejection_reason", "created_at", "updated_at"
        )
        read_only_fields = ("id", "verification_status", "verified_at", "rejection_reason", "created_at", "updated_at")
        extra_kwargs = {
            "account_number": {"write_only": True}
        }

    def get_masked_account_number(self, obj):
        return obj.masked_account_number()


class KYCStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCStatus
        fields = ("id", "employee", "pan_verified", "aadhaar_verified", "overall_status", "updated_at")
        read_only_fields = ("id", "employee", "overall_status", "updated_at")


class SettlementCycleSerializer(serializers.ModelSerializer):
    employee_count = serializers.IntegerField(read_only=True, required=False)
    total_settled_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, required=False)

    class Meta:
        model = SettlementCycle
        fields = ("id", "org", "cycle_start", "cycle_end", "settlement_date", "status", "created_at", "employee_count", "total_settled_amount")
        read_only_fields = ("id", "org", "status", "created_at")


class PayoutDisputeSerializer(serializers.ModelSerializer):
    booking_reference = serializers.SerializerMethodField()

    def get_booking_reference(self, obj):
        if obj.transaction and obj.transaction.booking:
            return obj.transaction.booking.request_id
        return f"TXN-{obj.transaction_id}"

    class Meta:
        model = PayoutDispute
        fields = (
            "id", "transaction", "booking_reference", "employee", "org",
            "reason", "status", "admin_notes", "created_at", "updated_at"
        )
        read_only_fields = ("id", "employee", "org", "status", "admin_notes", "created_at", "updated_at")




