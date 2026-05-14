from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdminRole, is_admin_role

from .models import Employee
from .serializers import EmployeeCreateSerializer, EmployeeSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        if not hasattr(self.request, 'company'):
            return Employee.objects.none()
        return Employee.objects.select_related("user").filter(company=self.request.company).order_by("employee_id")

    def get_permissions(self):
        if self.action in {"list", "create", "update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def retrieve(self, request, *args, **kwargs):
        employee = self.get_object()
        if not is_admin_role(request.user) and employee.user_id != request.user.id:
            return Response({"detail": "Not found."}, status=404)
        return super().retrieve(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="me")
    def me(self, request):
        employee = Employee.objects.select_related("user").filter(user=request.user).first()
        if not employee:
            return Response({"detail": "Employee profile not found."}, status=404)
        return Response(EmployeeSerializer(employee).data)
