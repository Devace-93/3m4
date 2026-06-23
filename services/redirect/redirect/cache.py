"""Redis helpers for the redirect hot path.

We cache the *resolved* outcome of a short code (a reserved redirect, a live
link, or "nothing here") for a few seconds. This keeps the common case off
Postgres entirely. Everything degrades gracefully: if Redis is down we simply
fall back to the database, so a cache outage slows us down but never breaks
redirects.

Cached value shapes (JSON):
  - {"type": "reserved", "url": "...", "status": 302}   reserved-slug redirect
  - {"type": "link", "link_id": "...", "account_id": "...",
     "destination_url": "...", "redirect_type": 302}    a live short link
  - {"type": "none"}                                     known-missing code
"""
from __future__ import annotations

import json

import redis

from dbcore.config import config

# Positive results (reserved redirects, live links) live a little longer than
# negative ones. Both TTLs are short so edits/expiries propagate quickly.
LINK_TTL_SECONDS = 30
MISS_TTL_SECONDS = 10

_KEY_PREFIX = "redir:"

# Lazily-created module-level client. redis-py clients are thread-safe and hold
# an internal connection pool, so one shared instance is correct for gunicorn
# workers.
_client: redis.Redis | None = None


def get_redis() -> redis.Redis | None:
    """Return a shared Redis client, or None if it can't be reached."""
    global _client
    if _client is None:
        try:
            _client = redis.Redis.from_url(config.redis_url, decode_responses=True)
        except Exception:
            return None
    return _client


def _key(code: str) -> str:
    return f"{_KEY_PREFIX}{code}"


def cache_get(code: str) -> dict | None:
    """Return the cached resolution for `code`, or None on miss/error."""
    client = get_redis()
    if client is None:
        return None
    try:
        raw = client.get(_key(code))
    except Exception:
        return None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        return None


def cache_set(code: str, value: dict, ttl: int = LINK_TTL_SECONDS) -> None:
    """Store a resolution for `code`. Best-effort: silently ignores failures."""
    client = get_redis()
    if client is None:
        return
    try:
        client.set(_key(code), json.dumps(value), ex=ttl)
    except Exception:
        # The cache is an optimization; never let it break a redirect.
        pass
