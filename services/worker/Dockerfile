# Celery worker image. Build context = repo root:
#   docker build -f services/worker/Dockerfile -t 3m4-worker .
#
# The same image runs both roles (compose overrides the command):
#   worker: celery -A worker.app.celery worker
#   beat:   celery -A worker.app.celery beat
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install Python deps first for better layer caching.
COPY services/worker/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Shared code + the service package. Imports resolve as `dbcore...` and `worker...`.
COPY dbcore /app/dbcore
COPY packages/shared /app/packages/shared
COPY services/worker/worker /app/worker

# Default to the worker role; compose runs `beat` with an overridden command.
CMD ["celery", "-A", "worker.app.celery", "worker", "--loglevel=info"]
