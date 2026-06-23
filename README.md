# 3m4

**Open-source URL shortener with real click analytics.** Short codes, custom
domains, 301/302 redirects, geo/device/referrer analytics, QR codes, and a public
API — self-hostable under the MIT license.

> Built by Enrique Magallon Alvarez. Hosted edition runs at `3m4.net`; the core is
> free to self-host on your own infrastructure.

---

## Why 3m4

- **Clicks are the product.** Usage is metered on two monthly metrics — links
  created and *tracked clicks* — because clicks are the real cost and the real value.
- **Accurate analytics by default.** Links default to `302` so every click is
  counted; opt a link into `301` when you want permanent/cached behavior.
- **Self-host friendly.** The open-source build runs without any billing provider.
- **Stateless & portable.** Plain Docker, Postgres as the source of truth — scale
  from one VPS to a load-balanced fleet without rewrites.

## Architecture

```
Caddy (reverse proxy, auto-HTTPS)
 ├─ web        Qwik City (Bun)   landing + /info + /blog + /projects + /sponsors + dashboard
 ├─ redirect   Flask (hot path)  GET /<code> → enqueue click → 301/302
 ├─ api        Flask             auth, links, analytics, domains, billing webhooks, metering
 └─ worker     Celery            click enrichment (geo/device/referrer), rollups, retention
      Postgres (source of truth) · Redis (cache + queue)
```

Shared core lives in [`dbcore/`](dbcore/) (models, plans, code generation, metering)
and is imported by all three Python services. The interface contract is
[`CONTRACT.md`](CONTRACT.md); the full design is [`PROJECT_PLAN.md`](PROJECT_PLAN.md).

```
dbcore/            shared Python core (models, plans, codegen, usage, privacy)
services/api/      Flask REST API
services/redirect/ Flask redirect service
services/worker/   Celery worker + beat
apps/web/          Qwik City frontend (Bun)
packages/shared/   plan_limits.json + reserved_slugs.json (single source of truth)
deploy/            docker-compose, Caddyfile
db/                Alembic scaffold for future migrations
```

## Quick start (Docker)

```bash
cp .env.example .env        # then edit secrets (JWT_SECRET_KEY, IP_HASH_SALT, ...)
make up                     # build + start everything; runs migrations & seeds
# open http://localhost:8080
```

The `migrate` service creates tables and seeds the reserved slugs (including the
`/resume` → https://enrique-magallon.com redirect) before the app starts.

### Self-host (no billing)

```bash
# sets BILLING_ENABLED=false; RevenueCat is never contacted, paywalls hidden
make up-selfhost
```

## Common tasks

| Command | Does |
|---|---|
| `make up` / `make down` | start / stop the full stack |
| `make up-selfhost` | start without billing |
| `make logs` | tail all logs |
| `make seed` | re-seed reserved slugs |
| `make build` | rebuild images |
| `make ps` | service status |

## Configuration

All config is environment-driven — see [`.env.example`](.env.example). Key values:
`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `IP_HASH_SALT`, `BILLING_ENABLED`,
`REVENUECAT_WEBHOOK_AUTH_TOKEN`, `POSTHOG_API_KEY`, `RESUME_REDIRECT_URL`.

## Privacy

Raw IP addresses are **never stored**. The worker uses the IP transiently for geo
lookup, stores only a salted hash and coarse geo, then discards it.

## Scaling path

Single VPS → vertical scale → externalize Postgres/Redis (managed + replica) →
multiple stateless `api`/`redirect` instances behind a load balancer → CDN/edge →
ClickHouse for clicks if volume demands it. See `PROJECT_PLAN.md §9`.

## License

[MIT](LICENSE) © 2026 Enrique Magallon Alvarez.
