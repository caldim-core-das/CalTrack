from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PayrollGenerateView,
    PayrollRecordViewSet,
    CurrencyMasterViewSet,
    PayrollRuleViewSet,
    DynamicPayrollGenerateView,
    PayslipView,
    # New region-based payroll endpoints
    PayrollGroupViewSet,
    EmployeePayrollConfigViewSet,
    PayrollRegionSummaryView,
    IndiaPayrollGenerateView,
)

router = DefaultRouter()
router.register(r"records", PayrollRecordViewSet, basename="payroll-record")
router.register(r"currency", CurrencyMasterViewSet, basename="currency")
router.register(r"rules", PayrollRuleViewSet, basename="payroll-rules")
router.register(r"groups", PayrollGroupViewSet, basename="payroll-groups")
router.register(r"configs", EmployeePayrollConfigViewSet, basename="payroll-configs")

urlpatterns = [
    path("generate/", PayrollGenerateView.as_view(), name="payroll-generate"),
    path("dynamic-generate/", DynamicPayrollGenerateView.as_view(), name="dynamic-payroll-generate"),
    path("india-generate/", IndiaPayrollGenerateView.as_view(), name="india-payroll-generate"),
    path("region-summary/", PayrollRegionSummaryView.as_view(), name="payroll-region-summary"),
    path("payslip/<str:employee_id>/", PayslipView.as_view(), name="payslip-view"),
]

urlpatterns += router.urls

