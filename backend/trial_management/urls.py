from django.urls import path
from . import views

urlpatterns = [
    path("status/",         views.TrialStatusView.as_view(),         name="trial-status"),
    path("notifications/",  views.TrialNotificationsView.as_view(),  name="trial-notifications"),
    path("upgrade-click/",  views.TrialUpgradeClickView.as_view(),   name="trial-upgrade-click"),
    path("metrics/",        views.TrialMetricsView.as_view(),        name="trial-metrics"),
]
