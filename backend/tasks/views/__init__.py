from .task_views import (
    AdminTaskListCreateView,
    AdminTaskDetailView,
    AdminTaskAttachmentCreateView,
    AdminDeclinedTasksView,
    AdminAvailableEmployeesView,
    AdminTaskCancelView,
    AdminTaskCompleteView,
    EmployeeTaskListView,
    EmployeeTaskActionView,
)
from .gap_job_views import (
    SuspendJobView,
    AvailableGapJobsView,
    AcceptGapJobView,
    CompleteGapJobView,
    ResumeJobView,
    AdminPushGapJobView,
)
from .smart_assign_views import (
    CheckSmartNearbyView,
    EmployeeNearbyDecisionView,
    UpdateCompletionView,
    TaskActivityLogView,
    AdminSmartDispatchView,
    AdminUpdateCompletionView,
)
from .smart_address_views import (
    AddressAutocompleteView,
    SmartAddressWorkflowView,
)
from .live_map_views import (
    LiveTaskMapView,
)
