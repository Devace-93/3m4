"""Monthly usage metering.

Two metered metrics per account per calendar month:
  - links_created   (hard limit: block new links over cap)
  - tracked_clicks  (soft limit: keep redirecting, stop counting over cap)

Period = calendar month [first day, first day of next month).
"""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import UsageCounter


def _today() -> date:
    return datetime.now(timezone.utc).date()


def period_bounds(on: date | None = None) -> tuple[date, date]:
    on = on or _today()
    start = on.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def get_or_create_counter(session: Session, account_id, on: date | None = None) -> UsageCounter:
    start, end = period_bounds(on)
    counter = session.scalar(
        select(UsageCounter).where(
            UsageCounter.account_id == account_id,
            UsageCounter.period_start == start,
        )
    )
    if counter is None:
        counter = UsageCounter(
            account_id=account_id, period_start=start, period_end=end,
            links_created=0, tracked_clicks=0,
        )
        session.add(counter)
        session.flush()
    return counter
