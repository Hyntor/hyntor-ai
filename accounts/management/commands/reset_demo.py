"""Drop every row, re-apply migrations, clear stored files and seed again (FND-6, #11; ADM-1).

Destroys all data in DATABASE_URL and STORAGE_DIR. Intended for local databases and the demo, which is
why it refuses to run with DEBUG off unless --force is passed.

    python manage.py reset_demo
"""

import shutil
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Drop all data, re-apply migrations, clear stored files and seed. Destructive."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--force", action="store_true", help="Allow the reset when DEBUG is off.")
        parser.add_argument("--password", default=None, help="Password for the seeded accounts.")

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG and not options["force"]:
            raise CommandError("DEBUG is off. Re-run with --force only if this is a demo database.")

        call_command("flush", "--no-input")
        call_command("migrate", "--no-input")

        storage_dir = Path(settings.STORAGE_DIR)
        if storage_dir.exists():
            shutil.rmtree(storage_dir)

        seed_options = {"password": options["password"]} if options["password"] else {}
        call_command("seed", **seed_options)
        self.stdout.write(self.style.SUCCESS("Database reset and seeded."))
