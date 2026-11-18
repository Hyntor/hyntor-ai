"""Tests for the profile page.

    python manage.py test accounts.tests.test_profile

Reached from the signed-in person's name in the header. It shows their own details and the courses
they are in, so the thing worth testing is that it shows theirs and nobody else's.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import University, User
from accounts.passwords import hash_password
from courses.models import Course, Enrollment
from courses.terms import current_term

PASSWORD = "hyntor-demo-password"


class ProfilePageTests(TestCase):
    def setUp(self):
        self.university = University.objects.create(
            name="University of Mississippi", email_domain="go.olemiss.edu"
        )
        self.user = User.objects.create(
            university=self.university,
            email="casey@go.olemiss.edu",
            display_name="Casey Student",
            password_hash=hash_password(PASSWORD),
            email_verified_at=timezone.now(),
        )
        self.course = Course.objects.create(
            university=self.university, code="CSCI 3087", title="Software Design and Dev."
        )
        Enrollment.objects.create(user=self.user, course=self.course, term=current_term())
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def test_it_shows_the_name_email_and_university(self):
        response = self.client.get(reverse("profile"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Casey Student")
        self.assertContains(response, "casey@go.olemiss.edu")
        self.assertContains(response, "University of Mississippi")

    def test_it_lists_the_courses_they_are_in(self):
        response = self.client.get(reverse("profile"))

        self.assertContains(response, "CSCI 3087")
        self.assertContains(response, reverse("course-tutor", args=[self.course.pk]))

    def test_it_does_not_list_another_student_s_courses(self):
        """The page is about the person reading it, not everyone at their university."""
        someone_else = User.objects.create(
            university=self.university,
            email="other@go.olemiss.edu",
            display_name="Other Person",
            password_hash=hash_password(PASSWORD),
        )
        their_course = Course.objects.create(
            university=self.university, code="CSCI 1011", title="Computer Science I"
        )
        Enrollment.objects.create(user=someone_else, course=their_course, term=current_term())

        response = self.client.get(reverse("profile"))

        self.assertNotContains(response, "CSCI 1011")

    def test_it_does_not_list_an_earlier_term(self):
        past = Course.objects.create(university=self.university, code="CSCI 1012", title="CS II")
        Enrollment.objects.create(user=self.user, course=past, term="2020-SP")

        response = self.client.get(reverse("profile"))

        self.assertNotContains(response, "CSCI 1012")

    def test_a_student_with_no_courses_is_told_so(self):
        Enrollment.objects.all().delete()

        response = self.client.get(reverse("profile"))

        self.assertContains(response, "not joined any courses")

    def test_it_reports_whether_the_email_is_confirmed(self):
        self.user.email_verified_at = None
        self.user.save()

        response = self.client.get(reverse("profile"))

        self.assertContains(response, "Not yet")

    def test_a_signed_out_visitor_is_sent_to_sign_in(self):
        self.client.post(reverse("logout"))

        response = self.client.get(reverse("profile"))

        self.assertRedirects(response, reverse("login"))

    def test_the_header_links_to_it(self):
        """The name in the header is how people reach this page."""
        response = self.client.get(reverse("home"))

        self.assertContains(response, reverse("profile"))
