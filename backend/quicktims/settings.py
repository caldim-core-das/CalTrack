from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
import os

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

# ---------------------------------------------------------------------------
# Database Configuration - django-tenants + PostgreSQL (Supabase)
# ---------------------------------------------------------------------------

SHARED_APPS = [
    "django_tenants",  # mandatory
    "companies",  # you must list the app where your tenant model is in both shared and tenant
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "accounts",  # users are shared
    "corsheaders",
    "rest_framework",
]

TENANT_APPS = [
    "django.contrib.contenttypes", # contenttypes must be in both
    "employees",
    "time_tracking",
    "leaves",
    "payroll",
    "scheduling",
    "reports",
    "tasks",
    "live_locations",
]

INSTALLED_APPS = list(set(SHARED_APPS + TENANT_APPS))

TENANT_MODEL = "companies.Company"
TENANT_DOMAIN_MODEL = "companies.Domain"

MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware", # must be at the top
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "companies.middleware.CompanyMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Note: CompanyMiddleware is replaced by TenantMainMiddleware for DB routing.
# If you still need specific logic from companies.middleware, keep it after TenantMainMiddleware.

DATABASE_ROUTERS = (
    'django_tenants.routers.TenantSyncRouter',
)

DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": os.getenv("DB_NAME", "postgres"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "db.supabase.co"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

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

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# Use syncdb for all apps — avoids migration dependency issues with MongoDB
# (MongoDB doesn't benefit from SQL migration approach; collections are created on first use)
# MIGRATION_MODULES = {
#     "auth": None,
#     "contenttypes": None,
#     "sessions": None,
#     "accounts": None,
#     "employees": None,
#     "time_tracking": None,
#     "leaves": None,
#     "payroll": None,
#     "scheduling": None,
#     "reports": None,
#     "tasks": None,
#     "live_locations": None,
#     "companies": None,
# }

# Silence mongodb.E001 for Django's own built-in models (auth, sessions) whose
# id field is inherited BigAutoField. Our custom models all use ObjectIdAutoField.
SILENCED_SYSTEM_CHECKS = []

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


