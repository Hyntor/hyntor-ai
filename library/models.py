"""Material and MaterialChunk: uploaded course files and their extracted text."""

from django.db import models

from accounts.models import User
from courses.models import Course


class FileKind(models.TextChoices):
    """The file types the library accepts. Each has an extractor in ADR-0006."""

    PDF = "pdf", "PDF"
    DOCX = "docx", "Word document"
    PPTX = "pptx", "PowerPoint slides"


class ExtractionStatus(models.TextChoices):
    """How far a material has got through text extraction.

    A material is pending until its text has been read and split into chunks. Only indexed
    materials can be cited by the tutor; failed ones keep the file but have no chunks.
    """

    PENDING = "pending", "Pending"
    INDEXED = "indexed", "Indexed"
    FAILED = "failed", "Failed"


class Material(models.Model):
    """An uploaded file. The same bytes can be uploaded once per course (C4).

    Removal is a soft delete: removed_at and removed_by keep the audit trail (E3), and removed
    materials are never listed.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="materials")
    uploader = models.ForeignKey(User, on_delete=models.PROTECT, related_name="uploaded_materials")
    title = models.CharField(max_length=200)
    file_kind = models.CharField(max_length=10, choices=FileKind)
    storage_key = models.CharField(max_length=255, unique=True)
    byte_size = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    extraction_status = models.CharField(
        max_length=20, choices=ExtractionStatus, default=ExtractionStatus.PENDING
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="removed_materials"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["course", "sha256"], name="unique_material_per_course")
        ]
        indexes = [models.Index(fields=["course", "-uploaded_at"])]

    def __str__(self) -> str:
        return self.title

    @property
    def is_removed(self) -> bool:
        """Removed materials stay in the table for the audit trail but are never listed (E3)."""
        return self.removed_at is not None


class MaterialChunk(models.Model):
    """An ordered slice of a material's extracted text. A material has no chunks until extraction succeeds."""

    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="chunks")
    ordinal = models.PositiveIntegerField()
    text = models.TextField()
    char_count = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["material", "ordinal"], name="unique_chunk_ordinal")]
        ordering = ["material", "ordinal"]

    def __str__(self) -> str:
        return f"{self.material_id} chunk {self.ordinal}"
