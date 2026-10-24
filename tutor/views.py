"""Hand-off into the Streamlit tutor.

The tutor runs as its own service, so Django does not render the chat. It checks that the visitor is
signed in, mints a short-lived signed token saying who they are, and sends the browser on with it.
See tutor_chat/handoff.py for the token format.
"""

from urllib.parse import quote

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render

from tutor_chat.handoff import make_token


def tutor_chat(request: HttpRequest) -> HttpResponse:
    # Signing in is the whole point of the hand-off: an anonymous visitor gets no token.
    if not request.user:
        return redirect("login")

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
