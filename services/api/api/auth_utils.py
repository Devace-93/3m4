"""Authentication helpers: password hashing, JWTs, and route decorators.

Two ways to authenticate against this API:

1. **Dashboard / first-party** — a short-lived JWT access token in the
   ``Authorization: Bearer <token>`` header, refreshed via an opaque refresh
   token stored *hashed* in the ``refresh_tokens`` table.
2. **Public API** — a long-lived API key in the ``X-API-Key`` header, looked up
   by its sha256 hash in ``api_keys``.

The ``@require_auth`` and ``@require_api_key`` decorators put the resolved
``user_id`` / ``account_id`` on ``flask.g`` so views can stay terse.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import g, request
from sqlalchemy import select

from dbcore.config import config
from dbcore.db import SessionLocal
from dbcore.models import ApiKey

from .errors import ApiError

# argon2-cffi password hasher with library defaults (a good modern baseline).
_ph = PasswordHasher()


# --------------------------------------------------------------------------- #
# Passwords
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        # Malformed hash, etc. Treat as a failed login rather than a 500.
        return False


# --------------------------------------------------------------------------- #
# Tokens
# --------------------------------------------------------------------------- #
def create_access_token(user_id, account_id) -> str:
    """Mint a signed HS256 JWT access token (TTL from config)."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "account_id": str(account_id),
        "iat": now,
        "exp": now + timedelta(minutes=config.access_token_ttl_min),
    }
    return jwt.encode(payload, config.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decode/verify a JWT. Raises ``jwt.PyJWTError`` on bad/expired tokens."""
    return jwt.decode(token, config.jwt_secret_key, algorithms=["HS256"])


def generate_refresh_token() -> str:
    """Opaque, high-entropy refresh token. Only the hash is persisted."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """sha256 hex digest — used for refresh tokens and API keys at rest."""
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=config.refresh_token_ttl_days)


# --------------------------------------------------------------------------- #
# Decorators
# --------------------------------------------------------------------------- #
def require_auth(view):
    """Require a valid JWT. Sets ``g.user_id`` and ``g.account_id``."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "unauthorized", "Missing bearer token.")
        token = header[len("Bearer ") :].strip()
        try:
            payload = decode_access_token(token)
        except jwt.ExpiredSignatureError:
            raise ApiError(401, "token_expired", "Access token has expired.")
        except jwt.PyJWTError:
            raise ApiError(401, "unauthorized", "Invalid access token.")
        g.user_id = uuid.UUID(payload["sub"])
        g.account_id = uuid.UUID(payload["account_id"])
        g.auth_method = "jwt"
        return view(*args, **kwargs)

    return wrapper


def _resolve_api_key():
    """Look up the API key from ``X-API-Key``; returns the ApiKey or None.

    Also stamps ``last_used_at`` so the dashboard can show key activity. Runs in
    its own short session so it is independent of the view's transaction.
    """
    raw = request.headers.get("X-API-Key", "").strip()
    if not raw:
        return None
    key_hash = hash_token(raw)
    with SessionLocal() as session:
        api_key = session.scalar(
            select(ApiKey).where(
                ApiKey.key_hash == key_hash,
                ApiKey.revoked_at.is_(None),
            )
        )
        if api_key is None:
            return None
        api_key.last_used_at = datetime.now(timezone.utc)
        account_id = api_key.account_id
        session.commit()
    return account_id


def require_api_key(view):
    """Require a valid API key. Sets ``g.account_id`` (``g.user_id`` is None)."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        account_id = _resolve_api_key()
        if account_id is None:
            raise ApiError(401, "unauthorized", "Missing or invalid API key.")
        g.user_id = None
        g.account_id = account_id
        g.auth_method = "api_key"
        return view(*args, **kwargs)

    return wrapper


def require_auth_or_api_key(view):
    """Accept EITHER a dashboard JWT OR a public API key.

    Used by the ``/links`` endpoints which are reachable from both the dashboard
    and the public API.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            return require_auth(view)(*args, **kwargs)
        if request.headers.get("X-API-Key"):
            return require_api_key(view)(*args, **kwargs)
        raise ApiError(401, "unauthorized", "Provide a bearer token or an API key.")

    return wrapper
