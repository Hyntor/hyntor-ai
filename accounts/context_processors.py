"""Makes the signed-in user available to every template as `current_user`."""

from django.http import HttpRequest


def current_user(request: HttpRequest) -> dict[str, object]:
    """Listed in TEMPLATES in settings.py, so every template gets this without each view passing
    the user in. None when signed out, which is what the templates branch on."""
    return {"current_user": getattr(request, "user", None)}
