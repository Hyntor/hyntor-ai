"""The hand-off token that lets the Django site vouch for a signed-in user to the Streamlit tutor.

The two run as separate services on different hostnames, and `onrender.com` is on the Public Suffix
List, so a browser will not share one cookie between them. Instead Django mints a short-lived token
that says who the user is, signs it, and sends the browser to the tutor with the token in the URL.
The tutor checks the signature with the same secret and trusts the result.

    Django                                        Streamlit
    ------                                        ---------
    user is signed in
    make_token(secret, ...)  --- redirect --->    read_token(secret, ...)
                             ?t=<body>.<sig>      saved in st.session_state

Both sides import THIS file, so there is one implementation of the format, not two that can drift.
It uses only the standard library, so the Streamlit service does not need Django installed.

What the signature does and does not do:
  * It proves the token was made by something holding the shared secret, and that nobody edited it.
    Changing one character of the payload changes the signature, and the attacker cannot recompute
    it without the secret.
  * It does NOT encrypt. The payload is readable by anyone holding the URL, so it carries only an
    id, an email and a display name - never a password or a session cookie.
  * It does NOT prevent replay within its lifetime. Anyone who captures the URL inside the 60-second
    window can use it once. HTTPS protects the URL in transit; the short life limits the rest.
"""

import base64
import hmac
import json
import time
from hashlib import sha256

# Long enough to survive a redirect, short enough that a leaked URL is stale almost immediately.
DEFAULT_TTL_SECONDS = 60


class InvalidToken(Exception):
    """The token is missing, malformed, altered, or past its expiry."""


def _b64encode(raw: bytes) -> str:
    """URL-safe base64 with the '=' padding removed, so the token is safe in a query string."""
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _signature(secret: str, body: str) -> str:
    return _b64encode(hmac.new(secret.encode(), body.encode(), sha256).digest())


def make_token(
    secret: str,
    *,
    user_id: int | str,
    email: str,
    display_name: str,
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
    now: float | None = None,
) -> str:
    """Build a signed token identifying one user. Called by Django."""
    if not secret:
        raise ValueError("A hand-off secret is required")

    issued_at = time.time() if now is None else now
    payload = {
        "sub": str(user_id),
        "email": email,
        "name": display_name,
        "exp": int(issued_at + ttl_seconds),
    }
    # sort_keys and the compact separators keep the encoding identical on both sides.
    body = _b64encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    return f"{body}.{_signature(secret, body)}"


def read_token(secret: str, token: str, *, now: float | None = None) -> dict:
    """Check a token and return its payload. Raises InvalidToken for anything suspect.

    Called by Streamlit. Every failure raises the same exception, so a caller cannot tell a forged
    signature from an expired one.
    """
    if not secret:
        raise ValueError("A hand-off secret is required")
    if not token or not isinstance(token, str):
        raise InvalidToken("No token supplied")

    parts = token.split(".")
    if len(parts) != 2:
        raise InvalidToken("Token is malformed")
    body, signature = parts

    # compare_digest takes the same time whichever character differs, so an attacker cannot learn
    # the correct signature one character at a time by measuring how long the check takes.
    if not hmac.compare_digest(signature, _signature(secret, body)):
        raise InvalidToken("Signature does not match")

    try:
        payload = json.loads(_b64decode(body))
    except (ValueError, TypeError) as exc:
        raise InvalidToken("Payload is not readable") from exc

    if not isinstance(payload, dict) or "exp" not in payload or "sub" not in payload:
        raise InvalidToken("Payload is missing required fields")

    current_time = time.time() if now is None else now
    if current_time > payload["exp"]:
        raise InvalidToken("Token has expired")

    return payload
