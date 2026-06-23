# 3m4 — Interface Contract

This file is the shared contract between the backend (Flask), the redirect/worker
services, and the Qwik frontend. All services build against it. Keep it in sync.

## Ports (container)
| Service   | Port | Notes |
|-----------|------|-------|
| api       | 5000 | Flask JSON API, mounted at `/api` by Caddy |
| redirect  | 5001 | Catch-all short-code redirects on the apex |
| web       | 3000 | Qwik City (Bun) SSR server — landing + dashboard |
| postgres  | 5432 | |
| redis     | 6379 | db0 cache, db1 celery broker, db2 result backend |
| caddy     | 8080 | dev entrypoint (prod: 80/443) |

Frontend tooling is **Bun** (`bun install`, `bun run build`, `bun run dev`). Image: `oven/bun`.

## Auth
- JWT bearer. `Authorization: Bearer <access_token>`.
- Access token TTL ~30 min; refresh token (opaque, stored hashed in DB) ~30 days.
- Public API uses API keys: header `X-API-Key: sk_live_...` (maps to an account).

## REST API (all under `/api`)
Responses are JSON. Errors: `{ "error": { "code": "string", "message": "string" } }`.

### Auth
- `POST /auth/register` `{email, password, account_name?}` → `{user, account, access_token, refresh_token}` (201)
- `POST /auth/login` `{email, password}` → `{user, account, access_token, refresh_token}`
- `POST /auth/refresh` `{refresh_token}` → `{access_token}`
- `POST /auth/logout` `{refresh_token}` → 204
- `GET  /auth/me` → `{user, account, plan, limits, usage}`

### Links
- `GET    /links?page=1&per_page=20&q=` → `{items:[Link], page, per_page, total}`
- `POST   /links` `{destination_url, custom_slug?, redirect_type?(301|302), title?, expires_at?}` → Link (201). 402 if monthly link limit reached (`error.code = "limit_reached"`, `error.which = "links"`).
- `GET    /links/:id` → Link
- `PATCH  /links/:id` `{destination_url?, title?, active?, redirect_type?, expires_at?}` → Link
- `DELETE /links/:id` → 204
- `GET    /links/:id/qr.png?size=512` → image/png
- `GET    /links/:id/analytics?range=7d|30d|1y` → `{summary:{clicks,uniques}, series:[{date,count}], by_country:[{key,count}], by_device:[...], by_referrer:[...]}`

### Account / analytics / keys
- `GET /account/usage` → `{period_start, period_end, links_created, tracked_clicks, limits}`
- `GET /analytics/overview?range=` → account-wide totals + top links
- `GET /apikeys` → `[{id, prefix, last_used_at, created_at}]`
- `POST /apikeys` `{name}` → `{id, key}` (full key shown once)
- `DELETE /apikeys/:id` → 204

### Billing (only when BILLING_ENABLED=true)
- `GET  /billing/offerings` → offerings/packages for the paywall (proxied/shaped from RevenueCat config)
- `POST /billing/webhook` ← RevenueCat (server-to-server; verifies `Authorization` header)

### Health
- `GET /healthz` → `{status:"ok"}`

## Link object
```json
{
  "id": "uuid",
  "short_code": "Ab3xK9",
  "short_url": "https://3m4.net/Ab3xK9",
  "destination_url": "https://example.com/very/long",
  "redirect_type": 302,
  "title": "optional",
  "active": true,
  "expires_at": null,
  "created_at": "2026-06-23T00:00:00Z",
  "click_count": 0
}
```

## Limits / plans
Loaded from `packages/shared/plan_limits.json`. Enforcement:
- **Link creation over limit** → hard block, HTTP 402, emit PostHog `limit_reached{which:"links"}`.
- **Tracked clicks over limit** → KEEP redirecting, STOP counting/recording (no insert), emit `limit_reached{which:"clicks"}` once per period.

## Reserved slugs
Loaded from `packages/shared/reserved_slugs.json`. Never generate or allow these as codes.
`special_redirects` (e.g. `resume` → enrique-magallon.com, 302) are served by the redirect service.

## PostHog events (frontend + backend)
`signup`, `link_created`, `limit_reached{which,plan}`, `paywall_viewed`, `checkout_started`,
`subscription_activated`, `upgrade`, `downgrade`, `churn`. Group analytics: group=account, prop `plan`.

## Frontend routes (single Qwik City app)
Marketing (apex): `/`, `/info/[...slug]`, `/blog/[...slug]`, `/projects/[...slug]`, `/sponsors`.
Dashboard (app.3m4.net): `/login`, `/signup`, `/dashboard` (links list), `/dashboard/links/[id]`
(analytics + QR), `/dashboard/settings` (api keys), `/dashboard/billing` (paywall/upgrade).
`/resume` is NOT a frontend route — it is handled by the redirect service (302 → external).
