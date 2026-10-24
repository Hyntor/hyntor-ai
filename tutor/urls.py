from django.urls import path

from tutor import views

urlpatterns = [
    path("tutor/", views.tutor_chat, name="tutor-chat"),
]
