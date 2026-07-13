from django.apps import AppConfig


class TrialManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'trial_management'

    def ready(self):
        import trial_management.signals
