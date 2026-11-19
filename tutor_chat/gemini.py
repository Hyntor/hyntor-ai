"""Calling Gemini, with a retry on the failures that are worth retrying.

A 5xx or a 429 is the provider having a bad moment: the same request usually succeeds a second
later, so giving up on the first one turns a blip into a dead conversation. A 4xx is our own
mistake - a bad key, an unknown model, a malformed request - and will fail the same way however
many times it is sent, so it is raised at once rather than making the student wait for two retries
that cannot help.

The failure is logged with its real status and message before being re-raised. The chat deliberately
shows the student something short and friendly, which means the detail exists nowhere else; without
this log there is no way to tell a capacity blip from an exhausted quota.

This lives apart from tutor.py because that module runs Streamlit as it is imported, so the retry
could not otherwise be tested without starting an app.
"""

import logging
import time

# 429 is rate limiting; the rest are the provider failing to answer a request it accepted.
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})

MAX_ATTEMPTS = 3

# The waits between attempts, so there is one fewer of these than there are attempts.
BACKOFF_SECONDS = (1, 2)

log = logging.getLogger(__name__)


def is_retryable(exc: Exception) -> bool:
    """Whether sending the same request again might work.

    Read off the exception's status rather than its class, so this does not depend on which
    exception types the installed google-genai version happens to define.
    """
    return getattr(exc, "code", None) in RETRYABLE_STATUS


def generate(call, *, sleep=time.sleep):
    """Return `call()`, retrying a transient provider failure. Raises the last error if all fail.

    `sleep` is an argument so a test can count the waits instead of spending them.
    """
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return call()
        except Exception as exc:  # noqa: BLE001 - the status decides what to do, not the class
            if not is_retryable(exc) or attempt == MAX_ATTEMPTS:
                log.exception("Gemini call failed on attempt %s of %s", attempt, MAX_ATTEMPTS)
                raise
            log.warning("Gemini call failed on attempt %s (%s); retrying", attempt, exc)
            sleep(BACKOFF_SECONDS[attempt - 1])
