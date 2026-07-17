from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Employee
from .utils import generate_next_employee_id

User = get_user_model()


class EmployeeUserSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")
        read_only_fields = ("id",)


class EmployeeSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    user = EmployeeUserSerializer(read_only=True)
    first_name = serializers.CharField(source='user.first_name', required=False, allow_blank=True)
    last_name = serializers.CharField(source='user.last_name', required=False, allow_blank=True)
    email = serializers.EmailField(source='user.email', required=False, allow_blank=True)
    role = serializers.CharField(source='user.role', required=False)
    job_site_name = serializers.SlugRelatedField(
        source='assigned_job_site',
        read_only=True,
        slug_field='name'
    )
    # ── Live availability (computed, never stored) ────────────────────────
    # Values: "available" | "busy" | "on_break" | "on_leave" | "offline"
    current_availability = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = (
            "id",
            "employee_id",
            "user",
            "first_name",
            "last_name",
            "email",
            "role",
            "phone",
            "title",
            "hourly_rate",
            "hire_date",
            "date_of_birth",
            "assigned_job_site",
            "job_site_name",
            "allow_all_locations",  # Phase 1 — bypass EmployeeLocation filter
            "country",
            "state",
            "department",
            "currency",
            "payroll_group",
            "tax_category",
            "bank_details",
            "exempt_status",
            "exempt_history",
            "flsa_duties_category",
            "weekly_salary",
            "uk_tax_code",
            "uk_ni_category",
            "rolled_up_holiday_pay",
            "wtr_opt_out_active",
            "is_online",
            "last_login_at",
            "last_logout_at",
            "last_activity_at",
            "current_availability",
            "is_active",
            "created_at",
            "updated_at",
            "service_roles",
        )
        read_only_fields = ("id", "created_at", "updated_at", "is_online", "last_login_at", "last_logout_at", "last_activity_at")

    def get_current_availability(self, employee):
        """
        Compute live availability by checking:
          1. Employee is inactive        → offline
          2. Has approved leave today    → on_leave
          3. Is not online               → offline
          4. Has explicit availability   → lowercase value
          5. Otherwise fallback to shift details
        """
        from django.utils import timezone
        from time_tracking.models import TimeLog, Break
        from leaves.models import LeaveRequest

        if not employee.is_active:
            return "offline"

        today = timezone.localdate()

        # Check for approved leave covering today
        on_leave = LeaveRequest.objects.filter(
            employee=employee,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today,
            end_date__gte=today,
        ).exists()
        if on_leave:
            return "on_leave"

        if not employee.is_online:
            return "offline"

        # If online, try using the explicit availability field
        if employee.current_availability and employee.current_availability.strip() and employee.current_availability.lower() != "offline":
            return employee.current_availability.lower()

        # Check for an open time log (clocked in, not yet clocked out)
        open_log = TimeLog.objects.filter(
            employee=employee,
            work_date=today,
            clock_out__isnull=True,
        ).first()

        if open_log:
            # Check if currently on a break within that log
            on_break = Break.objects.filter(
                time_log=open_log,
                break_end__isnull=True,
            ).exists()
            if on_break:
                return "on_break"
            
            # Check if there is an active (in progress) task associated with this time log
            has_active_task = False
            if hasattr(open_log, 'task') and open_log.task:
                if open_log.task.status == 'in_progress':
                    has_active_task = True
            
            return "busy" if has_active_task else "available"

        # If not clocked in but online, employee is available
        return "available"

    def validate_hourly_rate(self, value):
        request = self.context.get("request")
        if not request or not request.user:
            return value

        # If updating an existing instance
        if self.instance:
            from decimal import Decimal
            try:
                old_rate = Decimal(str(self.instance.hourly_rate))
                new_rate = Decimal(str(value))
            except (ValueError, TypeError):
                return value

            if old_rate != new_rate:
                is_superuser = request.user.is_superuser
                is_inviting_admin = (self.instance.invited_by == request.user)
                if not (is_superuser or is_inviting_admin):
                    raise serializers.ValidationError(
                        "Only the admin who invited/approved this employee can assign or modify their hourly rate."
                    )
        return value

    def update(self, instance, validated_data):
        print("UPDATE CALLED WITH VALIDATED DATA:", validated_data)
        user_data = validated_data.pop('user', {})
        print("USER DATA EXTRACTED:", user_data)
        user = instance.user

        # Update user fields
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()

        # Update employee fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class EmployeeCreateSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.EMPLOYEE, write_only=True)
    employee_id = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Employee
        fields = (
            "id",
            "employee_id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone",
            "title",
            "hourly_rate",
            "hire_date",
            "date_of_birth",
            "assigned_job_site",
            "allow_all_locations",
            "country",
            "state",
            "department",
            "currency",
            "payroll_group",
            "tax_category",
            "bank_details",
            "exempt_status",
            "weekly_salary",
            "uk_tax_code",
            "uk_ni_category",
            "rolled_up_holiday_pay",
            "wtr_opt_out_active",
            "is_active",
        )

    def create(self, validated_data):
        username = validated_data.pop("username")
        password = validated_data.pop("password")
        email = validated_data.pop("email", "")
        first_name = validated_data.pop("first_name", "")
        last_name = validated_data.pop("last_name", "")
        role = validated_data.pop("role", User.Role.EMPLOYEE)
        
        request = self.context.get("request")
        company = getattr(request, "company", None)

        if not company:
            # Final fallback: check if current user has an employee record
            emp = Employee.objects.filter(user=request.user).first()
            if emp:
                company = emp.company

        if not company:
            raise serializers.ValidationError({"detail": "You must be associated with a company to add members."})

        from django.db.models import Q
        user = User.objects.filter(Q(username__iexact=username) | Q(email__iexact=email)).first()

        try:
            if user:
                # If they are associated with public or None, associate with the new company
                if not user.company or user.company.schema_name == 'public':
                    user.company = company
                if first_name:
                    user.first_name = first_name
                if last_name:
                    user.last_name = last_name
                user.save()
            else:
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    company=company
                )
            
            if not validated_data.get("employee_id"):
                validated_data["employee_id"] = generate_next_employee_id(company)
                
            # Set/validate invited_by and hourly_rate for existing/new employee
            employee = Employee.objects.filter(user=user, company=company).first()
            if employee:
                # Existing employee: check if hourly_rate is being modified
                new_rate = validated_data.get("hourly_rate")
                if new_rate is not None:
                    from decimal import Decimal
                    try:
                        old_rate = Decimal(str(employee.hourly_rate))
                        new_rate_dec = Decimal(str(new_rate))
                        if old_rate != new_rate_dec:
                            is_superuser = request.user.is_superuser if request and request.user else False
                            is_inviting_admin = (employee.invited_by == request.user) if request and request.user else False
                            if not (is_superuser or is_inviting_admin):
                                raise serializers.ValidationError(
                                    {"hourly_rate": "Only the admin who invited/approved this employee can assign or modify their hourly rate."}
                                )
                    except (ValueError, TypeError):
                        pass
                if not employee.invited_by and request and request.user and request.user.is_authenticated:
                    employee.invited_by = request.user
                    employee.save(update_fields=["invited_by"])
            else:
                # New employee: set invited_by to the requesting user
                if request and request.user and request.user.is_authenticated:
                    validated_data["invited_by"] = request.user

            employee, created = Employee.objects.get_or_create(
                user=user,
                company=company,
                defaults=validated_data
            )
            if not created:
                for attr, value in validated_data.items():
                    setattr(employee, attr, value)
                employee.save()
                
            return employee
        except Exception as e:
            # Handle potential integrity errors (duplicate username, etc)
            raise serializers.ValidationError({"detail": str(e)})
