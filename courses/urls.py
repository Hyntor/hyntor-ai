"""Routes for course membership.

Both are POST-only and change data, which is why neither is a link. Opening a course's tutor lives
in tutor/urls.py, next to the hand-off code it depends on.
"""

from django.urls import path

from courses import views

urlpatterns = [
    path("courses/join/", views.join_course, name="course-join"),
    path("courses/leave/", views.leave_course, name="course-leave"),
]
