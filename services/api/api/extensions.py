"""Flask extensions instantiated once and wired up in the app factory.

Right now that's just the rate limiter (Flask-Limiter backed by Redis). Keeping
it here lets blueprints import the shared ``limiter`` object without importing
the application module (which would be circular).
"""
from __future__ import annotations

from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from dbcore.config import config


def public_api_key_func() -> str:
    """Rate-limit key for public-API routes.

    When the caller authenticates with an API key we bucket the limit by that
    key; otherwise we fall back to the client IP. This way one account hammering
    the public API does not eat into another account's budget.
    """
    return request.headers.get("X-API-Key") or get_remote_address()


# Default limit applies to every route. Public-API routes additionally apply
# `config.rate_limit_public_api` via an explicit `@limiter.limit(...)` decorator.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[config.rate_limit_default],
    storage_uri=config.redis_url,
    strategy="fixed-window",
)
