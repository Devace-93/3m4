"""Celery tasks: click processing + scheduled maintenance.

The headline task is `process_click`, which the redirect service enqueues for
every link hit. It enforces the tracked-clicks limit, enriches the event, and
writes the durable rows. See PROJECT_PLAN.md §3/§6 and CONTRACT.md.
`reconcile_billing` is the daily pull from payments.3m4.net (CONTRACT.md "Billing").
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from dbcore.billing_sync import account_for_identity, apply_entitlements
from dbcore.config import config
from dbcore.db import session_scope
from dbcore.m4pay import M4PayClient, M4PayError
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

log = logging.getLogger("3m4.worker")


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
        limit = plans.effective_plan_limits(plan, str(account_id)).get("tracked_clicks_per_month", 0)

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
            retention_days = plans.effective_plan_limits(plan, str(account_id)).get("retention_days", -1)
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


# --------------------------------------------------------------------------- #
# Billing reconcile (pull from payments.3m4.net)
# --------------------------------------------------------------------------- #
# The push half is the signed webhook in services/api (POST /api/billing/webhook);
# this pull is the backstop so a missed or late delivery cannot leave
# `accounts.plan` stale for more than a day. The window overlaps the daily
# schedule so a missed run is covered by the next one (snapshots are idempotent).
RECONCILE_WINDOW = timedelta(days=2)


def payments_client() -> M4PayClient | None:
    """The service-key client, or None when billing / the key is not configured."""
    if not config.billing_enabled or not config.payments_service_key:
        return None
    return M4PayClient(config.payments_internal_url, app=config.payments_app, service_key=config.payments_service_key)


@celery.task(name="reconcile_billing")
def reconcile_billing(updated_since: str | None = None, client: M4PayClient | None = None) -> dict:
    """Daily billing reconciliation backstop (celery beat; `make reconcile-billing`
    runs it once on demand).

    Pulls every subscription of the app changed since ``updated_since`` (ISO,
    default: the last ``RECONCILE_WINDOW``) with ``M4PayClient.subscriptions``
    and applies each snapshot through the same code path as the push webhook
    (``dbcore.billing_sync.apply_entitlements``). Returns counts: ``applied``
    (rows matched to a 3m4 account), ``changed`` (plan flips), ``unknown``
    (identities that never signed in here), ``skipped`` (not configured) and
    ``error`` (payments unreachable).
    """
    client = client or payments_client()
    if client is None:
        log.info("billing reconcile skipped: PAYMENTS_SERVICE_KEY not configured")
        return {"skipped": 1}
    since = updated_since or (datetime.now(timezone.utc) - RECONCILE_WINDOW).strftime("%Y-%m-%dT%H:%M:%SZ")
    counts = {"applied": 0, "changed": 0, "unknown": 0}
    try:
        rows = list(client.subscriptions(updated_since=since))
    except (M4PayError, OSError) as err:  # requests exceptions are OSError subclasses
        log.warning("billing reconcile failed: %s", err)
        return {"error": 1}
    for row in rows:
        with session_scope() as session:
            account = account_for_identity(session, row.get("identity_id"))
            if account is None:
                counts["unknown"] += 1
                continue
            result = apply_entitlements(session, account, row)
            counts["applied"] += 1
            if result["plan"] != result["previous_plan"]:
                counts["changed"] += 1
                log.info("billing reconcile: account %s %s -> %s", account.id, result["previous_plan"], result["plan"])
    log.info("billing reconcile since %s: %s", since, counts)
    return counts
