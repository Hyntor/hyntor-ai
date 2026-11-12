import json
import threading
from datetime import timedelta
from unittest import mock
 
from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from django.urls import NoReverseMatch, reverse
from django.utils import timezone
 
from accounts.models import University, User
from accounts.passwords import hash_password
from courses.models import Course, Enrollment
from courses.terms import current_term
from tutor import services
from tutor.models import TutorMessage, TutorMode, TutorSession
from tutor_chat.limits import MAX_MESSAGE_LENGTH
 
PASSWORD = "hyntor-demo-password"
 
 
def fake_reply(session, history):
    return f"reply to: {history[-1]['content'][:20]}"
 
 
def make_user(university, email):
    return User.objects.create(
        university=university,
        email=email,
        display_name=email.split("@")[0],
        password_hash=hash_password(PASSWORD),
        email_verified_at=timezone.now(),
    )
 
 
class Base:
    """Shared setup: one university, one course, two enrolled students."""
    def create_world(self):
        self.university = University.objects.create(name="Demo University", email_domain="example.edu")
        self.course = Course.objects.create(university=self.university, code="CSCI 1203", title="CS I")
        self.alice = make_user(self.university, "alice@example.edu")
        self.bob = make_user(self.university, "bob@example.edu")
        for user in (self.alice, self.bob):
            Enrollment.objects.create(user=user, course=self.course, term=current_term())
 
    def sign_in(self, user):
        self.client.cookies.clear()
        self.client.post(reverse("login"), {"email": user.email, "password": PASSWORD})
 
    def post_json(self, url, payload):
        return self.client.post(url, json.dumps(payload), content_type="application/json")
 
    def start(self, mode="concept"):
        return self.post_json(reverse("tutor-sessions"), {"course_id": self.course.pk, "mode": mode})
 
    def send(self, session_id, text):
        return self.post_json(reverse("tutor-send", args=[session_id]), {"text": text})
 
 
@mock.patch("tutor.api.provider.reply_for", fake_reply)
class StartSessionTests(Base, TestCase):
    def setUp(self):
        self.create_world()
        self.sign_in(self.alice)
 
    def test_starting_a_session_stores_the_mode(self):
        response = self.start("assignment")
 
        self.assertEqual(response.status_code, 201)
        session = TutorSession.objects.get(pk=response.json()["id"])
        self.assertEqual(
            (session.student, session.course, session.mode), (self.alice, self.course, "assignment")
        )
 
    def test_an_unknown_mode_is_refused_and_creates_nothing(self):
        response = self.start("cheat")
 
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorSession.objects.count(), 0)
 
    def test_a_course_the_student_has_not_joined_is_a_404(self):
        Enrollment.objects.filter(user=self.alice).delete()
 
        self.assertEqual(self.start().status_code, 404)
 
    def test_the_mode_cannot_be_changed_afterwards(self):
        """There is no route that updates a session, so a stray PATCH or PUT is refused."""
        session_id = self.start("concept").json()["id"]
 
        for method in ("put", "patch", "delete"):
            response = getattr(self.client, method)(
                reverse("tutor-session", args=[session_id]),
                json.dumps({"mode": "assignment"}),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 405, method)
        self.assertEqual(TutorSession.objects.get(pk=session_id).mode, TutorMode.CONCEPT)
 
    def test_a_signed_out_visitor_gets_401(self):
        self.client.cookies.clear()
 
        self.assertEqual(self.start().status_code, 401)
        self.assertEqual(self.client.get(reverse("tutor-sessions")).status_code, 401)
 
 
@mock.patch("tutor.api.provider.reply_for", fake_reply)
class OwnershipTests(Base, TestCase):
    def setUp(self):
        self.create_world()
        self.sign_in(self.alice)
        self.alice_session = self.start().json()["id"]
        self.send(self.alice_session, "hello")
        self.sign_in(self.bob)
 
    def test_another_users_session_is_403_to_read(self):
        response = self.client.get(reverse("tutor-session", args=[self.alice_session]))
 
        self.assertEqual(response.status_code, 403)
 
    def test_another_users_session_is_403_to_send_to_and_nothing_is_written(self):
        response = self.send(self.alice_session, "let me in")
 
        self.assertEqual(response.status_code, 403)
        self.assertEqual(TutorMessage.objects.filter(tutor_session_id=self.alice_session).count(), 2)
 
    def test_a_session_that_does_not_exist_is_404(self):
        self.assertEqual(self.client.get(reverse("tutor-session", args=[999999])).status_code, 404)
 
    def test_the_list_holds_only_my_sessions(self):
        mine = self.start().json()["id"]
 
        listed = [s["id"] for s in self.client.get(reverse("tutor-sessions")).json()["sessions"]]
 
        self.assertEqual(listed, [mine])
 
 
@mock.patch("tutor.api.provider.reply_for", fake_reply)
class SendTests(Base, TestCase):
    def setUp(self):
        self.create_world()
        self.sign_in(self.alice)
        self.session_id = self.start().json()["id"]
 
    def test_a_send_appends_the_question_and_the_reply(self):
        response = self.send(self.session_id, "What is recursion?")
 
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            [(m["ordinal"], m["role"]) for m in response.json()["messages"]],
            [(1, "student"), (2, "assistant")],
        )
 
    def test_ordinals_stay_contiguous_over_many_exchanges(self):
        for i in range(25):
            self.assertEqual(self.send(self.session_id, f"question {i}").status_code, 201)
 
        detail = self.client.get(reverse("tutor-session", args=[self.session_id])).json()
 
        self.assertEqual([m["ordinal"] for m in detail["messages"]], list(range(1, 51)))
        self.assertEqual([m["role"] for m in detail["messages"][:4]], ["student", "assistant"] * 2)
 
    def test_messages_come_back_in_ordinal_order_whatever_the_insert_order(self):
        self.send(self.session_id, "first")
        TutorMessage.objects.filter(ordinal=1).update(created_at=timezone.now() + timedelta(days=1))
 
        detail = self.client.get(reverse("tutor-session", args=[self.session_id])).json()
 
        self.assertEqual([m["ordinal"] for m in detail["messages"]], [1, 2])
 
    def test_the_provider_sees_the_whole_conversation_so_far(self):
        seen = []
 
        def spy(session, history):
            seen.append([m["content"] for m in history])
            return "ok"
 
        with mock.patch("tutor.api.provider.reply_for", spy):
            self.send(self.session_id, "one")
            self.send(self.session_id, "two")
 
        self.assertEqual(seen, [["one"], ["one", "ok", "two"]])
 
    def test_last_activity_moves_on_every_exchange(self):
        old = timezone.now() - timedelta(days=3)
        TutorSession.objects.filter(pk=self.session_id).update(last_activity_at=old)
 
        self.send(self.session_id, "hi")
        after_first = TutorSession.objects.get(pk=self.session_id).last_activity_at
        self.send(self.session_id, "again")
        after_second = TutorSession.objects.get(pk=self.session_id).last_activity_at
 
        self.assertGreater(after_first, old)
        self.assertGreater(after_second, after_first)
 
    def test_a_failing_reply_leaves_no_half_exchange(self):
        """One transaction: if the reply cannot be produced, the student's message is not kept."""
        with mock.patch("tutor.api.provider.reply_for", side_effect=RuntimeError("model down")):
            with self.assertRaises(RuntimeError):
                self.send(self.session_id, "hi")
 
        self.assertEqual(TutorMessage.objects.count(), 0)
        self.assertEqual(self.send(self.session_id, "hi again").json()["messages"][0]["ordinal"], 1)
 
 
@mock.patch("tutor.api.provider.reply_for", fake_reply)
class MessageValidationTests(Base, TestCase):
    def setUp(self):
        self.create_world()
        self.sign_in(self.alice)
        self.session_id = self.start().json()["id"]
 
    def assert_refused(self, text):
        response = self.send(self.session_id, text)
 
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorMessage.objects.count(), 0)
 
    def test_empty_is_refused(self):
        self.assert_refused("")
 
    def test_whitespace_only_is_refused(self):
        self.assert_refused("   \n\t  ")
 
    def test_a_missing_text_field_is_refused(self):
        response = self.post_json(reverse("tutor-send", args=[self.session_id]), {})
 
        self.assertEqual(response.status_code, 400)
 
    def test_max_length_is_accepted(self):
        self.assertEqual(self.send(self.session_id, "a" * MAX_MESSAGE_LENGTH).status_code, 201)
 
    def test_max_plus_one_is_refused(self):
        self.assert_refused("a" * (MAX_MESSAGE_LENGTH + 1))
 
    def test_padding_whitespace_does_not_count_against_the_limit(self):
        self.assertEqual(self.send(self.session_id, "  " + "a" * MAX_MESSAGE_LENGTH + "  ").status_code, 201)
 
 
class AppendOnlyTests(Base, TestCase):
    """T5: no route edits or deletes a message."""
    def setUp(self):
        self.create_world()
        self.sign_in(self.alice)
        self.session_id = self.start().json()["id"]
 
    def test_the_messages_route_accepts_only_post(self):
        url = reverse("tutor-send", args=[self.session_id])
 
        for method in ("get", "put", "patch", "delete"):
            self.assertEqual(getattr(self.client, method)(url).status_code, 405, method)
 
    def test_no_url_names_a_single_message(self):
        for name in ("tutor-message", "tutor-edit-message", "tutor-delete-message"):
            with self.assertRaises(NoReverseMatch):
                reverse(name, args=[self.session_id, 1])
 
 
class ConcurrentSendTests(Base, TransactionTestCase):
    """Two sends racing for the same session must not both take the same ordinal.
 
    Needs TransactionTestCase: TestCase wraps each test in one transaction on one connection, so
    threads would not be separate database clients. On SQLite there are no row locks, so this
    test is only meaningful on PostgreSQL, which is what CI runs.
    """
    def test_parallel_sends_never_duplicate_an_ordinal(self):
        if connection.vendor != "postgresql":
            self.skipTest("row locks need PostgreSQL (CI runs it)")
        self.create_world()
        session = TutorSession.objects.create(course=self.course, student=self.alice, mode="concept")
        workers = 8
        barrier = threading.Barrier(workers)
        errors = []
 
        def slow_reply(session, history):
            return "ok"
 
        def worker(n):
            try:
                barrier.wait()
                services.send_message(self.alice, session.pk, f"q{n}", slow_reply)
            except Exception as exc:  # noqa: BLE001 - collected and asserted below
                errors.append(exc)
            finally:
                connections.close_all()
 
        threads = [threading.Thread(target=worker, args=(n,)) for n in range(workers)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
 
        self.assertEqual(errors, [])
        ordinals = list(session.messages.order_by("ordinal").values_list("ordinal", flat=True))
        self.assertEqual(ordinals, list(range(1, workers * 2 + 1)))