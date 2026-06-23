"""Tiny management CLI used by the `migrate` compose service.

    python -m dbcore.cli upgrade-and-seed   # create tables (if missing) + seed
    python -m dbcore.cli seed                # seed reserved slugs only

For a first runnable build we use SQLAlchemy create_all (idempotent). The
PROJECT_PLAN calls for Alembic migrations as schema evolves; an alembic/
scaffold lives in db/ for that next step.
"""
from __future__ import annotations

import sys

from sqlalchemy import select

from . import models  # noqa: F401  (register models on Base.metadata)
from .db import Base, engine, session_scope
from .models import ReservedSlug
from .reserved import reserved_set, special_redirects


def create_all() -> None:
    Base.metadata.create_all(engine)
    print("✓ tables ensured")


def seed_reserved() -> None:
    specials = special_redirects()
    with session_scope() as s:
        existing = set(s.scalars(select(ReservedSlug.slug)).all())
        added = 0
        for slug in sorted(reserved_set()):
            if slug in existing:
                continue
            sp = specials.get(slug)
            s.add(ReservedSlug(
                slug=slug,
                redirect_url=sp["url"] if sp else None,
                redirect_status=sp["status"] if sp else None,
            ))
            added += 1
        # ensure special redirects are kept current even if slug already existed
        for slug, sp in specials.items():
            row = s.scalar(select(ReservedSlug).where(ReservedSlug.slug == slug))
            if row is not None:
                row.redirect_url = sp["url"]
                row.redirect_status = sp["status"]
    print(f"✓ reserved slugs seeded (+{added}); special redirects: {list(specials)}")


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "upgrade-and-seed"
    if cmd == "upgrade-and-seed":
        create_all()
        seed_reserved()
    elif cmd == "seed":
        seed_reserved()
    elif cmd == "create-all":
        create_all()
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
