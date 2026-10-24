"""Tests for the signed hand-off token (tutor_chat/handoff.py).

    python manage.py test tutor.tests.test_handoff

This token is the only thing standing between the public internet and the tutor service, so the tests
here are mostly about what must be REFUSED. No database is involved, so SimpleTestCase is enough.
"""

import time

from django.test import SimpleTestCase

from tutor_chat.handoff import InvalidToken, make_token, read_token

SECRET = "a-test-handoff-secret"


def token_for(user_id=7, email="learner1@example.edu", display_name="Lee Learner", **kwargs):
    return make_token(SECRET, user_id=user_id, email=email, display_name=display_name, **kwargs)


class MakeAndReadTokenTests(SimpleTestCase):
    def test_a_token_round_trips(self):
        payload = read_token(SECRET, token_for())

        self.assertEqual(payload["sub"], "7")
        self.assertEqual(payload["email"], "learner1@example.edu")
        self.assertEqual(payload["name"], "Lee Learner")

    def test_the_token_is_url_safe(self):
        """It travels in a query string, so it must survive without escaping."""
        token = token_for(display_name="Zoë O'Brien & Co")

        self.assertNotIn("+", token)
        self.assertNotIn("/", token)
        self.assertNotIn("=", token)
        self.assertEqual(read_token(SECRET, token)["name"], "Zoë O'Brien & Co")

    def test_two_users_get_different_tokens(self):
        self.assertNotEqual(token_for(user_id=1), token_for(user_id=2))


class RejectedTokenTests(SimpleTestCase):
    """Everything that must not get in."""

    def test_a_token_signed_with_another_secret_is_refused(self):
        """The case that matters if the two services are configured with different secrets."""
        forged = make_token("a-different-secret", user_id=7, email="a@b.edu", display_name="A")

        with self.assertRaises(InvalidToken):
            read_token(SECRET, forged)

    def test_an_edited_payload_is_refused(self):
        """Someone swapping in another user's id must not be believed.

        The payload is only base64, not encrypted, so editing it is easy. The signature is what
        makes the edit useless.
        """
        import base64
        import json

        body, signature = token_for(user_id=7).split(".")
        stolen = json.loads(base64.urlsafe_b64decode(body + "=="))
        stolen["sub"] = "1"
        edited = base64.urlsafe_b64encode(json.dumps(stolen).encode()).rstrip(b"=").decode()

        with self.assertRaises(InvalidToken):
            read_token(SECRET, f"{edited}.{signature}")

    def test_an_altered_signature_is_refused(self):
        token = token_for()
        altered = token[:-1] + ("A" if token[-1] != "A" else "B")

        with self.assertRaises(InvalidToken):
            read_token(SECRET, altered)

    def test_an_expired_token_is_refused(self):
        """One second past expiry. The boundary from the outside."""
        expired = token_for(now=time.time() - 61, ttl_seconds=60)

        with self.assertRaises(InvalidToken):
            read_token(SECRET, expired)

    def test_a_token_one_second_before_expiry_is_accepted(self):
        """The same boundary from the inside, so the rule is not simply 'always refuse'."""
        nearly = token_for(now=time.time() - 59, ttl_seconds=60)

        self.assertEqual(read_token(SECRET, nearly)["sub"], "7")

    def test_malformed_input_is_refused_rather_than_crashing(self):
        """Whatever arrives in the query string, the page must not return a stack trace."""
        for value in [None, "", "not-a-token", "a.b.c", "....", "x." + "y" * 50, 12345]:
            with self.subTest(token=value):
                with self.assertRaises(InvalidToken):
                    read_token(SECRET, value)

    def test_an_empty_secret_is_a_configuration_error_not_a_refusal(self):
        """Raising something other than InvalidToken keeps a missing secret from looking like a
        normal failed sign-in. The tutor checks for this separately and refuses to serve."""
        with self.assertRaises(ValueError):
            read_token("", token_for())

        with self.assertRaises(ValueError):
            make_token("", user_id=1, email="a@b.edu", display_name="A")


class TokenContentsTests(SimpleTestCase):
    def test_the_token_carries_no_secret_material(self):
        """Anyone holding the URL can read the payload, so it must contain nothing sensitive."""
        token = token_for()

        self.assertNotIn(SECRET, token)
        self.assertEqual(set(read_token(SECRET, token)), {"sub", "email", "name", "exp"})
