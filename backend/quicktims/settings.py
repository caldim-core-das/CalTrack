from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

INSTALLED_APPS = [
    # Note: django.contrib.admin excluded (requires sessions+contenttypes in SQL style).
    # django.contrib.contenttypes kept because it's required by django.contrib.auth.
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "corsheaders",
    "rest_framework",
    "accounts.apps.AccountsConfig",
    "employees.apps.EmployeesConfig",
    "time_tracking.apps.TimeTrackingConfig",
    "leaves.apps.LeavesConfig",
    "payroll.apps.PayrollConfig",
    "scheduling.apps.SchedulingConfig",
    "reports.apps.ReportsConfig",
    "tasks.apps.TasksConfig",
    "live_locations.apps.LiveLocationsConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "quicktims.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    }
]

WSGI_APPLICATION = "quicktims.wsgi.application"
ASGI_APPLICATION = "quicktims.asgi.application"

# ---------------------------------------------------------------------------
# MongoDB — Official django-mongodb-backend (Python 3.13 + Django 5/6 compatible)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django_mongodb_backend",
        "NAME": os.getenv("MONGO_DB", "quicktims"),
        "HOST": os.getenv("MONGO_URI", "mongodb://localhost:27017"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django_mongodb_backend.fields.ObjectIdAutoField"
AUTH_USER_MODEL = "accounts.User"

# Use syncdb for all apps — avoids migration dependency issues with MongoDB
# (MongoDB doesn't benefit from SQL migration approach; collections are created on first use)
MIGRATION_MODULES = {
    "auth": None,
    "contenttypes": None,
    "sessions": None,
    "accounts": None,
    "employees": None,
    "time_tracking": None,
    "leaves": None,
    "payroll": None,
    "scheduling": None,
    "reports": None,
    "tasks": None,
    "live_locations": None,
}

# Silence mongodb.E001 for Django's own built-in models (auth, sessions) whose
# id field is inherited BigAutoField. Our custom models all use ObjectIdAutoField.
SILENCED_SYSTEM_CHECKS = [
    "mongodb.E001",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "60"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

CORS_ALLOWED_ORIGINS = [
    o
    for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174").split(",")
    if o
]
CORS_ALLOW_CREDENTIALS = True

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Monkey-patch Django's post_migrate signal functions that crash with MongoDB
# because they assume models have integer primary keys before saving.
try:
    from django.contrib.auth import management as auth_management
    from django.contrib.contenttypes import management as ct_management
    
    def noop_post_migrate(*args, **kwargs):
        pass
        
    auth_management.create_permissions = noop_post_migrate
    ct_management.update_contenttypes = noop_post_migrate
except ImportError:
    pass
