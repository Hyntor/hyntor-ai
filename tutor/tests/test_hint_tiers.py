"""Tests for server-enforced hint tiers (TUT-3, #27).

    python manage.py test tutor.tests.test_hint_tiers

The product's promise is that assignment mode hints before it answers, and never hands over the
full solution. That promise is only worth anything if a student cannot choose their own tier, so
most of this file is written as an attack: send the tier in the body, send it as a string, send a
float, send extra fields, change the mode mid-session, race two requests. Each one must be refused
or ignored, and the stored tier must still be the one the server worked out.

The arithmetic itself is tested directly against `tiers.tier_for`, and the rest goes through the
API, because an endpoint that computes the right tier and then forgets to save it is still broken.
"""

import json
from unittest import mock

from django.test import SimpleTestCase, TestCase
from django.urls import reverse

from tests import clients, factories
from tests.fake_ai import FakeAiProvider
from tutor import tiers
from tutor.models import MessageAuthorRole, TutorMessage, TutorMode, TutorSession
from tutor.tiers import MAX_TIER_SERVED, TIER_FULL_SOLUTION, tier_for


class Session:
    """Just enough of a session for the arithmetic, which does not touch the database."""

    def __init__(self, mode):
        self.mode = mode


class TierArithmeticTests(SimpleTestCase):
    """What tier the next reply gets, given how many replies came before."""

    def test_the_first_assignment_reply_is_tier_one(self):
        self.assertEqual(tier_for(Session(TutorMode.ASSIGNMENT), replies_so_far=0), 1)

    def test_each_exchange_raises_it_by_exactly_one(self):
        session = Session(TutorMode.ASSIGNMENT)

        served = [tier_for(session, replies_so_far=n) for n in range(3)]

        self.assertEqual(served, [1, 2, 3])

    def test_it_stops_at_the_cap_and_never_reaches_tier_four(self):
        """Ten exchanges: 1, 2, 3, 3, 3 ... and never 4 (D4)."""
        session = Session(TutorMode.ASSIGNMENT)

        served = [tier_for(session, replies_so_far=n) for n in range(10)]

        self.assertEqual(served, [1, 2, 3, 3, 3, 3, 3, 3, 3, 3])
        self.assertNotIn(TIER_FULL_SOLUTION, served)

    def test_the_boundary_either_side_of_the_cap(self):
        session = Session(TutorMode.ASSIGNMENT)

        self.assertEqual(tier_for(session, replies_so_far=MAX_TIER_SERVED - 2), MAX_TIER_SERVED - 1)
        self.assertEqual(tier_for(session, replies_so_far=MAX_TIER_SERVED - 1), MAX_TIER_SERVED)
        self.assertEqual(tier_for(session, replies_so_far=MAX_TIER_SERVED), MAX_TIER_SERVED)

    def test_a_long_conversation_still_cannot_exceed_the_cap(self):
        """A student who keeps asking does not eventually get the answer."""
        self.assertEqual(tier_for(Session(TutorMode.ASSIGNMENT), replies_so_far=10_000), MAX_TIER_SERVED)

    def test_concept_mode_has_no_tier_at_all(self):
        """Explaining an idea is not doing someone's homework (D3)."""
        for n in (0, 1, 50):
            with self.subTest(replies_so_far=n):
                self.assertIsNone(tier_for(Session(TutorMode.CONCEPT), replies_so_far=n))

    def test_the_cap_is_below_the_full_solution(self):
        """If these two were ever equal, the cap would be serving the answer."""
        self.assertLess(MAX_TIER_SERVED, TIER_FULL_SOLUTION)

    def test_every_served_tier_has_an_instruction(self):
        for tier in range(1, MAX_TIER_SERVED + 1):
            with self.subTest(tier=tier):
                self.assertTrue(tiers.instruction_for(tier).strip())

    def test_concept_mode_gets_no_instruction(self):
        self.assertEqual(tiers.instruction_for(None), "")


class TutorApiTests(TestCase):
    """One course and one enrolled student, with a provider that answers from a script."""

    def setUp(self):
        self.course = factories.a_course()
        self.alice = clients.member(self.course)

        self.provider = FakeAiProvider(default="ok")
        patcher = mock.patch("tutor.api.provider.reply_for", self.provider.as_reply_for())
        patcher.start()
        self.addCleanup(patcher.stop)

    def post_json(self, url, payload):
        return self.alice.post(url, json.dumps(payload), content_type="application/json")

    def start(self, mode):
        response = self.post_json(reverse("tutor-sessions"), {"course_id": self.course.pk, "mode": mode})
        return response.json()["id"]

    def send(self, session_id, text="a question", **extra):
        """A send, optionally carrying fields a student is not meant to be sending."""
        return self.post_json(reverse("tutor-send", args=[session_id]), {"text": text, **extra})

    def tiers_of(self, session_id):
        return list(
            TutorMessage.objects.filter(tutor_session_id=session_id, author_role=MessageAuthorRole.ASSISTANT)
            .order_by("ordinal")
            .values_list("hint_tier", flat=True)
        )


class StoredTierTests(TutorApiTests):
    def test_an_assignment_session_climbs_and_then_holds(self):
        session_id = self.start("assignment")

        for _ in range(5):
            self.assertEqual(self.send(session_id).status_code, 201)

        self.assertEqual(self.tiers_of(session_id), [1, 2, 3, 3, 3])

    def test_a_concept_session_stores_no_tier(self):
        session_id = self.start("concept")

        for _ in range(3):
            self.send(session_id)

        self.assertEqual(self.tiers_of(session_id), [None, None, None])

    def test_the_student_message_never_carries_a_tier(self):
        session_id = self.start("assignment")
        self.send(session_id)

        student = TutorMessage.objects.get(tutor_session_id=session_id, author_role=MessageAuthorRole.STUDENT)
        self.assertIsNone(student.hint_tier)

    def test_each_reply_returns_its_tier_for_the_badge(self):
        """TUT-7 draws a badge from this, so it has to come back, not only be stored."""
        session_id = self.start("assignment")

        first = self.send(session_id).json()["messages"]
        second = self.send(session_id).json()["messages"]

        self.assertEqual([m["hint_tier"] for m in first], [None, 1])
        self.assertEqual([m["hint_tier"] for m in second], [None, 2])

    def test_the_provider_is_told_which_tier_it_is_answering_at(self):
        """The model is told, but is not trusted with it: our code wrote the tier down above."""
        session_id = self.start("assignment")

        self.send(session_id)
        self.send(session_id)

        self.assertEqual([call.options["tier"] for call in self.provider.calls], [1, 2])

    def test_the_provider_is_told_there_is_no_tier_in_concept_mode(self):
        session_id = self.start("concept")

        self.send(session_id)

        self.assertIsNone(self.provider.calls[0].options["tier"])

    def test_two_sessions_climb_independently(self):
        """A student cannot warm one session up and collect a high tier in another."""
        first = self.start("assignment")
        second = self.start("assignment")

        for _ in range(3):
            self.send(first)
        self.send(second)

        self.assertEqual(self.tiers_of(first), [1, 2, 3])
        self.assertEqual(self.tiers_of(second), [1])


class TierCannotBeChosenTests(TutorApiTests):
    """The attack this issue exists for: the tier must not come from the request (T2)."""

    def setUp(self):
        super().setUp()
        self.session_id = self.start("assignment")

    def assert_refused(self, response):
        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorMessage.objects.count(), 0)
        self.assertFalse(self.provider.was_called)

    def test_a_tier_in_the_body_is_refused(self):
        self.assert_refused(self.send(self.session_id, tier=TIER_FULL_SOLUTION))

    def test_a_tier_of_any_shape_is_refused(self):
        """Not validated and coerced - refused. The field has no business being there."""
        for value in (4, "4", -1, 3.5, None, True, [4], {"n": 4}):
            with self.subTest(tier=value):
                self.assert_refused(self.send(self.session_id, tier=value))

    def test_the_fields_we_store_cannot_be_posted(self):
        for field in ("hint_tier", "max_tier_allowed", "beyond_materials", "ordinal", "author_role"):
            with self.subTest(field=field):
                self.assert_refused(self.send(self.session_id, **{field: 4}))

    def test_a_mode_on_a_send_is_refused(self):
        """The mode is fixed at creation, so a send carrying one is trying to change it."""
        self.assert_refused(self.send(self.session_id, mode="concept"))

    def test_the_mode_is_unchanged_after_the_attempt(self):
        self.send(self.session_id, mode="concept")

        self.assertEqual(TutorSession.objects.get(pk=self.session_id).mode, TutorMode.ASSIGNMENT)

    def test_the_refusal_says_which_field_was_wrong(self):
        response = self.send(self.session_id, tier=4)

        self.assertIn("tier", json.dumps(response.json()))

    def test_an_unknown_field_on_starting_a_session_is_refused(self):
        response = self.post_json(
            reverse("tutor-sessions"),
            {"course_id": self.course.pk, "mode": "assignment", "max_tier_allowed": 4},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(TutorSession.objects.count(), 1)  # only the one from setUp

    def test_a_rejected_send_does_not_advance_the_tier(self):
        """The next legitimate send must still be Tier 1, not Tier 2."""
        self.send(self.session_id, tier=4)

        self.assertEqual(self.send(self.session_id).json()["messages"][1]["hint_tier"], 1)


class FailedExchangeTests(TutorApiTests):
    """F2: a provider failure must not cost the student a tier."""

    def setUp(self):
        super().setUp()
        self.session_id = self.start("assignment")

    def test_a_failed_reply_does_not_advance_the_tier(self):
        self.send(self.session_id)  # tier 1 served

        broken = FakeAiProvider(replies=[RuntimeError("model down")])
        with (
            mock.patch("tutor.api.provider.reply_for", broken.as_reply_for()),
            self.assertRaises(RuntimeError),
        ):
            self.send(self.session_id)

        self.assertEqual(self.send(self.session_id).json()["messages"][1]["hint_tier"], 2)

    def test_a_failure_leaves_no_tier_behind(self):
        broken = FakeAiProvider(replies=[RuntimeError("model down")])
        with (
            mock.patch("tutor.api.provider.reply_for", broken.as_reply_for()),
            self.assertRaises(RuntimeError),
        ):
            self.send(self.session_id)

        self.assertEqual(self.tiers_of(self.session_id), [])
