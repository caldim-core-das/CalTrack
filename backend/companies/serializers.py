from rest_framework import serializers
from .models import Company, Region


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = [
            "id",
            "code",
            "name",
            "currency",
            "currency_symbol",
            "date_format",
            "week_start",
            "overtime_weekly_hours",
            "max_weekly_hours",
            "statutory_leave_days",
            "tax_year_start_month",
            "tax_year_start_day",
            "payroll_frequency",
            "min_wage",
            "national_insurance_enabled",
            "paye_enabled",
            "flsa_enabled",
            "state_tax_enabled",
        ]


class CompanySerializer(serializers.ModelSerializer):
    region_detail = RegionSerializer(source="region", read_only=True)

    class Meta:
        model = Company
        fields = [
            "id",
            "company_name",
            "display_id",
            "schema_name",
            "primary_country",
            "region",
            "region_detail",
            "default_state",
            "compliance_mode",
            "shift_enforcement_mode",
            "allowed_countries",
            "team_size",
            "selected_modules",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "display_id", "schema_name", "region_detail", "created_at", "updated_at"]

    def validate(self, data):
        primary_country = data.get("primary_country", getattr(self.instance, "primary_country", None))
        default_state = data.get("default_state", getattr(self.instance, "default_state", None))

        if primary_country == "US" and not default_state:
            raise serializers.ValidationError(
                {"default_state": "Default state is required for US-based companies."}
            )
        return data

    def create(self, validated_data):
        # Auto-resolve region from primary_country when not explicitly provided
        if "region" not in validated_data:
            country = validated_data.get("primary_country", "US")
            try:
                validated_data["region"] = Region.objects.get(code=country)
            except Region.DoesNotExist:
                pass
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # If primary_country changes, update region too
        new_country = validated_data.get("primary_country")
        if new_country and new_country != instance.primary_country:
            try:
                validated_data["region"] = Region.objects.get(code=new_country)
            except Region.DoesNotExist:
                pass
        return super().update(instance, validated_data)
