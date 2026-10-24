"""Course and Enrollment. A course persists across terms; the term lives on Enrollment (G2)."""

from django.db import models

from accounts.models import University, User


class Course(models.Model):
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="courses")
    code = models.CharField(max_length=32)
    title = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["university", "code"], name="unique_course_code_per_university")
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.title}"

    @staticmethod
    def normalize_code(code: str) -> str:
        """'csci 3087' -> 'CSCI 3087', applied before the uniqueness check (CRS-1)."""
        return " ".join(code.split()).upper()


class CourseRole(models.TextChoices):
    MEMBER = "member", "Member"
    MAINTAINER = "maintainer", "Maintainer"


class Enrollment(models.Model):
    """One user in one course for one term, e.g. '2026-FA'.

    The ERD keys this on (user, course, term). Django needs a single-column primary key for related
    managers, so the key is enforced as a unique constraint instead.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrollments")
    term = models.CharField(max_length=16)
    course_role = models.CharField(max_length=20, choices=CourseRole, default=CourseRole.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "course", "term"], name="unique_enrollment_per_term")
        ]
        indexes = [models.Index(fields=["course", "term"])]

    def __str__(self) -> str:
        return f"{self.user_id} in {self.course_id} ({self.term})"
