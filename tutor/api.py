import json

from django.http import HttpRequest, JsonResponse
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from tutor import provider, services
from tutor.forms import SendMessageForm, StartSessionForm
from tutor.models import TutorMessage, TutorSession


def _session_json(session: TutorSession) -> dict:
    return {
        "id": session.pk,
        "course_id": session.course_id,
        "mode": session.mode,
        "started_at": session.started_at.isoformat(),
        "last_activity_at": session.last_activity_at.isoformat(),
    }


def _message_json(message: TutorMessage) -> dict:
    return {
        "ordinal": message.ordinal,
        "role": message.author_role,
        "text": message.body,
        "created_at": message.created_at.isoformat(),
    }


def _body(request: HttpRequest) -> dict | None:
    """The request's JSON object, or None if it is not one."""
    try:
        data = json.loads(request.body or b"{}")
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _unauthenticated() -> JsonResponse:
    return JsonResponse({"error": "Sign in first."}, status=401)


def _refused(form) -> JsonResponse:
    return JsonResponse({"errors": form.errors.get_json_data()}, status=400)


@require_http_methods(["GET", "POST"])
def sessions(request: HttpRequest) -> JsonResponse:
    if not request.user:
        return _unauthenticated()
    if request.method == "GET":
        mine = TutorSession.objects.filter(student=request.user).order_by("-last_activity_at", "-pk")
        return JsonResponse({"sessions": [_session_json(s) for s in mine]})

    form = StartSessionForm(_body(request) or {})
    if not form.is_valid():
        return _refused(form)
    session = services.start_session(request.user, **form.cleaned_data)
    return JsonResponse(_session_json(session), status=201)


@require_GET
def session_detail(request: HttpRequest, session_id: int) -> JsonResponse:
    if not request.user:
        return _unauthenticated()
    session = services.get_own_session(request.user, session_id)
    messages = session.messages.order_by("ordinal")
    return JsonResponse({**_session_json(session), "messages": [_message_json(m) for m in messages]})


@require_POST
def send(request: HttpRequest, session_id: int) -> JsonResponse:
    if not request.user:
        return _unauthenticated()
    form = SendMessageForm(_body(request) or {})
    if not form.is_valid():
        return _refused(form)
    sent = services.send_message(request.user, session_id, form.cleaned_data["text"], provider.reply_for)
    return JsonResponse({"messages": [_message_json(m) for m in sent]}, status=201)
