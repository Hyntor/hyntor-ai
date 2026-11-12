"""Rows to test against (FND-4, #9).

Every factory fills in whatever the test did not ask about, so a test names only the field it is
actually about. A test for the 25 MB cap says `a_material(byte_size=...)` and stays silent about
titles and SHA-256 digests, which makes the interesting value easy to see in the diff.

Values that must be unique across rows (emails, course codes, storage keys) get a counter rather
than a random value, so a failure reproduces on the next run.
"""

import hashlib
import itertools

from django.utils import timezone

from accounts.models import PlatformRole, University, User
from accounts.passwords import hash_password
from courses.models import Course, CourseRole, Enrollment
from library.models import ExtractionStatus, FileKind, Material, MaterialChunk
from tutor.models import TutorMode, TutorSession

# The password every factory-made account uses. Tests that sign in need to know it; it is not a
# secret, and S106 is ignored under tests/ for exactly this.
PASSWORD = "hyntor-test-password"

_counter = itertools.count(1)


def _next(prefix: str) -> str:
    return f"{prefix}{next(_counter)}"


def a_university(**fields) -> University:
    domain = fields.pop("email_domain", None) or f"{_next('school')}.edu"
    return University.objects.create(
        name=fields.pop("name", "Demo University"), email_domain=domain, **fields
    )


def a_user(university=None, *, verified=True, password=PASSWORD, **fields) -> User:
    """A learner by default. `verified=False` gives an account that has not confirmed its email."""
    university = university or a_university()
    email = fields.pop("email", None) or f"{_next('person')}@{university.email_domain}"
    verified_at = fields.pop("email_verified_at", timezone.now() if verified else None)
    return User.objects.create(
        university=university,
        email=email,
        display_name=fields.pop("display_name", "Test Person"),
        password_hash=fields.pop("password_hash", hash_password(password)),
        email_verified_at=verified_at,
        **fields,
    )


def a_learner(university=None, **fields) -> User:
    return a_user(university, platform_role=PlatformRole.LEARNER, **fields)


def an_unverified_learner(university=None, **fields) -> User:
    """Signed up but has not confirmed their email, so the tutor stays shut (ACC-5)."""
    return a_user(university, verified=False, platform_role=PlatformRole.LEARNER, **fields)


def an_admin(university=None, **fields) -> User:
    return a_user(university, platform_role=PlatformRole.ADMIN, **fields)


def a_course(university=None, **fields) -> Course:
    university = university or a_university()
    return Course.objects.create(
        university=university,
        code=fields.pop("code", None) or _next("CS"),
        title=fields.pop("title", "Test Course"),
        **fields,
    )


def an_enrollment(user, course, **fields) -> Enrollment:
    return Enrollment.objects.create(
        user=user,
        course=course,
        term=fields.pop("term", "2026-FA"),
        course_role=fields.pop("course_role", CourseRole.MEMBER),
        **fields,
    )


def a_maintainer(course, user=None, **fields) -> User:
    """Someone who may manage this one course, as opposed to the whole site."""
    user = user or a_learner(course.university)
    an_enrollment(user, course, course_role=CourseRole.MAINTAINER, **fields)
    return user


def a_member(course, user=None, **fields) -> User:
    user = user or a_learner(course.university)
    an_enrollment(user, course, course_role=CourseRole.MEMBER, **fields)
    return user


def someone_from_another_university(**fields) -> User:
    """The isolation case: a real, verified account with no business in this university's courses."""
    return a_learner(a_university(name="Other University"), **fields)


def a_material(course=None, uploader=None, *, chunks=0, **fields) -> Material:
    """A material. `chunks=n` also writes n indexed chunks and marks it indexed."""
    course = course or a_course()
    uploader = uploader or a_member(course)
    body = fields.pop("sha256", None) or hashlib.sha256(_next("material").encode()).hexdigest()
    status = fields.pop("extraction_status", ExtractionStatus.INDEXED if chunks else ExtractionStatus.PENDING)
    material = Material.objects.create(
        course=course,
        uploader=uploader,
        title=fields.pop("title", "Test Material"),
        file_kind=fields.pop("file_kind", FileKind.PDF),
        storage_key=fields.pop("storage_key", None) or _next("materials/key"),
        byte_size=fields.pop("byte_size", 1024),
        sha256=body,
        extraction_status=status,
        **fields,
    )
    for ordinal in range(chunks):
        a_chunk(material, ordinal=ordinal)
    return material


def a_chunk(material, *, ordinal=0, text=None, **fields) -> MaterialChunk:
    text = text if text is not None else f"Chunk {ordinal} of {material.title}."
    return MaterialChunk.objects.create(
        material=material,
        ordinal=ordinal,
        text=text,
        char_count=fields.pop("char_count", len(text)),
        **fields,
    )


def a_tutor_session(course=None, student=None, **fields) -> TutorSession:
    course = course or a_course()
    student = student or a_member(course)
    return TutorSession.objects.create(
        course=course,
        student=student,
        mode=fields.pop("mode", TutorMode.CONCEPT),
        **fields,
    )
