"""Django settings for Hyntor.

One settings file serves development and production (N10). SQLite is used when DATABASE_URL is unset;
CI and production set it to PostgreSQL. See docs/adr/0010-stack-python-django.md.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# One .env at the repository root serves the site, the management commands and the tests.
load_dotenv(BASE_DIR / ".env")

# Development default. Production must set DJANGO_SECRET_KEY; deploy checks refuse to start without it.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-do-not-use-in-production")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

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

# Uploaded materials (ADR-0005). Local disk in development; blob storage in production.
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR") or BASE_DIR / ".storage")

# Session cookie (ADR-0007). ACC-2 (#15) owns renewal and the final lifetime.
SESSION_COOKIE_NAME = "hyntor_session"
SESSION_TTL_DAYS = 7

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600
