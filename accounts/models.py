"""University, User and Session: the account half of the ERD (M2 section 4)."""

from django.db import models


class University(models.Model):
    """A school. Signup is allowed only for addresses at a registered email domain (A1, E1)."""

    name = models.CharField(max_length=200)
    email_domain = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "universities"

    def __str__(self) -> str:
        return self.name

    @staticmethod
    def normalize_domain(domain: str) -> str:
        """Lowercase, trimmed, no leading '@' - applied before storage and lookup (ACC-1)."""
        return domain.strip().lstrip("@").lower()


class PlatformRole(models.TextChoices):
    LEARNER = "learner", "Learner"
    ADMIN = "admin", "Administrator"


class User(models.Model):
    university = models.ForeignKey(University, on_delete=models.PROTECT, related_name="users")
    email = models.EmailField(max_length=255, unique=True)
    display_name = models.CharField(max_length=100)
    # Argon2id hash; the password itself is never stored (ADR-0007). See accounts.passwords.
    password_hash = models.CharField(max_length=255)
    platform_role = models.CharField(max_length=20, choices=PlatformRole, default=PlatformRole.LEARNER)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.display_name} <{self.email}>"

    @property
    def is_admin(self) -> bool:
        return self.platform_role == PlatformRole.ADMIN

    @property
    def is_verified(self) -> bool:
        return self.email_verified_at is not None

    @staticmethod
    def normalize_email(email: str) -> str:
        """Case and whitespace are normalized before the uniqueness check (ACC-3)."""
        return email.strip().lower()


class Session(models.Model):
    """A signed-in browser. Only the SHA-256 of the cookie token is stored (ADR-0007)."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"session for {self.user_id} until {self.expires_at:%Y-%m-%d}"
