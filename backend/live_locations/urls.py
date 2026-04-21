from django.urls import path
from .views import LiveLocationUpdateView, CurrentLocationsListView, EmployeeLocationHistoryView, EmployeeLiveSessionDetailView

urlpatterns = [
    path('update/', LiveLocationUpdateView.as_view(), name='live-location-update'),
    path('current/', CurrentLocationsListView.as_view(), name='current-locations'),
    path('history/<str:employee_id>/', EmployeeLocationHistoryView.as_view(), name='employee-location-history'),
    path('session/<str:time_log_id>/', EmployeeLiveSessionDetailView.as_view(), name='session-detail'),
]
