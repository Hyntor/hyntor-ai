"""Tests for the test harness itself (FND-4, #9).

    python manage.py test tests.test_harness

A broken factory makes other tests fail for reasons that have nothing to do with what they are
testing, and a broken guard fails nothing at all - it just quietly stops guarding. So the harness
is tested like any other code.
"""

import socket

from django.test import SimpleTestCase, TestCase

from accounts.models import PlatformRole
from courses.models import CourseRole
from library.models import ExtractionStatus
from tests import clients, factories, network
from tests.fake_ai import FakeAiProvider, ProviderError


class FactoryTests(TestCase):
    def test_rows_are_unique_without_being_asked(self):
        """Two calls must not collide on a unique column, or every test needs its own names."""
        self.assertNotEqual(factories.a_learner().email, factories.a_learner().email)
        self.assertNotEqual(factories.a_course().code, factories.a_course().code)

    def test_a_learner_is_verified_by_default(self):
        self.assertTrue(factories.a_learner().is_verified)

    def test_an_unverified_learner_is_not(self):
        self.assertFalse(factories.an_unverified_learner().is_verified)

    def test_an_admin_is_an_admin(self):
        self.assertTrue(factories.an_admin().is_admin)
        self.assertEqual(factories.an_admin().platform_role, PlatformRole.ADMIN)

    def test_a_maintainer_is_enrolled_as_one(self):
        course = factories.a_course()
        user = factories.a_maintainer(course)

        enrollment = user.enrollments.get(course=course)
        self.assertEqual(enrollment.course_role, CourseRole.MAINTAINER)

    def test_someone_from_another_university_really_is_elsewhere(self):
        """The isolation case is worthless if the factory quietly puts them in the same place."""
        course = factories.a_course()
        outsider = factories.someone_from_another_university()

        self.assertNotEqual(outsider.university_id, course.university_id)

    def test_a_material_with_chunks_is_indexed_and_ordered(self):
        material = factories.a_material(chunks=3)

        self.assertEqual(material.extraction_status, ExtractionStatus.INDEXED)
        self.assertEqual(list(material.chunks.values_list("ordinal", flat=True)), [0, 1, 2])

    def test_a_material_without_chunks_is_still_pending(self):
        material = factories.a_material()

        self.assertEqual(material.extraction_status, ExtractionStatus.PENDING)
        self.assertEqual(material.chunks.count(), 0)

    def test_an_explicit_field_wins_over_the_default(self):
        """The whole point: a test names the one value it is about."""
        self.assertEqual(factories.a_material(byte_size=26_214_401).byte_size, 26_214_401)

    def test_a_tutor_session_belongs_to_an_enrolled_student(self):
        session = factories.a_tutor_session()

        self.assertTrue(session.student.enrollments.filter(course=session.course).exists())


class ClientTests(TestCase):
    def test_a_role_client_is_already_signed_in(self):
        client = clients.learner()

        self.assertTrue(client.cookies.get("hyntor_session"))
        self.assertEqual(client.user.platform_role, PlatformRole.LEARNER)

    def test_signed_out_carries_no_cookie(self):
        self.assertFalse(clients.signed_out().cookies.get("hyntor_session"))

    def test_the_session_really_works_against_a_view(self):
        """A cookie that the middleware does not accept would make every test a false negative."""
        from django.urls import reverse

        client = clients.learner()
        response = client.get(reverse("home"))

        self.assertContains(response, client.user.display_name)

    def test_each_client_is_a_different_person(self):
        self.assertNotEqual(clients.learner().user.pk, clients.learner().user.pk)

    def test_a_maintainer_client_is_enrolled_in_that_course(self):
        course = factories.a_course()
        client = clients.maintainer(course)

        self.assertTrue(client.user.enrollments.filter(course=course).exists())


class FakeAiProviderTests(SimpleTestCase):
    def test_it_replies_from_the_script_in_order(self):
        provider = FakeAiProvider(replies=["first", "second"])

        self.assertEqual(provider.generate("a"), "first")
        self.assertEqual(provider.generate("b"), "second")

    def test_it_records_what_it_was_asked(self):
        provider = FakeAiProvider(replies=["ok"])
        provider.generate("why is the sky blue", system_instruction="be brief", temperature=0)

        self.assertEqual(provider.call_count, 1)
        self.assertEqual(provider.last_prompt, "why is the sky blue")
        self.assertEqual(provider.calls[0].system_instruction, "be brief")
        self.assertEqual(provider.calls[0].options, {"temperature": 0})

    def test_was_called_is_false_before_any_call(self):
        """Several rules are about not calling the provider at all (D7, TUT-9)."""
        self.assertFalse(FakeAiProvider(replies=["ok"]).was_called)

    def test_an_exception_in_the_script_is_raised(self):
        """So a test can put a provider outage partway through a conversation."""
        provider = FakeAiProvider(replies=["fine", ProviderError("429")])

        self.assertEqual(provider.generate("a"), "fine")
        with self.assertRaises(ProviderError):
            provider.generate("b")

    def test_running_off_the_end_of_the_script_fails_loudly(self):
        """An unexpected extra call is a bug; answering it anyway would hide it."""
        provider = FakeAiProvider(replies=["only one"])
        provider.generate("a")

        with self.assertRaises(AssertionError):
            provider.generate("b")

    def test_a_default_allows_a_call_count_that_does_not_matter(self):
        provider = FakeAiProvider(default="anything")

        self.assertEqual(provider.generate("a"), "anything")
        self.assertEqual(provider.generate("b"), "anything")

    def test_last_prompt_before_any_call_says_so(self):
        provider = FakeAiProvider(replies=["ok"])

        with self.assertRaises(AssertionError):
            _ = provider.last_prompt


class NetworkGuardTests(SimpleTestCase):
    """The guard is already installed by the runner, so these run against the real thing."""

    def test_an_outbound_connection_is_refused(self):
        with self.assertRaises(network.NetworkUsedInTests):
            socket.create_connection(("generativelanguage.googleapis.com", 443), timeout=1)

    def test_the_failure_names_the_host(self):
        with self.assertRaises(network.NetworkUsedInTests) as caught:
            socket.socket().connect(("example.com", 80))

        self.assertIn("example.com", str(caught.exception))

    def test_loopback_is_still_allowed(self):
        """The test database is a real PostgreSQL server on localhost in CI."""
        try:
            socket.socket().connect(("127.0.0.1", 1))
        except network.NetworkUsedInTests:
            self.fail("the guard blocked loopback, so the test database would be unreachable")
        except OSError:
            pass  # nothing listening on port 1, which is the expected outcome
