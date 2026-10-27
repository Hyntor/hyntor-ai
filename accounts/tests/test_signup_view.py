"""Tests for the signup page (ACC-3, #16).

    python manage.py test accounts.tests.test_signup_view

The rule that matters most is A2: an email at an unregistered domain is refused AND no row is
created. A refusal that still writes something is worse than no check at all.
"""

from django.test import Client, TestCase
from django.urls import reverse

from accounts.models import PlatformRole, Session, University, User
from accounts.passwords import MIN_PASSWORD_LENGTH, verify_password

PASSWORD = "a-good-enough-password"


def form(**overrides):
    return {
        "display_name": "Lee Learner",
        "email": "lee@example.edu",
        "password": PASSWORD,
    } | overrides


class SignupTests(TestCase):
    def setUp(self):
        self.university = University.objects.create(name="Demo University", email_domain="example.edu")

    def test_the_page_renders_a_form(self):
        response = self.client.get(reverse("signup"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'name="password"')
        self.assertContains(response, 'name="display_name"')

    def test_a_university_address_creates_an_account_and_signs_in(self):
        response = self.client.post(reverse("signup"), form())

        self.assertRedirects(response, reverse("home"))
        user = User.objects.get(email="lee@example.edu")
        self.assertEqual(user.university, self.university)
        self.assertEqual(Session.objects.filter(user=user).count(), 1)

    def test_the_password_is_hashed_not_stored(self):
        self.client.post(reverse("signup"), form())

        user = User.objects.get(email="lee@example.edu")
        self.assertTrue(user.password_hash.startswith("$argon2id$"))
        self.assertNotIn(PASSWORD, user.password_hash)
        self.assertTrue(verify_password(user.password_hash, PASSWORD))

    def test_a_new_account_is_a_learner(self):
        self.client.post(reverse("signup"), form())

        self.assertEqual(User.objects.get(email="lee@example.edu").platform_role, PlatformRole.LEARNER)


class RefusedSignupTests(TestCase):
    """Every case here must leave the database exactly as it was."""

    def setUp(self):
        University.objects.create(name="Demo University", email_domain="example.edu")

    def assert_nothing_created(self, response):
        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Session.objects.count(), 0)

    def test_an_unregistered_domain_is_refused_and_creates_nothing(self):
        """A2. The rule is stated back to the person rather than a generic error."""
        response = self.client.post(reverse("signup"), form(email="lee@gmail.com"))

        self.assert_nothing_created(response)
        self.assertContains(response, "do not recognise that email domain", status_code=400)

    def test_a_password_one_character_short_is_refused(self):
        response = self.client.post(reverse("signup"), form(password="a" * (MIN_PASSWORD_LENGTH - 1)))

        self.assert_nothing_created(response)

    def test_a_password_at_the_minimum_length_is_accepted(self):
        """The other side of the same boundary."""
        response = self.client.post(reverse("signup"), form(password="a" * MIN_PASSWORD_LENGTH))

        self.assertRedirects(response, reverse("home"))

    def test_a_blank_display_name_is_refused(self):
        response = self.client.post(reverse("signup"), form(display_name="   "))

        self.assert_nothing_created(response)

    def test_two_at_signs_are_refused(self):
        """'a@b@example.edu' ends in a valid-looking domain, so a naive split would accept it."""
        response = self.client.post(reverse("signup"), form(email="lee@elsewhere@example.edu"))

        self.assert_nothing_created(response)

    def test_an_empty_post_does_not_crash(self):
        response = self.client.post(reverse("signup"), {})

        self.assert_nothing_created(response)


class SignupEdgeCaseTests(TestCase):
    def setUp(self):
        self.university = University.objects.create(name="Demo University", email_domain="example.edu")

    def test_an_uppercase_domain_is_accepted(self):
        """Addresses are normalized before the domain is looked up."""
        response = self.client.post(reverse("signup"), form(email="LEE@EXAMPLE.EDU"))

        self.assertRedirects(response, reverse("home"))
        self.assertTrue(User.objects.filter(email="lee@example.edu").exists())

    def test_surrounding_spaces_are_ignored(self):
        self.client.post(reverse("signup"), form(email="  lee@example.edu  "))

        self.assertTrue(User.objects.filter(email="lee@example.edu").exists())

    def test_a_duplicate_address_is_refused_and_creates_no_second_account(self):
        self.client.post(reverse("signup"), form())

        # A second, signed-out visitor: signing up signs you in, and a signed-in visitor is sent
        # home before the duplicate check is reached.
        response = Client().post(reverse("signup"), form(display_name="Someone Else"))

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.filter(email="lee@example.edu").count(), 1)
        self.assertEqual(User.objects.get(email="lee@example.edu").display_name, "Lee Learner")

    def test_a_posted_platform_role_is_ignored(self):
        """Mass assignment (T2). Posting an extra field must not make an administrator."""
        self.client.post(reverse("signup"), form(platform_role="admin"))

        self.assertEqual(User.objects.get(email="lee@example.edu").platform_role, PlatformRole.LEARNER)

    def test_html_in_a_name_is_stored_verbatim_and_rendered_escaped(self):
        """Stored as typed; the template escapes it, so it never becomes markup in a page."""
        self.client.post(reverse("signup"), form(display_name="<script>alert(1)</script>"))

        user = User.objects.get(email="lee@example.edu")
        self.assertEqual(user.display_name, "<script>alert(1)</script>")

        response = self.client.get(reverse("home"))
        self.assertNotContains(response, "<script>alert(1)</script>")
        self.assertContains(response, "&lt;script&gt;")

    def test_a_signed_in_user_is_sent_home(self):
        self.client.post(reverse("signup"), form())

        response = self.client.get(reverse("signup"))

        self.assertRedirects(response, reverse("home"))
