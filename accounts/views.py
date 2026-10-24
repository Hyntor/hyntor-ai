"""Sign in and sign out. ACC-2 (#15) adds route guards and renewal; ACC-4 (#17) adds throttling."""

from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_http_methods

from accounts.models import User
from accounts.passwords import dummy_verify, verify_password
from accounts.sessions import clear_session_cookie, end_session, set_session_cookie, start_session

# One message for an unknown email and for a wrong password alike, so neither reveals which (T1).
SIGN_IN_FAILED = "Email or password is incorrect."


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user:
        return redirect("home")

    if request.method == "GET":
        return render(request, "accounts/login.html")

    email = User.normalize_email(request.POST.get("email", ""))
    password = request.POST.get("password", "")

    user = User.objects.filter(email=email).first()
    if user is None:
        # Hash anyway, so the response time does not reveal which addresses exist (T1).
        dummy_verify(password)
        return render(request, "accounts/login.html", {"error": SIGN_IN_FAILED, "email": email}, status=401)

    if not verify_password(user.password_hash, password):
        return render(request, "accounts/login.html", {"error": SIGN_IN_FAILED, "email": email}, status=401)

    _session, token = start_session(user)
    response = redirect("home")
    set_session_cookie(response, token)
    return response


@require_http_methods(["POST"])
def logout_view(request: HttpRequest) -> HttpResponse:
    token = request.COOKIES.get("hyntor_session")
    if token:
        end_session(token)
    response = redirect("login")
    clear_session_cookie(response)
    return response
