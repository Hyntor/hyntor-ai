"""Demo data for local development, the demo and ADM-1's reset (FND-6, #11).

Idempotent (E2): every write is a get_or_create on a natural key, so a second run creates nothing.

    python manage.py seed
"""

import hashlib
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import PlatformRole, University, User
from accounts.passwords import hash_password
from courses.models import Course, CourseRole, Enrollment
from library.models import FileKind, Material

SEED_FILES_DIR = Path(settings.BASE_DIR) / "seed" / "files"

DEFAULT_PASSWORD = "hyntor-demo-password"

UNIVERSITY = {"name": "Demo University", "email_domain": "example.edu"}

USERS = [
    ("admin", "admin@example.edu", "Avery Admin", PlatformRole.ADMIN),
    ("maintainer", "maintainer@example.edu", "Morgan Maintainer", PlatformRole.LEARNER),
    ("learner1", "learner1@example.edu", "Lee Learner", PlatformRole.LEARNER),
    ("learner2", "learner2@example.edu", "Riley Learner", PlatformRole.LEARNER),
]

COURSE = {"code": "CSCI 1010", "title": "Introduction to Programming (Demo)"}

# Two terms, so a current-term learner can see an earlier term's materials (G2).
ENROLLMENTS = [
    ("maintainer", "2026-SP", CourseRole.MAINTAINER),
    ("maintainer", "2026-FA", CourseRole.MAINTAINER),
    ("learner1", "2026-SP", CourseRole.MEMBER),
    ("learner2", "2026-FA", CourseRole.MEMBER),
]

# Original notes the team wrote for this demo, not copyrighted course files (T9).
MATERIALS = [
    ("loops-and-iteration-notes.pdf", "Loops and Iteration Notes", FileKind.PDF, "learner1"),
    ("big-o-cheat-sheet.docx", "Big-O Cheat Sheet", FileKind.DOCX, "maintainer"),
    ("recursion-slides.pptx", "Recursion Slides", FileKind.PPTX, "maintainer"),
]


class Command(BaseCommand):
    help = "Load the demo university, accounts, course and materials. Safe to run more than once."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--password",
            default=DEFAULT_PASSWORD,
            help=f"Password for every seeded account (default: {DEFAULT_PASSWORD}).",
        )

    @transaction.atomic
    def handle(self, *args, **options) -> None:
        university, _ = University.objects.get_or_create(
            email_domain=UNIVERSITY["email_domain"], defaults={"name": UNIVERSITY["name"]}
        )

        users: dict[str, User] = {}
        for key, email, display_name, role in USERS:
            users[key], _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "university": university,
                    "display_name": display_name,
                    "platform_role": role,
                    # ACC-3 owns signup; the seed hashes directly with the same helper.
                    "password_hash": hash_password(options["password"]),
                    "email_verified_at": timezone.now(),
                },
            )

        course, _ = Course.objects.get_or_create(
            university=university, code=COURSE["code"], defaults={"title": COURSE["title"]}
        )

        for user_key, term, role in ENROLLMENTS:
            Enrollment.objects.get_or_create(
                user=users[user_key], course=course, term=term, defaults={"course_role": role}
            )

        storage_dir = Path(settings.STORAGE_DIR)
        for filename, title, file_kind, uploader_key in MATERIALS:
            data = (SEED_FILES_DIR / filename).read_bytes()
            sha256 = hashlib.sha256(data).hexdigest()
            storage_key = f"materials/{course.pk}/{sha256}.{file_kind}"

            target = storage_dir / storage_key
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)

            # Extraction (LIB-2) indexes pending materials; the seed only registers them.
            Material.objects.get_or_create(
                course=course,
                sha256=sha256,
                defaults={
                    "uploader": users[uploader_key],
                    "title": title,
                    "file_kind": file_kind,
                    "storage_key": storage_key,
                    "byte_size": len(data),
                },
            )

        emails = ", ".join(email for _, email, _, _ in USERS)
        self.stdout.write(self.style.SUCCESS(f"Seeded. Sign in as {emails}"))
