"""Tests for uploading into a course library (LIB-1, #21).

    python manage.py test library.tests.test_uploads

Written as attacks, because the upload is the one place a stranger's bytes reach our disk: wrong
types dressed up with the right extension (C2), sizes either side of the limit (C3), the same file
twice (C4), a filename that tries to climb out of the storage folder, and people outside the course.
"""

import hashlib
import io
import tempfile
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from accounts.sessions import start_session
from library.models import ExtractionStatus, FileKind, Material
from library.uploads import MAX_BYTES, UploadRejected, add_material, detect_kind, title_for
from tests import clients, factories

SEED_FILES = Path(settings.BASE_DIR) / "seed" / "files"


def pdf(size: int = 200, filler: bytes = b"x") -> bytes:
    """Bytes of exactly `size` that pass the PDF signature check."""
    head = b"%PDF-1.4\n"
    return head + filler * (size - len(head))


def a_zip(*names: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name in names:
            archive.writestr(name, "x")
    return buffer.getvalue()


class UploadTests(TestCase):
    def setUp(self):
        storage = tempfile.TemporaryDirectory()
        self.addCleanup(storage.cleanup)
        self.storage_dir = Path(storage.name)
        override = override_settings(STORAGE_DIR=self.storage_dir)
        override.enable()
        self.addCleanup(override.disable)

        self.course = factories.a_course()
        self.student = clients.member(self.course)

    def upload(self, data=None, name="notes.pdf", title="", client=None, course=None):
        file = SimpleUploadedFile(name, pdf() if data is None else data)
        url = reverse("material-upload", args=[(course or self.course).pk])
        return (client or self.student).post(url, {"file": file, "title": title})

    def assert_refused(self, response, message, status=400):
        self.assertEqual(response.status_code, status)
        self.assertContains(response, message, status_code=status)
        self.assertEqual(Material.objects.count(), 0)

    def stored_files(self) -> list[Path]:
        return [p for p in self.storage_dir.rglob("*") if p.is_file()]

    # ------------------------------------------------------------------ the happy path

    def test_a_member_uploads_a_pdf(self):
        response = self.upload(name="Loops.pdf", title="Loop notes")

        material = Material.objects.get()
        self.assertRedirects(
            response,
            f"{reverse('course-library', args=[self.course.pk])}?uploaded={material.pk}#material-{material.pk}",
        )
        self.assertEqual(material.title, "Loop notes")
        self.assertEqual(material.file_kind, FileKind.PDF)
        self.assertEqual(material.uploader, self.student.user)
        self.assertEqual(material.extraction_status, ExtractionStatus.PENDING)
        self.assertEqual(material.sha256, hashlib.sha256(pdf()).hexdigest())
        self.assertEqual((self.storage_dir / material.storage_key).read_bytes(), pdf())

    def test_the_library_confirms_the_upload(self):
        response = self.upload(title="Loop notes")
        page = self.student.get(response["Location"])
        self.assertContains(page, "Uploaded &ldquo;Loop notes&rdquo;")

    def test_word_and_powerpoint_are_recognised_from_their_contents(self):
        for name, kind in (
            ("big-o-cheat-sheet.docx", FileKind.DOCX),
            ("recursion-slides.pptx", FileKind.PPTX),
        ):
            with self.subTest(name=name):
                self.upload((SEED_FILES / name).read_bytes(), name=name)
                self.assertEqual(Material.objects.get(file_kind=kind).title, Path(name).stem)

    def test_without_a_title_the_file_name_is_used(self):
        self.assertEqual(title_for("", "Week 3 - Recursion.pptx"), "Week 3 - Recursion")
        self.assertEqual(title_for("   ", ".pdf"), ".pdf")
        self.assertEqual(title_for("  Many   spaces  ", "x.pdf"), "Many spaces")
        self.assertEqual(len(title_for("t" * 500, "x.pdf")), 200)

    # ------------------------------------------------------------------ size (C3)

    def test_exactly_25_mb_is_accepted(self):
        self.assertEqual(self.upload(pdf(MAX_BYTES)).status_code, 302)
        self.assertEqual(Material.objects.get().byte_size, MAX_BYTES)

    def test_one_byte_over_25_mb_is_refused_and_nothing_is_stored(self):
        response = self.upload(pdf(MAX_BYTES + 1))

        self.assert_refused(response, "larger than the 25 MB limit", status=413)
        self.assertEqual(self.stored_files(), [])

    def test_the_size_is_checked_again_without_the_streaming_handler(self):
        """add_material may be called from code that is not this view (an attach in the tutor,
        a script), so the limit cannot rely on the handler alone."""
        with self.assertRaisesMessage(UploadRejected, "25 MB limit"):
            add_material(
                course=self.course, uploader=self.student.user, data=pdf(MAX_BYTES + 1), filename="x.pdf"
            )

    def test_an_empty_file_is_refused(self):
        self.assert_refused(self.upload(b""), "That file is empty.")

    def test_no_file_at_all_is_refused(self):
        response = self.student.post(reverse("material-upload", args=[self.course.pk]), {"title": "x"})
        self.assert_refused(response, "Choose a file to upload.")

    # ------------------------------------------------------------------ type, by signature (C2)

    def test_png_bytes_named_pdf_are_refused(self):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        self.assert_refused(self.upload(png, name="homework.pdf"), "Only PDF, Word")

    def test_a_renamed_executable_is_refused(self):
        exe = b"MZ\x90\x00" + b"\x00" * 100
        for name in ("setup.pdf", "setup.docx", "setup.pptx"):
            with self.subTest(name=name):
                self.assert_refused(self.upload(exe, name=name), "Only PDF, Word")

    def test_a_zip_that_is_neither_word_nor_powerpoint_is_refused(self):
        self.assert_refused(self.upload(a_zip("notes.txt"), name="notes.docx"), "Only PDF, Word")

    def test_a_damaged_zip_is_refused(self):
        self.assert_refused(self.upload(b"PK\x03\x04" + b"\x00" * 50, name="x.docx"), "looks damaged")

    def test_the_extension_is_not_what_decides_the_type(self):
        """Real PDF bytes under a .docx name are stored as what they are."""
        self.upload(pdf(), name="actually-a-pdf.docx")
        self.assertEqual(Material.objects.get().file_kind, FileKind.PDF)

    def test_detect_kind_unit(self):
        self.assertEqual(detect_kind(a_zip("word/document.xml")), FileKind.DOCX)
        self.assertEqual(detect_kind(a_zip("ppt/presentation.xml")), FileKind.PPTX)
        with self.assertRaises(UploadRejected):
            detect_kind(b"plain text")

    # ------------------------------------------------------------------ duplicates (C4)

    def test_the_same_file_twice_in_one_course_is_refused_with_a_link(self):
        self.upload(title="First copy")
        first = Material.objects.get()

        response = self.upload(title="Second copy")

        self.assertEqual(response.status_code, 409)
        self.assertContains(response, "already in the library as “First copy”", status_code=409)
        self.assertContains(response, f"#material-{first.pk}", status_code=409)
        self.assertEqual(Material.objects.count(), 1)

    def test_the_same_file_in_another_course_is_accepted(self):
        other = factories.a_course(self.course.university)
        factories.a_member(other, self.student.user)

        self.upload()
        self.upload(course=other)

        self.assertEqual(Material.objects.count(), 2)

    def test_a_removed_file_cannot_be_uploaded_again(self):
        self.upload()
        Material.objects.update(removed_at=timezone.now())

        response = self.upload()

        self.assertContains(response, "was removed from the course", status_code=400)
        self.assertEqual(Material.objects.count(), 1)

    # ------------------------------------------------------------------ where it is stored

    def test_a_hostile_filename_never_reaches_the_disk(self):
        self.upload(name="../../etc/passwd.pdf")

        material = Material.objects.get()
        self.assertEqual(material.storage_key, f"materials/{self.course.pk}/{material.sha256}.pdf")
        [stored] = self.stored_files()
        self.assertTrue(stored.resolve().is_relative_to(self.storage_dir.resolve()))
        self.assertNotIn("passwd", str(stored))
        self.assertEqual(material.title, "passwd")  # shown to people, escaped by the template

    def test_a_file_left_on_disk_from_before_is_reused(self):
        """After a database reset that kept the files, the same bytes map to the same key."""
        key = f"materials/{self.course.pk}/{hashlib.sha256(pdf()).hexdigest()}.pdf"
        (self.storage_dir / key).parent.mkdir(parents=True)
        (self.storage_dir / key).write_bytes(pdf())

        self.upload()

        self.assertEqual(Material.objects.get().storage_key, key)
        self.assertEqual(len(self.stored_files()), 1)

    # ------------------------------------------------------------------ who may upload

    def test_a_non_member_gets_403(self):
        same_university = clients.learner(self.course.university)
        for who in (same_university, clients.outsider(self.course)):
            with self.subTest(who=who.user.email):
                self.assertEqual(self.upload(client=who).status_code, 403)
        self.assertEqual(Material.objects.count(), 0)

    def test_signed_out_is_sent_to_sign_in(self):
        response = self.upload(client=clients.signed_out())
        self.assertRedirects(response, reverse("login"), fetch_redirect_response=False)

    def test_a_past_term_member_may_upload(self):
        user = factories.a_learner(self.course.university)
        factories.an_enrollment(user, self.course, term="2020-SP")
        self.assertEqual(self.upload(client=clients._as(user)).status_code, 302)

    def test_csrf_is_still_checked(self):
        """The view opts out of the CSRF middleware to install the size limit first, then checks
        CSRF itself. Without that second step any website could upload as a signed-in student."""
        browser = Client(enforce_csrf_checks=True)
        _session, token = start_session(self.student.user)
        browser.cookies[settings.SESSION_COOKIE_NAME] = token

        self.assertEqual(self.upload(client=browser).status_code, 403)
        self.assertEqual(Material.objects.count(), 0)

    def test_get_is_not_allowed(self):
        self.assertEqual(self.student.get(reverse("material-upload", args=[self.course.pk])).status_code, 405)
