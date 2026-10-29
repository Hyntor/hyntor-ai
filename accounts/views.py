"""Sign up, sign in and sign out. ACC-2 (#15) adds route guards and renewal; ACC-4 (#17) adds throttling."""

from django.conf import settings
from django.core import signing
from django.db import IntegrityError, transaction
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from django.utils.crypto import constant_time_compare
from django.views.decorators.http import require_http_methods

from accounts import google_oauth
from accounts.models import University, User
from accounts.passwords import (
    MIN_PASSWORD_LENGTH,
    UNUSABLE_PASSWORD_HASH,
    dummy_verify,
    hash_password,
    validate_password,
    verify_password,
)
from accounts.sessions import clear_session_cookie, end_session, set_session_cookie, start_session

# One message for an unknown email and for a wrong password alike, so neither reveals which (T1).
SIGN_IN_FAILED = "Email or password is incorrect."

UNKNOWN_DOMAIN = (
    "Hyntor accounts are tied to a registered university. We do not recognise that email domain yet - "
    "ask an administrator to register it."
)
# A duplicate signup does reveal that the address is taken (T1). That is a deliberate trade: the
# alternative is to accept the form and send nothing, which strands a real person who simply forgot
# they had signed up. The address is already discoverable inside a university anyway.
EMAIL_TAKEN = "An account already exists for that email address. Sign in instead."


@require_http_methods(["GET", "POST"])
def login_view(request: HttpRequest) -> HttpResponse:
    if request.user:
        return redirect("home")

    if request.method == "GET":
        return render(request, "accounts/login.html", {"google_enabled": google_oauth.is_configured()})

    email = User.normalize_email(request.POST.get("email", ""))
    password = request.POST.get("password", "")
    failed = {"error": SIGN_IN_FAILED, "email": email, "google_enabled": google_oauth.is_configured()}

    user = User.objects.filter(email=email).first()
    if user is None:
        # Hash anyway, so the response time does not reveal which addresses exist (T1).
        dummy_verify(password)
        return render(request, "accounts/login.html", failed, status=401)

    # An account created through Google has no usable password, so this always fails - and it fails
    # with the same message as a wrong password, revealing nothing about how the account signs in.
    if not verify_password(user.password_hash, password):
        return render(request, "accounts/login.html", failed, status=401)

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


@require_http_methods(["GET", "POST"])
def signup_view(request: HttpRequest) -> HttpResponse:
    """Create an account, if the email belongs to a registered university (ACC-3, #16).

    A refused signup creates nothing. Every failure path returns before any row is written, and the
    one write that can race another request is wrapped in a transaction.
    """
    if request.user:
        return redirect("home")

    context = {"min_password_length": MIN_PASSWORD_LENGTH, "google_enabled": google_oauth.is_configured()}
    if request.method == "GET":
        return render(request, "accounts/signup.html", context)

    email = User.normalize_email(request.POST.get("email", ""))
    display_name = request.POST.get("display_name", "").strip()
    password = request.POST.get("password", "")
    # Keep what they typed so a refused form does not make them start again. The password is never
    # sent back to the browser.
    context |= {"email": email, "display_name": display_name}

    def refuse(message: str) -> HttpResponse:
        return render(request, "accounts/signup.html", context | {"error": message}, status=400)

    if not display_name:
        return refuse("Enter the name you want other students to see.")

    # Exactly one @, and something on each side of it. "a@b@example.edu" is refused here.
    local, separator, domain = email.partition("@")
    if not separator or not local or "@" in domain:
        return refuse("Enter a valid email address.")

    password_problem = validate_password(password)
    if password_problem:
        return refuse(password_problem)

    university = University.objects.filter(email_domain=University.normalize_domain(domain)).first()
    if university is None:
        # Refused before anything is created, which is the point of A2: no orphan rows.
        return refuse(UNKNOWN_DOMAIN)

    if User.objects.filter(email=email).exists():
        return refuse(EMAIL_TAKEN)

    try:
        with transaction.atomic():
            # Fields are named one by one rather than passed through from the form, so a posted
            # "platform_role": "admin" is ignored instead of making an administrator (T2).
            user = User.objects.create(
                university=university,
                email=email,
                display_name=display_name,
                password_hash=hash_password(password),
            )
    except IntegrityError:
        # Another request created the same address between the check above and this write.
        return refuse(EMAIL_TAKEN)

    _session, token = start_session(user)
    response = redirect("home")
    set_session_cookie(response, token)
    return response


# --------------------------------------------------------------------------- sign in with Google

# Holds `state` and `nonce` between leaving for Google and coming back. A signed cookie rather than
# a database row: it is needed for seconds, by one browser, and nothing else ever reads it.
GOOGLE_FLOW_COOKIE = "hyntor_google_flow"
GOOGLE_FLOW_SALT = "accounts.google.flow"
GOOGLE_FLOW_MAX_AGE_SECONDS = 600

GOOGLE_SIGN_IN_FAILED = "Could not finish signing in with Google. Please try again."


def _google_redirect_uri(request: HttpRequest) -> str:
    """The callback address, built from the request so one setting serves local and deployed runs.

    It has to match an Authorised redirect URI in Google Cloud Console character for character.
    """
    return request.build_absolute_uri(reverse("google-callback"))


@require_http_methods(["GET"])
def google_start_view(request: HttpRequest) -> HttpResponse:
    """Send the browser to Google, remembering what we need to check when it comes back."""
    if request.user:
        return redirect("home")
    if not google_oauth.is_configured():
        return render(request, "accounts/google_not_configured.html", status=503)

    state, nonce = google_oauth.new_state_and_nonce()
    response = redirect(google_oauth.build_authorization_url(_google_redirect_uri(request), state, nonce))
    response.set_cookie(
        GOOGLE_FLOW_COOKIE,
        signing.dumps({"state": state, "nonce": nonce}, salt=GOOGLE_FLOW_SALT),
        max_age=GOOGLE_FLOW_MAX_AGE_SECONDS,
        httponly=True,
        samesite="Lax",  # Must survive Google's redirect back, so not Strict.
        secure=not settings.DEBUG,
    )
    return response


@require_http_methods(["GET"])
def google_callback_view(request: HttpRequest) -> HttpResponse:
    """Where Google sends the browser back. Creates or signs in the account."""
    if request.user:
        return redirect("home")

    def refuse(message: str, status: int = 400) -> HttpResponse:
        context = {"error": message, "google_enabled": google_oauth.is_configured()}
        response = render(request, "accounts/login.html", context, status=status)
        response.delete_cookie(GOOGLE_FLOW_COOKIE)
        return response

    # The user pressed Cancel, or Google declined. Not an error worth alarming them about.
    if request.GET.get("error"):
        return refuse("Google sign-in was cancelled.", status=400)

    try:
        flow = signing.loads(
            request.COOKIES.get(GOOGLE_FLOW_COOKIE, ""),
            salt=GOOGLE_FLOW_SALT,
            max_age=GOOGLE_FLOW_MAX_AGE_SECONDS,
        )
    except signing.BadSignature:
        # Missing, tampered with, or older than ten minutes.
        return refuse("That Google sign-in link has expired. Please start again.")

    # The CSRF check for this callback: a response started in another browser cannot finish here.
    if not request.GET.get("state") or not constant_time_compare(request.GET["state"], flow["state"]):
        return refuse(GOOGLE_SIGN_IN_FAILED)

    code = request.GET.get("code")
    if not code:
        return refuse(GOOGLE_SIGN_IN_FAILED)

    try:
        identity = google_oauth.exchange_code_for_identity(code, _google_redirect_uri(request), flow["nonce"])
    except google_oauth.GoogleAuthError as exc:
        return refuse(str(exc))

    # Google confirms the address is theirs. Without that claim we know nothing more than a typed
    # email would tell us, so the whole point of this route is gone.
    if not identity.email_verified:
        return refuse("That Google account's email address is not confirmed.")

    domain = identity.email.rpartition("@")[2]
    university = University.objects.filter(email_domain=University.normalize_domain(domain)).first()
    if university is None:
        # Same rule as a password signup: Google proves who you are, not that you may join (A1).
        return refuse(UNKNOWN_DOMAIN, status=403)

    # Look for the Google id first. It is stable, so someone whose address changed is still
    # recognised as the same person rather than being handed a second account. Matching on email is
    # the fallback, and it is what links a Google sign-in to an existing password account.
    user = User.objects.filter(google_subject=identity.subject).first()
    if user is None:
        user = User.objects.filter(email=identity.email).first()

    if user is None:
        with transaction.atomic():
            user = User.objects.create(
                university=university,
                email=identity.email,
                display_name=identity.display_name or identity.email.partition("@")[0],
                # No password: this account signs in through Google only.
                password_hash=UNUSABLE_PASSWORD_HASH,
                email_verified_at=timezone.now(),
                google_subject=identity.subject,
            )
    else:
        changed = []
        if not user.google_subject:
            # First Google sign-in for an account that already existed. Remember the id now so the
            # next sign-in does not depend on the address still being the same.
            user.google_subject = identity.subject
            changed.append("google_subject")
        if not user.email_verified_at:
            # An existing password account proves itself by signing in with Google once. This is how
            # verification happens for everyone: there is no separate confirmation email.
            user.email_verified_at = timezone.now()
            changed.append("email_verified_at")
        if changed:
            user.save(update_fields=changed)

    _session, token = start_session(user)
    response = redirect("home")
    set_session_cookie(response, token)
    response.delete_cookie(GOOGLE_FLOW_COOKIE)
    return response
