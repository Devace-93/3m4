#!/usr/bin/env bash
# Nightly Postgres backup with 14-day local retention.
# Install on the server:  crontab -e  →  10 3 * * * /opt/3m4/deploy/backup.sh
set -euo pipefail

BACKUP_DIR=/var/backups/3m4
mkdir -p "$BACKUP_DIR"

cd "$(dirname "$0")"
docker compose exec -T postgres pg_dump -U shortlink shortlink \
  | gzip > "$BACKUP_DIR/shortlink-$(date +%F).sql.gz"

find "$BACKUP_DIR" -name 'shortlink-*.sql.gz' -mtime +14 -delete
