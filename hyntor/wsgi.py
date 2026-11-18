"""
WSGI config for hyntor project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""

# WSGI is the standard interface between a web server and a Python web application, so the same
# Django app runs under any WSGI server. Render runs it with gunicorn (see render.yaml).
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hyntor.settings")

application = get_wsgi_application()
