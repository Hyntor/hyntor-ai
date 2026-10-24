"""Tests for accounts/sessions.py: creating, reading and ending a signed-in session.

    python manage.py test accounts.tests.test_sessions

These use TestCase, not SimpleTestCase, because sessions are rows in the database. Django wraps each
test in a transaction and rolls it back afterwards, so tests cannot affect one another.
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from accounts.models import Session, University, User
from accounts.passwords import hash_password
from accounts.sessions import end_session, hash_token, start_session, user_for_token


def make_user(email="learner@example.edu"):
    university = University.objects.create(name="Demo University", email_domain="example.edu")
    return User.objects.create(
        university=university,
        email=email,
        display_name="Lee Learner",
        password_hash=hash_password("hyntor-demo-password"),
    )


class StartSessionTests(TestCase):
    def test_the_raw_token_is_never_stored(self):
        """The cookie holds the token; the database holds only its SHA-256 (ADR-0007).

        Anyone who reads the session table still cannot sign in as that user.
        """
        user = make_user()

        session, token = start_session(user)

        self.assertNotEqual(session.token_hash, token)
        self.assertEqual(session.token_hash, hash_token(token))
        self.assertFalse(Session.objects.filter(token_hash=token).exists())

    def test_each_session_gets_a_different_token(self):
        """Two sign-ins must not collide, or one person could read another's session."""
        user = make_user()

        _, first = start_session(user)
        _, second = start_session(user)

        self.assertNotEqual(first, second)

    def test_the_token_is_256_bits(self):
        """32 random bytes, printed as hex, is 64 characters. Short tokens can be guessed."""
        user = make_user()

        _, token = start_session(user)

        self.assertEqual(len(token), 64)


class UserForTokenTests(TestCase):
    def test_a_valid_token_returns_its_user(self):
        user = make_user()
        _, token = start_session(user)

        self.assertEqual(user_for_token(token), user)

    def test_an_unknown_token_returns_none(self):
        """A made-up cookie must not sign anyone in."""
        make_user()

        self.assertIsNone(user_for_token("0" * 64))

    def test_a_tampered_token_returns_none(self):
        """Changing one character breaks the hash, so the row is not found."""
        user = make_user()
        _, token = start_session(user)
        tampered = ("1" if token[0] == "0" else "0") + token[1:]

        self.assertIsNone(user_for_token(tampered))

    def test_a_session_one_second_before_expiry_is_accepted(self):
        """The boundary from the inside. A session is valid right up to its expiry time."""
        user = make_user()
        session, token = start_session(user)
        session.expires_at = timezone.now() + timedelta(seconds=1)
        session.save()

        self.assertEqual(user_for_token(token), user)

    def test_a_session_one_second_after_expiry_is_refused(self):
        """The same boundary from the outside. Expired means signed out (A4), not an error."""
        user = make_user()
        session, token = start_session(user)
        session.expires_at = timezone.now() - timedelta(seconds=1)
        session.save()

        self.assertIsNone(user_for_token(token))


class EndSessionTests(TestCase):
    def test_ending_a_session_deletes_the_row(self):
        """Logout removes the row, so the old cookie can never be used again (A6)."""
        user = make_user()
        _, token = start_session(user)

        end_session(token)

        self.assertEqual(Session.objects.count(), 0)
        self.assertIsNone(user_for_token(token))

    def test_ending_one_session_leaves_other_sessions_alone(self):
        """Signing out on a phone must not sign the same person out on their laptop."""
        user = make_user()
        _, phone = start_session(user)
        _, laptop = start_session(user)

        end_session(phone)

        self.assertIsNone(user_for_token(phone))
        self.assertEqual(user_for_token(laptop), user)
