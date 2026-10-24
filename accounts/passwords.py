"""Password hashing. Argon2id through argon2-cffi, with the library's defaults (ADR-0007)."""

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()

# Shown on the signup form and enforced on signup (ACC-3).
MIN_PASSWORD_LENGTH = 10


def validate_password(password: str) -> str | None:
    """Check a new password against Hyntor's rules.

    Returns None when the password is acceptable, or the message to show the user when it is not.

    Used by signup (ACC-3). Sign-in never applies these rules: an account created under an older rule
    must keep working, so only the stored hash decides whether a sign-in succeeds.
    """
    if not password.strip():
        return "Password cannot be blank."
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
    return None


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """True when the password matches. Returns False instead of raising, for any bad input.

    Two different failures both mean "do not sign this person in":
      * VerificationError  - the password does not match (its subclass VerifyMismatchError is the usual one)
      * InvalidHashError   - the stored hash is damaged or was never a hash at all
    """
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def dummy_verify(password: str) -> None:
    """Hash a throwaway password so an unknown email costs the same time as a wrong one (ACC-4, T1)."""
    _hasher.hash(password)
