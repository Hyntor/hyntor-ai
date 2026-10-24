"""Tests for the sign-in and sign-out pages, through real HTTP requests.

    python manage.py test accounts.tests.test_login_view

Django's test client sends requests through the whole stack - URLs, middleware, view, template - without
a running server, so these test what a browser would actually get back.
"""

from django.conf import settings
from django.test import Client, TestCase
from django.urls import reverse

from accounts.models import Session, University, User
from accounts.passwords import hash_password
from accounts.views import SIGN_IN_FAILED

PASSWORD = "hyntor-demo-password"


class LoginViewTests(TestCase):
    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="learner1@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
        )

    def test_the_login_page_renders_a_form(self):
        response = self.client.get(reverse("login"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="password"')
        self.assertContains(response, "csrfmiddlewaretoken")

    def test_the_correct_password_signs_the_user_in(self):
        response = self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

        self.assertRedirects(response, reverse("home"))
        self.assertEqual(Session.objects.count(), 1)
        self.assertIn(settings.SESSION_COOKIE_NAME, response.cookies)

    def test_the_session_cookie_is_protected(self):
        """HttpOnly keeps JavaScript away from the token; SameSite=Lax blocks cross-site form posts."""
        response = self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

        cookie = response.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["samesite"], "Lax")

    def test_a_wrong_password_is_refused_and_creates_no_session(self):
        response = self.client.post(reverse("login"), {"email": self.user.email, "password": "wrong"})

        self.assertEqual(response.status_code, 401)
        self.assertContains(response, SIGN_IN_FAILED, status_code=401)
        self.assertEqual(Session.objects.count(), 0)

    def test_an_unknown_email_is_refused_and_creates_no_user(self):
        """A failed sign-in must never create anything."""
        response = self.client.post(reverse("login"), {"email": "nobody@example.edu", "password": PASSWORD})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Session.objects.count(), 0)

    def test_unknown_email_and_wrong_password_look_identical(self):
        """Enumeration (T1): the page must not reveal which addresses have accounts.

        Same status code and same message, so an attacker learns nothing by trying addresses.
        """
        unknown = self.client.post(reverse("login"), {"email": "nobody@example.edu", "password": "wrong"})
        wrong = self.client.post(reverse("login"), {"email": self.user.email, "password": "wrong"})

        self.assertEqual(unknown.status_code, wrong.status_code)
        self.assertContains(unknown, SIGN_IN_FAILED, status_code=401)
        self.assertContains(wrong, SIGN_IN_FAILED, status_code=401)

    def test_the_email_is_case_insensitive(self):
        """Addresses are normalized before lookup, so shift-lock does not block a sign-in."""
        response = self.client.post(reverse("login"), {"email": "LEARNER1@EXAMPLE.EDU", "password": PASSWORD})

        self.assertRedirects(response, reverse("home"))

    def test_surrounding_spaces_in_the_email_are_ignored(self):
        response = self.client.post(
            reverse("login"), {"email": "  learner1@example.edu  ", "password": PASSWORD}
        )

        self.assertRedirects(response, reverse("home"))

    def test_a_post_without_a_csrf_token_is_refused(self):
        """Blocks another site from posting this form on a visitor's behalf.

        The usual test client fills the token in automatically; enforce_csrf_checks turns that off so the
        protection itself is tested.
        """
        unsafe_client = Client(enforce_csrf_checks=True)

        response = unsafe_client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(Session.objects.count(), 0)

    def test_a_signed_in_user_is_sent_home(self):
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

        response = self.client.get(reverse("login"))

        self.assertRedirects(response, reverse("home"))

    def test_missing_fields_do_not_crash(self):
        """An empty post is what a broken client or a script sends."""
        response = self.client.post(reverse("login"), {})

        self.assertEqual(response.status_code, 401)


class LogoutViewTests(TestCase):
    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="learner1@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def test_logout_deletes_the_session(self):
        response = self.client.post(reverse("logout"))

        self.assertRedirects(response, reverse("login"))
        self.assertEqual(Session.objects.count(), 0)

    def test_the_old_cookie_cannot_be_replayed(self):
        """The adversarial case: someone copies the cookie, the user signs out, the copy is used.

        Because logout deletes the row, the stolen cookie no longer matches anything.
        """
        stolen = self.client.cookies[settings.SESSION_COOKIE_NAME].value
        self.client.post(reverse("logout"))

        replayed = Client()
        replayed.cookies[settings.SESSION_COOKIE_NAME] = stolen
        response = replayed.get(reverse("home"))

        self.assertNotContains(response, "Signed in as")

    def test_logout_cannot_be_triggered_by_a_get(self):
        """A GET must not change anything, or a stray <img> tag could sign people out."""
        response = self.client.get(reverse("logout"))

        self.assertEqual(response.status_code, 405)
        self.assertEqual(Session.objects.count(), 1)
