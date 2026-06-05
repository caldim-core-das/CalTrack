from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import MileagePolicyViewSet, MileageTripViewSet, MileageYTDTrackerViewSet

router = DefaultRouter()
router.register("policies", MileagePolicyViewSet, basename="mileage-policies")
router.register("trips", MileageTripViewSet, basename="mileage-trips")
router.register("ytd", MileageYTDTrackerViewSet, basename="mileage-ytd")

urlpatterns = [
    path("", include(router.urls)),
]
