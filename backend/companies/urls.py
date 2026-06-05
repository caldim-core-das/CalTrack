from django.urls import path
from .views import CompanyCreateView, CompanyMeView, CompanyUpdateView, RegionListView

urlpatterns = [
    path("create", CompanyCreateView.as_view(), name="company-create"),
    path("me", CompanyMeView.as_view(), name="company-me"),
    path("update", CompanyUpdateView.as_view(), name="company-update"),
    path("regions/", RegionListView.as_view(), name="company-regions"),
]
