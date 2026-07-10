"""Feature flag enforcement for the API.

``@require_flag("key")`` rejects requests when a flag is OFF for the
requester. Backend enforcement is the source of truth — the frontend only
mirrors these flags (delivered via ``/auth/me`` and ``GET /api/flags``).

Never gate: the redirect service, the RevenueCat webhook, or login.
"""
from __future__ import annotations

from functools import wraps

from flask import Blueprint, g, jsonify, request

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
    """Resolved flags for the requester. Public: anonymous pages (e.g. signup)
    need to know their flags before any session exists. An optional bearer
    token upgrades resolution to the account's targeting bucket — but this
    endpoint never *requires* auth, so it tolerates bad/expired tokens.
    """
    distinct = "anonymous"
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        try:
            from .auth_utils import decode_access_token

            payload = decode_access_token(header[len("Bearer ") :].strip())
            distinct = payload["account_id"]
        except Exception:
            pass
    return jsonify({"flags": resolve_all(distinct)})
