#!/usr/bin/env sh
# Run the backend test suite (services/api/tests) against disposable Postgres
# and Redis containers started with `docker run`, using a local virtualenv in
# .venv. Ports and container names are 3m4-specific (55436 / 56436,
# 3m4-test-pg / 3m4-test-redis) so the sibling repos' harnesses can run at the
# same time on this machine.
#   make test            # or: sh deploy/test.sh [pytest args]
# The containers are removed when the script exits, whatever the outcome.
set -eu
cd "$(dirname "$0")/.."

PG=3m4-test-pg
RD=3m4-test-redis
PG_PORT="${TEST_PG_PORT:-55436}"
REDIS_PORT="${TEST_REDIS_PORT:-56436}"

cleanup() { docker rm -f "$PG" "$RD" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
cleanup

docker run -d --rm --name "$PG" -e POSTGRES_USER=shortlink -e POSTGRES_PASSWORD=shortlink -e POSTGRES_DB=shortlink_test \
  -p "$PG_PORT:5432" postgres:16-alpine >/dev/null
docker run -d --rm --name "$RD" -p "$REDIS_PORT:6379" redis:7-alpine >/dev/null

i=0
until docker exec "$PG" pg_isready -U shortlink >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo "postgres did not come up" >&2; exit 1; }; sleep 1
done
i=0
until docker exec "$RD" redis-cli ping 2>/dev/null | grep -q PONG; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo "redis did not come up" >&2; exit 1; }; sleep 1
done

if [ ! -d .venv ]; then
  "${PYTHON:-python3}" -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate
# The api and worker packages are both under test (the billing reconcile is a
# worker task). The worker image pins its own redis/sqlalchemy/... versions;
# here only its extra libraries (celery, user-agents, geoip2) are added on top
# of the api's pins, so the venv resolves once.
pip install -q -r services/api/requirements.txt -r services/api/requirements-dev.txt
grep -E '^(celery|user-agents|geoip2)' services/worker/requirements.txt | xargs pip install -q

export DATABASE_URL="postgresql+psycopg://shortlink:shortlink@localhost:$PG_PORT/shortlink_test"
export TEST_DATABASE_URL="$DATABASE_URL"
export REDIS_URL="redis://localhost:$REDIS_PORT/0"
export CELERY_BROKER_URL="redis://localhost:$REDIS_PORT/1"
export CELERY_RESULT_BACKEND="redis://localhost:$REDIS_PORT/2"
export PYTHONPATH="$PWD:$PWD/services/api:$PWD/services/worker"

python -m pytest services/api/tests "$@"
