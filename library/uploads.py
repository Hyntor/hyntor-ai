"""Uploading a file into a course library (LIB-1, #21).

Everything about an upload that is not HTTP lives here, so it can be tested without a request: what
counts as a PDF, Word or PowerPoint file (C2), the size limits (C3), duplicate detection (C4), and
where the bytes are stored (ADR-0005). courses/views.py upload_material is the view around it.
"""

import hashlib
import io
import zipfile
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadhandler import FileUploadHandler, StopUpload
from django.db import IntegrityError, transaction

from library.models import FileKind, Material

MAX_BYTES = 25 * 1024 * 1024  # C3. The limit students are told, so it is stated in MB in the message.
MAX_MB = MAX_BYTES // (1024 * 1024)

TITLE_MAX_LENGTH = Material._meta.get_field("title").max_length

ACCEPTED = "Only PDF, Word (.docx) and PowerPoint (.pptx) files can be uploaded."


class UploadRejected(Exception):
    """The file cannot be added, with a reason written for the student."""


class DuplicateMaterial(UploadRejected):
    """These exact bytes are already in the course (C4). Carries the material that has them."""

    def __init__(self, existing: Material) -> None:
        self.existing = existing
        super().__init__(f"This file is already in the library as “{existing.title}”.")


class SizeLimitUploadHandler(FileUploadHandler):
    """Stops reading a file the moment it passes MAX_BYTES (C3).

    Django otherwise reads the whole upload to a temporary file before the view sees it, so a 2 GB
    file would be written to disk only to be refused. This handler sits first in the chain, counts
    each chunk as it arrives, and gives up as soon as the count passes the limit. The view finds
    `request.upload_too_large` set and the file missing from request.FILES.
    """

    def __init__(self, request=None, limit: int = MAX_BYTES) -> None:
        super().__init__(request)
        self.limit = limit
        self.received = 0

    def new_file(self, *args, **kwargs) -> None:
        super().new_file(*args, **kwargs)
        self.received = 0

    def receive_data_chunk(self, raw_data: bytes, start: int) -> bytes:
        self.received += len(raw_data)
        if self.received > self.limit:
            self.request.upload_too_large = True
            # connection_reset=False: the rest of the body is read and thrown away rather than
            # stored, so the browser still receives the error page instead of a dropped connection.
            raise StopUpload(connection_reset=False)
        return raw_data  # pass the chunk on to Django's own handlers

    def file_complete(self, file_size: int) -> None:
        return None  # the handlers after this one build the file


def detect_kind(data: bytes) -> FileKind:
    """The file's type from its bytes, never its name or the browser's content type (C2).

    A PDF starts with "%PDF-". Word and PowerPoint files are both ZIP archives, told apart by the
    part every such file has. Reading a ZIP's table of contents decompresses nothing, so this is
    safe on a hostile archive; extraction (LIB-2, LIB-3) is where the contents are opened.
    """
    if data.startswith(b"%PDF-"):
        return FileKind.PDF
    if data.startswith(b"PK\x03\x04"):
        try:
            names = set(zipfile.ZipFile(io.BytesIO(data)).namelist())
        except zipfile.BadZipFile:
            raise UploadRejected(f"That file looks damaged and could not be read. {ACCEPTED}") from None
        if "word/document.xml" in names:
            return FileKind.DOCX
        if "ppt/presentation.xml" in names:
            return FileKind.PPTX
    raise UploadRejected(ACCEPTED)


def storage_key(course_id: int, sha256: str, kind: str) -> str:
    """ADR-0005: content-addressed, built only from values we computed. The student's filename
    never reaches the disk, so a name like "../../etc/passwd.pdf" cannot place a file anywhere."""
    return f"materials/{course_id}/{sha256}.{kind}"


def material_storage() -> FileSystemStorage:
    """Django's storage API over STORAGE_DIR (ADR-0005 as amended by ADR-0010).

    A function, not a module constant, so tests that override STORAGE_DIR get their own folder.
    """
    return FileSystemStorage(location=settings.STORAGE_DIR)


def title_for(given: str, filename: str) -> str:
    """The title the student typed, else the file's name without its extension."""
    title = " ".join(given.split()) or Path(filename).stem.strip() or "Untitled"
    return title[:TITLE_MAX_LENGTH]


def add_material(*, course, uploader, data: bytes, filename: str, title: str = "") -> Material:
    """Validate the bytes, store them, and create the Material as pending (LIB-1).

    Raises UploadRejected (or DuplicateMaterial) with a message for the student. Checks run cheapest
    first: size, then type, then the database.
    """
    if not data:
        raise UploadRejected("That file is empty.")
    if len(data) > MAX_BYTES:
        # The streaming handler normally stops these first; this is the backstop for any caller
        # that hands over bytes some other way.
        raise UploadRejected(f"That file is larger than the {MAX_MB} MB limit.")

    kind = detect_kind(data)
    sha256 = hashlib.sha256(data).hexdigest()

    # The unique constraint covers removed materials too, so a removed file cannot come back as a
    # new row; it says so rather than linking to something that is no longer listed.
    existing = Material.objects.filter(course=course, sha256=sha256).first()
    if existing is not None:
        if existing.is_removed:
            raise UploadRejected("This file was removed from the course and cannot be uploaded again.")
        raise DuplicateMaterial(existing)

    key = storage_key(course.pk, sha256, kind)
    storage = material_storage()
    # Same key means same bytes, so a file already there (say, from before a database reset) is
    # kept. Saving over it would make Django pick a new name, and the row would point at the wrong one.
    if not storage.exists(key):
        storage.save(key, ContentFile(data))

    try:
        with transaction.atomic():
            material = Material.objects.create(
                course=course,
                uploader=uploader,
                title=title_for(title, filename),
                file_kind=kind,
                storage_key=key,
                byte_size=len(data),
                sha256=sha256,
            )
    except IntegrityError:
        # Two people uploaded the same file at the same moment and the other request won.
        raise DuplicateMaterial(Material.objects.get(course=course, sha256=sha256)) from None

    # Extraction (LIB-2, #22) starts here once it exists. Until then new materials stay pending.
    return material
