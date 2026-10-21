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
- **Identity lives in accounts.3m4.net** (shared by every 3m4 app; contract:
  `accounts/CONTRACT.md`). Register, log in (password, magic link, Google /
  GitHub / Microsoft / Discord), verify e-mail, profile, avatar and logout all
  happen there. This app has no passwords and no refresh tokens.
- Dashboard: the accounts session JWT (EdDSA) arrives in the `3m4_session`
  cookie (`Domain=.3m4.net`, 15 min, refreshed by the browser against
  `${ACCOUNTS_URL}/api/session/refresh`) or as `Authorization: Bearer <jwt>`.
  The API verifies it locally with the JWKS at
  `${ACCOUNTS_INTERNAL_URL}/.well-known/jwks.json` (issuer `ACCOUNTS_URL`,
  audience `3m4`).
- First request of an unknown `sub` ⇒ just-in-time provisioning: `users`
  row (`identity_id` = `sub`, email / handle / name / avatar_url mirrored
  from the claims and refreshed on every request) + `accounts` row
  (`"{handle}'s workspace"`, plan free) + owner membership. Gated by the
  `signups` switch (403 `signups_disabled`).
- Errors: 401 `no_session` (nothing presented ⇒ the web app sends the visitor
  to `${ACCOUNTS_URL}/login?return_to=`), 401 `session_expired` (client
  refreshes once and retries), 401 `invalid_session`, 403 `email_unverified`
  (every session route except `GET /auth/me`, which the dashboard uses to
  render the "verify your e-mail" banner).
- `/login` and `/signup` on the web app are 302 redirects to the accounts
  pages with `return_to` set to the dashboard.
- Public API uses API keys: header `X-API-Key: m4_live_...` (or the same key
  as a bearer; maps to an account). Unchanged by the identity move.

### Authorization (RBAC)
- Every API key has a **role** (`viewer` | `editor` | `admin`) chosen at creation. Roles → scopes live in `packages/shared/api_key_roles.json` (shared by API, dashboard and MCP server).
- Scopes: `links:read`, `links:write`, `links:delete`, `analytics:read`, `usage:read`, `audit:read`. Dashboard (accounts) sessions hold every scope.
- Each endpoint below names its scope. Missing scope → **403** `{ "error": { "code": "insufficient_scope", "message", "required_scope", "role" } }` and an `auth.denied` audit event.
- Audit: mutations (`link.create|update|delete`, `apikey.create|revoke`) and denials are appended to `audit_events` in the same transaction.

## REST API (all under `/api`)
Responses are JSON. Errors: `{ "error": { "code": "string", "message": "string" } }`.

### Auth
- `GET /auth/me` → `{user: {id, identity_id, email, email_verified, handle, name, avatar_url, created_at}, account, plan, limits, usage, flags}` — session (verified or not). Everything else about the identity is at accounts.3m4.net (`/api/me`, `/profile`).
- `GET /flags` → `{flags}` — public; a valid session cookie upgrades the targeting bucket to the account.

### Links
- `GET    /links?page=1&per_page=20&q=` → `{items:[Link], page, per_page, total}` — scope `links:read`
- `POST   /links` `{destination_url, custom_slug?, redirect_type?(301|302), title?, expires_at?}` → Link (201) — scope `links:write`. 402 if monthly link limit reached (`error.code = "limit_reached"`, `error.which = "links"`). 402 if `custom_slug` is sent on a plan without it (`error.code = "upgrade_required"`, `error.which = "custom_slugs"`; per-plan boolean `custom_slugs` in plan_limits.json).
- `GET    /links/:id` → Link — `links:read`
- `PATCH  /links/:id` `{destination_url?, title?, active?, redirect_type?, expires_at?}` → Link — `links:write`
- `DELETE /links/:id` → 204 — `links:delete`
- `GET    /links/:id/qr.png?size=512` → image/png — `links:read`
- `GET    /links/:id/analytics?range=7d|30d|1y` — `analytics:read` → `{summary:{clicks,uniques}, series:[{date,count}], by_country:[{key,count}], by_device:[...], by_referrer:[...]}`

### Account / analytics / keys
- `GET /account/usage` → `{period_start, period_end, links_created, tracked_clicks, limits}` — JWT or key, `usage:read`
- `GET /account/audit?limit=50&action=` → `{items:[AuditEvent], limit}` newest first — JWT or key, `audit:read`
- `GET /analytics/overview?range=` → account-wide totals + top links — JWT or key, `analytics:read`
- `GET /apikeys` → `[{id, name, prefix, role, last_used_at, created_at}]` (JWT)
- `GET /apikeys/roles` → `{default_role, roles:{viewer|editor|admin: {label, description, scopes}}}` (public)
- `POST /apikeys` `{name, role?}` → `{id, key, prefix, name, role}` (full key shown once; 400 `invalid_role`) (JWT)
- `GET /apikeys/me` → `{account, key:{id, prefix, role}, scopes:[...]}` (API key only; what the MCP server calls at startup)
- `DELETE /apikeys/:id` → 204 (JWT)

### MCP (AI agents)
- Streamable HTTP endpoint `POST /mcp` (Caddy → `mcp:3333`), auth `Authorization: Bearer m4_live_…` (or `X-API-Key`). Stateless; one server per request bound to the caller's key.
- stdio flavour published to npm as `3m4-mcp`. Tools/roles table in `packages/mcp-server/README.md`.
- `/mcp` is a reserved slug.

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

### Public QR
- `GET /qr/:short_code.png?size=512` → image/png, **no auth** (encodes only the public short URL). Rate limited. 404 for unknown codes.

### Early access
- Flag `early-access` ON ⇒ `effective_plan_limits()` returns the `enterprise` limits for every account (links, clicks, retention, custom slugs), `/auth/me.limits` reflects that, and the UI hides plan/billing surfaces behind an early-access notice. OFF ⇒ limits enforced per `accounts.plan`.

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

## AuditEvent object
```json
{
  "id": "uuid", "ts": "2026-10-14T00:00:00Z",
  "actor_type": "api_key", "actor_id": "uuid", "actor_label": "m4_live_AbCd",
  "action": "link.delete", "target_type": "link", "target_id": "uuid",
  "outcome": "ok", "meta": {"short_code": "Ab3xK9"}
}
```
`actor_type`: `user` | `api_key`. `outcome`: `ok` | `denied` | `error`.
