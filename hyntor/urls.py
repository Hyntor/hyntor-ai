from django.urls import include, path

from hyntor import views

urlpatterns = [
    path("", views.home, name="home"),
    path("", include("accounts.urls")),
    path("", include("tutor.urls")),
]
