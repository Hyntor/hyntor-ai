"""Joining and leaving a course (CRS-2).

A student joins a course for the current term, which creates an Enrollment row. The home page then
shows one card per joined course, and each card leads to that course's tutor.
"""

import re

from django.db import IntegrityError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.views.decorators.http import require_http_methods

from courses.models import Course, Enrollment
from courses.terms import current_term


def joinable_courses(user) -> list[Course]:
    """Courses at this user's university that they have not already joined this term."""
    already_joined = Enrollment.objects.filter(user=user, term=current_term()).values("course_id")
    return list(
        Course.objects.filter(university=user.university).exclude(pk__in=already_joined).order_by("code")
    )


def joined_courses(user) -> list[Course]:
    """This term's courses, in the order they appear on a timetable."""
    return list(
        Course.objects.filter(enrollments__user=user, enrollments__term=current_term()).order_by("code")
    )


def courses_by_level(courses: list[Course]) -> list[tuple[str, list[Course]]]:
    """Group courses for the dropdown, e.g. "1000 level".

    The CSCI catalogue is over a hundred courses. One flat list is hard to scan, and <optgroup>
    groups it without any JavaScript. A code we cannot read a level from goes under "Other" rather
    than being dropped.
    """
    groups: dict[str, list[Course]] = {}
    for course in courses:
        digits = re.search(r"\d", course.code)
        label = f"{digits.group()}000 level" if digits else "Other"
        groups.setdefault(label, []).append(course)
    return sorted(groups.items())


@require_http_methods(["POST"])
def join_course(request: HttpRequest) -> HttpResponse:
    """Join one or more courses for the current term.

    The form posts a checkbox per course, so `course_id` arrives as a list. Someone registering for
    a semester picks their whole timetable at once rather than submitting the page five times.

    Unknown or other-university ids are ignored rather than refused: the valid choices in the same
    submission still go through, and the filter below means a guessed id can never enroll anyone.
    """
    if not request.user:
        return redirect("login")

    # Keep only values that could be a primary key. Without this, a posted "abc" reaches the
    # database layer and raises ValueError, which is a 500 page rather than a refusal.
    requested = [value for value in request.POST.getlist("course_id") if value.isdigit()]

    # The filter is the access control. Only courses at this user's own university can match, so
    # there is no way to enroll in someone else's course by editing the form.
    chosen = Course.objects.filter(pk__in=requested, university=request.user.university)

    for course in chosen:
        try:
            Enrollment.objects.get_or_create(user=request.user, course=course, term=current_term())
        except IntegrityError:
            # Two submissions racing each other. The row exists either way, which is all that matters.
            pass

    return redirect("home")


@require_http_methods(["POST"])
def leave_course(request: HttpRequest) -> HttpResponse:
    """Drop a course for the current term. Earlier terms are left alone (G2)."""
    if not request.user:
        return redirect("login")

    # Same guard as join_course: a non-numeric id reaching the database layer raises ValueError,
    # which is a 500 page rather than a no-op.
    course_id = request.POST.get("course_id", "")
    if not course_id.isdigit():
        return redirect("home")

    Enrollment.objects.filter(user=request.user, course_id=course_id, term=current_term()).delete()

    return redirect("home")
