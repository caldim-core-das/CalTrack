from django.apps import AppConfig


class SchedulingConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "scheduling"
