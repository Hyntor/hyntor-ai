"""Tests for /courses/<id>/, the course library (CRS-4, #24).

    python manage.py test courses.tests.test_library

The page's promise is G2: a course's materials outlive the term they were shared in. The rest is
who may see them (G5: 403 for anyone not in the course) and that the list can be found in.
"""

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from courses.models import CourseRole
from courses.views import LIBRARY_PAGE_SIZE
from library.models import ExtractionStatus, Material
from tests import clients, factories

PAST_TERM = "2020-SP"


class LibraryTests(TestCase):
    def setUp(self):
        self.course = factories.a_course(code="CSCI 1010")

    def url(self, course=None, **params):
        return reverse("course-library", args=[(course or self.course).pk])

    def titles(self, response) -> list[str]:
        return [m.title for m in response.context["page"].object_list]

    def person(self, display_name):
        return factories.a_learner(self.course.university, display_name=display_name)

    def a_material(self, title="Notes", **fields):
        return factories.a_material(self.course, title=title, **fields)

    # ------------------------------------------------------------------ who may see it

    def test_signed_out_is_sent_to_sign_in(self):
        response = clients.signed_out().get(self.url())
        self.assertRedirects(response, reverse("login"), fetch_redirect_response=False)

    def test_anyone_not_in_the_course_gets_403(self):
        """G5. Same university but never enrolled, another university, and an admin of neither."""
        same_university = clients.learner(self.course.university)
        for who in (same_university, clients.outsider(self.course), clients.admin()):
            with self.subTest(who=who.user.email):
                self.assertEqual(who.get(self.url()).status_code, 403)

    def test_a_course_that_does_not_exist_is_404(self):
        client = clients.member(self.course)
        self.assertEqual(client.get(reverse("course-library", args=[999_999])).status_code, 404)

    def test_a_member_from_a_past_term_can_still_read_it(self):
        user = factories.a_learner(self.course.university)
        factories.an_enrollment(user, self.course, term=PAST_TERM)
        self.assertEqual(clients._as(user).get(self.url()).status_code, 200)

    def test_an_unverified_member_can_read_it(self):
        """Only the tutor needs a verified address; the library spends no AI quota."""
        user = factories.an_unverified_learner(self.course.university)
        factories.an_enrollment(user, self.course)
        self.assertEqual(clients._as(user).get(self.url()).status_code, 200)

    # ------------------------------------------------------------------ what it lists

    def test_a_later_learner_sees_every_earlier_terms_material(self):
        """G2: someone who joins this term sees 100% of what was shared in earlier terms."""
        earlier = factories.a_learner(self.course.university)
        factories.an_enrollment(earlier, self.course, term=PAST_TERM)
        shared = {factories.a_material(self.course, earlier, title=f"Week {n}").title for n in range(5)}

        response = clients.member(self.course).get(self.url())

        self.assertEqual(set(self.titles(response)), shared)

    def test_it_shows_title_type_uploader_date_and_status(self):
        uploader = factories.a_member(self.course, self.person("Lee Learner"))
        factories.a_material(
            self.course, uploader, title="Recursion Slides", file_kind="pptx", extraction_status="failed"
        )

        response = clients.member(self.course).get(self.url())

        for text in ("Recursion Slides", "PowerPoint slides", "Lee Learner", "Failed", "badge-failed"):
            self.assertContains(response, text)

    def test_removed_materials_are_never_listed(self):
        self.a_material("Kept")
        self.a_material("Taken down", removed_at=timezone.now())

        response = clients.member(self.course).get(self.url())

        self.assertEqual(self.titles(response), ["Kept"])
        self.assertNotContains(response, "Taken down")

    def test_another_courses_materials_are_not_listed(self):
        factories.a_material(factories.a_course(self.course.university), title="Elsewhere")
        self.assertEqual(self.titles(clients.member(self.course).get(self.url())), [])

    def test_newest_first(self):
        now = timezone.now()
        for title, age in (("Old", 3), ("Newest", 1), ("Middle", 2)):
            material = self.a_material(title)
            Material.objects.filter(pk=material.pk).update(uploaded_at=now - timedelta(days=age))

        response = clients.member(self.course).get(self.url())

        self.assertEqual(self.titles(response), ["Newest", "Middle", "Old"])

    def test_order_is_stable_when_timestamps_are_equal(self):
        """Without a tie-breaker the database may return ties in any order, and a material can
        appear on two pages or on none."""
        materials = [self.a_material(f"Same {n}") for n in range(3)]
        Material.objects.filter(course=self.course).update(uploaded_at=timezone.now())
        client = clients.member(self.course)

        first = self.titles(client.get(self.url()))

        self.assertEqual(first, [m.title for m in reversed(materials)])
        self.assertEqual(self.titles(client.get(self.url())), first)

    # ------------------------------------------------------------------ filter and pages

    def test_the_filter_is_a_case_insensitive_substring(self):
        self.a_material("Big-O Cheat Sheet")
        self.a_material("Recursion Slides")

        response = clients.member(self.course).get(self.url(), {"q": "  cheat  "})

        self.assertEqual(self.titles(response), ["Big-O Cheat Sheet"])

    def test_percent_and_underscore_are_matched_literally(self):
        """A LIKE wildcard that slipped through would make "%" match every title."""
        self.a_material("100% pass rate")
        self.a_material("snake_case names")
        self.a_material("Plain title")
        client = clients.member(self.course)

        self.assertEqual(self.titles(client.get(self.url(), {"q": "%"})), ["100% pass rate"])
        self.assertEqual(self.titles(client.get(self.url(), {"q": "_"})), ["snake_case names"])

    def test_no_match_says_so(self):
        self.a_material("Notes")
        response = clients.member(self.course).get(self.url(), {"q": "nothing"})
        self.assertContains(response, "No materials have a title containing")

    def test_it_is_paginated_and_keeps_the_filter_across_pages(self):
        for n in range(LIBRARY_PAGE_SIZE + 1):
            self.a_material(f"Lab {n}")
        client = clients.member(self.course)

        first = client.get(self.url(), {"q": "lab"})
        second = client.get(self.url(), {"q": "lab", "page": 2})

        self.assertEqual(len(self.titles(first)), LIBRARY_PAGE_SIZE)
        self.assertEqual(len(self.titles(second)), 1)
        self.assertContains(first, "?q=lab&amp;page=2")

    def test_a_bad_page_number_shows_a_page_rather_than_an_error(self):
        self.a_material("Notes")
        response = clients.member(self.course).get(self.url(), {"page": "abc"})
        self.assertEqual(self.titles(response), ["Notes"])

    # ------------------------------------------------------------------ empty state and upload

    def test_an_empty_library_points_to_upload(self):
        response = clients.member(self.course).get(self.url())

        self.assertContains(response, 'href="#upload"')
        self.assertContains(response, 'id="upload"')

    # ------------------------------------------------------------------ roster

    def test_the_roster_lists_this_terms_members_only(self):
        factories.a_member(self.course, self.person("Riley Now"))
        factories.a_maintainer(self.course, self.person("Morgan Maintainer"))
        factories.a_member(self.course, self.person("Lee Then"), term=PAST_TERM)

        response = clients.member(self.course).get(self.url())

        members = [e.user.display_name for e in response.context["members"]]
        self.assertIn("Riley Now", members)
        self.assertIn("Morgan Maintainer", members)
        self.assertNotIn("Lee Then", members)
        self.assertContains(response, "Maintainer</span>")

    def test_past_term_contributors_are_counted_once_each(self):
        """B6: people not here this term whose shared materials are still listed."""
        uni = self.course.university
        past = factories.a_learner(uni)
        factories.an_enrollment(past, self.course, term=PAST_TERM)
        factories.a_material(self.course, past, title="One")
        factories.a_material(self.course, past, title="Two")  # same person: still one contributor
        removed_only = factories.a_learner(uni)
        factories.an_enrollment(removed_only, self.course, term=PAST_TERM)
        factories.a_material(self.course, removed_only, removed_at=timezone.now())
        current = factories.a_member(self.course)
        factories.a_material(self.course, current, title="Mine")  # here this term: not "past"

        response = clients.member(self.course).get(self.url())

        self.assertEqual(response.context["past_contributors"], 1)
        self.assertContains(response, "1 past-term contributor")

    # ------------------------------------------------------------------ links

    def test_the_tutor_link_shows_only_for_this_terms_members(self):
        tutor = reverse("course-tutor", args=[self.course.pk])
        past = factories.a_learner(self.course.university)
        factories.an_enrollment(past, self.course, term=PAST_TERM, course_role=CourseRole.MEMBER)

        self.assertContains(clients.member(self.course).get(self.url()), tutor)
        self.assertNotContains(clients._as(past).get(self.url()), tutor)

    def test_the_home_page_card_links_to_the_library(self):
        client = clients.member(self.course)
        self.assertContains(client.get(reverse("home")), self.url())

    def test_pending_is_the_badge_for_a_new_upload(self):
        self.a_material("Fresh", extraction_status=ExtractionStatus.PENDING)
        self.assertContains(clients.member(self.course).get(self.url()), "badge-pending")
