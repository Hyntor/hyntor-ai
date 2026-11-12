"""A signed-in test client per role (FND-4, #9).

Authorization bugs are found by asking the same question as six different people, so the roles are
named here once rather than re-built in every test:

    for who in (signed_out(), unverified_learner(), outsider(course)):
        self.assertEqual(who.get(url).status_code, 403)

Each helper returns a `django.test.Client` with the session cookie already set, and carries the
user it signed in as on `client.user`, so a test can assert against the row it was given.
"""

from django.test import Client

from accounts.sessions import start_session
from tests import factories


def _as(user) -> Client:
    """A client already holding a valid session for this user, without going through the form.

    Signing in through the login view would make every authorization test depend on the login
    view working, which is tested on its own in accounts/tests/test_login_view.py.
    """
    from django.conf import settings

    client = Client()
    _session, token = start_session(user)
    client.cookies[settings.SESSION_COOKIE_NAME] = token
    client.user = user
    return client


def signed_out() -> Client:
    """A stranger. No cookie at all."""
    return Client()


def learner(university=None) -> Client:
    return _as(factories.a_learner(university))


def unverified_learner(university=None) -> Client:
    """Signed in, but has not confirmed their email (ACC-5)."""
    return _as(factories.an_unverified_learner(university))


def member(course) -> Client:
    """Enrolled in this course as an ordinary student."""
    return _as(factories.a_member(course))


def maintainer(course) -> Client:
    """Enrolled in this course with permission to manage it."""
    return _as(factories.a_maintainer(course))


def outsider(course=None) -> Client:
    """A verified account from a different university: the isolation case (CRS-3).

    `course` is accepted and ignored, so a test can read `outsider(course)` as "someone who is not
    in that course" without the caller having to know the user is unrelated to it.
    """
    return _as(factories.someone_from_another_university())


def admin(university=None) -> Client:
    return _as(factories.an_admin(university))
