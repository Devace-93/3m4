# Production runbook (Hetzner)

One CX22 (2 vCPU / 4 GB, Ubuntu 24.04) runs the whole stack via docker compose.

**Already deployed before the accounts migration?** Append these to `.env` and rebuild
(the public accounts URL is baked into the web bundle at build time):

```
ACCOUNTS_URL=https://accounts.3m4.net
ACCOUNTS_INTERNAL_URL=http://accounts-api-1:5000
VITE_ACCOUNTS_URL=https://accounts.3m4.net
PROTOCOL_HEADER=x-forwarded-proto
```
then `docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build web api`
from `deploy/`. Without `ACCOUNTS_URL` the API rejects every session (issuer mismatch);
without `PROTOCOL_HEADER` the login redirect carries an `http://` return address that
accounts refuses, so users land on their profile instead of the dashboard.

## First-time setup

1. **Create server** at console.hetzner.cloud: CX22, Ubuntu 24.04, your SSH key,
   paste `cloud-init.yaml` into the "Cloud config" field. Enable auto-backups.
2. **Clone + configure**
   ```sh
   ssh root@<ip>
   git clone git@github.com:Devace-93/3m4.git /opt/3m4   # add a deploy key first
   cd /opt/3m4 && cp .env.example .env && $EDITOR .env
   ```
   Prod `.env` checklist: `DASHBOARD_URL=https://app.3m4.net`, PostHog keys
   (`POSTHOG_API_KEY`, `POSTHOG_PERSONAL_API_KEY`, `VITE_POSTHOG_KEY`),
   the payments portal set (see **Billing** below), fresh DB password.
3. **GeoIP**: download MaxMind GeoLite2-City.mmdb into `deploy/geoip/`.
4. **Start**
   ```sh
   cd /opt/3m4/deploy
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
5. **DNS (Bluehost)**: A records `3m4.net` and `app.3m4.net` → server IP.
   Caddy issues TLS automatically once DNS resolves. (The payments webhook is
   delivered over the internal `edge` network, not through Caddy.)
6. **Backups**: `crontab -e` → `10 3 * * * /opt/3m4/deploy/backup.sh`
7. **Deploy-on-push**: in the GitHub repo set secrets `DEPLOY_HOST` (server IP)
   and `DEPLOY_SSH_KEY` (private key), and repo variable `DEPLOY_ENABLED=true`.
   After that every push to master redeploys via `.github/workflows/deploy.yml`.

## Billing (payments.3m4.net)

3m4 never calls Stripe. The portal at `/opt/payments` owns checkout, the
Customer Portal, receipts and donations; 3m4 only sends users there,
receives its signed push webhooks and pulls entitlements with a service key.
Both stacks talk over the shared `edge` network by container name
(`payments-api-1`, `3m4-api-1`), so nothing is exposed publicly.

1. **App key on the payments box** (once; prints the two secrets a single
   time — rotate by running it again):
   ```sh
   cd /opt/payments && make app-key SLUG=3m4 WEBHOOK_URL=http://3m4-api-1:5000/api/billing/webhook
   ```
2. **3m4 `.env`**:
   ```
   BILLING_ENABLED=true
   PAYMENTS_URL=https://payments.3m4.net
   PAYMENTS_INTERNAL_URL=http://payments-api-1:5000
   PAYMENTS_SERVICE_KEY=m4pay_sk_…          # from step 1
   PAYMENTS_WEBHOOK_SECRET=whsec_m4pay_…    # from step 1
   VITE_PAYMENTS_URL=https://payments.3m4.net
   VITE_BILLING_ENABLED=true
   ```
   then rebuild `api`, `worker`, `beat` and `web` (the public URL is baked into
   the web bundle): `docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build api worker beat web`.
   `api`, `worker` and `web` join `edge` in the base compose; `beat` schedules
   the daily `reconcile_billing` task that the worker runs.
3. **Catalog**: the products live in payments' `packages/shared/catalog.json`
   (app `3m4`: `pro_monthly`, `pro_annual`, entitlement `pro`, lookup keys
   `3m4_pro_monthly` / `3m4_pro_annual`) and in 3m4's
   `packages/shared/plan_limits.json` → `price_keys`. Keep both in sync;
   `team` has no product yet, so its Upgrade button is disabled.
4. **Verify** (same commands locally with `http://localhost:8080` and the
   `.env` secrets; `early-access` must be OFF for the billing page to show,
   the webhook works regardless):
   ```sh
   # push: a signed subscription.updated for an identity that has signed in to 3m4
   SECRET=$(grep ^PAYMENTS_WEBHOOK_SECRET .env | cut -d= -f2-)
   IDENTITY=<accounts sub of a user who has opened the dashboard>
   BODY='{"id":"'$(uuidgen)'","type":"subscription.updated","created":"2026-11-01T00:00:00Z","app":"3m4","identity_id":"'$IDENTITY'","email":"x@example.com","data":{"entitlements":["pro"],"subscription":{"id":"sub_test","entitlement":"pro","status":"active","current_period_end":"2027-01-01T00:00:00Z","cancel_at_period_end":false,"label":"Pro"},"payment":null,"updated_at":"2026-11-01T00:00:00Z"}}'
   TS=$(date +%s); SIG=v1=$(printf '%s.%s' "$TS" "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
   curl -s -X POST https://3m4.net/api/billing/webhook -H "Content-Type: application/json" \
     -H "X-M4Pay-Timestamp: $TS" -H "X-M4Pay-Signature: $SIG" -d "$BODY"      # → {"plan":"pro","status":"ok"}
   docker exec 3m4-postgres-1 psql -U shortlink -d shortlink -c "select plan from accounts"   # → pro
   # pull: one reconcile run (lists the app's subscriptions changed in the last 2 days)
   make reconcile-billing                                                               # → reconciled: {'applied': n, ...}
   ```
   The same signed POST with `"entitlements":[],"subscription":null` sets the
   plan back to `free`. Real purchases: `early-access` OFF → `/dashboard/billing`
   → Upgrade opens `https://payments.3m4.net/subscribe?app=3m4&price=pro_monthly`.

## Static side apps (info / bubbles / kinegram)

Rsync each build to `/srv/static/<app>` on the server, uncomment its block in
`Caddyfile.prod` and the `/srv/static` mount in `docker-compose.prod.yml`,
add the subdomain A record, then `docker compose ... up -d caddy`.

## Scaling

resize CX22→CX32 (console, ~1 min) → move Postgres to its own box / managed PG
(`DATABASE_URL`) → second app node behind a Hetzner LB (redirect is stateless).
