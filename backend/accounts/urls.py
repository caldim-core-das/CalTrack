from django.urls import path

from .views import LoginView, MeView, RefreshView, GoogleLoginView, RegisterView

urlpatterns = [
    path("login/", LoginView.as_view(), name="jwt-login"),
    path("register/", RegisterView.as_view(), name="jwt-register"),
    path("google/", GoogleLoginView.as_view(), name="google-login"),
    path("refresh/", RefreshView.as_view(), name="jwt-refresh"),
    path("me/", MeView.as_view(), name="me"),
]
