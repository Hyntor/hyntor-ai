"""Routes into the AI tutor.

Neither view renders a chat. The tutor is a separate Streamlit service, so both of these check who
is asking and then redirect with a signed token. /tutor/ opens it with no course attached;
/courses/<id>/tutor/ opens it for one course the student is enrolled in.
"""

from django.urls import path

from tutor import views

urlpatterns = [
    path("tutor/", views.tutor_chat, name="tutor-chat"),
    path("courses/<int:course_id>/tutor/", views.course_tutor, name="course-tutor"),
    path("api/tutor/sessions/", api.sessions, name="tutor-sessions"),
    path("api/tutor/sessions/<int:session_id>/", api.session_detail, name="tutor-session"),
    path("api/tutor/sessions/<int:session_id>/messages/", api.send, name="tutor-send"),
]
