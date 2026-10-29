"""Tests for sign in with Google (ADR-0012).

    python manage.py test accounts.tests.test_google_oauth

Nothing here talks to Google. The one function that does, `exchange_code_for_identity`, is replaced
with a stand-in, so these tests check OUR side of the flow: the state check, the domain rule, and
what we store about the person. A guard test fails the suite if a real request is ever attempted.
"""

from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.core import signing
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from accounts.google_oauth import GoogleAuthError, GoogleIdentity
from accounts.models import Session, University, User
from accounts.passwords import UNUSABLE_PASSWORD_HASH, hash_password, verify_password
from accounts.views import GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_SALT

GOOGLE = {"GOOGLE_CLIENT_ID": "test-client-id", "GOOGLE_CLIENT_SECRET": "test-client-secret"}

PASSWORD = "a-good-enough-password"


def identity(email="lee@example.edu", verified=True, name="Lee Learner", subject="google-123"):
    return GoogleIdentity(subject=subject, email=email, email_verified=verified, display_name=name)


@override_settings(**GOOGLE)
class StartGoogleSignInTests(TestCase):
    def test_it_sends_the_browser_to_google(self):
        response = self.client.get(reverse("google-start"))

        self.assertEqual(response.status_code, 302)
        destination = urlparse(response["Location"])
        self.assertEqual(destination.netloc, "accounts.google.com")

        query = parse_qs(destination.query)
        self.assertEqual(query["client_id"], ["test-client-id"])
        self.assertEqual(query["response_type"], ["code"])
        self.assertIn("openid", query["scope"][0])

    def test_it_remembers_state_and_nonce_in_a_signed_cookie(self):
        """Both are checked on the way back, so they have to survive the round trip."""
        response = self.client.get(reverse("google-start"))

        cookie = response.cookies[GOOGLE_FLOW_COOKIE]
        flow = signing.loads(cookie.value, salt=GOOGLE_FLOW_SALT)
        query = parse_qs(urlparse(response["Location"]).query)

        self.assertEqual(query["state"], [flow["state"]])
        self.assertEqual(query["nonce"], [flow["nonce"]])
        self.assertTrue(cookie["httponly"])

    def test_each_attempt_gets_fresh_values(self):
        first = parse_qs(urlparse(self.client.get(reverse("google-start"))["Location"]).query)
        second = parse_qs(urlparse(Client().get(reverse("google-start"))["Location"]).query)

        self.assertNotEqual(first["state"], second["state"])


class GoogleNotConfiguredTests(TestCase):
    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="")
    def test_the_button_is_hidden(self):
        """No credentials, no button - rather than one that leads to an error."""
        response = self.client.get(reverse("login"))

        self.assertNotContains(response, "Continue with Google")

    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="")
    def test_the_route_says_so_rather_than_failing(self):
        response = self.client.get(reverse("google-start"))

        self.assertEqual(response.status_code, 503)

    @override_settings(**GOOGLE)
    def test_the_button_appears_when_configured(self):
        for page in ["login", "signup"]:
            with self.subTest(page=page):
                self.assertContains(self.client.get(reverse(page)), "Continue with Google")


@override_settings(**GOOGLE)
class GoogleCallbackTests(TestCase):
    def setUp(self):
        self.university = University.objects.create(name="Demo University", email_domain="example.edu")

    def start_flow(self):
        """Run the first leg so the browser holds a real state cookie, and return the state."""
        response = self.client.get(reverse("google-start"))
        return parse_qs(urlparse(response["Location"]).query)["state"][0]

    def callback(self, state, who=None, side_effect=None, code="an-authorization-code"):
        target = "accounts.views.google_oauth.exchange_code_for_identity"
        with patch(target, side_effect=side_effect, return_value=who or identity()) as exchange:
            response = self.client.get(reverse("google-callback"), {"state": state, "code": code})
        self.exchange = exchange
        return response

    def test_a_first_sign_in_creates_a_verified_account(self):
        response = self.callback(self.start_flow())

        self.assertRedirects(response, reverse("home"))
        user = User.objects.get(email="lee@example.edu")
        self.assertIsNotNone(user.email_verified_at, "Google confirmed the address, so it must count")
        self.assertEqual(user.university, self.university)
        self.assertEqual(Session.objects.filter(user=user).count(), 1)

    def test_a_google_account_has_no_usable_password(self):
        """Nothing should let someone sign in to it with a typed password."""
        self.callback(self.start_flow())

        user = User.objects.get(email="lee@example.edu")
        self.assertEqual(user.password_hash, UNUSABLE_PASSWORD_HASH)
        self.assertFalse(verify_password(user.password_hash, ""))
        self.assertFalse(verify_password(user.password_hash, UNUSABLE_PASSWORD_HASH))

    def test_signing_in_twice_does_not_create_a_second_account(self):
        self.callback(self.start_flow())
        Client().get(reverse("logout"))

        fresh = Client()
        state = parse_qs(urlparse(fresh.get(reverse("google-start"))["Location"]).query)["state"][0]
        with patch("accounts.views.google_oauth.exchange_code_for_identity", return_value=identity()):
            fresh.get(reverse("google-callback"), {"state": state, "code": "another-code"})

        self.assertEqual(User.objects.filter(email="lee@example.edu").count(), 1)

    def test_an_existing_password_account_becomes_verified(self):
        """This is how verification happens: sign in with Google once, and the address is confirmed."""
        user = User.objects.create(
            university=self.university,
            email="lee@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
        )
        self.assertIsNone(user.email_verified_at)

        self.callback(self.start_flow())

        user.refresh_from_db()
        self.assertIsNotNone(user.email_verified_at)
        # Their password still works; Google did not replace it.
        self.assertTrue(verify_password(user.password_hash, PASSWORD))


@override_settings(**GOOGLE)
class RefusedGoogleCallbackTests(TestCase):
    """Everything that must not result in a session."""

    def setUp(self):
        University.objects.create(name="Demo University", email_domain="example.edu")

    def start_flow(self):
        response = self.client.get(reverse("google-start"))
        return parse_qs(urlparse(response["Location"])[4])["state"][0]

    def assert_refused(self, response):
        self.assertIn(response.status_code, (400, 403))
        self.assertEqual(Session.objects.count(), 0)

    def test_a_mismatched_state_is_refused(self):
        """The CSRF check: someone else's sign-in must not be completed in this browser."""
        self.start_flow()

        with patch("accounts.views.google_oauth.exchange_code_for_identity") as exchange:
            response = self.client.get(reverse("google-callback"), {"state": "not-the-one", "code": "c"})

        self.assert_refused(response)
        exchange.assert_not_called()

    def test_a_callback_with_no_cookie_is_refused(self):
        """Arriving at the callback directly, without ever having started a sign-in."""
        with patch("accounts.views.google_oauth.exchange_code_for_identity") as exchange:
            response = self.client.get(reverse("google-callback"), {"state": "anything", "code": "c"})

        self.assert_refused(response)
        exchange.assert_not_called()

    def test_a_tampered_cookie_is_refused(self):
        self.start_flow()
        self.client.cookies[GOOGLE_FLOW_COOKIE] = "forged-cookie-value"

        response = self.client.get(reverse("google-callback"), {"state": "anything", "code": "c"})

        self.assert_refused(response)

    def test_an_unregistered_domain_is_refused_and_creates_nothing(self):
        """Google proves who you are, not that you may join. The A1 rule still applies."""
        state = self.start_flow()

        with patch(
            "accounts.views.google_oauth.exchange_code_for_identity",
            return_value=identity(email="someone@gmail.com"),
        ):
            response = self.client.get(reverse("google-callback"), {"state": state, "code": "c"})

        self.assert_refused(response)
        self.assertEqual(User.objects.count(), 0)

    def test_an_unconfirmed_google_address_is_refused(self):
        """Without the email_verified claim, Google has told us no more than a typed address would."""
        state = self.start_flow()

        with patch(
            "accounts.views.google_oauth.exchange_code_for_identity",
            return_value=identity(verified=False),
        ):
            response = self.client.get(reverse("google-callback"), {"state": state, "code": "c"})

        self.assert_refused(response)
        self.assertEqual(User.objects.count(), 0)

    def test_an_error_from_google_is_reported_calmly(self):
        """Pressing Cancel on Google's screen is not a crash."""
        self.start_flow()

        response = self.client.get(reverse("google-callback"), {"error": "access_denied"})

        self.assert_refused(response)

    def test_a_failure_while_talking_to_google_is_shown_to_the_user(self):
        state = self.start_flow()

        with patch(
            "accounts.views.google_oauth.exchange_code_for_identity",
            side_effect=GoogleAuthError("Could not reach Google. Try again in a moment."),
        ):
            response = self.client.get(reverse("google-callback"), {"state": state, "code": "c"})

        self.assert_refused(response)
        self.assertContains(response, "Could not reach Google", status_code=400)

    def test_a_missing_code_is_refused(self):
        state = self.start_flow()

        with patch("accounts.views.google_oauth.exchange_code_for_identity") as exchange:
            response = self.client.get(reverse("google-callback"), {"state": state})

        self.assert_refused(response)
        exchange.assert_not_called()


@override_settings(**GOOGLE)
class GoogleAccountPasswordLoginTests(TestCase):
    """A Google-only account must not be reachable through the password form."""

    def setUp(self):
        university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.user = User.objects.create(
            university=university,
            email="lee@example.edu",
            display_name="Lee Learner",
            password_hash=UNUSABLE_PASSWORD_HASH,
            email_verified_at=timezone.now(),
        )

    def test_the_marker_itself_cannot_be_used_as_a_password(self):
        response = self.client.post(
            reverse("login"), {"email": self.user.email, "password": UNUSABLE_PASSWORD_HASH}
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(Session.objects.count(), 0)

    def test_an_empty_password_cannot_be_used(self):
        response = self.client.post(reverse("login"), {"email": self.user.email, "password": ""})

        self.assertEqual(response.status_code, 401)
        self.assertEqual(Session.objects.count(), 0)


@override_settings(**GOOGLE)
class GoogleSubjectTests(TestCase):
    """The Google id is stored so a returning person is recognised even if their address changed."""

    def setUp(self):
        self.university = University.objects.create(name="Demo University", email_domain="example.edu")

    def start_flow(self):
        response = self.client.get(reverse("google-start"))
        return parse_qs(urlparse(response["Location"]).query)["state"][0]

    def sign_in_with(self, who):
        state = self.start_flow()
        with patch("accounts.views.google_oauth.exchange_code_for_identity", return_value=who):
            return self.client.get(reverse("google-callback"), {"state": state, "code": "a-code"})

    def test_a_new_account_stores_the_google_id(self):
        self.sign_in_with(identity(subject="google-abc"))

        self.assertEqual(User.objects.get(email="lee@example.edu").google_subject, "google-abc")

    def test_an_existing_password_account_is_linked_on_first_google_sign_in(self):
        user = User.objects.create(
            university=self.university,
            email="lee@example.edu",
            display_name="Lee Learner",
            password_hash=hash_password(PASSWORD),
        )

        self.sign_in_with(identity(subject="google-abc"))

        user.refresh_from_db()
        self.assertEqual(user.google_subject, "google-abc")

    def test_a_changed_email_still_finds_the_same_account(self):
        """The point of storing the id: Google reports a new address, we recognise the person."""
        user = User.objects.create(
            university=self.university,
            email="lee.old@example.edu",
            display_name="Lee Learner",
            password_hash=UNUSABLE_PASSWORD_HASH,
            google_subject="google-abc",
            email_verified_at=timezone.now(),
        )

        self.sign_in_with(identity(email="lee.new@example.edu", subject="google-abc"))

        self.assertEqual(User.objects.count(), 1, "a changed address must not create a second account")
        self.assertEqual(Session.objects.filter(user=user).count(), 1)
