from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def _create_user(self, username, email, password, **extra_fields):
        if not username:
            raise ValueError("Username must be set")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser):
    """
    Custom user model for QuickTIMS.
    Extends AbstractBaseUser to avoid the Django auth permission/group system
    which requires contenttypes and complex M2M tables not needed in a JWT API.
    """

    company = models.ForeignKey('companies.Company', on_delete=models.CASCADE, null=True, blank=True, related_name="users")

    username_validator = UnicodeUsernameValidator()

    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[username_validator],
        error_messages={"unique": "A user with that username already exists."},
    )
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_superuser = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        EMPLOYEE = "employee", "Employee"
        KIOSK = "kiosk", "Kiosk"
        CUSTOMER = "customer", "Customer"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYEE)

    # Extended profile fields
    bio = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    timezone = models.CharField(max_length=60, default="UTC")
    language = models.CharField(max_length=10, default="en")
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)

    # 2FA & OTP Logins
    totp_secret = models.CharField(max_length=100, blank=True, default="")
    two_fa_enabled = models.BooleanField(default=False)
    email_otp = models.CharField(max_length=6, blank=True, null=True)
    phone_otp = models.CharField(max_length=6, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email"]

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"

    def get_full_name(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name

    def get_short_name(self):
        return self.first_name

    def has_perm(self, perm, obj=None):
        return self.is_superuser

    def has_module_perms(self, app_label):
        return self.is_superuser

    def is_admin(self) -> bool:
        return self.role == self.Role.ADMIN

    def is_employee(self) -> bool:
        return self.role == self.Role.EMPLOYEE


class OTPAuditLog(models.Model):
    phone = models.CharField(max_length=30)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    action = models.CharField(max_length=30)  # e.g. send_request, send_failed, rate_limited_ip, rate_limited_phone, verify_success, verify_failed, attempts_exceeded
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "OTP Audit Log"
        verbose_name_plural = "OTP Audit Logs"

    def __str__(self):
        return f"{self.phone} - {self.action} @ {self.timestamp}"


class RegistrationDossier(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    region = models.CharField(max_length=50, blank=True, default="IN")
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    trust_score = models.IntegerField(default=0)
    
    # Store complete forms as JSON instead of rigidly defining all fields
    reg_form_data = models.JSONField(default=dict, blank=True)
    doc_form_data = models.JSONField(default=dict, blank=True)
    academy_state_data = models.JSONField(default=dict, blank=True)
    interview_state_data = models.JSONField(default=dict, blank=True)
    admin_clearance_data = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Registration Dossier"
        verbose_name_plural = "Registration Dossiers"

    def __str__(self):
        return f"Dossier: {self.full_name} ({self.email}) - {self.status}"
