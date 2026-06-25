from django.urls import path

from .views import (
    LoginView, MeView, RefreshView, LogoutView,
    GoogleLoginView, RegisterView, AdminRegistrationView,
    ProfileUpdateView, PasswordChangeView, EmailChangeView, TwoFactorSetupView,
    TwoFAChallengeView,
    AcceptInviteView, PasswordResetRequestView, PasswordResetConfirmView,
    RegistrationDossierView, PasswordResetVerifyIdentityView,
    SendOTPView, VerifyOTPView,
    RegistrationDossierApproveView, RegistrationDossierRejectView,
    RegistrationDossierVerifyTokenView, RegistrationDossierActivateView,
    ApprovedEmployeesListView, DeleteAccountView, SendEmailOTPView, PasswordResetWithOTPView
)

urlpatterns = [
    path("login/",          LoginView.as_view(),                  name="jwt-login"),
    path("register/",       RegisterView.as_view(),               name="jwt-register"),
    path("register-admin/", AdminRegistrationView.as_view(),      name="jwt-register-admin"),
    path("google/",         GoogleLoginView.as_view(),            name="google-login"),
    path("refresh/",        RefreshView.as_view(),                name="jwt-refresh"),
    path("logout/",         LogoutView.as_view(),                 name="jwt-logout"),
    path("me/",             MeView.as_view(),                     name="me"),
    path("profile/",        ProfileUpdateView.as_view(),          name="profile-update"),
    path("password/change/",PasswordChangeView.as_view(),         name="password-change"),
    path("email/change/",   EmailChangeView.as_view(),            name="email-change"),
    path("2fa/",            TwoFactorSetupView.as_view(),         name="2fa-setup"),
    path("2fa/challenge/",  TwoFAChallengeView.as_view(),         name="2fa-challenge"),
    path("accept-invite/",  AcceptInviteView.as_view(),           name="accept-invite"),
    path("password-reset/verify-identity/", PasswordResetVerifyIdentityView.as_view(), name="password-reset-verify-identity"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("registration-dossier/", RegistrationDossierView.as_view(), name="registration-dossier"),
    path("registration-dossier/approve/", RegistrationDossierApproveView.as_view(), name="registration-dossier-approve"),
    path("registration-dossier/reject/", RegistrationDossierRejectView.as_view(), name="registration-dossier-reject"),
    path("registration-dossier/verify-token/", RegistrationDossierVerifyTokenView.as_view(), name="registration-dossier-verify-token"),
    path("registration-dossier/activate/", RegistrationDossierActivateView.as_view(), name="registration-dossier-activate"),
    path("send-otp/",       SendOTPView.as_view(),                name="send-otp"),
    path("verify-otp/",     VerifyOTPView.as_view(),              name="verify-otp"),
    path("send-email-otp/", SendEmailOTPView.as_view(),           name="send-email-otp"),
    path("password/reset-with-otp/", PasswordResetWithOTPView.as_view(), name="password-reset-with-otp"),
    path("approved-employees/", ApprovedEmployeesListView.as_view(), name="approved-employees"),
    path("delete-account/", DeleteAccountView.as_view(), name="delete-account"),
]

