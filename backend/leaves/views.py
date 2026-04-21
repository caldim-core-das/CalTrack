from django.utils import timezone
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.permissions import IsAdminRole
from employees.models import Employee

from .models import LeaveRequest
from .serializers import LeaveRequestCreateSerializer, LeaveRequestSerializer


class LeaveRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = LeaveRequest.objects.select_related("employee", "employee__user", "approved_by").all().order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == "admin":
            return qs
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            return qs.none()
        return qs.filter(employee=employee)

    def get_serializer_class(self):
        if self.action == "create":
            return LeaveRequestCreateSerializer
        return LeaveRequestSerializer

    def perform_create(self, serializer):
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            raise ValidationError({"detail": "Employee profile not found."})
        serializer.save(employee=employee)

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
