"""Tests for the seed command (FND-6, #11).

    python manage.py test accounts.tests.test_seed

The rule the issue states is E2: running the seed twice must leave the database exactly as it was after
the first run. A seed that duplicates rows breaks the demo and every test that depends on it.
"""

import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase, override_settings

from accounts.management.commands.seed import (
    CSCI_COURSES_FILE,
    DEFAULT_PASSWORD,
    MATERIALS,
    OLE_MISS_DOMAIN,
    UNIVERSITIES,
    USERS,
)
from accounts.models import University, User
from accounts.passwords import verify_password
from courses.models import Course, Enrollment
from library.models import Material


def row_counts():
    return {
        "universities": University.objects.count(),
        "users": User.objects.count(),
        "courses": Course.objects.count(),
        "enrollments": Enrollment.objects.count(),
        "materials": Material.objects.count(),
    }


class SeedCommandTests(TestCase):
    def setUp(self):
        # A throwaway directory per test, so the seed never writes into the real .storage folder.
        self._storage = tempfile.TemporaryDirectory()
        self.addCleanup(self._storage.cleanup)
        self.storage_dir = Path(self._storage.name)

    def seed(self, **kwargs):
        # stdout is captured so the command's success message does not clutter the test output.
        with override_settings(STORAGE_DIR=self.storage_dir):
            call_command("seed", stdout=StringIO(), **kwargs)

    def test_it_creates_the_demo_data(self):
        self.seed()

        self.assertEqual(
            row_counts(),
            {
                "universities": len(UNIVERSITIES),
                "users": len(USERS),
                # The demo course, plus the whole CSCI catalogue.
                "courses": 1 + len(json.loads(CSCI_COURSES_FILE.read_text(encoding="utf-8"))),
                "enrollments": 4,
                "materials": len(MATERIALS),
            },
        )

    def test_running_it_twice_changes_nothing(self):
        """E2. The second run must create no rows and raise no error."""
        self.seed()
        after_first = row_counts()

        self.seed()

        self.assertEqual(row_counts(), after_first)

    def test_it_enrolls_people_in_two_different_terms(self):
        """G2 depends on this: a learner who joins later still sees an earlier term's materials."""
        self.seed()

        terms = set(Enrollment.objects.values_list("term", flat=True))

        self.assertEqual(terms, {"2026-SP", "2026-FA"})

    def test_seeded_accounts_store_argon2id_hashes(self):
        """The demo password must be hashed like any other, not stored as text."""
        self.seed()

        for user in User.objects.all():
            with self.subTest(email=user.email):
                self.assertTrue(user.password_hash.startswith("$argon2id$"))
                self.assertNotIn(DEFAULT_PASSWORD, user.password_hash)
                self.assertTrue(verify_password(user.password_hash, DEFAULT_PASSWORD))

    def test_a_custom_password_is_used_when_given(self):
        self.seed(password="a-different-password")

        user = User.objects.first()

        self.assertTrue(verify_password(user.password_hash, "a-different-password"))
        self.assertFalse(verify_password(user.password_hash, DEFAULT_PASSWORD))

    def test_every_material_file_is_copied_into_storage(self):
        """The rows are useless without the files they point at."""
        self.seed()

        for material in Material.objects.all():
            with self.subTest(title=material.title):
                stored = self.storage_dir / material.storage_key
                self.assertTrue(stored.exists(), f"missing {material.storage_key}")
                self.assertEqual(stored.stat().st_size, material.byte_size)

    def test_the_second_run_restores_a_deleted_file(self):
        """The rows already exist, so a naive 'skip if the row is there' would leave the file missing."""
        self.seed()
        material = Material.objects.first()
        (self.storage_dir / material.storage_key).unlink()

        self.seed()

        self.assertTrue((self.storage_dir / material.storage_key).exists())


class RegisteredDomainTests(TestCase):
    """The University rows ARE the signup allowlist, so the seed decides who can create an account."""

    def setUp(self):
        self._storage = tempfile.TemporaryDirectory()
        self.addCleanup(self._storage.cleanup)
        with override_settings(STORAGE_DIR=Path(self._storage.name)):
            call_command("seed", stdout=StringIO())

    def test_it_registers_every_listed_domain(self):
        stored = set(University.objects.values_list("email_domain", flat=True))

        self.assertEqual(stored, {u["email_domain"] for u in UNIVERSITIES})

    def test_the_student_domain_is_registered(self):
        """Ole Miss issues student addresses at go.olemiss.edu."""
        self.assertTrue(University.objects.filter(email_domain="go.olemiss.edu").exists())

    def test_the_staff_domain_is_not_registered(self):
        """Hyntor is for students. Registering olemiss.edu as well would put staff in a separate
        university, and a course belongs to exactly one, so they could never share a course."""
        self.assertFalse(University.objects.filter(email_domain="olemiss.edu").exists())

    def test_an_unregistered_domain_is_still_refused(self):
        self.assertFalse(University.objects.filter(email_domain="gmail.com").exists())


class CsciCatalogueTests(TestCase):
    """The courses students actually join (CRS-2) come from the real Ole Miss CSCI listing."""

    def setUp(self):
        self._storage = tempfile.TemporaryDirectory()
        self.addCleanup(self._storage.cleanup)
        with override_settings(STORAGE_DIR=Path(self._storage.name)):
            call_command("seed", stdout=StringIO())
        self.catalogue = json.loads(CSCI_COURSES_FILE.read_text(encoding="utf-8"))

    def test_every_course_in_the_file_is_loaded(self):
        stored = set(
            Course.objects.filter(university__email_domain=OLE_MISS_DOMAIN).values_list("code", flat=True)
        )

        self.assertEqual(stored, {entry["code"] for entry in self.catalogue})

    def test_the_courses_belong_to_ole_miss_not_the_demo_university(self):
        """A student at go.olemiss.edu only sees courses at their own university."""
        demo_codes = Course.objects.filter(university__email_domain="example.edu").values_list(
            "code", flat=True
        )

        self.assertNotIn("CSCI 1011", demo_codes)

    def test_running_the_seed_twice_does_not_duplicate_the_catalogue(self):
        before = Course.objects.count()

        with override_settings(STORAGE_DIR=Path(self._storage.name)):
            call_command("seed", stdout=StringIO())

        self.assertEqual(Course.objects.count(), before)

    def test_the_file_has_no_duplicate_codes(self):
        """A duplicate would silently collapse into one course under the unique constraint."""
        codes = [entry["code"] for entry in self.catalogue]

        self.assertEqual(len(codes), len(set(codes)))
