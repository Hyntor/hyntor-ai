"""Session tokens. The cookie holds a random token; the database holds only its SHA-256 hash (ADR-0007)."""

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone

from accounts.models import Session, User

TOKEN_BYTES = 32  # 256 bits


def hash_token(token: str) -> str:
    """The value stored for a session token.

    SHA-256 rather than Argon2: this is a 256-bit random value, not a guessable password, so a
    fast hash is enough and keeps every request cheap. The point is that a stolen database row
    cannot be replayed as a cookie.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(user: User) -> tuple[Session, str]:
    """Create a session row and return it with the raw token, which only the cookie ever holds."""
    token = secrets.token_hex(TOKEN_BYTES)
    session = Session.objects.create(
        user=user,
        token_hash=hash_token(token),
        expires_at=timezone.now() + timedelta(days=settings.SESSION_TTL_DAYS),
    )
    return session, token


def user_for_token(token: str) -> User | None:
    """The signed-in user, or None when the token is unknown or the session has expired (A4)."""
    session = (
        Session.objects.select_related("user", "user__university")
        .filter(token_hash=hash_token(token), expires_at__gt=timezone.now())
        .first()
    )
    return session.user if session else None


def end_session(token: str) -> None:
    """Delete the session row, so the old cookie is refused afterwards (A6)."""
    Session.objects.filter(token_hash=hash_token(token)).delete()


def set_session_cookie(response: HttpResponse, token: str) -> None:
    """Put the signed-in cookie on a response.

    HttpOnly keeps JavaScript away from the token, SameSite=Lax stops another site posting as this
    user, and Secure is on everywhere except local development, where there is no HTTPS.
    """
    response.set_cookie(
        settings.SESSION_COOKIE_NAME,
        token,
        max_age=settings.SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="Lax",
        secure=not settings.DEBUG,
    )


def clear_session_cookie(response: HttpResponse) -> None:
    """Remove the cookie on sign-out. The session row is deleted separately, by end_session."""
    response.delete_cookie(settings.SESSION_COOKIE_NAME)
