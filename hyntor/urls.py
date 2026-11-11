"""Every URL the site answers on.

Each app owns its own urls.py and this file includes them, so a route lives beside the code that
serves it. They all mount at the root rather than under a prefix, because the paths students use
read better short: /login/, /signup/, /courses/join/.
"""

from django.urls import include, path

from hyntor import views

urlpatterns = [
    path("", views.home, name="home"),
    path("", include("accounts.urls")),
    path("", include("courses.urls")),
    path("", include("tutor.urls")),
]
