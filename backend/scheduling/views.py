from rest_framework import permissions, viewsets
from rest_framework.response import Response

from accounts.permissions import IsAdminRole
from employees.models import Employee

from .models import Shift
from .serializers import ShiftSerializer


class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Shift.objects.select_related("employee", "employee__user").order_by("-shift_start")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.role == "admin":
            return qs
        employee = Employee.objects.filter(user=self.request.user).first()
        if not employee:
            return qs.none()
        return qs.filter(employee=employee)

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [permissions.IsAuthenticated(), IsAdminRole()]
        return [permissions.IsAuthenticated()]

    def retrieve(self, request, *args, **kwargs):
        shift = self.get_object()
        if request.user.role != "admin" and shift.employee.user_id != request.user.id:
            return Response({"detail": "Not found."}, status=404)
        return super().retrieve(request, *args, **kwargs)
