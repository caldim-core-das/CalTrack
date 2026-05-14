from django.urls import path

from .views import (
    AdminTaskListCreateView,
    AdminTaskDetailView,
    AdminTaskAttachmentCreateView,
    AdminDeclinedTasksView,
    AdminAvailableEmployeesView,
    EmployeeTaskListView,
    EmployeeTaskActionView,
)

urlpatterns = [
    # Admin endpoints
    path("admin/",                          AdminTaskListCreateView.as_view(),   name="task-admin-list"),
    path("admin/declined/",                 AdminDeclinedTasksView.as_view(),    name="task-admin-declined"),
    path("admin/available-employees/",      AdminAvailableEmployeesView.as_view(), name="task-admin-available-employees"),
    path("admin/<str:pk>/",                 AdminTaskDetailView.as_view(),       name="task-admin-detail"),
    path("admin/<str:pk>/attachments/",     AdminTaskAttachmentCreateView.as_view(), name="task-admin-attachments"),

    # Employee endpoints
    path("my/",                             EmployeeTaskListView.as_view(),      name="task-my-list"),
    path("my/<str:pk>/<str:action>/",       EmployeeTaskActionView.as_view(),    name="task-my-action"),
]
