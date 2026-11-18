"""Django app config for courses: courses and the enrollments that join students to them."""

# Default file generated with every Django app. Hyntor does not need anything from it: deleting it
# works, because Django falls back to a built-in AppConfig and DEFAULT_AUTO_FIELD is set in
# settings.py. Kept because it is the standard Django layout, and because startup hooks such as
# ready() would go here if the app ever needs one.
from django.apps import AppConfig


class CoursesConfig(AppConfig):
    name = "courses"
