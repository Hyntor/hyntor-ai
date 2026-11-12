"""Hand-off into the Streamlit tutor.

The tutor runs as its own service, so Django does not render the chat. It checks that the visitor is
signed in, mints a short-lived signed token saying who they are, and sends the browser on with it.
See tutor_chat/handoff.py for the token format.
"""

from urllib.parse import quote

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from courses.models import Enrollment
from courses.terms import current_term
from tutor_chat.handoff import make_token


def tutor_chat(request: HttpRequest) -> HttpResponse:
    """Open the tutor with no course attached.

    Checks sign-in, then that the email address is confirmed - every reply costs AI quota, so a
    self-registered account that has proved nothing does not get in. Then mints a short-lived
    signed token and sends the browser to the Streamlit service.
    """
    # Signing in is the whole point of the hand-off: an anonymous visitor gets no token.
    if not request.user:
        return redirect("login")

    # Signed in is not enough. Anyone can create an account at a registered domain, and nothing has
    # checked that they can read mail at that address. Every reply here spends the team's AI quota,
    # so the tutor is the one place that requires a verified address (T6, N9). The rest of the site
    # stays open to unverified accounts.
    if not request.user.is_verified:
        return render(request, "tutor/verification_required.html", status=403)

    # No tutor service configured (local development, or before the second service is deployed).
    # Say so plainly rather than redirecting to an empty address (G6).
    if not settings.TUTOR_CHAT_URL:
        return render(request, "tutor/not_configured.html", status=503)

    token = make_token(
        settings.HANDOFF_SECRET,
        user_id=request.user.pk,
        email=request.user.email,
        display_name=request.user.display_name,
    )
    return redirect(f"{settings.TUTOR_CHAT_URL}?t={quote(token)}")


@require_http_methods(["GET"])
def course_tutor(request: HttpRequest, course_id: int) -> HttpResponse:
    """Open the tutor for one course.

    Same hand-off as tutor_chat, with the course added to the signed token. A teammate is building
    the per-course tutor pages on the Streamlit side; this view is the seam they read `course_id`
    and `course_code` from, and it guarantees the person is actually enrolled before issuing one.
    """
    if not request.user:
        return redirect("login")
    if not request.user.is_verified:
        return render(request, "tutor/verification_required.html", status=403)

    # Enrolled this term, at this university. A guessed id gets a 404, not a token.
    enrollment = get_object_or_404(
        Enrollment.objects.select_related("course"),
        user=request.user,
        course_id=course_id,
        course__university=request.user.university,
        term=current_term(),
    )

    if not settings.TUTOR_CHAT_URL:
        return render(request, "tutor/not_configured.html", status=503)

    token = make_token(
        settings.HANDOFF_SECRET,
        user_id=request.user.pk,
        email=request.user.email,
        display_name=request.user.display_name,
        course_id=enrollment.course.pk,
        course_code=enrollment.course.code,
    )
    return redirect(f"{settings.TUTOR_CHAT_URL}?t={quote(token)}")
