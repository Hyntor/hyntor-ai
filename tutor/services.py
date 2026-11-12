from collections.abc import Callable

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404

from accounts.models import User
from courses.models import Enrollment
from courses.terms import current_term
from tutor.models import MessageAuthorRole, TutorMessage, TutorSession

ReplyFor = Callable[[TutorSession, list[dict]], str]


def start_session(user: User, course_id: int, mode: str) -> TutorSession:
    """Open a conversation about a course the student is enrolled in this term."""
    enrollment = get_object_or_404(
        Enrollment.objects.select_related("course"),
        user=user,
        course_id=course_id,
        course__university=user.university,
        term=current_term(),
    )
    return TutorSession.objects.create(course=enrollment.course, student=user, mode=mode)


def get_own_session(user: User, session_id: int) -> TutorSession:
    """The session, or 404 if it does not exist, or 403 if it belongs to someone else"""
    session = get_object_or_404(TutorSession, pk=session_id)
    if session.student_id != user.pk:
        raise PermissionDenied
    return session


def send_message(user: User, session_id: int, text: str, reply_for: ReplyFor) -> list[TutorMessage]:
    with transaction.atomic():
        session = get_object_or_404(TutorSession.objects.select_for_update(), pk=session_id)
        if session.student_id != user.pk:
            raise PermissionDenied

        last = session.messages.aggregate(last=Max("ordinal"))["last"] or 0
        history = [{"role": m.author_role, "content": m.body} for m in session.messages.order_by("ordinal")]
        history.append({"role": MessageAuthorRole.STUDENT, "content": text})

        student_message = TutorMessage.objects.create(
            tutor_session=session, ordinal=last + 1, author_role=MessageAuthorRole.STUDENT, body=text
        )
        assistant_message = TutorMessage.objects.create(
            tutor_session=session,
            ordinal=last + 2,
            author_role=MessageAuthorRole.ASSISTANT,
            body=reply_for(session, history),
        )

        # auto_now only fires inside save(), and only for fields named in update_fields
        session.save(update_fields=["last_activity_at"])

    return [student_message, assistant_message]
