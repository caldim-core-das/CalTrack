from decimal import Decimal

from django.db import transaction
from rest_framework import permissions, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from employees.models import Employee
from leaves.models import LeaveRequest
from time_tracking.models import TimeLog

from .models import PayrollPeriod, PayrollRecord
from .serializers import PayrollGenerateSerializer, PayrollRecordSerializer


def _calc_leave_hours(employee, start, end):
    qs = LeaveRequest.objects.filter(
        employee=employee,
        status=LeaveRequest.Status.APPROVED,
        start_date__lte=end,
        end_date__gte=start,
    )
    paid = Decimal("0")
    unpaid = Decimal("0")
    for leave in qs:
        s = max(start, leave.start_date)
        e = min(end, leave.end_date)
        days = Decimal(str((e - s).days + 1))
        hours = days * Decimal("8")
        if leave.paid:
            paid += hours
        else:
            unpaid += hours
    return paid, unpaid


def _calc_work_hours(employee, start, end):
    qs = TimeLog.objects.filter(employee=employee, work_date__gte=start, work_date__lte=end).prefetch_related("breaks")
    daily = {}
    total = Decimal("0")
    for log in qs:
        hours = Decimal(str(round(log.worked_seconds() / 3600, 4)))
        daily.setdefault(log.work_date, Decimal("0"))
        daily[log.work_date] += hours
        total += hours
    weekly = {}
    for d, hours in daily.items():
        y, w, _ = d.isocalendar()
        weekly.setdefault((y, w), Decimal("0"))
        weekly[(y, w)] += hours
    weekly_ot = sum((hours - Decimal("40")) for hours in weekly.values() if hours > Decimal("40"))
    overtime = max(Decimal("0"), weekly_ot)
    regular = max(Decimal("0"), total - overtime)
    return regular.quantize(Decimal("0.01")), overtime.quantize(Decimal("0.01"))


class PayrollRecordViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PayrollRecordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PayrollRecord.objects.select_related("employee", "employee__user", "period").order_by("-generated_at")
        if self.request.user.role == "admin":
            return qs
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            return qs.none()
        return qs.filter(employee=employee)


class PayrollGenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]

    @transaction.atomic
    def post(self, request):
        serializer = PayrollGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = Employee.objects.select_related("user").filter(id=serializer.validated_data["employee"]).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)

        start = serializer.validated_data["start"]
        end = serializer.validated_data["end"]
        if end < start:
            return Response({"detail": "End date must be after start date."}, status=400)

        period, _ = PayrollPeriod.objects.get_or_create(start_date=start, end_date=end)

        hourly_rate = employee.hourly_rate
        regular_hours, overtime_hours = _calc_work_hours(employee, start, end)
        paid_leave_hours, unpaid_leave_hours = _calc_leave_hours(employee, start, end)

        overtime_multiplier = Decimal("1.5")
        gross = (regular_hours + paid_leave_hours) * hourly_rate + overtime_hours * hourly_rate * overtime_multiplier
        net = gross

        record, _ = PayrollRecord.objects.update_or_create(
            period=period,
            employee=employee,
            defaults={
                "hourly_rate": hourly_rate,
                "regular_hours": regular_hours,
                "overtime_hours": overtime_hours,
                "paid_leave_hours": paid_leave_hours.quantize(Decimal("0.01")),
                "unpaid_leave_hours": unpaid_leave_hours.quantize(Decimal("0.01")),
                "gross_pay": gross.quantize(Decimal("0.01")),
                "net_pay": net.quantize(Decimal("0.01")),
                "generated_by": request.user,
            },
        )
        return Response(PayrollRecordSerializer(record).data, status=201)
