# 3m4 — URL Shortener with Click Analytics — Project Plan

> Working name: **3m4** (from the domain `3m4.net`). Rename pending decision.
> Status: PLANNING COMPLETE — implementation starting (Phase 1 MVP).
> Last updated: 2026-06-23.

Owner: Enrique Magallon Alvarez. License: **MIT** (open-source core, self-hostable).

---

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Backend | Python + Flask (REST JSON API) |
| Database | PostgreSQL (source of truth, stateless app) |
| Frontend | **Qwik (Qwik City)** — resumable, excellent SEO/perf for marketing + content pages |
| Billing | RevenueCat Web Billing (Stripe underneath); entitlements `pro`, `team` |
| Product analytics | PostHog (frontend SDK + server-side `posthog-python`) |
| Redirect status | **302 default**, per-link `301` override (accurate click analytics by default) |
| Auth | **Roll-your-own** Flask + JWT (access) + refresh tokens in Postgres. No vendor lock-in. WorkOS reserved for enterprise SSO (Phase 5) |
| Tenancy | **Account/org is the billing unit from day 1**; users join via `memberships` + roles. RC `app_user_id = account_id` |
| Short-link domain | **Apex `3m4.net/<code>`**, shared with marketing/reserved paths via reserved-slug blocklist |
| IP storage | **Never store raw IPs.** Hash (salted + truncated) → derive geo only, then discard |
| Click-limit overflow | **Keep redirecting, stop tracking/counting.** Never break a live link |
| Link-create overflow | **Hard block** new links with HTTP `402` + PostHog `limit_reached` event |
| Short codes | Random base62, 6→7 chars, unique-constraint + retry. Vanity/custom slugs gated to paid plans |
| Brand color | Tailwind **blue** scale |
| Deployment | Dockerized (Dockerfile + docker-compose), Caddy reverse proxy w/ on-demand TLS |
| VPS | Hetzner Cloud recommended; portable plain-Docker (DO/Vultr/Linode drop-in) |

---

## 2. Domain / routing layout

- `3m4.net` (apex) — landing page + reserved content paths + short-link redirects.
  - `/` — **landing page**: page name, the goal/pitch, basic info, CTA.
  - `/info/*` — catch-all for future pages (pricing, docs, terms, etc.).
  - `/resume` — **302 redirect → https://enrique-magallon.com** (stored in seed/reserved file).
  - `/blog/*`, `/projects/*` — reserved for future content.
  - `/sponsors` — supporter listing + badges (Phase 3).
  - `/<code>` — short-link redirect (302 default / per-link 301).
- `app.3m4.net` — **dashboard for account admins / users** (authed Qwik app).
- `/api/*` — Flask JSON API.

DNS: managed at Bluehost (record only). Point `A`/`CNAME` at the VPS (Caddy). Bluehost does NOT host the app.

---

## 3. Services / architecture

Hot path (redirects) is split from everything else so it scales independently.

```
Caddy (reverse proxy, auto-HTTPS, on-demand TLS for custom domains)
 ├─ web        (Qwik City)  landing + /info + /blog + /projects + /sponsors + dashboard (app.3m4.net)
 ├─ redirect   (Flask, tiny)  GET /<code> → lookup → enqueue click → 302/301
 ├─ api        (Flask)        auth, links, analytics, domains, apikeys, billing webhooks, metering
 └─ worker     (Celery/RQ)    click enrichment (geo/device/referrer), rollups, retention, usage counters
        Postgres (source of truth)   Redis (cache + queue)   Object storage (QR/assets, S3-compatible)
```

- **redirect**: minimal deps; cache lookup (Redis→PG), push raw click event to queue, return redirect immediately. Reads per-link `redirect_type`.
- **worker**: consumes click events → geo (GeoLite2) + UA parse + referrer host → batch insert `clicks`, bump `usage_counters`, update `click_daily_rollup`, prune by retention.
- **api**: Flask blueprints `auth`, `links`, `analytics`, `domains`, `apikeys`, `billing`. `billing` is conditionally registered via `BILLING_ENABLED` so the self-host build omits RevenueCat entirely.
- **Stateless**: JWT access + DB refresh tokens; no local sessions/files. QR generated on demand or cached to object storage. Any instance serves any request.

### Repo layout (monorepo)
```
/services/api        Flask API
/services/redirect   Flask redirect service
/services/worker     Celery/RQ worker
/apps/web            Qwik City (marketing + dashboard)
/packages/shared     shared TS types / constants (reserved slugs, plan limits)
/db                  schema + migrations + seeds
/deploy              docker-compose, Caddyfile, env templates
PROJECT_PLAN.md
LICENSE              MIT
README.md
```

---

## 4. PostgreSQL data model (target schema)

Account = billing entity; users join via memberships.

- **accounts** — id, name, plan (`free|pro|team|enterprise`), created_at
- **users** — id, email, password_hash, created_at
- **memberships** — account_id, user_id, role (`owner|admin|member`)
- **subscriptions** — account_id, rc_app_user_id, entitlement (`pro|team`), product_id, period (`monthly|annual`), status, current_period_start/end, will_renew, raw_payload
- **links** — id, account_id, domain_id (NULL=apex), short_code, destination_url, redirect_type (`301|302`), title, created_by, created_at, expires_at, active — `UNIQUE(domain_id, short_code)`
- **domains** — id, account_id, hostname, verification_token, verified_at, tls_status
- **clicks** — id, link_id, account_id, ts, ip_hash, country, region, city, device, os, browser, referrer_host, raw_ua — **time-partitioned (monthly)**. NO raw IP.
- **click_daily_rollup** — link_id, account_id, date, count, by_country/by_device JSONB
- **usage_counters** — account_id, period_start, period_end, links_created, tracked_clicks — `UNIQUE(account_id, period_start)`
- **api_keys** — id, account_id, key_hash, prefix, scopes, last_used_at, revoked_at
- **webhook_events** — provider, event_id (UNIQUE → idempotency), type, received_at, processed_at
- **reserved_slugs** — seeded blocklist (see §5)

> **LEARNING BOUNDARY:** Enrique writes the Postgres + Flask logic himself. I provide the schema as a documented target and clear stubs; see §10.

---

## 5. Reserved slugs (seed) + /resume redirect

Frozen blocklist enforced at code-gen AND on custom slugs:
`resume, blog, info, projects, sponsors, api, app, admin, login, signup, dashboard, settings, billing, static, assets, health, robots.txt, favicon.ico`

Special reserved redirect (stored in seed file):
- `/resume` → **302** → `https://enrique-magallon.com`

---

## 6. Plans & limits

| Plan | Links/mo | Tracked clicks/mo | Custom domains | Retention | Users | API |
|---|---|---|---|---|---|---|
| Free | 50 | 1,000 | 1 | 7 days | 1 | basic |
| Pro/Supporter (~$15/mo, ~$144/yr) | 1,000 | 50,000 | 3 | 1 year | 1–2 | full + /sponsors badge |
| Team (~$59/mo, ~$564/yr) | 10,000 | 250,000 | 10 | 2 years | up to 20 (roles) | full + priority support |
| Enterprise | custom | custom | custom | custom | custom | SSO, SLA |
| Self-host | unlimited/config | config | config | config | config | full (no billing) |

Enforcement = entitlement (from RevenueCat) → plan → limit map (config) + `usage_counters`.

---

## 7. RevenueCat integration

- App user ID = **account_id**.
- Entitlements `pro`, `team`; offerings `pro` & `team`, each w/ monthly + annual packages.
- Frontend: RC Web SDK → checkout / paywall.
- Backend: `/billing/webhook` verifies RC `Authorization` token, dedupes on `event_id`, handles `INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, PRODUCT_CHANGE, BILLING_ISSUE` → updates `subscriptions` + `accounts.plan`. Nightly REST reconcile as backstop.
- **Self-host**: `BILLING_ENABLED=false` → billing blueprint not loaded; RC SDK absent; limits from config.

## 8. PostHog integration

- Frontend SDK + `posthog-python` server-side (trustworthy subscription events).
- Group analytics: group = account, property `plan`.
- Events: `link_created`, `limit_reached {which: links|clicks|domains, plan}`, `paywall_viewed`, `checkout_started`, `subscription_activated`, `upgrade/downgrade/churn`.
- Funnel: signup → first link → `limit_reached` → `paywall_viewed` → `checkout_started` → `subscription_activated`.
- Self-host: key optional; no-ops when unset.

---

## 9. Deployment & scaling

- Images: `api`, `redirect`, `worker`; static builds for `web`. `docker-compose.yml` + `docker-compose.selfhost.yml` (drops billing).
- **Caddy** reverse proxy — chosen for **on-demand TLS** (auto-issues certs for customer custom domains).
- Config via env/`.env`; Postgres backups via `pg_dump`/`wal-g` → S3-compatible.
- VPS: Hetzner recommended; portable plain Docker.

**Scaling path:** single VPS → vertical → externalize state (managed PG + replica, managed Redis) → scale out (multiple api/redirect behind LB, stateless JWT) → CDN/edge (Cloudflare) → ClickHouse for clicks if volume explodes.

---

## 10. Build order & LEARNING BOUNDARY

**Enrique is learning PostgreSQL + Python + Flask.** Claude does NOT implement those sections — leaves documented stubs (`# TODO(enrique): ...`) with signatures, docstrings, and explanation of what to write. Claude fully builds: Qwik frontend, Docker, Caddy, configs, seeds, project structure, docs, shared TS constants.

**Phases:**
1. **Core (MVP)** — auth, links, redirect, basic click count, dashboard list, reserved-slug blocklist, single-VPS Docker + Caddy, landing page, `/resume` redirect, MIT license.
2. **Analytics & API** — worker enrichment (geo/device/referrer), rollups + retention, QR codes, public API + API keys + rate limiting.
3. **Billing** — RevenueCat entitlements/offerings, usage metering + enforcement, PostHog funnels, `/sponsors`.
4. **Teams & custom domains** — memberships/roles, org billing, Caddy on-demand TLS domain flow.
5. **Enterprise & scale** — SSO/SAML, SLA, LB + replicas, ClickHouse if needed.

Self-host packaging runs alongside from Phase 1 (billing-free compose + docs).

---

## 11. Resolved implementation decisions

1. **Scope:** fully implement now (working end-to-end); Enrique will later ask to
   strip the Flask/Postgres sections to stubs for learning.
2. **Brand name:** `3m4` (from the domain).
3. **Qwik structure:** single Qwik City app (marketing + dashboard via grouped layouts).
4. **Email scope:** deferred for MVP; SMTP/verification/reset stubbed.
5. **Frontend toolchain:** Bun (not npm/pnpm).

## 12. Build status (2026-06-23) — MVP+ COMPLETE & VERIFIED

Implemented and verified via `docker compose build` + live smoke test:
- `dbcore` shared core; `services/api` (auth/JWT, links, analytics, API keys,
  billing webhooks, metering, QR); `services/redirect` + `services/worker`
  (async click enrichment, rollups, retention); `apps/web` (Qwik/Bun: landing,
  /info+/info/pricing, /blog, /projects, /sponsors, dashboard, settings, billing).
- Verified: health on all services; register → create link (302 default) →
  redirect → async worker enrichment → usage metering (links_created, tracked_clicks)
  → analytics rollups; `/resume` → 302 → enrique-magallon.com.
- Dependencies pinned; reproducible build.

### Known follow-ups / notes for review
- Custom-slug gating to paid plans: validated but not yet plan-gated (noted).
- `analytics.summary.uniques` returns null (privacy model keeps only coarse counts).
- `/info/pricing` issues a trailing-slash 301 (Qwik City normalization; harmless).
- `short_url` uses `https://{SHORT_DOMAIN}` — set `SHORT_DOMAIN`/`APP_BASE_URL` for prod.
- RevenueCat checkout + PostHog need real keys; both no-op safely until configured.
- Email (verification/reset) still stubbed.
- `clicks` table not yet partitioned (planned migration).
