from django.urls import path

from .views import (
    AdminTaskListCreateView,
    AdminTaskDetailView,
    AdminTaskAttachmentCreateView,
    AdminDeclinedTasksView,
    AdminAvailableEmployeesView,
    AdminTaskCancelView,
    AdminTaskCompleteView,
    EmployeeTaskListView,
    EmployeeTaskActionView,
    SuspendJobView,
    AvailableGapJobsView,
    AcceptGapJobView,
    CompleteGapJobView,
    ResumeJobView,
    AdminPushGapJobView,
    CheckSmartNearbyView,
    EmployeeNearbyDecisionView,
    UpdateCompletionView,
    TaskActivityLogView,
    AdminSmartDispatchView,
    AdminUpdateCompletionView,
    AddressAutocompleteView,
    SmartAddressWorkflowView,
    LiveTaskMapView,
)

urlpatterns = [
    # Admin endpoints
    path("admin/",                              AdminTaskListCreateView.as_view(),      name="task-admin-list"),
    path("admin/declined/",                     AdminDeclinedTasksView.as_view(),       name="task-admin-declined"),
    path("admin/available-employees/",          AdminAvailableEmployeesView.as_view(),  name="task-admin-available-employees"),
    path("admin/smart-dispatch/",               AdminSmartDispatchView.as_view(),       name="task-admin-smart-dispatch"),
    # Smart Address (Module 2) - MUST BE BEFORE <str:pk>
    path("admin/address-autocomplete/",        AddressAutocompleteView.as_view(),      name="task-address-autocomplete"),
    path("admin/smart-address-workflow/",      SmartAddressWorkflowView.as_view(),     name="task-smart-address-workflow"),
    path("admin/live-task-map/",               LiveTaskMapView.as_view(),              name="task-live-task-map"),

    path("admin/<str:pk>/",                     AdminTaskDetailView.as_view(),          name="task-admin-detail"),
    path("admin/<str:pk>/attachments/",         AdminTaskAttachmentCreateView.as_view(),name="task-admin-attachments"),
    path("admin/<str:pk>/push-gap-job/",        AdminPushGapJobView.as_view(),          name="task-admin-push-gap-job"),
    path("admin/<str:pk>/completion/",          AdminUpdateCompletionView.as_view(),    name="task-admin-completion"),
    path("admin/<str:pk>/cancel/",              AdminTaskCancelView.as_view(),          name="task-admin-cancel"),
    path("admin/<str:pk>/complete/",            AdminTaskCompleteView.as_view(),        name="task-admin-complete"),

    # Employee endpoints
    path("my/",                                 EmployeeTaskListView.as_view(),         name="task-my-list"),
    path("my/<str:pk>/<str:action>/",           EmployeeTaskActionView.as_view(),       name="task-my-action"),

    # Gap Jobs / Suspended Jobs endpoints
    path("available-gap-jobs/",                AvailableGapJobsView.as_view(),         name="task-available-gap-jobs"),
    path("<str:pk>/suspend/",                  SuspendJobView.as_view(),               name="task-suspend"),
    path("<str:pk>/accept-gap-job/",           AcceptGapJobView.as_view(),             name="task-accept-gap-job"),
    path("<str:pk>/complete-gap-job/",         CompleteGapJobView.as_view(),           name="task-complete-gap-job"),
    path("<str:pk>/resume/",                   ResumeJobView.as_view(),                name="task-resume"),

    # Smart Assignment (Module 1)
    path("smart-nearby/",                      CheckSmartNearbyView.as_view(),         name="task-smart-nearby"),
    path("<str:pk>/nearby-decision/",          EmployeeNearbyDecisionView.as_view(),   name="task-nearby-decision"),
    path("<str:pk>/completion/",               UpdateCompletionView.as_view(),         name="task-completion"),
    path("<str:pk>/activity-log/",             TaskActivityLogView.as_view(),          name="task-activity-log"),
]
