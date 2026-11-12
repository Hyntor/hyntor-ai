"""Joining and leaving a course (CRS-2).

A student joins a course for the current term, which creates an Enrollment row. The home page then
shows one card per joined course, and each card leads to that course's tutor.
"""

import re

from django.db import IntegrityError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect
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
    """Join one course for the current term."""
    if not request.user:
        return redirect("login")

    # Scoped to the user's own university, so a guessed id cannot enroll them elsewhere.
    course = get_object_or_404(Course, pk=request.POST.get("course_id"), university=request.user.university)

    try:
        Enrollment.objects.get_or_create(user=request.user, course=course, term=current_term())
    except IntegrityError:
        # Two clicks racing each other. The row exists either way, which is all that matters.
        pass

    return redirect("home")


@require_http_methods(["POST"])
def leave_course(request: HttpRequest) -> HttpResponse:
    """Drop a course for the current term. Earlier terms are left alone (G2)."""
    if not request.user:
        return redirect("login")

    Enrollment.objects.filter(
        user=request.user, course_id=request.POST.get("course_id"), term=current_term()
    ).delete()

    return redirect("home")
