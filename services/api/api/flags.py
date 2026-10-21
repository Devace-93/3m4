"""Feature flag enforcement for the API.

``@require_flag("key")`` rejects requests when a flag is OFF for the
requester. Backend enforcement is the source of truth — the frontend only
mirrors these flags (delivered via ``/auth/me`` and ``GET /api/flags``).

Never gate: the redirect service, the RevenueCat webhook, or login.
"""
from __future__ import annotations

from functools import wraps

from flask import Blueprint, g, jsonify

from dbcore.feature_flags import is_enabled, resolve_all

from .errors import ApiError


def _distinct_id() -> str:
    """PostHog distinct_id for the requester: account id, or "anonymous"."""
    account_id = getattr(g, "account_id", None)
    return str(account_id) if account_id else "anonymous"


def require_flag(key: str, status: int = 403):
    """Reject the request when ``key`` is OFF for the requester.

    Place *after* the auth decorator so ``g.account_id`` is set and the flag
    can target specific accounts / percentage rollouts.
    """

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if not is_enabled(key, _distinct_id()):
                raise ApiError(status, "feature_disabled", f"'{key}' is not available.")
            return view(*args, **kwargs)

        return wrapper

    return decorator


bp = Blueprint("flags", __name__)


@bp.get("")
def flags():
    """Resolved flags for the requester. Public: the marketing pages need
    their flags before any session exists. A valid accounts session upgrades
    resolution to the account's targeting bucket — but this endpoint never
    *requires* auth, so it tolerates missing, bad or expired sessions.
    """
    distinct = "anonymous"
    try:
        from sqlalchemy import select

        from dbcore.db import SessionLocal
        from dbcore.models import Membership, User

        from .auth_utils import session_token, verify_session

        token = session_token()
        if token:
            claims = verify_session(token)
            with SessionLocal() as session:
                account_id = session.scalar(
                    select(Membership.account_id)
                    .join(User, User.id == Membership.user_id)
                    .where(User.identity_id == claims["sub"])
                    .order_by(Membership.created_at)
                )
            distinct = str(account_id) if account_id else claims["sub"]
    except Exception:
        pass
    return jsonify({"flags": resolve_all(distinct)})
