.PHONY: help install build typecheck dev dev-api dev-services dev-web down rebuild test lint clean migrate-dev migrate-deploy migrate-push migrate-studio db-refresh-collation bump-version

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies (Bun)
	@echo "Installing web dependencies..."
	cd apps/web && bun install
	@echo "Installing API dependencies..."
	cd apps/api && bun install
	@echo "Setting up git hooks..."
	bunx husky
	@echo "✓ Dependencies installed!"
	@echo "  Start services: make dev-services"
	@echo "  Start API:      make dev-api"
	@echo "  Start frontend: make dev-web"

build: ## Build frontend for production
	cd apps/web && bun run build

typecheck: ## Typecheck frontend
	bun run typecheck

dev-services: ## Start only database, MinIO, and Redis services
	docker compose up db minio minio-init redis -d

dev-api: ## Start TypeScript/Bun API locally with hot reload
	cd apps/api && bun run dev

dev-web: ## Start React frontend with live reload
	cd apps/web && bun run dev

dev: ## Show development setup instructions
	@echo "Development Setup Options:"
	@echo ""
	@echo "Option 1: Docker (Recommended for production)"
	@echo "  docker compose up  # Start everything in Docker"
	@echo ""
	@echo "Option 2: Local development (Faster iteration)"
	@echo "  Run these commands in separate terminals:"
	@echo "  1. make dev-services  # Start PostgreSQL + MinIO"
	@echo "  2. make dev-api       # Start TypeScript/Bun API"
	@echo "  3. make dev-web       # Start React frontend"

down: ## Stop Docker containers
	docker compose down

rebuild: ## Rebuild Docker containers (fixes dependency issues)
	@echo "Rebuilding Docker containers..."
	docker compose build --no-cache
	@echo "✓ Containers rebuilt. Start with: make dev-api"

test: ## Run all tests
	@echo "Running web tests..."
	cd apps/web && bun run test
	@echo "Running API tests..."
	cd apps/api && bun test

lint: ## Lint all code
	@echo "Linting frontend..."
	cd apps/web && bun run lint || echo "No linter configured"
	@echo "Linting API..."
	cd apps/api && bun run lint || echo "No linter configured"

clean: ## Clean all build artifacts and caches
	@echo "Cleaning build artifacts..."
	rm -rf apps/web/dist
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	docker compose down -v

bump-version: ## Bump the patch version in all package.json files
	@./scripts/bump-version.sh

# ===== Database Migrations (Prisma) =====

migrate-dev: ## Create a new migration during development
	@echo "Creating migration..."
	cd apps/api && bun run db:migrate:dev

migrate-deploy: ## Apply pending migrations (production)
	@echo "Applying migrations..."
	cd apps/api && bun run db:migrate

migrate-push: ## Push schema changes to database (development only, bypasses migrations)
	@echo "Pushing schema changes..."
	cd apps/api && bun run db:push

migrate-studio: ## Open Prisma Studio for database exploration
	@echo "Opening Prisma Studio..."
	cd apps/api && bun run db:studio

db-refresh-collation: ## Refresh PostgreSQL collation version for template1 and app DB (use DB_NAME/DB_USER overrides)
	@DB_NAME=$${DB_NAME:-hously}; \
	DB_USER=$${DB_USER:-hously}; \
	echo "Refreshing template1 collation version..."; \
	docker compose exec -T db psql -U $$DB_USER -d postgres -c "ALTER DATABASE template1 REFRESH COLLATION VERSION;"; \
	echo "Refreshing database collation version for database: $$DB_NAME..."; \
	docker compose exec -T db psql -U $$DB_USER -d postgres -c "ALTER DATABASE $$DB_NAME REFRESH COLLATION VERSION;"
	@echo "✓ Collation versions refreshed successfully"
