"""service_requests/urls.py"""
from django.urls import path

from .views import (
    # Public
    BookingCreateView,
    CustomerMyBookingsView,
    FeedbackTokenView,
    CatalogCategoryListView,
    CatalogServiceListView,
    # Admin — Service Requests
    AdminSRListView,
    AdminSRDetailView,
    AdminSRReviewView,
    AdminSRPriorityView,
    AdminSRAssignView,
    AdminSRRejectView,
    AdminSRVerifyView,
    AdminSRReworkView,
    AdminSRCloseView,
    AdminSRResendFeedbackView,
    AdminEmployeeListView,

    # Admin — Feedback
    AdminFeedbackListView,
    AdminFeedbackMetricsView,
    # Employee
    EmployeeJobListView,
    EmployeeJobDetailView,
    EmployeeJobAcceptView,
    EmployeeJobRejectView,
    EmployeeJobStartView,
    EmployeeJobCompleteView,
    EmployeeJobProofView,
    EmployeePerformanceView,
)
from .payment_views import (
    PaymentInitiateView,
    PaymentVerifyView,
    EmployeeCashCollectView,
    EmployeeJobOnTheWayView,
    AdminPaymentUpdateView,
    InvoiceDownloadView,
)

urlpatterns = [
    # ── Public & Customer ────────────────────────────────────────────────────────────
    path("catalog/categories/",              CatalogCategoryListView.as_view(), name="catalog-categories"),
    path("catalog/services/",                CatalogServiceListView.as_view(),  name="catalog-services"),
    path("booking/",                         BookingCreateView.as_view(),    name="sr-booking"),
    path("booking/my-bookings/",             CustomerMyBookingsView.as_view(), name="sr-my-bookings"),
    path("booking/<int:pk>/invoice/",        InvoiceDownloadView.as_view(),  name="sr-invoice"),
    path("feedback/<uuid:token>/",           FeedbackTokenView.as_view(),    name="sr-feedback-token"),

    # ── Payment ───────────────────────────────────────────────────────────────
    path("payment/initiate/",                PaymentInitiateView.as_view(),  name="payment-initiate"),
    path("payment/verify/",                  PaymentVerifyView.as_view(),    name="payment-verify"),

    # ── Admin — Service Requests ──────────────────────────────────────────
    path("admin/service-requests/",          AdminSRListView.as_view(),      name="sr-admin-list"),
    path("admin/service-requests/employees/", AdminEmployeeListView.as_view(), name="sr-admin-employees"),
    path("admin/service-requests/<int:pk>/", AdminSRDetailView.as_view(),    name="sr-admin-detail"),
    path("admin/service-requests/<int:pk>/review/",       AdminSRReviewView.as_view(),   name="sr-admin-review"),
    path("admin/service-requests/<int:pk>/priority/",     AdminSRPriorityView.as_view(), name="sr-admin-priority"),
    path("admin/service-requests/<int:pk>/assign/",       AdminSRAssignView.as_view(),   name="sr-admin-assign"),
    path("admin/service-requests/<int:pk>/reject/",       AdminSRRejectView.as_view(),   name="sr-admin-reject"),
    path("admin/service-requests/<int:pk>/verify/",       AdminSRVerifyView.as_view(),   name="sr-admin-verify"),
    path("admin/service-requests/<int:pk>/request-rework/", AdminSRReworkView.as_view(), name="sr-admin-rework"),
    path("admin/service-requests/<int:pk>/close/",        AdminSRCloseView.as_view(),    name="sr-admin-close"),
    path("admin/service-requests/<int:pk>/resend-feedback/", AdminSRResendFeedbackView.as_view(), name="sr-admin-resend-feedback"),
    path("admin/service-requests/<int:pk>/payment/",      AdminPaymentUpdateView.as_view(), name="sr-admin-payment"),

    # ── Admin — Feedback ──────────────────────────────────────────────────
    path("admin/feedback/",                  AdminFeedbackListView.as_view(),   name="sr-admin-feedback-list"),
    path("admin/feedback/metrics/",          AdminFeedbackMetricsView.as_view(),name="sr-admin-feedback-metrics"),

    # ── Employee ──────────────────────────────────────────────────────────
    path("employee/jobs/",                          EmployeeJobListView.as_view(),     name="sr-emp-jobs"),
    path("employee/jobs/<int:pk>/",                 EmployeeJobDetailView.as_view(),   name="sr-emp-job-detail"),
    path("employee/jobs/<int:pk>/accept/",          EmployeeJobAcceptView.as_view(),   name="sr-emp-accept"),
    path("employee/jobs/<int:pk>/reject/",          EmployeeJobRejectView.as_view(),   name="sr-emp-reject"),
    path("employee/jobs/<int:pk>/on-the-way/",      EmployeeJobOnTheWayView.as_view(), name="sr-emp-on-the-way"),
    path("employee/jobs/<int:pk>/start/",           EmployeeJobStartView.as_view(),    name="sr-emp-start"),
    path("employee/jobs/<int:pk>/complete/",        EmployeeJobCompleteView.as_view(), name="sr-emp-complete"),
    path("employee/jobs/<int:pk>/collect-cash/",    EmployeeCashCollectView.as_view(), name="sr-emp-collect-cash"),
    path("employee/jobs/<int:pk>/proof/",           EmployeeJobProofView.as_view(),    name="sr-emp-proof"),
    path("employee/performance/",                   EmployeePerformanceView.as_view(), name="sr-emp-performance"),
]
