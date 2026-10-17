# 3m4 — developer convenience wrapper around docker compose.
# All compose files live in ./deploy.

# --env-file makes the repo-root .env drive build-arg interpolation (VITE_* are
# inlined into the web bundle at build time), not just runtime container env.
COMPOSE      := docker compose --env-file .env -f deploy/docker-compose.yml
COMPOSE_SH   := docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.selfhost.yml

.PHONY: help up up-selfhost down build rebuild logs ps seed migrate shell-api shell-db clean e2e

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Build + start the full stack (hosted edition)
	@docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null
	$(COMPOSE) up -d --build

up-selfhost: ## Start without billing (BILLING_ENABLED=false)
	$(COMPOSE_SH) up -d --build

down: ## Stop the stack
	$(COMPOSE) down

build: ## Rebuild all images
	$(COMPOSE) build

rebuild: ## Rebuild from scratch (no cache)
	$(COMPOSE) build --no-cache

logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=100

ps: ## Show service status
	$(COMPOSE) ps

seed: ## Re-seed reserved slugs
	$(COMPOSE) run --rm migrate python -m dbcore.cli seed

migrate: ## Run create-all + seed
	$(COMPOSE) run --rm migrate python -m dbcore.cli upgrade-and-seed

shell-api: ## Shell into the api container
	$(COMPOSE) exec api sh

shell-db: ## psql into Postgres
	$(COMPOSE) exec postgres psql -U shortlink -d shortlink

clean: ## Stop and remove volumes (DESTRUCTIVE: wipes the database)
	$(COMPOSE) down -v

e2e: ## Run the Playwright end-to-end suite against the running stack (E2E_BASE_URL)
	cd e2e && bun install && bunx playwright install chromium && bun run test
