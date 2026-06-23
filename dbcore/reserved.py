"""Reserved-slug rules. Source: packages/shared/reserved_slugs.json.

The DB also has a `reserved_slugs` table (seeded from the same file) so the
redirect service can resolve special redirects like /resume in one query. This
module is the in-process fast path used during code generation / slug validation.
"""
from __future__ import annotations

from ._shared import load_shared


def _data() -> dict:
    return load_shared("reserved_slugs.json")


def reserved_set() -> set[str]:
    return {s.lower() for s in _data()["reserved"]}


def special_redirects() -> dict[str, dict]:
    """slug -> {"url": str, "status": int}."""
    return _data().get("special_redirects", {})


def is_reserved(slug: str) -> bool:
    return slug.strip().lower() in reserved_set()
