"""Tests for the tutor session and message API (TUT-2, #26).

    python manage.py test tutor.tests.test_tutor_sessions

A session is one student's conversation about one course. The rules that matter are ownership
(nobody reads or writes anyone else's), append-only (T5: no route edits or deletes a message) and
contiguous ordinals, including when two requests race.

The provider is never real here: the shared FakeAiProvider answers from a script and records what
it was asked, so a test can assert on what the tutor was given as well as on what came back.
"""

import json
import threading
from datetime import timedelta
from unittest import mock

from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from django.urls import NoReverseMatch, reverse
from django.utils import timezone

from tests import clients, factories
from tests.fake_ai import FakeAiProvider
from tutor import services
from tutor.models import TutorMessage, TutorMode, TutorSession
from tutor_chat.limits import MAX_MESSAGE_LENGTH


class TutorApiTests(TestCase):
    """One course, two students enrolled in it, and a provider that answers from a script.

    `self.alice` and `self.bob` are signed-in test clients, each with its own account on
    `client.user`, so a test switches person by switching client rather than by signing in again.
    """

    def setUp(self):
        self.course = factories.a_course()
        self.alice = clients.member(self.course)
        self.bob = clients.member(self.course)

        self.provider = FakeAiProvider(default="ok")
        patcher = mock.patch("tutor.api.provider.reply_for", self.provider.as_reply_for())
        patcher.start()
        self.addCleanup(patcher.stop)

    def post_json(self, client, url, payload):
        return client.post(url, json.dumps(payload), content_type="application/json")

    def start(self, client, mode="concept", course=None):
        course = course or self.course
        return self.post_json(client, reverse("tutor-sessions"), {"course_id": course.pk, "mode": mode})

    def send(self, client, session_id, text):
        return self.post_json(client, reverse("tutor-send", args=[session_id]), {"text": text})


class StartSessionTests(TutorApiTests):
    def test_starting_a_session_stores_the_mode(self):
        response = self.start(self.alice, "assignment")

        self.assertEqual(response.status_code, 201)
        session = TutorSession.objects.get(pk=response.json()["id"])
        self.assertEqual(
            (session.student, session.course, session.mode),
            (self.alice.user, self.course, "assignment"),
        )

    def test_an_unknown_mode_is_refused_and_creates_nothing(self):
        response = self.start(self.alice, "cheat")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorSession.objects.count(), 0)

    def test_a_course_the_student_has_not_joined_is_a_404(self):
        self.alice.user.enrollments.all().delete()

        self.assertEqual(self.start(self.alice).status_code, 404)

    def test_another_universitys_course_is_a_404_and_creates_nothing(self):
        """Isolation (CRS-3): a real, verified account still cannot reach elsewhere."""
        outsider = clients.outsider(self.course)

        self.assertEqual(self.start(outsider).status_code, 404)
        self.assertEqual(TutorSession.objects.count(), 0)

    def test_the_mode_cannot_be_changed_afterwards(self):
        """There is no route that updates a session, so a stray PATCH or PUT is refused."""
        session_id = self.start(self.alice, "concept").json()["id"]

        for method in ("put", "patch", "delete"):
            response = getattr(self.alice, method)(
                reverse("tutor-session", args=[session_id]),
                json.dumps({"mode": "assignment"}),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 405, method)
        self.assertEqual(TutorSession.objects.get(pk=session_id).mode, TutorMode.CONCEPT)

    def test_a_signed_out_visitor_gets_401(self):
        stranger = clients.signed_out()

        self.assertEqual(self.start(stranger).status_code, 401)
        self.assertEqual(stranger.get(reverse("tutor-sessions")).status_code, 401)


class OwnershipTests(TutorApiTests):
    def setUp(self):
        super().setUp()
        self.alice_session = self.start(self.alice).json()["id"]
        self.send(self.alice, self.alice_session, "hello")

    def test_another_users_session_is_403_to_read(self):
        response = self.bob.get(reverse("tutor-session", args=[self.alice_session]))

        self.assertEqual(response.status_code, 403)

    def test_another_users_session_is_403_to_send_to_and_nothing_is_written(self):
        response = self.send(self.bob, self.alice_session, "let me in")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(TutorMessage.objects.filter(tutor_session_id=self.alice_session).count(), 2)

    def test_a_refused_send_never_reaches_the_provider(self):
        """Quota would be spent on a stranger if authorization were checked after the call (N9)."""
        self.provider.calls.clear()

        self.send(self.bob, self.alice_session, "let me in")

        self.assertFalse(self.provider.was_called)

    def test_a_session_that_does_not_exist_is_404(self):
        self.assertEqual(self.bob.get(reverse("tutor-session", args=[999999])).status_code, 404)

    def test_the_list_holds_only_my_sessions(self):
        mine = self.start(self.bob).json()["id"]

        listed = [s["id"] for s in self.bob.get(reverse("tutor-sessions")).json()["sessions"]]

        self.assertEqual(listed, [mine])


class SendTests(TutorApiTests):
    def setUp(self):
        super().setUp()
        self.session_id = self.start(self.alice).json()["id"]

    def test_a_send_appends_the_question_and_the_reply(self):
        response = self.send(self.alice, self.session_id, "What is recursion?")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            [(m["ordinal"], m["role"]) for m in response.json()["messages"]],
            [(1, "student"), (2, "assistant")],
        )

    def test_ordinals_stay_contiguous_over_many_exchanges(self):
        for i in range(25):
            self.assertEqual(self.send(self.alice, self.session_id, f"question {i}").status_code, 201)

        detail = self.alice.get(reverse("tutor-session", args=[self.session_id])).json()

        self.assertEqual([m["ordinal"] for m in detail["messages"]], list(range(1, 51)))
        self.assertEqual([m["role"] for m in detail["messages"][:4]], ["student", "assistant"] * 2)

    def test_messages_come_back_in_ordinal_order_whatever_the_insert_order(self):
        self.send(self.alice, self.session_id, "first")
        TutorMessage.objects.filter(ordinal=1).update(created_at=timezone.now() + timedelta(days=1))

        detail = self.alice.get(reverse("tutor-session", args=[self.session_id])).json()

        self.assertEqual([m["ordinal"] for m in detail["messages"]], [1, 2])

    def test_the_provider_sees_the_whole_conversation_so_far(self):
        provider = FakeAiProvider(default="ok")
        with mock.patch("tutor.api.provider.reply_for", provider.as_reply_for()):
            self.send(self.alice, self.session_id, "one")
            self.send(self.alice, self.session_id, "two")

        seen = [[m["content"] for m in call.options["history"]] for call in provider.calls]
        self.assertEqual(seen, [["one"], ["one", "ok", "two"]])

    def test_the_provider_is_asked_the_students_question(self):
        self.provider.calls.clear()

        self.send(self.alice, self.session_id, "What is recursion?")

        self.assertEqual(self.provider.last_prompt, "What is recursion?")

    def test_last_activity_moves_on_every_exchange(self):
        """Time is pinned, because two sends can land inside one clock tick on a fast machine."""
        old = timezone.now() - timedelta(days=3)
        TutorSession.objects.filter(pk=self.session_id).update(last_activity_at=old)
        first_tick = timezone.now()
        second_tick = first_tick + timedelta(minutes=1)

        with mock.patch("django.utils.timezone.now", return_value=first_tick):
            self.send(self.alice, self.session_id, "hi")
        after_first = TutorSession.objects.get(pk=self.session_id).last_activity_at

        with mock.patch("django.utils.timezone.now", return_value=second_tick):
            self.send(self.alice, self.session_id, "again")
        after_second = TutorSession.objects.get(pk=self.session_id).last_activity_at

        self.assertGreater(after_first, old)
        self.assertGreater(after_second, after_first)

    def test_a_failing_reply_leaves_no_half_exchange(self):
        """One transaction: if the reply cannot be produced, the student's message is not kept."""
        broken = FakeAiProvider(replies=[RuntimeError("model down")])
        with (
            mock.patch("tutor.api.provider.reply_for", broken.as_reply_for()),
            self.assertRaises(RuntimeError),
        ):
            self.send(self.alice, self.session_id, "hi")

        self.assertEqual(TutorMessage.objects.count(), 0)
        self.assertEqual(
            self.send(self.alice, self.session_id, "hi again").json()["messages"][0]["ordinal"], 1
        )


class MessageValidationTests(TutorApiTests):
    def setUp(self):
        super().setUp()
        self.session_id = self.start(self.alice).json()["id"]

    def assert_refused(self, text):
        response = self.send(self.alice, self.session_id, text)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorMessage.objects.count(), 0)

    def test_empty_is_refused(self):
        self.assert_refused("")

    def test_whitespace_only_is_refused(self):
        self.assert_refused("   \n\t  ")

    def test_a_missing_text_field_is_refused(self):
        response = self.post_json(self.alice, reverse("tutor-send", args=[self.session_id]), {})

        self.assertEqual(response.status_code, 400)

    def test_a_refused_message_never_reaches_the_provider(self):
        self.provider.calls.clear()

        self.assert_refused("")

        self.assertFalse(self.provider.was_called)

    def test_max_length_is_accepted(self):
        self.assertEqual(self.send(self.alice, self.session_id, "a" * MAX_MESSAGE_LENGTH).status_code, 201)

    def test_max_plus_one_is_refused(self):
        self.assert_refused("a" * (MAX_MESSAGE_LENGTH + 1))

    def test_padding_whitespace_does_not_count_against_the_limit(self):
        padded = "  " + "a" * MAX_MESSAGE_LENGTH + "  "

        self.assertEqual(self.send(self.alice, self.session_id, padded).status_code, 201)


class AppendOnlyTests(TutorApiTests):
    """T5: no route edits or deletes a message."""

    def setUp(self):
        super().setUp()
        self.session_id = self.start(self.alice).json()["id"]

    def test_the_messages_route_accepts_only_post(self):
        url = reverse("tutor-send", args=[self.session_id])

        for method in ("get", "put", "patch", "delete"):
            self.assertEqual(getattr(self.alice, method)(url).status_code, 405, method)

    def test_no_url_names_a_single_message(self):
        for name in ("tutor-message", "tutor-edit-message", "tutor-delete-message"):
            with self.assertRaises(NoReverseMatch):
                reverse(name, args=[self.session_id, 1])


class ConcurrentSendTests(TransactionTestCase):
    """Two sends racing for the same session must not both take the same ordinal.

    Needs TransactionTestCase: TestCase wraps each test in one transaction on one connection, so
    threads would not be separate database clients. On SQLite there are no row locks, so this
    test is only meaningful on PostgreSQL, which is what CI runs.
    """

    def test_parallel_sends_never_duplicate_an_ordinal(self):
        if connection.vendor != "postgresql":
            self.skipTest("row locks need PostgreSQL (CI runs it)")

        course = factories.a_course()
        student = factories.a_member(course)
        session = factories.a_tutor_session(course, student)
        reply_for = FakeAiProvider(default="ok").as_reply_for()
        workers = 8
        barrier = threading.Barrier(workers)
        errors = []

        def worker(n):
            try:
                barrier.wait()
                services.send_message(student, session.pk, f"q{n}", reply_for)
            except Exception as exc:  # noqa: BLE001 - collected and asserted below
                errors.append(exc)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=worker, args=(n,)) for n in range(workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual(errors, [])
        ordinals = list(session.messages.order_by("ordinal").values_list("ordinal", flat=True))
        self.assertEqual(ordinals, list(range(1, workers * 2 + 1)))
