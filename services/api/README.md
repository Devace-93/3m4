# 3m4 — API service (Flask)

JSON REST API for the 3m4 URL shortener. Auth, links, analytics, account usage,
API keys, and (optionally) RevenueCat billing. Mounted at `/api` behind Caddy.

## Layout

```
services/api/
├── api/
│   ├── app.py              # create_app() factory + error handlers + health
│   ├── extensions.py       # Flask-Limiter (Redis-backed)
│   ├── auth_utils.py       # password hashing, JWT, @require_auth / @require_api_key
│   ├── serializers.py      # ORM -> JSON (CONTRACT.md shapes)
│   ├── errors.py           # ApiError -> {"error": {...}}
│   └── blueprints/         # auth, links, analytics, account, apikeys, billing
├── requirements.txt
└── Dockerfile
```

Shared logic (config, models, plans, codegen, usage, reserved slugs, PostHog)
lives in the repo-root `dbcore/` package and is imported, never re-implemented.

## Auth

- **Dashboard:** `Authorization: Bearer <JWT>` (HS256, TTL `ACCESS_TOKEN_TTL_MIN`).
  Refresh tokens are opaque and stored **hashed** (sha256) in `refresh_tokens`.
  Passwords hashed with argon2.
- **Public API:** `X-API-Key: sk_live_...` (looked up by sha256 hash). The
  `/links` endpoints accept either method.

## Endpoints (all under `/api`)

- `auth`: `register`, `login`, `refresh`, `logout`, `me`
- `links`: list/create/get/patch/delete, `:id/qr.png`, `:id/analytics`
- `account/usage`, `analytics/overview`
- `apikeys`: list/create/delete
- `billing` (only if `BILLING_ENABLED=true`): `offerings`, `webhook`
- `healthz` (also at the bare path for container health checks)

## Run

```bash
# From the repo root, via docker-compose (recommended):
docker compose -f deploy/docker-compose.yml up --build api

# Locally (needs Postgres + Redis reachable, deps installed):
pip install -r services/api/requirements.txt
gunicorn -b 0.0.0.0:5000 -w 2 'api.app:create_app()'
```

Configuration is entirely env-driven (`dbcore.config`); see the repo `.env.example`.

## Limit enforcement

- **Link creation over the monthly cap →** hard block, HTTP `402`
  `{"error":{"code":"limit_reached","which":"links"}}`, PostHog `limit_reached`.
- Tracked-click overflow is handled by the redirect/worker services (keep
  redirecting, stop counting) — not here.
