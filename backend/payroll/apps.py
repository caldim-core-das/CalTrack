from django.apps import AppConfig


class PayrollConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "payroll"
