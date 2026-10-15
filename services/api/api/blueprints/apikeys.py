"""API keys blueprint: list, create (shown once), revoke, and ``/me``.

Keys look like ``m4_live_<random>``. We store only a sha256 hash plus a short,
non-sensitive ``prefix`` (e.g. ``m4_live_AbCd``) so the dashboard can label keys
without ever holding the secret. The prefix is deliberately NOT ``sk_live_``:
that is Stripe's secret-key convention, and secret scanners (GitHub push
protection etc.) flag it as a leaked Stripe key.

Every key carries a *role* (viewer | editor | admin) chosen at creation time;
the role maps to scopes in ``packages/shared/api_key_roles.json`` and is what
``@require_scope`` checks on every public-API endpoint.
"""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import select

from dbcore import audit
from dbcore.db import session_scope
from dbcore.models import Account, ApiKey
from dbcore.rbac import all_roles, default_role, is_valid_role, scopes_for

from ..auth_utils import actor, hash_token, require_api_key, require_auth
from ..errors import ApiError
from ..extensions import limiter, public_api_key_func
from ..serializers import serialize_account, serialize_api_key

bp = Blueprint("apikeys", __name__)

_public_limit = limiter.limit("60/minute", key_func=public_api_key_func)


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


@bp.get("/roles")
def roles():
    """Public: the role catalogue, so clients can render a picker."""
    return jsonify({"default_role": default_role(), "roles": all_roles()})


@bp.post("")
@require_auth
def create_key():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip() or "API key"
    role = (data.get("role") or default_role()).strip().lower()
    if not is_valid_role(role):
        raise ApiError(
            400,
            "invalid_role",
            f"role must be one of: {', '.join(sorted(all_roles()))}.",
            extra={"roles": sorted(all_roles())},
        )

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
            role=role,
            key_hash=hash_token(full_key),
        )
        session.add(api_key)
        session.flush()
        key_id = str(api_key.id)
        audit.record(
            session,
            account_id=g.account_id,
            action="apikey.create",
            target_type="api_key",
            target_id=key_id,
            meta={"name": name, "prefix": prefix, "role": role},
            **actor(),
        )

    # Return the full key exactly once — it is never recoverable afterwards.
    return (
        jsonify({"id": key_id, "key": full_key, "prefix": prefix, "name": name, "role": role}),
        201,
    )


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
            audit.record(
                session,
                account_id=g.account_id,
                action="apikey.revoke",
                target_type="api_key",
                target_id=str(api_key.id),
                meta={"prefix": api_key.prefix, "role": api_key.role},
                **actor(),
            )
    return "", 204


@bp.get("/me")
@_public_limit
@require_api_key
def me():
    """Identity + permissions of the calling API key.

    Agents (e.g. the 3m4 MCP server) call this once at startup to learn which
    scopes they hold and only expose the matching tools.
    """
    with session_scope() as session:
        account = session.get(Account, g.account_id)
        if account is None:
            raise ApiError(404, "not_found", "Account not found.")
        body = {
            "account": serialize_account(account),
            "key": {"id": str(g.api_key_id), "prefix": g.api_key_prefix, "role": g.role},
            "scopes": sorted(scopes_for(g.role)),
        }
    return jsonify(body)
