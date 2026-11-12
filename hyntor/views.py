"""The home page.

One URL, two pages: a landing page that explains the product to a visitor, and a course dashboard
for a student who has signed in. Which one renders is decided here rather than in the template, so
a signed-out visitor never causes a course query.
"""

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render

from courses.terms import current_term, term_label
from courses.views import courses_by_level, joinable_courses, joined_courses


def home(request: HttpRequest) -> HttpResponse:
    """The landing page for a visitor, and the course dashboard for a student."""
    if not request.user:
        return render(request, "home.html")

    return render(
        request,
        "home.html",
        {
            "my_courses": joined_courses(request.user),
            "courses_to_join": courses_by_level(joinable_courses(request.user)),
            "term": term_label(current_term()),
        },
    )
