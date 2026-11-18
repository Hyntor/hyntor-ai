"""
WSGI config for hyntor project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/
"""
#WSGI is a standard interface between web servers and Python web applications or frameworks. It allows for a consistent way to deploy Python web applications across different web servers.
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hyntor.settings")

application = get_wsgi_application()
