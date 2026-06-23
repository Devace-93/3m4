# Redirect service image. Build context = repo root:
#   docker build -f services/redirect/Dockerfile -t 3m4-redirect .
FROM python:3.12-slim

WORKDIR /app

# System deps kept minimal — psycopg[binary] ships its own libpq.
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Install Python deps first for better layer caching.
COPY services/redirect/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Shared code + the service package. Imports resolve as `dbcore...` and `redirect...`.
COPY dbcore /app/dbcore
COPY packages/shared /app/packages/shared
COPY services/redirect/redirect /app/redirect

EXPOSE 5001

# 4 sync workers is plenty for this tiny IO-bound app on a single VPS.
CMD ["gunicorn", "-b", "0.0.0.0:5001", "-w", "4", "redirect.app:create_app()"]
