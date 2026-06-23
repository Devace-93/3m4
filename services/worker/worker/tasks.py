"""Celery tasks: click processing + scheduled maintenance.

The headline task is `process_click`, which the redirect service enqueues for
every link hit. It enforces the tracked-clicks limit, enriches the event, and
writes the durable rows. See PROJECT_PLAN.md §3/§6 and CONTRACT.md.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from dbcore.db import session_scope
from dbcore.models import (
    Account,
    Click,
    ClickDailyRollup,
    Link,
    UsageCounter,
)
from dbcore import plans
from dbcore.posthog_client import capture
from dbcore.privacy import hash_ip
from dbcore.usage import get_or_create_counter

from .app import celery
from .enrich import geo_lookup, parse_user_agent, referrer_host


def _as_uuid(value) -> uuid.UUID:
    """Accept either a UUID or its string form (payloads carry strings)."""
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))


def _parse_ts(value) -> datetime:
    """Parse the ISO timestamp from the payload, defaulting to now (UTC)."""
    if not value:
        return datetime.now(timezone.utc)
    try:
        ts = datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)
    # Be defensive about naive datetimes — treat them as UTC.
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def _bump(counts: dict | None, key: str | None) -> dict:
    """Return a NEW dict with `key` incremented (None -> "unknown").

    We build a fresh dict (rather than mutating in place) so SQLAlchemy reliably
    detects the change on a JSONB column without needing MutableDict.
    """
    new = dict(counts or {})
    bucket = key or "unknown"
    new[bucket] = new.get(bucket, 0) + 1
    return new


# Name is pinned so the redirect service can enqueue by string ("process_click")
# without importing this module.
@celery.task(name="process_click")
def process_click(payload: dict) -> None:
    account_id = _as_uuid(payload["account_id"])
    link_id = _as_uuid(payload["link_id"])
    ts = _parse_ts(payload.get("ts"))

    with session_scope() as session:
        account = session.get(Account, account_id)
        if account is None:
            # Account vanished (deleted) between redirect and processing — drop.
            return

        plan = account.plan
        limit = plans.plan_limits(plan).get("tracked_clicks_per_month", 0)

        counter = get_or_create_counter(session, account_id)

        # --- Click-limit rule (CRITICAL) -----------------------------------
        # If the account is over its tracked-clicks cap, the redirect already
        # happened; we must NOT record or count this click. Emit a one-shot
        # PostHog event (once per period via the clicks_limit_notified flag).
        if not plans.within_limit(counter.tracked_clicks, limit):
            if not counter.clicks_limit_notified:
                counter.clicks_limit_notified = True
                capture(
                    distinct_id=str(account_id),
                    event="limit_reached",
                    properties={"which": "clicks", "plan": plan},
                    groups={"account": str(account_id)},
                )
            return

        # --- Enrich --------------------------------------------------------
        ip = payload.get("ip")
        ua = parse_user_agent(payload.get("user_agent"))
        geo = geo_lookup(ip)  # uses raw IP transiently, never stores it
        ref_host = referrer_host(payload.get("referrer"))

        # --- Insert the click row (NEVER the raw IP) -----------------------
        session.add(
            Click(
                link_id=link_id,
                account_id=account_id,
                ts=ts,
                ip_hash=hash_ip(ip),
                country=geo["country"],
                region=geo["region"],
                city=geo["city"],
                device=ua["device"],
                os=ua["os"],
                browser=ua["browser"],
                referrer_host=ref_host,
                raw_ua=payload.get("user_agent"),
            )
        )

        # --- Counters ------------------------------------------------------
        counter.tracked_clicks += 1
        link = session.get(Link, link_id)
        if link is not None:
            link.click_count = (link.click_count or 0) + 1

        # --- Daily rollup (upsert + increment JSONB maps) ------------------
        day = ts.astimezone(timezone.utc).date()
        rollup = session.scalar(
            select(ClickDailyRollup).where(
                ClickDailyRollup.link_id == link_id,
                ClickDailyRollup.day == day,
            )
        )
        if rollup is None:
            rollup = ClickDailyRollup(
                link_id=link_id,
                account_id=account_id,
                day=day,
                count=0,
                by_country={},
                by_device={},
                by_referrer={},
            )
            session.add(rollup)

        rollup.count = (rollup.count or 0) + 1
        rollup.by_country = _bump(rollup.by_country, geo["country"])
        rollup.by_device = _bump(rollup.by_device, ua["device"])
        rollup.by_referrer = _bump(rollup.by_referrer, ref_host)


@celery.task(name="enforce_retention")
def enforce_retention() -> None:
    """Delete clicks (and trim rollups) older than each plan's retention window.

    retention_days == -1 (unlimited) means keep forever for that account.
    Runs daily via celery beat.
    """
    now = datetime.now(timezone.utc)

    with session_scope() as session:
        accounts = session.execute(select(Account.id, Account.plan)).all()
        for account_id, plan in accounts:
            retention_days = plans.plan_limits(plan).get("retention_days", -1)
            if plans.is_unlimited(retention_days):
                continue

            cutoff = now - timedelta(days=retention_days)
            cutoff_day = cutoff.date()

            session.execute(
                delete(Click).where(
                    Click.account_id == account_id,
                    Click.ts < cutoff,
                )
            )
            session.execute(
                delete(ClickDailyRollup).where(
                    ClickDailyRollup.account_id == account_id,
                    ClickDailyRollup.day < cutoff_day,
                )
            )


@celery.task(name="reconcile_billing")
def reconcile_billing() -> None:
    """Nightly billing reconciliation backstop.

    STUB: only meaningful when billing is enabled. The real implementation will
    pull subscription state from RevenueCat's REST API and repair any drift in
    `subscriptions` / `accounts.plan` that webhooks missed.

    # TODO(enrique): implement RevenueCat REST reconcile when BILLING_ENABLED.
    #   - skip entirely if not config.billing_enabled
    #   - for each account with a subscription, fetch current entitlements
    #   - resolve plan via dbcore.plans.resolve_plan_from_entitlements
    #   - update Subscription + Account.plan on mismatch
    """
    return None
