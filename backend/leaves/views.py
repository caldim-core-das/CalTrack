from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import IsAdminRole, is_admin_role
from employees.models import Employee

from .models import LeaveRequest
from .serializers import LeaveRequestCreateSerializer, LeaveRequestSerializer


class LeaveRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    # Removed global queryset to force company filtering in get_queryset

    def get_queryset(self):
        if not hasattr(self.request, 'company'):
            return LeaveRequest.objects.none()
        qs = LeaveRequest.objects.filter(company=self.request.company).select_related("employee", "employee__user", "approved_by").order_by("-created_at")
        if is_admin_role(self.request.user):
            return qs
        employee = Employee.objects.filter(user=self.request.user, company=self.request.company).first()
        if not employee:
            return qs.none()
        return qs.filter(employee=employee)

    def get_serializer_class(self):
        if self.action == "create":
            return LeaveRequestCreateSerializer
        return LeaveRequestSerializer

    def perform_create(self, serializer):
        employee = Employee.objects.filter(user=self.request.user, company=self.request.company).first()
        if not employee:
            raise ValidationError({"detail": "Employee profile not found."})
        serializer.save(employee=employee, company=self.request.company)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def approve(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.APPROVED
        leave.approved_by = request.user
        leave.decision_at = timezone.now()
        leave.save(update_fields=["status", "approved_by", "decision_at", "updated_at"])
        return Response(LeaveRequestSerializer(leave).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated, IsAdminRole])
    def reject(self, request, pk=None):
        leave = self.get_object()
        leave.status = LeaveRequest.Status.REJECTED
        leave.approved_by = request.user
        leave.decision_at = timezone.now()
        leave.save(update_fields=["status", "approved_by", "decision_at", "updated_at"])
        return Response(LeaveRequestSerializer(leave).data)
