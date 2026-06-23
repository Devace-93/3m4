# 3m4 web (Qwik City SSR on Bun).
#
# Build context is the REPO ROOT (`/home/enrique/3m4`), because the app imports
# the shared plan-limits JSON from packages/shared.
#
#   docker build -f apps/web/Dockerfile -t 3m4-web .
#
# In deploy/docker-compose.yml this is:
#   web: { build: { context: .., dockerfile: apps/web/Dockerfile } }

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /repo

# Shared package (single source of truth for plan limits) is imported by the app.
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

WORKDIR /repo/apps/web
RUN bun install --frozen-lockfile || bun install
# Build-time VITE_* vars can be injected here for hosted builds, e.g.:
#   ARG VITE_API_URL; ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
FROM oven/bun:1-slim AS runtime
WORKDIR /repo/apps/web

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# Built SSR server + client assets + deps.
COPY --from=build /repo/apps/web/server ./server
COPY --from=build /repo/apps/web/dist ./dist
COPY --from=build /repo/apps/web/node_modules ./node_modules
COPY --from=build /repo/apps/web/package.json ./package.json

EXPOSE 3000

# Start the standalone Node-API HTTP server with Bun (node:http compatible).
CMD ["bun", "./server/entry.node-server.js"]
