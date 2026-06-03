from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PayrollGenerateView, PayrollRecordViewSet, CurrencyMasterViewSet, PayrollRuleViewSet, DynamicPayrollGenerateView, PayslipView

router = DefaultRouter()
router.register(r"records", PayrollRecordViewSet, basename="payroll-record")
router.register(r"currency", CurrencyMasterViewSet, basename="currency")
router.register(r"rules", PayrollRuleViewSet, basename="payroll-rules")

urlpatterns = [
    path("generate/", PayrollGenerateView.as_view(), name="payroll-generate"),
    path("dynamic-generate/", DynamicPayrollGenerateView.as_view(), name="dynamic-payroll-generate"),
    path("payslip/<str:employee_id>/", PayslipView.as_view(), name="payslip-view"),
]

urlpatterns += router.urls
