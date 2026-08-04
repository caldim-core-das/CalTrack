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
    PayrollConfigViewSet,
    EmployeeWalletView,
    EmployeePayslipDownloadView,
    BankAccountViewSet,
    KYCStatusView,
    SettlementCycleRunView,
    WalletStatementDownloadView,
    PayoutDisputeViewSet,
)

router = DefaultRouter()
router.register(r"records", PayrollRecordViewSet, basename="payroll-record")
router.register(r"currency", CurrencyMasterViewSet, basename="currency")
router.register(r"rules", PayrollRuleViewSet, basename="payroll-rules")
router.register(r"groups", PayrollGroupViewSet, basename="payroll-groups")
router.register(r"configs", EmployeePayrollConfigViewSet, basename="payroll-configs")
router.register(r"config", PayrollConfigViewSet, basename="payroll-org-config")
router.register(r"bank-accounts", BankAccountViewSet, basename="payroll-bank-account")
router.register(r"disputes", PayoutDisputeViewSet, basename="payroll-dispute")

urlpatterns = [
    path("generate/", PayrollGenerateView.as_view(), name="payroll-generate"),
    path("dynamic-generate/", DynamicPayrollGenerateView.as_view(), name="dynamic-payroll-generate"),
    path("india-generate/", IndiaPayrollGenerateView.as_view(), name="india-payroll-generate"),
    path("region-summary/", PayrollRegionSummaryView.as_view(), name="payroll-region-summary"),
    path("payslip/<str:employee_id>/", PayslipView.as_view(), name="payslip-view"),
    path("my-wallet/", EmployeeWalletView.as_view(), name="payroll-my-wallet"),
    path("download-payslip/<int:transaction_id>/", EmployeePayslipDownloadView.as_view(), name="payroll-download-payslip"),
    path("my-kyc/", KYCStatusView.as_view(), name="payroll-my-kyc"),
    path("settlement-cycles/run/", SettlementCycleRunView.as_view(), name="payroll-settlement-cycles-run"),
    path("statement/", WalletStatementDownloadView.as_view(), name="payroll-statement"),
]

urlpatterns += router.urls



