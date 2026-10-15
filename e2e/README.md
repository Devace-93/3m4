# 3m4 end-to-end tests

Playwright suite that exercises the whole stack through Caddy: web app, REST
API, redirect service, worker (click processing) and the remote MCP endpoint.
It runs against an **already-running** stack; it does not start one.

## Run locally

```bash
make up                      # from the repo root, once
cd e2e
bun install
bunx playwright install chromium     # add --with-deps on a fresh machine
bun run test                 # whole suite, headless
bun run test:critical        # only tests tagged @critical
bun run test:ui              # Playwright UI mode
bun run report               # open the last HTML report
```

Or `make e2e` from the repo root.

| Variable       | Default                 | Meaning |
|----------------|-------------------------|---------|
| `E2E_BASE_URL` | `http://localhost:8080` | Caddy entrypoint. API at `/api`, MCP at `/mcp`, short links at `/<code>`. |

The suite expects the local flag set (`GET /api/flags`): `early-access=on`,
`projects=off`, `signups=on`, `public-api=on`, `analytics-dashboard=on`,
`site-building=off`, and `SHORT_URL_SCHEME=http`.

Every spec file registers its own account (`e2e+<ts>@example.com`) through
`POST /api/auth/register`, so runs are independent of existing data and of each
other. Dashboard tests seed the browser session with API tokens
(`localStorage` keys `3m4_access_token` / `3m4_refresh_token`); the auth spec
goes through the real sign-up / login / logout UI.

## What is covered

| File | Covers |
|------|--------|
| `tests/marketing.spec.ts` | Home hero, MCP section, early-access note; nav without Pricing/Projects; blog index + post; `/projects` coming-soon; `/info/pricing` early-access notice. |
| `tests/auth.spec.ts` | `@critical` sign-up via UI → dashboard; marketing nav shows Dashboard/Log out across pages (`data-auth-state`); logout; dashboard guard; login again. Wrong-password error. |
| `tests/links.spec.ts` | `@critical` create link in dashboard → appears in table → short URL 302s to destination → detail page QR loads from `/api/qr/<code>.png` → worker counts the click (`click_count`, analytics summary, UI tile). Unknown code 404. |
| `tests/apikeys.spec.ts` | `@critical` create viewer + admin keys in settings; viewer `POST /links` → 403 `insufficient_scope`; admin → 201; audit log has `auth.denied` + `link.create`; `/apikeys/me` roles + scopes. Revoked key → 401. |
| `tests/mcp.spec.ts` | `@critical` `POST /mcp` 401 without/with bogus key; viewer tool list excludes `create_link`/`delete_link`; admin lists all 9 tools; `tools/call create_link` returns `structuredContent.short_code`; viewer `create_link` refused. SSE and JSON bodies both parsed. |
| `tests/early-access.spec.ts` | `/api/flags`; `/auth/me` limits are `-1`; dashboard banner "Early access." and no "Upgrade plan" / Billing nav. |

`helpers.ts` holds the account/API-key factories, session seeding, polling and
the minimal Streamable-HTTP (SSE) MCP client.

## CI

`.github/workflows/e2e.yml` builds the stack with docker compose on every pull
request (and on demand), waits for `/api/healthz`, runs the suite and uploads
`playwright-report/` on failure. It is not a required check.

## Known app bugs

Tests that expose a real app bug are kept and marked `test.fixme(...)` with a
one-line reason, so they show up as skipped rather than silently passing.
