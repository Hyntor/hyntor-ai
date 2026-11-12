"""Hyntor is for students, so only the student email domain stays registered.

An earlier seed registered olemiss.edu alongside go.olemiss.edu, which made staff and student
addresses belong to two different universities - and a Course belongs to exactly one university,
so they could never have shared a course. This removes the staff row.

It is deliberately cautious: the row is deleted only if nobody signed up under it and no course was
created under it. If either exists, the row stays and a human decides what to do with it.
"""

from django.db import migrations

STAFF_DOMAIN = "olemiss.edu"
STUDENT_DOMAIN = "go.olemiss.edu"
NAME = "University of Mississippi"


def remove_staff_domain(apps, schema_editor):
    University = apps.get_model("accounts", "University")

    staff = University.objects.filter(email_domain=STAFF_DOMAIN).first()
    if staff and not staff.users.exists() and not staff.courses.exists():
        staff.delete()

    # The "(students)" suffix only existed to tell the two rows apart.
    University.objects.filter(email_domain=STUDENT_DOMAIN).update(name=NAME)


def restore_staff_domain(apps, schema_editor):
    """Reversing recreates the row, so migrating backwards leaves a usable database."""
    University = apps.get_model("accounts", "University")
    University.objects.get_or_create(email_domain=STAFF_DOMAIN, defaults={"name": NAME})


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(remove_staff_domain, restore_staff_domain)]
