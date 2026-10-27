"""Tests for /tutor/, the hand-off into the Streamlit tutor.

python manage.py test tutor.tests.test_tutor_view
"""

from urllib.parse import parse_qs, urlparse

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from accounts.models import University, User
from accounts.passwords import hash_password
from tutor_chat.handoff import read_token

PASSWORD = "hyntor-demo-password"
SECRET = "a-test-handoff-secret"
TUTOR_URL = "https://hyntor-tutor.example.com"


class TutorHandoffTests(TestCase):
    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="learner1@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
            email_verified_at=timezone.now(),
        )

    def sign_in(self):
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    @override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
    def test_a_signed_out_visitor_is_sent_to_the_login_page(self):
        """No token is minted for someone who is not signed in. This is the whole access control."""
        response = self.client.get(reverse("tutor-chat"))

        self.assertRedirects(response, reverse("login"))

    @override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
    def test_a_signed_in_user_is_sent_on_with_a_valid_token(self):
        self.sign_in()

        response = self.client.get(reverse("tutor-chat"))

        self.assertEqual(response.status_code, 302)
        destination = urlparse(response["Location"])
        self.assertEqual(f"{destination.scheme}://{destination.netloc}", TUTOR_URL)

        token = parse_qs(destination.query)["t"][0]
        payload = read_token(SECRET, token)
        self.assertEqual(payload["sub"], str(self.user.pk))
        self.assertEqual(payload["email"], self.user.email)

    @override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
    def test_the_token_is_short_lived(self):
        """A link that stayed valid for hours would be worth stealing from a browser history."""
        self.sign_in()

        response = self.client.get(reverse("tutor-chat"))

        token = parse_qs(urlparse(response["Location"]).query)["t"][0]
        payload = read_token(SECRET, token)
        self.assertLessEqual(payload["exp"], int(__import__("time").time()) + 60)

    @override_settings(TUTOR_CHAT_URL="", HANDOFF_SECRET=SECRET)
    def test_no_tutor_configured_says_so_instead_of_redirecting_nowhere(self):
        """Local development and the window before the second service exists (G6)."""
        self.sign_in()

        response = self.client.get(reverse("tutor-chat"))

        self.assertEqual(response.status_code, 503)
        self.assertContains(response, "not set up yet", status_code=503)

    @override_settings(TUTOR_CHAT_URL="", HANDOFF_SECRET=SECRET)
    def test_an_unconfigured_tutor_still_refuses_signed_out_visitors(self):
        """The sign-in check comes first, so a missing setting never becomes a way in."""
        response = self.client.get(reverse("tutor-chat"))

        self.assertRedirects(response, reverse("login"))


class UnverifiedUserTests(TestCase):
    """Anyone can create an account at a registered domain, so sign-in alone must not spend quota."""

    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="new@example.edu",
            display_name="New Person",
            password_hash=hash_password(PASSWORD),
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    @override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
    def test_an_unverified_account_gets_no_token(self):
        response = self.client.get(reverse("tutor-chat"))

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("Location", response)

    @override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
    def test_verifying_the_account_opens_the_tutor(self):
        """The same account, once verified, is handed through."""
        self.user.email_verified_at = timezone.now()
        self.user.save()

        response = self.client.get(reverse("tutor-chat"))

        self.assertEqual(response.status_code, 302)
        self.assertIn("?t=", response["Location"])
