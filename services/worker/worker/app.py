"""Celery application for the worker service.

Importable as `worker.app.celery` (compose runs
`celery -A worker.app.celery worker` and a matching `beat`).

Broker/result backend come from dbcore.config (Redis db1/db2). Tasks live in
`worker.tasks` and are pulled in via the `include` list so the worker registers
them on startup.
"""
from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from dbcore.config import config

celery = Celery(
    "3m4",
    broker=config.celery_broker_url,
    backend=config.celery_result_backend,
    include=["worker.tasks"],
)

celery.conf.update(
    # Click timestamps are produced in UTC by the redirect service; keep the
    # whole pipeline in UTC to avoid surprises.
    timezone="UTC",
    enable_utc=True,
    # Only ack a task after it succeeds, so a crash mid-processing re-queues the
    # click rather than dropping it.
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Be strict about what we accept off the broker.
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Scheduled maintenance (run by `celery beat`).
    beat_schedule={
        "enforce-retention-daily": {
            "task": "enforce_retention",
            # 03:15 UTC daily — quiet hours, after midnight rollovers settle.
            "schedule": crontab(hour=3, minute=15),
        },
        "reconcile-billing-daily": {
            "task": "reconcile_billing",
            "schedule": crontab(hour=4, minute=0),
        },
    },
)
