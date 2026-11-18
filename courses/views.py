"""Joining and leaving a course (CRS-2), the course library (CRS-4) and uploading to it (LIB-1).

A student joins a course for the current term, which creates an Enrollment row. The home page then
shows one card per joined course, and each card leads to that course's tutor and its library.
"""

import re

from django.core.exceptions import PermissionDenied
from django.core.paginator import Paginator
from django.db import IntegrityError
from django.http import HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt, csrf_protect
from django.views.decorators.http import require_http_methods

from courses.models import Course, Enrollment
from courses.terms import current_term, term_label
from library import uploads
from library.models import Material

# Materials per page of the course library (CRS-4).
LIBRARY_PAGE_SIZE = 20


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


def member_course(request: HttpRequest, course_id: int):
    """The course and the caller's enrollments in it, or 403 if they have none (G5).

    Any term counts, at the caller's own university, so a student who took the course last spring
    can still read and add to what was shared (G2). A course id that does not exist is 404.
    """
    course = get_object_or_404(Course, pk=course_id)
    enrolled = Enrollment.objects.filter(
        user=request.user, course=course, course__university=request.user.university
    )
    if not enrolled.exists():
        raise PermissionDenied
    return course, enrolled


def render_library(request: HttpRequest, course: Course, enrolled, *, error="", existing=None, status=200):
    """The library page, also used to show an upload's error in place, next to the form."""
    term = current_term()
    query = request.GET.get("q", "").strip()

    # Removed materials stay in the table for the audit trail and are never listed (E3). Newest
    # first, with the id breaking ties, so two uploads in the same instant never swap places
    # between one page and the next.
    materials = (
        Material.objects.filter(course=course, removed_at__isnull=True)
        .select_related("uploader")
        .order_by("-uploaded_at", "-pk")
    )
    if query:
        # icontains escapes % and _, so they match themselves rather than acting as wildcards.
        materials = materials.filter(title__icontains=query)
    page = Paginator(materials, LIBRARY_PAGE_SIZE).get_page(request.GET.get("page"))

    members = (
        Enrollment.objects.filter(course=course, term=term)
        .select_related("user")
        .order_by("user__display_name", "user__pk")
    )
    # Past-term contributors (B6): people who shared a material still listed here and are not
    # enrolled this term - the students whose notes a current learner is reading.
    past_contributors = (
        Material.objects.filter(course=course, removed_at__isnull=True)
        .exclude(uploader__in=members.values("user"))
        .values("uploader")
        .distinct()
        .count()
    )

    # ?uploaded=<id> is where a successful upload lands. Only a listed material of this course
    # counts, so the parameter cannot be used to show another course's titles.
    uploaded = (
        Material.objects.filter(pk=request.GET["uploaded"], course=course, removed_at__isnull=True).first()
        if request.GET.get("uploaded", "").isdigit()
        else None
    )

    return render(
        request,
        "courses/library.html",
        {
            "course": course,
            "page": page,
            "query": query,
            "members": members,
            "past_contributors": past_contributors,
            "term": term_label(term),
            "enrolled_this_term": enrolled.filter(term=term).exists(),
            "max_mb": uploads.MAX_MB,
            "uploaded": uploaded,
            "upload_error": error,
            "existing": existing,
        },
        status=status,
    )


@require_http_methods(["GET"])
def course_library(request: HttpRequest, course_id: int) -> HttpResponse:
    """The course library (CRS-4): every term's materials, a title filter, the roster and upload.

    The email check that gates the tutor does not apply here: reading the library spends no AI quota.
    """
    if not request.user:
        return redirect("login")
    course, enrolled = member_course(request, course_id)
    return render_library(request, course, enrolled)


@csrf_exempt
@require_http_methods(["POST"])
def upload_material(request: HttpRequest, course_id: int) -> HttpResponse:
    """Add a PDF, Word or PowerPoint file to the course library (LIB-1, #21).

    CSRF is still checked, one step later: Django's CSRF middleware reads request.POST, which parses
    the upload, and the size-limit handler has to be installed before that happens. This is the
    pattern Django's documentation gives for custom upload handlers.
    """
    request.upload_handlers.insert(0, uploads.SizeLimitUploadHandler(request))
    return _upload_material(request, course_id)


@csrf_protect
def _upload_material(request: HttpRequest, course_id: int) -> HttpResponse:
    if not request.user:
        return redirect("login")
    # Any enrolled member may share. ACC-5 (#35) makes this verified-only once it lands.
    course, enrolled = member_course(request, course_id)

    def refuse(message: str, status: int, existing=None) -> HttpResponse:
        return render_library(request, course, enrolled, error=message, existing=existing, status=status)

    # Reading request.FILES is what parses the upload, so it comes first: only after it has run can
    # the size-limit handler have flagged the request.
    file = request.FILES.get("file")
    if getattr(request, "upload_too_large", False):
        return refuse(f"That file is larger than the {uploads.MAX_MB} MB limit.", 413)
    if file is None:
        return refuse("Choose a file to upload.", 400)

    try:
        material = uploads.add_material(
            course=course,
            uploader=request.user,
            data=file.read(),
            filename=file.name,
            title=request.POST.get("title", ""),
        )
    except uploads.DuplicateMaterial as exc:
        return refuse(str(exc), 409, existing=exc.existing)
    except uploads.UploadRejected as exc:
        return refuse(str(exc), 400)

    # Redirect after POST, so refreshing the page does not offer to upload the file again.
    library = reverse("course-library", args=[course.pk])
    return redirect(f"{library}?uploaded={material.pk}#material-{material.pk}")
