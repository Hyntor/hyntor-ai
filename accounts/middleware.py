"""Resolves the session cookie into request.user once per request."""

from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from accounts.sessions import user_for_token


class SessionMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        token = request.COOKIES.get(settings.SESSION_COOKIE_NAME)
        # None when signed out, so views and templates test `if request.user`.
        request.user = user_for_token(token) if token else None
        return self.get_response(request)
