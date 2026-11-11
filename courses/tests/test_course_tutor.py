"""Tests for /courses/<id>/tutor/, the per-course hand-off.

    python manage.py test courses.tests.test_course_tutor

This route is the seam the per-course tutor pages are built on. Its job is to prove, before any
token exists, that this person is enrolled in this course at their own university this term.
"""

from urllib.parse import parse_qs, urlparse

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from accounts.models import University, User
from accounts.passwords import hash_password
from courses.models import Course, Enrollment
from courses.terms import current_term
from tutor_chat.handoff import InvalidToken, read_token

PASSWORD = "hyntor-demo-password"
SECRET = "a-test-handoff-secret"
TUTOR_URL = "https://hyntor-tutor.example.com"


@override_settings(TUTOR_CHAT_URL=TUTOR_URL, HANDOFF_SECRET=SECRET)
class CourseTutorTests(TestCase):
    def setUp(self):
        self.university = University.objects.create(
            name="University of Mississippi", email_domain="go.olemiss.edu"
        )
        self.user = User.objects.create(
            university=self.university,
            email="student@go.olemiss.edu",
            display_name="Casey Student",
            password_hash=hash_password(PASSWORD),
            email_verified_at=timezone.now(),
        )
        self.course = Course.objects.create(
            university=self.university, code="CSCI 1203", title="Computer Science I"
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def enroll(self, term=None):
        return Enrollment.objects.create(user=self.user, course=self.course, term=term or current_term())

    def open_tutor(self, course=None):
        return self.client.get(reverse("course-tutor", args=[(course or self.course).pk]))

    def test_an_enrolled_student_is_handed_through_with_the_course(self):
        self.enroll()

        response = self.open_tutor()

        self.assertEqual(response.status_code, 302)
        token = parse_qs(urlparse(response["Location"]).query)["t"][0]
        payload = read_token(SECRET, token)
        self.assertEqual(payload["sub"], str(self.user.pk))
        self.assertEqual(payload["course_id"], str(self.course.pk))
        self.assertEqual(payload["course_code"], "CSCI 1203")

    def test_the_course_cannot_be_swapped_in_the_url(self):
        """The course is inside the signed payload, so changing it invalidates the signature."""
        self.enroll()
        token = parse_qs(urlparse(self.open_tutor()["Location"]).query)["t"][0]

        body, signature = token.split(".")
        tampered = f"{body[:-1]}A.{signature}"

        with self.assertRaises(InvalidToken):
            read_token(SECRET, tampered)

    def test_a_student_who_has_not_joined_gets_no_token(self):
        """Knowing a course id is not the same as being enrolled in it."""
        response = self.open_tutor()

        self.assertEqual(response.status_code, 404)

    def test_an_enrollment_in_an_earlier_term_is_not_enough(self):
        """Enrollment is per term, so last semester's membership does not open this one."""
        self.enroll(term="2020-SP")

        response = self.open_tutor()

        self.assertEqual(response.status_code, 404)

    def test_a_course_at_another_university_is_refused(self):
        elsewhere = University.objects.create(name="Demo University", email_domain="example.edu")
        their_course = Course.objects.create(university=elsewhere, code="DEMO 101", title="Theirs")
        Enrollment.objects.create(user=self.user, course=their_course, term=current_term())

        response = self.open_tutor(their_course)

        self.assertEqual(response.status_code, 404)

    def test_an_unverified_student_gets_no_token(self):
        """The same quota protection as the general tutor route."""
        self.enroll()
        self.user.email_verified_at = None
        self.user.save()

        response = self.open_tutor()

        self.assertEqual(response.status_code, 403)

    def test_a_signed_out_visitor_is_sent_to_sign_in(self):
        self.enroll()
        self.client.post(reverse("logout"))

        response = self.open_tutor()

        self.assertRedirects(response, reverse("login"))

    @override_settings(TUTOR_CHAT_URL="", HANDOFF_SECRET=SECRET)
    def test_no_tutor_configured_says_so(self):
        self.enroll()

        response = self.open_tutor()

        self.assertEqual(response.status_code, 503)
