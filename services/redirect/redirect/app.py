"""The redirect Flask app (factory `create_app`).

Routes:
  GET /healthz        -> {"status": "ok"}
  GET /<code>         -> resolve a single-segment short code and redirect

Resolution order for /<code>:
  1. Reserved-slug redirect (e.g. /resume -> external site).
  2. A live (active, non-expired) Link by short_code.
  3. Otherwise a minimal 404.

On a link hit we enqueue a click event to the Celery worker and redirect
immediately. We NEVER block on analytics and we NEVER store the raw IP here —
the worker hashes it and discards it.
"""
from __future__ import annotations

from datetime import datetime, timezone

from celery import Celery
from flask import Flask, Response, redirect, request
from sqlalchemy import select

from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import Link, ReservedSlug
from dbcore.reserved import special_redirects

from . import cache

# Name of the worker task we enqueue onto. Must match the `name=` given to the
# task in services/worker/worker/tasks.py. Using send_task by name means the
# redirect image does NOT need to import the worker package.
CLICK_TASK = "process_click"

# A broker-only Celery client used purely to *send* tasks (no result backend
# needed for fire-and-forget). Created once at import time.
_celery_client = Celery(broker=config.celery_broker_url)

_NOT_FOUND_HTML = (
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<link rel='icon' href='/favicon.ico' sizes='48x48'>"
    "<link rel='icon' type='image/svg+xml' href='/favicon.svg'>"
    "<title>Link not found \u2014 3m4</title></head>"
    "<body style='font-family:system-ui,sans-serif;text-align:center;"
    "margin:6rem auto;max-width:28rem;padding:0 1rem;color:#0f172a'>"
    "<h1 style='font-size:3rem;margin:0'>404</h1>"
    "<p style='color:#475569'>This short link doesn't exist or has been removed.</p>"
    "<p><a href='/' style='color:#2563eb'>Go to 3m4</a></p></body></html>"
)


def _client_ip() -> str | None:
    """Best client IP: first hop of X-Forwarded-For, else the socket peer.

    Behind Caddy the real client is the first entry in X-Forwarded-For; later
    entries are proxies. We only use this transiently (it's sent to the worker
    which hashes then discards it) — nothing is stored here.
    """
    xff = request.headers.get("X-Forwarded-For")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first
    return request.remote_addr


def _resolve(code: str) -> dict:
    """Resolve a short code to a cached-shaped dict (see cache.py for shapes).

    Tries Redis first, then the in-process special-redirects map, then Postgres.
    The result is written back to the cache so repeat hits stay off the DB.
    """
    cached = cache.cache_get(code)
    if cached is not None:
        return cached

    # Fast in-process path for hard-coded special redirects (e.g. /resume).
    special = special_redirects().get(code)
    if special:
        result = {
            "type": "reserved",
            "url": special["url"],
            "status": int(special.get("status", 302)),
        }
        cache.cache_set(code, result, cache.LINK_TTL_SECONDS)
        return result

    now = datetime.now(timezone.utc)
    with session_scope() as session:
        # 1) Reserved slug that performs its own redirect (DB-backed).
        reserved = session.execute(
            select(ReservedSlug.redirect_url, ReservedSlug.redirect_status).where(
                ReservedSlug.slug == code
            )
        ).first()
        if reserved is not None and reserved.redirect_url:
            result = {
                "type": "reserved",
                "url": reserved.redirect_url,
                "status": int(reserved.redirect_status or 302),
            }
            cache.cache_set(code, result, cache.LINK_TTL_SECONDS)
            return result

        # 2) A short link. Select only the columns we need (keeps the hot path light).
        link = session.execute(
            select(
                Link.id,
                Link.account_id,
                Link.destination_url,
                Link.redirect_type,
                Link.active,
                Link.expires_at,
            ).where(Link.short_code == code)
        ).first()

        if (
            link is not None
            and link.active
            and (link.expires_at is None or link.expires_at > now)
        ):
            result = {
                "type": "link",
                "link_id": str(link.id),
                "account_id": str(link.account_id),
                "destination_url": link.destination_url,
                "redirect_type": int(link.redirect_type or 302),
            }
            cache.cache_set(code, result, cache.LINK_TTL_SECONDS)
            return result

    # 3) Nothing usable. Cache the miss briefly to shield Postgres from probes.
    result = {"type": "none"}
    cache.cache_set(code, result, cache.MISS_TTL_SECONDS)
    return result


def _enqueue_click(result: dict) -> None:
    """Fire-and-forget a click event to the worker. Never raises."""
    payload = {
        "link_id": result["link_id"],
        "account_id": result["account_id"],
        "ts": datetime.now(timezone.utc).isoformat(),
        # Raw IP travels to the worker, which hashes + discards it. Not stored here.
        "ip": _client_ip(),
        "user_agent": request.headers.get("User-Agent"),
        "referrer": request.headers.get("Referer"),
    }
    try:
        _celery_client.send_task(CLICK_TASK, args=[payload])
    except Exception:
        # If the broker is unreachable we still redirect — analytics is best-effort.
        pass


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/healthz")
    def healthz():
        return {"status": "ok"}

    @app.get("/<code>")
    def follow(code: str):
        # The <code> converter matches a single path segment (no slashes), which
        # is exactly what apex short codes / reserved slugs are.
        result = _resolve(code)

        if result["type"] == "reserved":
            return redirect(result["url"], code=result["status"])

        if result["type"] == "link":
            _enqueue_click(result)
            return redirect(result["destination_url"], code=result["redirect_type"])

        return Response(_NOT_FOUND_HTML, status=404, mimetype="text/html")

    return app
