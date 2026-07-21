from django.db import models
from django_tenants.models import TenantMixin, DomainMixin


class Region(models.Model):
    """
    Defines region-specific compliance and payroll rules for UK and US.
    Seeded once at startup — not user-editable.
    """

    class Code(models.TextChoices):
        US = "US", "United States"
        UK = "UK", "United Kingdom"
        IN = "IN", "India"

    code = models.CharField(max_length=2, unique=True, choices=Code.choices)
    name = models.CharField(max_length=100)

    # Currency
    currency = models.CharField(max_length=3)           # USD, GBP
    currency_symbol = models.CharField(max_length=5)    # $, £

    # Date & calendar
    date_format = models.CharField(max_length=20, default="MM/DD/YYYY")
    week_start = models.IntegerField(default=0)         # 0=Mon (UK), 6=Sun (US)

    # Working time
    overtime_weekly_hours = models.PositiveIntegerField(default=40)     # FLSA=40, WTR=48
    max_weekly_hours = models.PositiveIntegerField(default=40)          # WTR cap=48

    # Leave
    statutory_leave_days = models.PositiveIntegerField(default=0)       # UK=28, US=0

    # Tax year
    tax_year_start_month = models.IntegerField(default=1)   # US=Jan(1), UK=Apr(4)
    tax_year_start_day = models.IntegerField(default=1)     # US=1,      UK=6

    # Payroll
    payroll_frequency = models.CharField(max_length=20, default="biweekly")  # biweekly | monthly
    min_wage = models.DecimalField(max_digits=7, decimal_places=2, default=0)

    # UK-specific
    national_insurance_enabled = models.BooleanField(default=False)
    paye_enabled = models.BooleanField(default=False)

    # US-specific
    flsa_enabled = models.BooleanField(default=False)
    state_tax_enabled = models.BooleanField(default=False)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"

def default_module_permissions():
    return {
        "live_location": { "admin": ["view", "modify"], "manager": ["view", "modify"], "employee": ["view"] },
        "locations": { "admin": ["view", "modify"], "manager": ["view", "modify"], "employee": [] },
        "attendance": { "admin": ["view", "modify"], "manager": ["view", "modify"], "employee": ["view", "modify"] },
        "payroll": { "admin": ["view", "modify"], "manager": ["view", "modify"], "employee": [] },
        "reports": { "admin": ["view"], "manager": ["view"], "employee": [] },
    }


class Company(TenantMixin):
    company_name = models.CharField(max_length=255)
    display_id = models.CharField(max_length=50, unique=True, null=True, blank=True)

    class PrimaryCountry(models.TextChoices):
        US = "US", "United States"
        UK = "UK", "United Kingdom"
        IN = "IN", "India"

    primary_country = models.CharField(
        max_length=2,
        choices=PrimaryCountry.choices,
        default=PrimaryCountry.US,
    )

    # Region FK — set automatically from primary_country on save
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="companies",
    )

    default_state = models.CharField(max_length=100, blank=True, null=True)
    
    industry = models.CharField(max_length=100, blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    timezone = models.CharField(max_length=50, default="UTC")
    data_region = models.CharField(max_length=50, default="us-east")
    address = models.TextField(blank=True, null=True)
    logo = models.ImageField(upload_to="company_logos/", blank=True, null=True)

    # Geofence Config
    geofence_enabled = models.BooleanField(default=True)
    geofence_radius_meters = models.PositiveIntegerField(default=200)
    geofence_strict_mode = models.BooleanField(default=True)
    geofence_admin_override = models.BooleanField(default=True)

    class ComplianceMode(models.TextChoices):
        STRICT = "strict", "Strict"
        FLEXIBLE = "flexible", "Flexible"

    compliance_mode = models.CharField(
        max_length=20,
        choices=ComplianceMode.choices,
        default=ComplianceMode.STRICT,
    )

    class ShiftEnforcementMode(models.TextChoices):
        BLOCK = "block", "Block clock-in"
        WARN = "warn", "Allow with warning flag"
        OFF = "off", "No shift-location enforcement"

    shift_enforcement_mode = models.CharField(
        max_length=10,
        choices=ShiftEnforcementMode.choices,
        default=ShiftEnforcementMode.WARN,
    )

    allowed_countries = models.JSONField(default=list, blank=True)
    team_size = models.CharField(max_length=100, blank=True, null=True)
    selected_modules = models.JSONField(default=list, blank=True)
    module_permissions = models.JSONField(default=default_module_permissions, blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.display_id:
            import uuid
            self.display_id = f"ORG-{uuid.uuid4().hex[:6].upper()}"

        if not self.schema_name:
            from django.utils.text import slugify
            import uuid
            base_slug = slugify(self.company_name).replace("-", "_") or f"org_{uuid.uuid4().hex[:8]}"
            schema = base_slug
            i = 2
            while Company.objects.filter(schema_name=schema).exists():
                schema = f"{base_slug}_{i}"
                i += 1
            self.schema_name = schema

        # Auto-assign region from primary_country if not explicitly set
        if self.primary_country and not self.region_id:
            try:
                self.region = Region.objects.get(code=self.primary_country)
            except Region.DoesNotExist:
                pass

        super().save(*args, **kwargs)

    def __str__(self):
        return self.company_name


class Domain(DomainMixin):
    pass
