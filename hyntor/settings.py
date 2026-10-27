"""Django settings for Hyntor.

One settings file serves development and production (N10). SQLite is used when DATABASE_URL is unset;
CI and production set it to PostgreSQL. See docs/adr/0010-stack-python-django.md.
"""

import os
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# One .env at the repository root serves the site, the management commands and the tests.
load_dotenv(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# `or` rather than a get() default: .env.example ships DJANGO_SECRET_KEY="", and a default only
# applies when the variable is absent, not when it is present and empty. Copying .env.example
# therefore produced an empty SECRET_KEY, which breaks CSRF and every signed value in the project.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or ""
if not SECRET_KEY:
    if not DEBUG:
        # Never fall back to a published key on a real deployment. Stop instead.
        raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG=0")
    SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"

ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()
]

CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()
]

# Render publishes the service's own hostname here. Reading it means the deployed site works without
# anyone copying the generated address into a setting by hand.
RENDER_HOSTNAME = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "")
if RENDER_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_HOSTNAME)
    CSRF_TRUSTED_ORIGINS.append(f"https://{RENDER_HOSTNAME}")

# One app per epic, so every module has an owner (DEL-5). django.contrib.auth is deliberately absent:
# Hyntor has its own User and Session models from the ERD, and hashes passwords with argon2-cffi.
INSTALLED_APPS = [
    "django.contrib.staticfiles",
    "accounts",
    "courses",
    "library",
    "tutor",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves static files in production. Render has no separate web server in front of Django.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Resolves the session cookie into request.user once per request.
    "accounts.middleware.SessionMiddleware",
]

ROOT_URLCONF = "hyntor.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "accounts.context_processors.current_user",
            ],
        },
    },
]

WSGI_APPLICATION = "hyntor.wsgi.application"

# SQLite needs no server, so a clean machine can run the site after one install (ADR-0011).
# CI and production set DATABASE_URL to PostgreSQL; nothing else differs.
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "dev.sqlite3"}}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        # In production: compress each file and put a content hash in its name, so a changed file is
        # never served from a stale browser cache. This reads a manifest that `collectstatic` writes,
        # so it only works after that command has run - which is why CI runs it before the tests.
        # In development there is no manifest, and files are served straight from static/.
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}

# Uploaded materials (ADR-0005). Local disk in development; blob storage in production.
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR") or BASE_DIR / ".storage")

# Session cookie (ADR-0007). ACC-2 (#15) owns renewal and the final lifetime.
SESSION_COOKIE_NAME = "hyntor_session"
SESSION_TTL_DAYS = 7

# The Streamlit tutor service (ADR-0011). Empty means "no tutor configured", and /tutor/ says so
# instead of redirecting nowhere (G6). On Render, TUTOR_CHAT_HOST is filled in from the other
# service, so neither address has to be copied by hand.
TUTOR_CHAT_HOST = os.environ.get("TUTOR_CHAT_HOST", "")
TUTOR_CHAT_URL = os.environ.get("TUTOR_CHAT_URL") or (f"https://{TUTOR_CHAT_HOST}" if TUTOR_CHAT_HOST else "")

# Sign in with Google (ADR-0012). Empty means the button is hidden and the rest of sign-in works
# normally. Create the credentials in Google Cloud Console and register the callback address:
#   http://localhost:8000/auth/google/callback/   (development)
#   https://<your-render-host>/auth/google/callback/   (production)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

# Shared with the tutor service; it signs the hand-off token that identifies the signed-in user.
# Falling back to SECRET_KEY keeps local development working with no extra setup. In production the
# two services are given the same generated value.
HANDOFF_SECRET = os.environ.get("HANDOFF_SECRET") or SECRET_KEY

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
