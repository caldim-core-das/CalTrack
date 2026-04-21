from django.urls import path

from .views import AdminOverviewReportView, DashboardAnalyticsView

urlpatterns = [
    path("overview/", AdminOverviewReportView.as_view(), name="reports-overview"),
    path("dashboard-analytics/", DashboardAnalyticsView.as_view(), name="dashboard-analytics"),
]

