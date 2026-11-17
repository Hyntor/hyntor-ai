"""Routes for course membership and the course library.

Join and leave are POST-only and change data, which is why neither is a link. The library is the
course's own page (/courses/<id>/, per the M2 sitemap), and uploads post to its materials/ (LIB-1).
Opening a course's tutor lives in tutor/urls.py, next to the hand-off code it depends on.
"""

from django.urls import path

from courses import views

urlpatterns = [
    path("courses/join/", views.join_course, name="course-join"),
    path("courses/leave/", views.leave_course, name="course-leave"),
    path("courses/<int:course_id>/", views.course_library, name="course-library"),
    path("courses/<int:course_id>/materials/", views.upload_material, name="material-upload"),
]
