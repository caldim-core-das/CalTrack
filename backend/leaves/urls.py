from rest_framework.routers import DefaultRouter

from .views import LeaveRequestViewSet

router = DefaultRouter()
router.register(r"", LeaveRequestViewSet, basename="leave")

urlpatterns = router.urls
