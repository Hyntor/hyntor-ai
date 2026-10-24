"""Password hashing. Argon2id through argon2-cffi, with the library's defaults (ADR-0007)."""

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

_hasher = PasswordHasher()

# Shown on the signup form and enforced on signup (ACC-3).
MIN_PASSWORD_LENGTH = 10


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """True when the password matches. Never raises for a wrong password."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError):
        return False


def dummy_verify(password: str) -> None:
    """Hash a throwaway password so an unknown email costs the same time as a wrong one (ACC-4, T1)."""
    _hasher.hash(password)
