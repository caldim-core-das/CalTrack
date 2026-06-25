from django.urls import path
from .views import CompanyCreateView, CompanyMeView, CompanyUpdateView, RegionListView

urlpatterns = [
    path("create", CompanyCreateView.as_view(), name="company-create"),
    path("create/", CompanyCreateView.as_view(), name="company-create-slash"),
    path("me", CompanyMeView.as_view(), name="company-me"),
    path("me/", CompanyMeView.as_view(), name="company-me-slash"),
    path("update", CompanyUpdateView.as_view(), name="company-update"),
    path("update/", CompanyUpdateView.as_view(), name="company-update-slash"),
    path("regions/", RegionListView.as_view(), name="company-regions"),
]
