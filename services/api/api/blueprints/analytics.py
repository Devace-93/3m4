"""Analytics blueprint: account-wide overview.

Aggregates the daily rollup across every link in the account for the requested
range and returns totals, a daily time series, and the top links.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select

from dbcore.db import session_scope
from dbcore.models import ClickDailyRollup, Link

from ..auth_utils import require_auth_or_api_key, require_scope
from ..flags import require_flag
from ..serializers import range_to_days, short_url

bp = Blueprint("analytics", __name__)


@bp.get("/overview")
@require_auth_or_api_key
@require_scope("analytics:read")
@require_flag("analytics-dashboard", status=404)
def overview():
    days = range_to_days(request.args.get("range"))
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)

    with session_scope() as session:
        # Total clicks per day across the whole account.
        day_rows = session.execute(
            select(ClickDailyRollup.day, func.sum(ClickDailyRollup.count))
            .where(
                ClickDailyRollup.account_id == g.account_id,
                ClickDailyRollup.day >= start,
                ClickDailyRollup.day <= today,
            )
            .group_by(ClickDailyRollup.day)
        ).all()
        per_day = {day: int(total or 0) for day, total in day_rows}

        series = []
        cursor = start
        while cursor <= today:
            series.append({"date": cursor.isoformat(), "count": per_day.get(cursor, 0)})
            cursor += timedelta(days=1)
        total_clicks = sum(per_day.values())

        # Top links by clicks within the range (join rollup -> link for labels).
        top_rows = session.execute(
            select(Link, func.sum(ClickDailyRollup.count).label("clicks"))
            .join(ClickDailyRollup, ClickDailyRollup.link_id == Link.id)
            .where(
                Link.account_id == g.account_id,
                ClickDailyRollup.day >= start,
                ClickDailyRollup.day <= today,
            )
            .group_by(Link.id)
            .order_by(func.sum(ClickDailyRollup.count).desc())
            .limit(10)
        ).all()

        total_links = session.scalar(
            select(func.count(Link.id)).where(Link.account_id == g.account_id)
        ) or 0

        top_links = [
            {
                "id": str(link.id),
                "short_code": link.short_code,
                "short_url": short_url(link.short_code),
                "title": link.title,
                "clicks": int(clicks or 0),
            }
            for link, clicks in top_rows
        ]

    return jsonify(
        {
            "range_days": days,
            "summary": {"clicks": total_clicks, "links": total_links},
            "series": series,
            "top_links": top_links,
        }
    )
