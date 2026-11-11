"""Tests for joining and leaving a course (CRS-2).

    python manage.py test courses.tests.test_join

The rule that matters most is isolation: a student may only join courses at their own university,
and only for the current term. Everything else here is about the dashboard reflecting reality.
"""

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import University, User
from accounts.passwords import hash_password
from courses.models import Course, Enrollment
from courses.terms import current_term

PASSWORD = "hyntor-demo-password"


class JoinCourseTests(TestCase):
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
        self.other = Course.objects.create(
            university=self.university, code="CSCI 2113", title="Data Structures"
        )
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def join(self, course, client=None):
        return (client or self.client).post(reverse("course-join"), {"course_id": course.pk})

    def test_joining_enrolls_the_student_for_this_term(self):
        response = self.join(self.course)

        self.assertRedirects(response, reverse("home"))
        enrollment = Enrollment.objects.get(user=self.user, course=self.course)
        self.assertEqual(enrollment.term, current_term())

    def test_a_joined_course_appears_on_the_home_page(self):
        self.join(self.course)

        response = self.client.get(reverse("home"))

        self.assertContains(response, "CSCI 1203")
        self.assertContains(response, "Computer Science I")

    def test_a_joined_course_links_to_its_own_tutor(self):
        """This is the seam the per-course tutor pages are built on."""
        self.join(self.course)

        response = self.client.get(reverse("home"))

        self.assertContains(response, reverse("course-tutor", args=[self.course.pk]))

    def test_a_joined_course_is_no_longer_offered_to_join(self):
        self.join(self.course)

        response = self.client.get(reverse("home"))

        self.assertNotContains(response, f'value="{self.course.pk}"></option>')
        self.assertContains(response, "CSCI 2113")

    def test_joining_twice_does_not_create_a_second_enrollment(self):
        """A double click, or the back button and another submit."""
        self.join(self.course)
        self.join(self.course)

        self.assertEqual(Enrollment.objects.filter(user=self.user, course=self.course).count(), 1)

    def test_joining_does_not_touch_other_students(self):
        other_student = User.objects.create(
            university=self.university,
            email="someone@go.olemiss.edu",
            display_name="Someone Else",
            password_hash=hash_password(PASSWORD),
        )

        self.join(self.course)

        self.assertEqual(Enrollment.objects.filter(user=other_student).count(), 0)


class JoinCourseRefusedTests(TestCase):
    """Cases that must not create an enrollment."""

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
        self.client.post(reverse("login"), {"email": self.user.email, "password": PASSWORD})

    def test_a_course_at_another_university_cannot_be_joined(self):
        """The isolation rule. Posting a valid id from elsewhere must not work."""
        elsewhere = University.objects.create(name="Demo University", email_domain="example.edu")
        their_course = Course.objects.create(
            university=elsewhere, code="DEMO 101", title="Someone Else's Course"
        )

        response = self.client.post(reverse("course-join"), {"course_id": their_course.pk})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Enrollment.objects.count(), 0)

    def test_a_course_that_does_not_exist_is_a_404(self):
        response = self.client.post(reverse("course-join"), {"course_id": 999999})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Enrollment.objects.count(), 0)

    def test_a_missing_course_id_does_not_crash(self):
        response = self.client.post(reverse("course-join"), {})

        self.assertEqual(response.status_code, 404)
        self.assertEqual(Enrollment.objects.count(), 0)

    def test_a_signed_out_visitor_is_sent_to_sign_in(self):
        course = Course.objects.create(university=self.university, code="CSCI 1203", title="CS I")
        self.client.post(reverse("logout"))

        response = self.client.post(reverse("course-join"), {"course_id": course.pk})

        self.assertRedirects(response, reverse("login"))
        self.assertEqual(Enrollment.objects.count(), 0)

    def test_joining_cannot_be_triggered_by_a_get(self):
        """A GET must not change anything, or a link could enroll someone without them asking."""
        course = Course.objects.create(university=self.university, code="CSCI 1203", title="CS I")

        response = self.client.get(reverse("course-join"), {"course_id": course.pk})

        self.assertEqual(response.status_code, 405)
        self.assertEqual(Enrollment.objects.count(), 0)


class LeaveCourseTests(TestCase):
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
        self.client.post(reverse("course-join"), {"course_id": self.course.pk})

    def test_leaving_removes_this_term_s_enrollment(self):
        response = self.client.post(reverse("course-leave"), {"course_id": self.course.pk})

        self.assertRedirects(response, reverse("home"))
        self.assertEqual(Enrollment.objects.filter(term=current_term()).count(), 0)

    def test_leaving_keeps_earlier_terms(self):
        """G2: a course's past terms are history, not something a student can erase by leaving."""
        Enrollment.objects.create(user=self.user, course=self.course, term="2026-SP")

        self.client.post(reverse("course-leave"), {"course_id": self.course.pk})

        self.assertTrue(Enrollment.objects.filter(term="2026-SP").exists())

    def test_leaving_a_course_you_never_joined_is_harmless(self):
        other = Course.objects.create(university=self.university, code="CSCI 2113", title="DS")

        response = self.client.post(reverse("course-leave"), {"course_id": other.pk})

        self.assertRedirects(response, reverse("home"))
        self.assertEqual(Enrollment.objects.filter(term=current_term()).count(), 1)

    def test_a_left_course_can_be_joined_again(self):
        self.client.post(reverse("course-leave"), {"course_id": self.course.pk})

        self.client.post(reverse("course-join"), {"course_id": self.course.pk})

        self.assertEqual(Enrollment.objects.filter(term=current_term()).count(), 1)
