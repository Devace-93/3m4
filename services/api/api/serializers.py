"""Pure functions that turn ORM rows into JSON-safe dicts.

Centralising serialization keeps the wire format (the CONTRACT.md shapes)
consistent across every blueprint.
"""
from __future__ import annotations

from datetime import datetime, timezone

from dbcore.config import config


def iso(dt: datetime | None) -> str | None:
    """UTC ISO-8601 with a trailing ``Z`` (or None). Naive datetimes are
    assumed to already be UTC (Postgres timestamptz comes back tz-aware)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def short_url(short_code: str) -> str:
    return f"{config.short_url_scheme}://{config.short_domain}/{short_code}"


def serialize_user(user) -> dict:
    """The local mirror of an accounts identity (profile fields come from the
    JWT claims; ``identity_id`` is the id shared by every 3m4 app)."""
    return {
        "id": str(user.id),
        "identity_id": str(user.identity_id),
        "email": user.email,
        "email_verified": user.email_verified_at is not None,
        "handle": user.handle,
        "name": user.name,
        "avatar_url": user.avatar_url,
        "created_at": iso(user.created_at),
    }


def serialize_account(account) -> dict:
    return {
        "id": str(account.id),
        "name": account.name,
        "plan": account.plan,
        "created_at": iso(account.created_at),
    }


def serialize_link(link) -> dict:
    """Exactly the CONTRACT.md "Link object" shape."""
    return {
        "id": str(link.id),
        "short_code": link.short_code,
        "short_url": short_url(link.short_code),
        "destination_url": link.destination_url,
        "redirect_type": link.redirect_type,
        "title": link.title,
        "active": link.active,
        "expires_at": iso(link.expires_at),
        "created_at": iso(link.created_at),
        "click_count": link.click_count,
    }


def serialize_api_key(api_key) -> dict:
    """Never includes the secret — only the non-sensitive prefix."""
    return {
        "id": str(api_key.id),
        "name": api_key.name,
        "prefix": api_key.prefix,
        "role": api_key.role,
        "last_used_at": iso(api_key.last_used_at),
        "created_at": iso(api_key.created_at),
    }


def serialize_usage(counter, limits: dict) -> dict:
    return {
        "period_start": counter.period_start.isoformat(),
        "period_end": counter.period_end.isoformat(),
        "links_created": counter.links_created,
        "tracked_clicks": counter.tracked_clicks,
        "limits": limits,
    }


# --------------------------------------------------------------------------- #
# Analytics helpers
# --------------------------------------------------------------------------- #
_RANGE_DAYS = {"7d": 7, "30d": 30, "1y": 365}


def range_to_days(range_str: str | None, default: int = 7) -> int:
    """Map the contract's ``range`` query param to a day count."""
    return _RANGE_DAYS.get((range_str or "").lower(), default)


def counts_to_list(counts: dict) -> list[dict]:
    """``{"US": 3, "DE": 1}`` -> ``[{"key": "US", "count": 3}, ...]`` (desc)."""
    items = [{"key": k, "count": v} for k, v in counts.items()]
    items.sort(key=lambda d: d["count"], reverse=True)
    return items


def serialize_audit_event(event) -> dict:
    return {
        "id": str(event.id),
        "ts": iso(event.ts),
        "actor_type": event.actor_type,
        "actor_id": str(event.actor_id) if event.actor_id else None,
        "actor_label": event.actor_label,
        "action": event.action,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "outcome": event.outcome,
        "meta": event.meta or {},
    }
