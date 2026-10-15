"""Tiny management CLI used by the `migrate` compose service.

    python -m dbcore.cli upgrade-and-seed   # create_all + alembic upgrade head + seed
    python -m dbcore.cli migrate             # alembic upgrade head only
    python -m dbcore.cli seed                # seed reserved slugs only

Schema lifecycle: ``create_all`` bootstraps a fresh database in one shot, then
Alembic (``db/migrations``) evolves it. Migrations are written idempotently so
the two can run back to back on both fresh and existing databases.
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import select

from . import models  # noqa: F401  (register models on Base.metadata)
from .db import Base, engine, session_scope
from .models import ReservedSlug
from .reserved import reserved_set, special_redirects


def create_all() -> None:
    Base.metadata.create_all(engine)
    print("✓ tables ensured")


def _db_dir() -> Path:
    """Locate db/ (alembic.ini + migrations) locally or inside the image."""
    for candidate in (Path(__file__).resolve().parents[1] / "db", Path("/app/db")):
        if (candidate / "alembic.ini").is_file():
            return candidate
    raise FileNotFoundError("db/alembic.ini not found")


def migrate() -> None:
    """``alembic upgrade head`` via the Python API (no CLI/cwd assumptions)."""
    from alembic import command
    from alembic.config import Config as AlembicConfig

    db_dir = _db_dir()
    cfg = AlembicConfig(str(db_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(db_dir / "migrations"))
    command.upgrade(cfg, "head")
    print("✓ migrations applied")


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
        migrate()
        seed_reserved()
    elif cmd == "migrate":
        migrate()
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
