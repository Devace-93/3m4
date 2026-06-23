"""Short-code generation.

Random base62, length 6 growing to 7 under collision pressure. Uses
`secrets` for unbiased, non-guessable codes. Validates against the reserved set.
Custom (vanity) slugs are validated but not generated here.
"""
from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Link
from .reserved import is_reserved

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
_SLUG_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,30}[A-Za-z0-9]$")


def _random_code(length: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


def code_exists(session: Session, code: str) -> bool:
    return session.scalar(select(Link.id).where(Link.short_code == code)) is not None


def generate_code(session: Session, *, length: int = 6, max_attempts: int = 12) -> str:
    """Return a fresh, unreserved, unused short code."""
    attempts = 0
    while True:
        code = _random_code(length)
        attempts += 1
        if is_reserved(code) or code_exists(session, code):
            if attempts >= max_attempts:
                length += 1            # widen the space, reset attempt budget
                attempts = 0
            continue
        return code


def validate_custom_slug(session: Session, slug: str) -> tuple[bool, str | None]:
    """(ok, error). Enforces shape, reserved set, and uniqueness."""
    slug = slug.strip()
    if not _SLUG_RE.match(slug):
        return False, "Slug must be 3-32 chars: letters, numbers, '-' or '_'."
    if is_reserved(slug):
        return False, "That slug is reserved."
    if code_exists(session, slug):
        return False, "That slug is already taken."
    return True, None
