"""API keys blueprint: list, create (shown once), revoke.

Keys look like ``m4_live_<random>``. We store only a sha256 hash plus a short,
non-sensitive ``prefix`` (e.g. ``m4_live_AbCd``) so the dashboard can label keys
without ever holding the secret. The prefix is deliberately NOT ``sk_live_``:
that is Stripe's secret-key convention, and secret scanners (GitHub push
protection etc.) flag it as a leaked Stripe key.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from dbcore.db import session_scope
from dbcore.models import ApiKey

from ..auth_utils import hash_token, require_auth
from ..errors import ApiError
from ..serializers import serialize_api_key

bp = Blueprint("apikeys", __name__)


@bp.get("")
@require_auth
def list_keys():
    with session_scope() as session:
        rows = session.scalars(
            select(ApiKey)
            .where(ApiKey.account_id == g.account_id, ApiKey.revoked_at.is_(None))
            .order_by(ApiKey.created_at.desc())
        ).all()
        body = [serialize_api_key(k) for k in rows]
    return jsonify(body)


@bp.post("")
@require_auth
def create_key():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip() or "API key"

    # `m4_live_` + 32 url-safe random chars. The prefix keeps the brand tag plus
    # the first 4 random chars so it is recognisable but not guessable.
    random_part = secrets.token_urlsafe(24)[:32]
    full_key = f"m4_live_{random_part}"
    prefix = f"m4_live_{random_part[:4]}"

    with session_scope() as session:
        api_key = ApiKey(
            account_id=g.account_id,
            name=name,
            prefix=prefix,
            key_hash=hash_token(full_key),
        )
        session.add(api_key)
        session.flush()
        key_id = str(api_key.id)

    # Return the full key exactly once — it is never recoverable afterwards.
    return jsonify({"id": key_id, "key": full_key, "prefix": prefix, "name": name}), 201


@bp.delete("/<key_id>")
@require_auth
def delete_key(key_id):
    try:
        kid = uuid.UUID(key_id)
    except ValueError:
        raise ApiError(404, "not_found", "API key not found.")
    with session_scope() as session:
        api_key = session.scalar(
            select(ApiKey).where(ApiKey.id == kid, ApiKey.account_id == g.account_id)
        )
        if api_key is None:
            raise ApiError(404, "not_found", "API key not found.")
        if api_key.revoked_at is None:
            api_key.revoked_at = datetime.now(timezone.utc)
    return "", 204
