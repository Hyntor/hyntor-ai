"""Tests for the home page.

    python manage.py test accounts.tests.test_home_page

The home page is the first thing a visitor sees, so what it must do is simple: describe the product
to a stranger, offer both ways in, and show something useful to someone already signed in.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import University, User
from accounts.passwords import hash_password

PASSWORD = "hyntor-demo-password"


class SignedOutHomePageTests(TestCase):
    def test_it_offers_both_ways_in(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse("signup"))
        self.assertContains(response, reverse("login"))

    def test_it_summarises_the_features(self):
        """A visitor who has never heard of Hyntor should learn what it does without signing in."""
        response = self.client.get(reverse("home"))

        for phrase in ["library", "tutor", "university"]:
            with self.subTest(phrase=phrase):
                self.assertContains(response, phrase)

    def test_it_does_not_offer_the_tutor_to_a_stranger(self):
        response = self.client.get(reverse("home"))

        self.assertNotContains(response, reverse("tutor-chat"))


class SignedInHomePageTests(TestCase):
    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="learner1@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
            email_verified_at=timezone.now(),
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def test_it_greets_the_signed_in_user_and_links_to_the_tutor(self):
        response = self.client.get(reverse("home"))

        self.assertContains(response, "Lee Learner")
        self.assertContains(response, reverse("tutor-chat"))

    def test_it_drops_the_sign_up_pitch(self):
        """Someone with an account should not be asked to create one."""
        response = self.client.get(reverse("home"))

        self.assertNotContains(response, "Create an account")


class UnverifiedHomePageTests(TestCase):
    """A self-registered account that has not confirmed its email address."""

    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="new@example.edu",
            display_name="New Person",
            password_hash=hash_password(PASSWORD),
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def test_the_tutor_is_not_offered_until_the_email_is_confirmed(self):
        """Better to explain what is missing than to show a button that refuses them."""
        response = self.client.get(reverse("home"))

        self.assertNotContains(response, reverse("tutor-chat"))
        self.assertContains(response, "email address is confirmed")
