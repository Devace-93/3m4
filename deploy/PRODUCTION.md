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
   RevenueCat (`REVENUECAT_WEBHOOK_AUTH_TOKEN`, `REVENUECAT_SECRET_API_KEY`,
   production `VITE_REVENUECAT_PUBLIC_KEY` — exists only after the live Stripe
   account is connected in Web Billing), fresh DB password.
3. **GeoIP**: download MaxMind GeoLite2-City.mmdb into `deploy/geoip/`.
4. **Start**
   ```sh
   cd /opt/3m4/deploy
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
5. **DNS (Bluehost)**: A records `3m4.net` and `app.3m4.net` → server IP.
   Caddy issues TLS automatically once DNS resolves. The RevenueCat webhook
   (`https://3m4.net/api/billing/webhook`) starts delivering immediately after.
6. **Backups**: `crontab -e` → `10 3 * * * /opt/3m4/deploy/backup.sh`
7. **Deploy-on-push**: in the GitHub repo set secrets `DEPLOY_HOST` (server IP)
   and `DEPLOY_SSH_KEY` (private key), and repo variable `DEPLOY_ENABLED=true`.
   After that every push to master redeploys via `.github/workflows/deploy.yml`.

## Static side apps (info / bubbles / kinegram)

Rsync each build to `/srv/static/<app>` on the server, uncomment its block in
`Caddyfile.prod` and the `/srv/static` mount in `docker-compose.prod.yml`,
add the subdomain A record, then `docker compose ... up -d caddy`.

## Scaling

resize CX22→CX32 (console, ~1 min) → move Postgres to its own box / managed PG
(`DATABASE_URL`) → second app node behind a Hetzner LB (redirect is stateless).
