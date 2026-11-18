"""
ASGI config for hyntor project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

# Django generates both asgi.py and wsgi.py for deployment; Hyntor only uses wsgi (see render.yaml).
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hyntor.settings")

application = get_asgi_application()
