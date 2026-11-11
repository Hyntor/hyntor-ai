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
    """Wipes the database and rebuilds it from the seed.

    The blunt instrument for when demo data has been edited into a mess. Unlike `seed`, this
    destroys data, which is why it refuses to run outside development without --force.
    """

    help = "Drop all data, re-apply migrations, clear stored files and seed. Destructive."

    def add_arguments(self, parser) -> None:
        """--force is the deliberate step required to wipe anything that is not a dev database."""
        parser.add_argument("--force", action="store_true", help="Allow the reset when DEBUG is off.")
        parser.add_argument("--password", default=None, help="Password for the seeded accounts.")

    def handle(self, *args, **options) -> None:
        """Drop every row, re-apply migrations, delete stored files, then seed.

        The files have to go too: rows and uploads are two halves of one state, and seeding over
        an old storage folder would leave materials pointing at files from a previous demo.
        """
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
