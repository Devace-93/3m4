# Database

The canonical schema is defined in [`../dbcore/models.py`](../dbcore/models.py)
(SQLAlchemy). Plan limits and reserved slugs are seeded from
[`../packages/shared`](../packages/shared).

## First build
Tables are created and seeded by the `migrate` compose service:

```bash
python -m dbcore.cli upgrade-and-seed   # create_all (idempotent) + seed reserved slugs
```

## Future migrations (Alembic)
Once the schema is live and you start changing it, switch to versioned migrations:

```bash
cd db
DATABASE_URL=postgresql+psycopg://shortlink:shortlink@localhost:5432/shortlink \
  alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

`env.py` imports `dbcore.models` so autogenerate sees every table, and reads the
DB URL from `DATABASE_URL`.

## Planned follow-ups (see PROJECT_PLAN §4)
- Monthly range-partitioning of the `clicks` table on `ts`.
- Per-account retention pruning (already handled by the worker's `enforce_retention`).
