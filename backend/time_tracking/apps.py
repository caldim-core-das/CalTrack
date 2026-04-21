from django.apps import AppConfig


class TimeTrackingConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "time_tracking"
