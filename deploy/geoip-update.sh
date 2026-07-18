#!/usr/bin/env bash
# Download/refresh GeoLite2-City.mmdb and restart the worker to pick it up.
# Requires /root/.maxmind_key containing ACCOUNT_ID:LICENSE_KEY.
# Cron (weekly; MaxMind updates twice a week):  0 4 * * 3 /opt/3m4/deploy/geoip-update.sh
set -euo pipefail

cd "$(dirname "$0")/geoip"
curl -sSfL -u "$(cat /root/.maxmind_key)" -o /tmp/GeoLite2-City.tar.gz \
  "https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz"
tar -xzf /tmp/GeoLite2-City.tar.gz --strip-components=1 --wildcards "*/GeoLite2-City.mmdb"
rm -f /tmp/GeoLite2-City.tar.gz

cd .. && docker compose restart worker >/dev/null 2>&1 || true
