"""Makes the signed-in user available to every template as `current_user`."""

from django.http import HttpRequest


def current_user(request: HttpRequest) -> dict[str, object]:
    return {"current_user": getattr(request, "user", None)}
