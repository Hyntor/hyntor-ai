"""Tests for accounts/passwords.py: is a password acceptable, and does it match its stored hash?

Run them with:

    python manage.py test accounts.tests.test_passwords

These use SimpleTestCase, not TestCase, because none of this code touches the database. That makes the
whole file run in well under a second.

Two different questions are tested here, and it is worth keeping them apart:

  * validate_password  - is this password allowed as a NEW password? (the rule, used at signup)
  * verify_password    - does this password match the hash we stored? (the check, used at sign-in)

A password that breaks today's rule can still sign in, because the rule may have changed after the
account was made. Only the hash decides a sign-in.
"""

import time

from django.test import SimpleTestCase

from accounts.passwords import (
    MIN_PASSWORD_LENGTH,
    hash_password,
    validate_password,
    verify_password,
)


class ValidatePasswordTests(SimpleTestCase):
    """The signup rule: at least MIN_PASSWORD_LENGTH characters, and not blank."""

    def test_password_at_the_minimum_length_is_accepted(self):
        """Exactly MIN_PASSWORD_LENGTH characters is allowed: the rule says 'at least', not 'more than'."""
        password = "a" * MIN_PASSWORD_LENGTH

        self.assertIsNone(validate_password(password))

    def test_password_one_below_the_minimum_is_refused(self):
        """One character short is refused. This is the boundary the rule is most likely to get wrong."""
        password = "a" * (MIN_PASSWORD_LENGTH - 1)

        self.assertEqual(
            validate_password(password), f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        )

    def test_password_one_above_the_minimum_is_accepted(self):
        """One character over is allowed, which shows the rule is not an exact-length check."""
        password = "a" * (MIN_PASSWORD_LENGTH + 1)

        self.assertIsNone(validate_password(password))

    def test_empty_password_is_refused(self):
        """An empty string is the smallest possible input, and a common source of crashes."""
        self.assertEqual(validate_password(""), "Password cannot be blank.")

    def test_whitespace_only_password_is_refused(self):
        """Spaces are long enough to pass a naive length check, so the rule tests them separately."""
        password = " " * (MIN_PASSWORD_LENGTH + 5)

        self.assertEqual(validate_password(password), "Password cannot be blank.")

    def test_a_very_long_password_is_accepted(self):
        """There is no upper limit, so a password manager's 200-character password still works."""
        self.assertIsNone(validate_password("x" * 200))

    def test_spaces_inside_a_password_are_allowed(self):
        """'correct horse battery staple' is a good password; only all-whitespace is refused."""
        self.assertIsNone(validate_password("correct horse battery staple"))


class VerifyPasswordTests(SimpleTestCase):
    """The sign-in check: does the password the user typed match the hash in the database?"""

    def test_the_correct_password_is_accepted(self):
        stored = hash_password("hyntor-demo-password")

        self.assertTrue(verify_password(stored, "hyntor-demo-password"))

    def test_a_wrong_password_is_refused(self):
        stored = hash_password("hyntor-demo-password")

        self.assertFalse(verify_password(stored, "wrong-password"))

    def test_the_check_is_case_sensitive(self):
        """'Secret' and 'secret' are different passwords."""
        stored = hash_password("hyntor-demo-password")

        self.assertFalse(verify_password(stored, "Hyntor-Demo-Password"))

    def test_a_wrong_password_returns_false_instead_of_raising(self):
        """A failed sign-in is a normal event, not an error, so the view can show a message."""
        stored = hash_password("hyntor-demo-password")

        result = verify_password(stored, "")

        self.assertIs(result, False)

    def test_a_damaged_hash_does_not_crash(self):
        """If a row is corrupted, sign-in must fail cleanly rather than return a 500 page."""
        self.assertFalse(verify_password("not-a-real-hash", "hyntor-demo-password"))


class AdversarialPasswordTests(SimpleTestCase):
    """Hostile and awkward input, rather than the happy path.

    The M3 plan asks for adversarial cases, so each test below is something an attacker or an unlucky
    user could actually send, not a tidier version of the tests above.
    """

    def test_a_password_is_not_trimmed(self):
        """Leading and trailing spaces are part of the password.

        The email IS trimmed before lookup (User.normalize_email), so it would be easy to trim the
        password the same way by mistake. That would let two different passwords open one account.
        """
        stored = hash_password(" hyntor-demo-password ")

        self.assertFalse(verify_password(stored, "hyntor-demo-password"))
        self.assertTrue(verify_password(stored, " hyntor-demo-password "))

    def test_a_prefix_of_the_password_is_refused(self):
        """Guards against a comparison that stops at the shorter string's length."""
        stored = hash_password("hyntor-demo-password")

        self.assertFalse(verify_password(stored, "hyntor-demo"))

    def test_sql_and_html_in_a_password_are_treated_as_plain_text(self):
        """A password is never put into a query or a page, so these are ordinary characters.

        The database is reached through the Django ORM, which parameterizes every query.
        """
        for hostile in ["' OR 1=1 --", "<script>alert(1)</script>", "'; DROP TABLE accounts_user; --"]:
            with self.subTest(password=hostile):
                padded = hostile + "x" * MIN_PASSWORD_LENGTH

                stored = hash_password(padded)

                self.assertTrue(verify_password(stored, padded))
                self.assertFalse(verify_password(stored, "x" * MIN_PASSWORD_LENGTH))

    def test_a_null_byte_does_not_truncate_the_password(self):
        """In C, a null byte ends a string. argon2-cffi is a C library behind a Python wrapper, so this
        checks that everything after the null byte still counts."""
        stored = hash_password("pass\x00word-secret")

        self.assertTrue(verify_password(stored, "pass\x00word-secret"))
        self.assertFalse(verify_password(stored, "pass"))

    def test_non_ascii_passwords_work(self):
        """Hyntor is for university students, whose passwords are not all ASCII."""
        for password in ["contraseña-segura", "пароль-надежный", "密码密码密码密码密码"]:
            with self.subTest(password=password):
                stored = hash_password(password)

                self.assertTrue(verify_password(stored, password))

    def test_accented_letters_must_match_exactly(self):
        """'café' can be typed two ways in Unicode: one 'é', or 'e' plus a combining accent.

        They look identical and are different byte strings, so they are different passwords. We do not
        normalize, which is a deliberate choice: it is predictable, and the user retypes what they set.
        """
        composed = "café-password"
        decomposed = "café-password"
        self.assertNotEqual(composed, decomposed)

        stored = hash_password(composed)

        self.assertFalse(verify_password(stored, decomposed))

    def test_a_very_long_password_does_not_hang_the_server(self):
        """An attacker could post a huge password to tie up a worker. Argon2's cost comes from its memory
        parameters, not the input length, so a 10,000-character password costs about the same as a short
        one. Measured at roughly 60 ms locally; the generous limit below is for slower CI machines."""
        password = "x" * 10_000

        start = time.perf_counter()
        stored = hash_password(password)
        elapsed = time.perf_counter() - start

        self.assertTrue(verify_password(stored, password))
        self.assertLess(elapsed, 2.0, f"hashing took {elapsed:.2f}s")


class HashPasswordTests(SimpleTestCase):
    """What gets stored. These are the tests to point at when asked how passwords are protected."""

    def test_the_password_is_never_stored_in_the_hash(self):
        """The stored value must not contain the password itself."""
        password = "hyntor-demo-password"

        stored = hash_password(password)

        self.assertNotIn(password, stored)
        self.assertNotEqual(stored, password)

    def test_the_hash_says_it_is_argon2id(self):
        """ADR-0007 requires Argon2id. The algorithm name is the first field of the stored hash."""
        stored = hash_password("hyntor-demo-password")

        self.assertTrue(stored.startswith("$argon2id$"), stored[:20])

    def test_the_same_password_hashes_differently_every_time(self):
        """Each hash uses a new random salt, so two users with the same password look unrelated,
        and an attacker cannot tell from the database that they match."""
        first = hash_password("hyntor-demo-password")
        second = hash_password("hyntor-demo-password")

        self.assertNotEqual(first, second)
        # Both still verify, which is what the salt stored inside each hash is for.
        self.assertTrue(verify_password(first, "hyntor-demo-password"))
        self.assertTrue(verify_password(second, "hyntor-demo-password"))
