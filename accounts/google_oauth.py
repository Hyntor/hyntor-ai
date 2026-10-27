"""Sign in with Google, using OpenID Connect's authorization code flow.

The flow, and why each piece exists:

    1. The user clicks "Continue with Google". We send them to Google with a `state` and a `nonce`
       that we also store in a signed, short-lived cookie.
    2. Google authenticates them and redirects back with a one-time `code`.
    3. We check `state` against the cookie. This is what stops someone else's login being completed
       in this browser (CSRF on the callback).
    4. We swap the code for an ID token, server to server, using the client secret. The code alone
       is useless to anyone who does not hold that secret.
    5. We verify the ID token's signature against Google's public keys, then check `nonce`, which
       ties the token to the request we started in step 1.

Google is used here for two things at once: proving who the person is, and proving they can read
mail at that address. An `email_verified` claim from Google is what sets `email_verified_at`, so a
Google sign-in needs no confirmation email of its own.

Google is NOT used to decide who may join. The email's domain still has to be a registered
university (A1), exactly as it does for a password signup.
"""

import secrets
from dataclasses import dataclass

import requests
from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"  # noqa: S105 - a public URL, not a secret

# openid and email are what we need; profile supplies a display name so the user does not type one.
SCOPES = "openid email profile"

TOKEN_REQUEST_TIMEOUT_SECONDS = 10


class GoogleAuthError(Exception):
    """Google could not be used to identify this person. The message is safe to show a user."""


@dataclass(frozen=True)
class GoogleIdentity:
    """What Google told us about the person, after the ID token was verified."""

    subject: str  # Google's stable id for the account; never reused, unlike an email address.
    email: str
    email_verified: bool
    display_name: str


def is_configured() -> bool:
    """False when no Google credentials are set, so the button can be hidden rather than broken."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def new_state_and_nonce() -> tuple[str, str]:
    """Two unguessable values: `state` ties the callback to this browser, `nonce` to this request."""
    return secrets.token_urlsafe(32), secrets.token_urlsafe(32)


def build_authorization_url(redirect_uri: str, state: str, nonce: str) -> str:
    """Where to send the browser to start the sign-in."""
    parameters = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "nonce": nonce,
        # Ask Google to show the account chooser rather than silently reusing one signed-in account.
        "prompt": "select_account",
    }
    return f"{AUTHORIZATION_ENDPOINT}?{requests.compat.urlencode(parameters)}"


def exchange_code_for_identity(code: str, redirect_uri: str, expected_nonce: str) -> GoogleIdentity:
    """Swap the one-time code for a verified identity. Raises GoogleAuthError if anything is off."""
    try:
        response = requests.post(
            TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=TOKEN_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise GoogleAuthError("Could not reach Google. Try again in a moment.") from exc

    if response.status_code != 200:
        # Usually a redirect_uri that does not match the one registered in Google Cloud Console.
        raise GoogleAuthError("Google refused the sign-in request.")

    raw_id_token = response.json().get("id_token")
    if not raw_id_token:
        raise GoogleAuthError("Google did not return an identity.")

    try:
        # Checks the signature against Google's published keys, and that the token was issued for
        # this client and has not expired. Anything wrong raises.
        claims = google_id_token.verify_oauth2_token(
            raw_id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        raise GoogleAuthError("Google's response could not be verified.") from exc

    # Ties this token to the request we started. Without it, a token obtained elsewhere for the same
    # client could be replayed into this callback.
    if claims.get("nonce") != expected_nonce:
        raise GoogleAuthError("Google's response did not match this sign-in attempt.")

    email = (claims.get("email") or "").strip().lower()
    if not email:
        raise GoogleAuthError("Google did not share an email address.")

    return GoogleIdentity(
        subject=claims["sub"],
        email=email,
        email_verified=bool(claims.get("email_verified")),
        # Fall back to the part before the @ when the profile has no name on it.
        display_name=(claims.get("name") or email.partition("@")[0]).strip(),
    )
