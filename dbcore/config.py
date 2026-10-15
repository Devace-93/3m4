"""Environment-driven configuration. No secrets in code."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    # database / cache
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://shortlink:shortlink@localhost:5432/shortlink",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    celery_broker_url: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1")
    celery_result_backend: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2")

    # auth
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-insecure-change-me")
    access_token_ttl_min: int = int(os.getenv("ACCESS_TOKEN_TTL_MIN", "30"))
    refresh_token_ttl_days: int = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))

    # privacy
    ip_hash_salt: str = os.getenv("IP_HASH_SALT", "dev-insecure-salt")

    # urls
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:8080")
    dashboard_url: str = os.getenv("DASHBOARD_URL", "http://localhost:8080")
    short_domain: str = os.getenv("SHORT_DOMAIN", "localhost:8080")
    # Scheme used when rendering short URLs. Prod is https (Caddy auto-TLS);
    # local Caddy serves plain http on :8080, so set SHORT_URL_SCHEME=http there.
    short_url_scheme: str = os.getenv("SHORT_URL_SCHEME", "https").strip().lower() or "https"
    resume_redirect_url: str = os.getenv("RESUME_REDIRECT_URL", "https://enrique-magallon.com")

    # billing
    billing_enabled: bool = _bool("BILLING_ENABLED", True)
    revenuecat_webhook_token: str = os.getenv("REVENUECAT_WEBHOOK_AUTH_TOKEN", "")
    revenuecat_api_key: str = os.getenv("REVENUECAT_SECRET_API_KEY", "")

    # posthog
    posthog_api_key: str = os.getenv("POSTHOG_API_KEY", "")
    posthog_host: str = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    # Personal API key enables local evaluation of feature flags (no network
    # in the request path). Without it, flags fall back to registry defaults.
    posthog_personal_api_key: str = os.getenv("POSTHOG_PERSONAL_API_KEY", "")

    # rate limiting
    rate_limit_default: str = os.getenv("RATE_LIMIT_DEFAULT", "120/minute")
    rate_limit_public_api: str = os.getenv("RATE_LIMIT_PUBLIC_API", "60/minute")

    # geoip
    geoip_db_path: str = os.getenv("GEOIP_DB_PATH", "/geoip/GeoLite2-City.mmdb")


config = Config()
