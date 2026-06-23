"""Links blueprint: CRUD, QR codes, and per-link analytics.

These endpoints accept EITHER a dashboard JWT OR a public API key. Everything is
scoped to ``g.account_id`` so one account can never see another's links.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from io import BytesIO

import qrcode
from flask import Blueprint, Response, g, jsonify, request
from sqlalchemy import func, or_, select

from dbcore.codegen import generate_code, validate_custom_slug
from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import Account, ClickDailyRollup, Link
from dbcore.plans import plan_limits, within_limit
from dbcore.posthog_client import capture
from dbcore.usage import get_or_create_counter

from ..auth_utils import require_auth_or_api_key
from ..errors import ApiError
from ..extensions import limiter, public_api_key_func
from ..serializers import counts_to_list, range_to_days, serialize_link, short_url

bp = Blueprint("links", __name__)

# Public-API budget applies on top of the global default limit.
_public_limit = limiter.limit(config.rate_limit_public_api, key_func=public_api_key_func)


def _parse_expires_at(value) -> datetime | None:
    """Accept an ISO-8601 string (optionally ending in ``Z``) or None."""
    if value in (None, ""):
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        raise ApiError(400, "invalid_expires_at", "expires_at must be ISO-8601.")


def _get_owned_link(session, link_id_str: str) -> Link:
    """Fetch a link by id, scoped to the current account, or 404."""
    try:
        link_id = uuid.UUID(link_id_str)
    except (ValueError, AttributeError):
        raise ApiError(404, "not_found", "Link not found.")
    link = session.scalar(
        select(Link).where(Link.id == link_id, Link.account_id == g.account_id)
    )
    if link is None:
        raise ApiError(404, "not_found", "Link not found.")
    return link


# --------------------------------------------------------------------------- #
# List + create
# --------------------------------------------------------------------------- #
@bp.get("")
@_public_limit
@require_auth_or_api_key
def list_links():
    page = max(int(request.args.get("page", 1)), 1)
    per_page = min(max(int(request.args.get("per_page", 20)), 1), 100)
    q = (request.args.get("q") or "").strip()

    with session_scope() as session:
        stmt = select(Link).where(Link.account_id == g.account_id)
        count_stmt = select(func.count(Link.id)).where(Link.account_id == g.account_id)
        if q:
            like = f"%{q}%"
            cond = or_(
                Link.destination_url.ilike(like),
                Link.title.ilike(like),
                Link.short_code.ilike(like),
            )
            stmt = stmt.where(cond)
            count_stmt = count_stmt.where(cond)

        total = session.scalar(count_stmt) or 0
        stmt = stmt.order_by(Link.created_at.desc()).offset((page - 1) * per_page).limit(per_page)
        items = [serialize_link(link) for link in session.scalars(stmt)]

    return jsonify({"items": items, "page": page, "per_page": per_page, "total": total})


@bp.post("")
@_public_limit
@require_auth_or_api_key
def create_link():
    data = request.get_json(silent=True) or {}
    destination_url = (data.get("destination_url") or "").strip()
    if not destination_url:
        raise ApiError(400, "missing_destination", "destination_url is required.")

    redirect_type = data.get("redirect_type", 302)
    if redirect_type not in (301, 302):
        raise ApiError(400, "invalid_redirect_type", "redirect_type must be 301 or 302.")

    custom_slug = (data.get("custom_slug") or "").strip()
    title = (data.get("title") or "").strip() or None
    expires_at = _parse_expires_at(data.get("expires_at"))

    with session_scope() as session:
        account = session.get(Account, g.account_id)
        plan = account.plan
        limit = plan_limits(plan)

        # ---- Enforce the monthly LINK limit (hard block) -------------------
        counter = get_or_create_counter(session, account.id)
        if not within_limit(counter.links_created, limit["links_per_month"]):
            # Emit before raising so the funnel captures the block.
            capture(
                str(account.id),
                "limit_reached",
                {"which": "links", "plan": plan},
                groups={"account": str(account.id)},
            )
            raise ApiError(
                402,
                "limit_reached",
                "Monthly link limit reached for your plan.",
                extra={"which": "links"},
            )

        # ---- Resolve the short code ----------------------------------------
        if custom_slug:
            ok, err = validate_custom_slug(session, custom_slug)
            if not ok:
                raise ApiError(400, "invalid_slug", err)
            short_code = custom_slug
            is_custom = True
        else:
            short_code = generate_code(session)
            is_custom = False

        link = Link(
            account_id=account.id,
            short_code=short_code,
            destination_url=destination_url,
            redirect_type=redirect_type,
            title=title,
            is_custom=is_custom,
            expires_at=expires_at,
            created_by=g.user_id,  # None when created via API key
        )
        session.add(link)
        counter.links_created += 1
        session.flush()
        body = serialize_link(link)

    capture(
        str(g.account_id),
        "link_created",
        {"plan": plan, "is_custom": is_custom},
        groups={"account": str(g.account_id)},
    )
    return jsonify(body), 201


# --------------------------------------------------------------------------- #
# Get / patch / delete
# --------------------------------------------------------------------------- #
@bp.get("/<link_id>")
@_public_limit
@require_auth_or_api_key
def get_link(link_id):
    with session_scope() as session:
        link = _get_owned_link(session, link_id)
        body = serialize_link(link)
    return jsonify(body)


@bp.patch("/<link_id>")
@_public_limit
@require_auth_or_api_key
def patch_link(link_id):
    data = request.get_json(silent=True) or {}
    with session_scope() as session:
        link = _get_owned_link(session, link_id)

        if "destination_url" in data:
            dest = (data.get("destination_url") or "").strip()
            if not dest:
                raise ApiError(400, "missing_destination", "destination_url cannot be empty.")
            link.destination_url = dest
        if "title" in data:
            link.title = (data.get("title") or "").strip() or None
        if "active" in data:
            link.active = bool(data.get("active"))
        if "redirect_type" in data:
            rt = data.get("redirect_type")
            if rt not in (301, 302):
                raise ApiError(400, "invalid_redirect_type", "redirect_type must be 301 or 302.")
            link.redirect_type = rt
        if "expires_at" in data:
            link.expires_at = _parse_expires_at(data.get("expires_at"))

        body = serialize_link(link)
    return jsonify(body)


@bp.delete("/<link_id>")
@_public_limit
@require_auth_or_api_key
def delete_link(link_id):
    with session_scope() as session:
        link = _get_owned_link(session, link_id)
        session.delete(link)
    return "", 204


# --------------------------------------------------------------------------- #
# QR code
# --------------------------------------------------------------------------- #
@bp.get("/<link_id>/qr.png")
@_public_limit
@require_auth_or_api_key
def link_qr(link_id):
    # Clamp the requested size to a sane pixel range.
    try:
        size = int(request.args.get("size", 512))
    except ValueError:
        size = 512
    size = min(max(size, 64), 2048)

    with session_scope() as session:
        link = _get_owned_link(session, link_id)
        url = short_url(link.short_code)

    # Build the QR, then resize to the exact requested square (nearest-neighbour
    # keeps the modules crisp).
    qr = qrcode.QRCode(border=2, box_size=10)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    img = img.resize((size, size))

    buf = BytesIO()
    img.save(buf, format="PNG")
    return Response(
        buf.getvalue(),
        mimetype="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# --------------------------------------------------------------------------- #
# Per-link analytics (read from the daily rollup)
# --------------------------------------------------------------------------- #
@bp.get("/<link_id>/analytics")
@_public_limit
@require_auth_or_api_key
def link_analytics(link_id):
    days = range_to_days(request.args.get("range"))
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)

    with session_scope() as session:
        link = _get_owned_link(session, link_id)
        rows = session.scalars(
            select(ClickDailyRollup)
            .where(
                ClickDailyRollup.link_id == link.id,
                ClickDailyRollup.day >= start,
                ClickDailyRollup.day <= today,
            )
            .order_by(ClickDailyRollup.day)
        ).all()

        # Per-day counts, then fill gaps so the series is continuous.
        per_day = {r.day: r.count for r in rows}
        series = []
        cursor = start
        while cursor <= today:
            series.append({"date": cursor.isoformat(), "count": per_day.get(cursor, 0)})
            cursor += timedelta(days=1)

        by_country: dict = {}
        by_device: dict = {}
        by_referrer: dict = {}
        for r in rows:
            _merge(by_country, r.by_country)
            _merge(by_device, r.by_device)
            _merge(by_referrer, r.by_referrer)

        total_clicks = sum(r.count for r in rows)

    return jsonify(
        {
            # `uniques` is not tracked in the daily rollup (privacy: we only keep
            # coarse aggregates), so it is reported as null.
            "summary": {"clicks": total_clicks, "uniques": None},
            "series": series,
            "by_country": counts_to_list(by_country),
            "by_device": counts_to_list(by_device),
            "by_referrer": counts_to_list(by_referrer),
        }
    )


def _merge(target: dict, source: dict | None) -> None:
    """Accumulate a JSONB ``{key: count}`` map into ``target``."""
    for key, value in (source or {}).items():
        target[key] = target.get(key, 0) + value
