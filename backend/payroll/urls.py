from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PayrollGenerateView, PayrollRecordViewSet

router = DefaultRouter()
router.register(r"records", PayrollRecordViewSet, basename="payroll-record")

urlpatterns = [
    path("generate/", PayrollGenerateView.as_view(), name="payroll-generate"),
]

urlpatterns += router.urls
