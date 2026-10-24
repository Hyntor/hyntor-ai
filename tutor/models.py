"""TutorSession, TutorMessage and MessageCitation: the tutor conversation and what it cited."""

from django.db import models

from accounts.models import User
from courses.models import Course
from library.models import MaterialChunk


class TutorMode(models.TextChoices):
    CONCEPT = "concept", "Concept"
    ASSIGNMENT = "assignment", "Assignment"


class MessageAuthorRole(models.TextChoices):
    STUDENT = "student", "Student"
    ASSISTANT = "assistant", "Assistant"


class TutorSession(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="tutor_sessions")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tutor_sessions")
    mode = models.CharField(max_length=20, choices=TutorMode)
    started_at = models.DateTimeField(auto_now_add=True)
    last_activity_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["course", "student"])]

    def __str__(self) -> str:
        return f"{self.mode} session in {self.course_id}"


class TutorMessage(models.Model):
    """One turn in a session. hint_tier is set on assistant replies only."""

    tutor_session = models.ForeignKey(TutorSession, on_delete=models.CASCADE, related_name="messages")
    ordinal = models.PositiveIntegerField()
    author_role = models.CharField(max_length=20, choices=MessageAuthorRole)
    body = models.TextField()
    hint_tier = models.PositiveSmallIntegerField(null=True, blank=True)
    beyond_materials = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["tutor_session", "ordinal"], name="unique_message_ordinal")
        ]
        ordering = ["tutor_session", "ordinal"]

    def __str__(self) -> str:
        return f"{self.author_role} message {self.ordinal}"


class MessageCitation(models.Model):
    """Which chunks an assistant message cited. Keyed on (message, chunk) in the ERD."""

    message = models.ForeignKey(TutorMessage, on_delete=models.CASCADE, related_name="citations")
    chunk = models.ForeignKey(MaterialChunk, on_delete=models.CASCADE, related_name="citations")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["message", "chunk"], name="unique_message_citation")]

    def __str__(self) -> str:
        return f"{self.message_id} cites {self.chunk_id}"
