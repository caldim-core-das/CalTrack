from datetime import timedelta
from pathlib import Path
import os
import sys
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Prevent loading remote Supabase dotenv when running pytest / django tests
if "test" not in "".join(sys.argv) and not os.getenv("DJANGO_TESTING"):
    load_dotenv(BASE_DIR / ".env", override=True)

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [h for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]

# ── Subpath / Reverse-proxy settings ─────────────────────────────────────────
# Required when Django is served under a subpath (e.g. /Caltrack/) behind Nginx.
# Set FORCE_SCRIPT_NAME=/Caltrack in production .env
FORCE_SCRIPT_NAME = os.getenv("FORCE_SCRIPT_NAME", "")
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SHARED_APPS = [
    "daphne",
    "django_tenants",
    "companies",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "accounts",
    "corsheaders",
    "rest_framework",
    "channels",
    "django_celery_beat",
]


TENANT_APPS = [
    "django.contrib.contenttypes",
    "employees",
    "time_tracking",
    "leaves",
    "payroll",
    "scheduling",
    "reports",
    "tasks",
    "live_locations",
    "compliance",
    "settings_hub",
    "inventory",
    "mileage",
]

# Preserve order and ensure daphne is at the very beginning for ASGI/WebSocket support
_installed = []
for app in SHARED_APPS + TENANT_APPS:
    if app not in _installed:
        _installed.append(app)
if "daphne" in _installed:
    _installed.remove("daphne")
    _installed.insert(0, "daphne")
INSTALLED_APPS = _installed

TENANT_MODEL = "companies.Company"
TENANT_DOMAIN_MODEL = "companies.Domain"

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django_tenants.middleware.main.TenantMainMiddleware",
    "django.middleware.gzip.GZipMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "compliance.middleware.AuditRequestMiddleware",
    "companies.middleware.CompanyMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

SHOW_PUBLIC_IF_NO_TENANT_FOUND = True

# ---------------------------------------------------------------------------
# Database Configuration - PostgreSQL (Production) or SQLite (Local Dev)
# ---------------------------------------------------------------------------

USE_POSTGRES = os.getenv("DB_NAME") or os.getenv("DB_HOST")

if USE_POSTGRES:
    DATABASE_ROUTERS = ('django_tenants.routers.TenantSyncRouter',)

    # Build OPTIONS dynamically — sslmode is opt-in via DB_SSLMODE env var.
    # Docker local PostgreSQL: leave DB_SSLMODE unset (no SSL).
    # Supabase / any remote TLS host: set DB_SSLMODE=require in .env.
    _db_options = {}
    _sslmode = os.getenv("DB_SSLMODE", "")
    if _sslmode:
        _db_options["sslmode"] = _sslmode
    _stmt_timeout = os.getenv("DB_STATEMENT_TIMEOUT", "")
    if _stmt_timeout:
        _db_options["options"] = f"-c statement_timeout={_stmt_timeout}"

    DATABASES = {
        "default": {
            "ENGINE": "django_tenants.postgresql_backend",
            "NAME": os.getenv("DB_NAME", "caltrack"),
            "USER": os.getenv("DB_USER", "caltrack_user"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "OPTIONS": _db_options,
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "0")),
            "CONN_HEALTH_CHECKS": True,
        }
    }
else:
    # Local Development Fallback to SQLite
    DATABASE_ROUTERS = ()
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
    # Remove tenant middleware if using SQLite
    MIDDLEWARE = [m for m in MIDDLEWARE if "django_tenants" not in m]
    # Remove django_tenants from installed apps if using SQLite
    if "django_tenants" in INSTALLED_APPS:
        INSTALLED_APPS.remove("django_tenants")



ROOT_URLCONF = "quicktims.urls"
APPEND_SLASH = False  # Prevents RuntimeError on POST to non-slash URLs

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
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

# Email Configuration
EMAIL_HOST = os.getenv("EMAIL_HOST")
if EMAIL_HOST:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
    DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
    DEFAULT_FROM_EMAIL = "noreply@caltrack.com"

AUTHENTICATION_BACKENDS = [
    "accounts.backends.EmailOrUsernameModelBackend",
    "django.contrib.auth.backends.ModelBackend",
]

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

# ── Caching ───────────────────────────────────────────────────────────────────
# Production: swap the backend for Redis using the CACHE_URL env var.
# Dev / default: in-process local-memory cache (zero config).
_cache_url = os.getenv("CACHE_URL")
if _cache_url:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": _cache_url,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "SOCKET_CONNECT_TIMEOUT": 2,
                "SOCKET_TIMEOUT": 2,
                "IGNORE_EXCEPTIONS": True,  # Degrade gracefully if Redis is down
            },
            "TIMEOUT": 300,  # 5 min default TTL
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "quicktims-default",
            "TIMEOUT": 300,
        }
    }

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # Cookie-first auth — also accepts Bearer header for API clients / mobile.
        "accounts.authentication.CookieJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    # Throttle anonymous and authenticated endpoints to protect DB
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON", "60/minute"),
        "user": os.getenv("THROTTLE_USER", "300/minute"),
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "480"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ── httpOnly JWT Cookie settings ─────────────────────────────────────────────
AUTH_COOKIE          = "qt_access"         # access token cookie name
AUTH_COOKIE_REFRESH  = "qt_refresh"        # refresh token cookie name
AUTH_COOKIE_SECURE   = not DEBUG           # HTTPS-only in production; False in dev
# "Lax" is required for cross-origin dev (frontend:5173 → backend:8000).
# In production with same domain, change back to "Strict" via env var.
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax" if DEBUG else "Strict")

# ── CORS — must name origins explicitly when credentials=True ────────────────
# CORS_ALLOW_ALL_ORIGINS + CORS_ALLOW_CREDENTIALS together are rejected by browsers.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    # Local development
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    # Production VPS
    "https://caldimproducts.com",
    "http://caldimproducts.com",
    "https://www.caldimproducts.com",
    "http://www.caldimproducts.com",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://.*\.localhost:517[3-5]$",
    r"^http://.*\.127\.0\.0\.1:517[3-5]$",
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = [
    # Local development
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://*.localhost:5173",
    "http://*.localhost:5174",
    "http://*.localhost:5175",
    "http://*.127.0.0.1:5173",
    "http://*.127.0.0.1:5174",
    "http://*.127.0.0.1:5175",
    # Production VPS
    "https://caldimproducts.com",
    "http://caldimproducts.com",
    "https://www.caldimproducts.com",
    "http://www.caldimproducts.com",
]


MEDIA_URL = os.getenv("MEDIA_URL", "/media/")
MEDIA_ROOT = BASE_DIR / "media"

STATIC_ROOT = BASE_DIR / "staticfiles"

# ── Django Channels ──────────────────────────────────────────────────────────
if DEBUG:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [(os.getenv("REDIS_HOST", "127.0.0.1"), int(os.getenv("REDIS_PORT", "6379")))],
                "capacity": 1500,
                "expiry": 10,
            },
        },
    }

# ── Email Settings for Password Reset ──────────────────────────────────────────
if os.getenv("EMAIL_HOST_USER") and os.getenv("EMAIL_HOST_PASSWORD"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = "smtp.gmail.com"
    EMAIL_PORT = 587
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
    EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
    DEFAULT_FROM_EMAIL = EMAIL_HOST_USER
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend" # Prints to console for dev

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── Celery ────────────────────────────────────────────────────────────────────
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://127.0.0.1:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "True") == "True"

