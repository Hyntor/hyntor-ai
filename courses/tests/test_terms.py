"""Tests for the academic term helper.

    python manage.py test courses.tests.test_terms

Enrollment is keyed on a term, so this function decides which term a student joins. Getting a
boundary wrong puts someone in the wrong semester, and changes the course list they see with it.
No database is involved, so SimpleTestCase is enough.
"""

from datetime import date

from django.test import SimpleTestCase

from courses.terms import current_term, term_for, term_label


class TermForTests(SimpleTestCase):
    def test_every_month_of_the_year_maps_to_a_term(self):
        """A missing month would raise a KeyError at the moment a student clicks Join."""
        for month in range(1, 13):
            with self.subTest(month=month):
                self.assertRegex(term_for(date(2026, month, 15)), r"^2026-(SP|SU|FA)$")

    def test_the_spring_to_summer_boundary(self):
        """31 May is still spring; 1 June is summer."""
        self.assertEqual(term_for(date(2026, 5, 31)), "2026-SP")
        self.assertEqual(term_for(date(2026, 6, 1)), "2026-SU")

    def test_the_summer_to_autumn_boundary(self):
        self.assertEqual(term_for(date(2026, 7, 31)), "2026-SU")
        self.assertEqual(term_for(date(2026, 8, 1)), "2026-FA")

    def test_the_year_boundary(self):
        """New Year's Eve is the autumn term; New Year's Day is the next spring."""
        self.assertEqual(term_for(date(2026, 12, 31)), "2026-FA")
        self.assertEqual(term_for(date(2027, 1, 1)), "2027-SP")

    def test_the_term_carries_the_calendar_year(self):
        self.assertEqual(term_for(date(2030, 9, 2)), "2030-FA")


class CurrentTermTests(SimpleTestCase):
    def test_it_returns_a_well_formed_term(self):
        self.assertRegex(current_term(), r"^\d{4}-(SP|SU|FA)$")

    def test_it_agrees_with_term_for_today(self):
        self.assertEqual(current_term(), term_for(date.today()))


class TermLabelTests(SimpleTestCase):
    def test_it_reads_as_a_person_would_say_it(self):
        self.assertEqual(term_label("2026-FA"), "Fall 2026")
        self.assertEqual(term_label("2027-SP"), "Spring 2027")
        self.assertEqual(term_label("2026-SU"), "Summer 2026")

    def test_an_unknown_code_is_shown_rather_than_hidden(self):
        """Old data with a code we no longer use should still render, not crash the page."""
        self.assertEqual(term_label("2024-XX"), "XX 2024")
