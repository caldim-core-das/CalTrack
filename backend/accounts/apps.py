from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django_mongodb_backend.fields.ObjectIdAutoField"
    name = "accounts"

    def ready(self):
        # Disconnect the django.contrib.contenttypes post_migrate signal.
        # That signal tries to create ContentType objects using integer PKs and
        # hashing of unsaved model instances, which is incompatible with
        # MongoDB ObjectId primary keys and causes:
        #   TypeError: Model instances without primary key value are unhashable
        try:
            from django.contrib.contenttypes.management import update_contenttypes
            from django.contrib.auth.management import create_permissions
            from django.db.models.signals import post_migrate
            post_migrate.disconnect(update_contenttypes)
            post_migrate.disconnect(
                create_permissions,
                dispatch_uid="django.contrib.auth.management.create_permissions"
            )
        except ImportError:
            pass
