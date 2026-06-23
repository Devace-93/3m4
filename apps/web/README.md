# 3m4 — Web (Qwik City)

The marketing site **and** dashboard for [3m4](https://3m4.net), an open-source
URL shortener with click analytics. One Qwik City app, SSR'd by a standalone
Node-compatible HTTP server on **port 3000** (run with Bun).

- Apex `3m4.net` → marketing: `/`, `/info/*` (incl. `/info/pricing`), `/blog/*`,
  `/projects/*`, `/sponsors`.
- `app.3m4.net` → dashboard: `/login`, `/signup`, `/dashboard`,
  `/dashboard/links/[id]`, `/dashboard/settings`, `/dashboard/billing`.

Toolchain: **Bun** (do not use npm/pnpm). Stack: Qwik + Qwik City + Vite +
TypeScript + Tailwind CSS, with the official `@builder.io/qwik-city/adapters/node-server`.

## Develop

```bash
cd apps/web
bun install
bun run dev          # Vite dev server (SSR), http://localhost:5173
```

## Build & serve (production)

```bash
bun install
bun run build        # client + SSR server → dist/ + server/entry.node-server.js
bun run serve        # starts the SSR server on 0.0.0.0:3000
```

## Environment (build-time `VITE_*`)

| Var | Default | Purpose |
|-----|---------|---------|
| `VITE_API_URL` | `/api` | Backend base URL (Caddy proxies `/api`). |
| `VITE_SHORT_DOMAIN` | – | Display domain for short links. |
| `VITE_POSTHOG_KEY` | – | PostHog project key. Unset → analytics no-ops. |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog host. |
| `VITE_REVENUECAT_PUBLIC_KEY` | – | RevenueCat Web SDK key (checkout TODO). |
| `VITE_BILLING_ENABLED` | `true` | Set `false` for self-host → hides purchase UI. |

> `VITE_*` vars are inlined at **build time**. For hosted builds, pass them as
> Docker build args (see `Dockerfile`).

## Docker

Build context is the **repo root** (the app imports
`packages/shared/plan_limits.json`):

```bash
# from repo root
docker build -f apps/web/Dockerfile -t 3m4-web .
docker run -p 3000:3000 3m4-web
```

Or via `deploy/docker-compose.yml` (the `web` service).

## Layout

```
src/
  root.tsx                 app root (<head>/<body>)
  entry.ssr.tsx            SSR render entry
  entry.node-server.tsx    standalone HTTP server (prod)
  entry.dev.tsx            CSR dev entry
  global.css               Tailwind + blue theme
  lib/
    api.ts                 fetch client (bearer + 401 refresh)
    auth.ts                token storage (memory + localStorage)
    analytics.ts           PostHog wrapper (no-op when unset)
    plans.ts               reads packages/shared/plan_limits.json
    types.ts               API types (mirror of CONTRACT.md)
  components/              nav, footer, pricing table, charts, …
  routes/
    (marketing)/           public pages
    (auth)/                login / signup
    (dashboard)/           authed area (client-side route guard)
```

## Notes

- **Auth guard**: tokens live only in the browser, so `/dashboard/*` is guarded
  client-side in `routes/(dashboard)/layout.tsx` (redirects to `/login`).
- **Adapter**: `@builder.io/qwik-city/adapters/node-server` → `server/entry.node-server.js`.
- **Billing**: `dashboard/billing` has a `TODO(billing)` where the RevenueCat Web
  SDK checkout goes (`app_user_id = account id`, entitlements `pro`/`team`).
- Open source · MIT.
```
