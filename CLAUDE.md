# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Rules

Detailed coding conventions live in `.claude/rules/` and are loaded automatically based on file globs:

- **`imports.md`** — Import path aliases (`@/` for web, relative for API, `@hously/shared` for cross-app)
- **`dry-and-shared-code.md`** — Shared code organization and DRY principles
- **`naming-conventions.md`** — File, code, and API response naming (PascalCase, camelCase, snake_case)
- **`feature-structure.md`** — Frontend feature folders and API route plugin patterns
- **`tanstack-query.md`** — Query/mutation hooks, query key factory, cross-feature invalidation

## Project Overview

Hously is a self-hosted command center for homelab enthusiasts. It provides a unified dashboard for monitoring infrastructure, managing media pipelines, and organizing daily life.

This monorepo contains:
- **API** (`apps/api`): Elysia (Bun runtime) + Prisma ORM
- **Web** (`apps/web`): React 19 + Vite + TanStack Router/Query + Tailwind CSS 4
- **Shared** (`apps/shared`): Types, hooks, utilities, endpoints shared across apps

In production, the frontend is built into `apps/api/public/` and served by the API via `@elysiajs/static` (enabled with `SERVE_STATIC=true`). A single `Dockerfile` builds both.

A native companion app lives in a separate repository:
- **iOS App** (`../hously-ios`): Swift/SwiftUI

## Development Setup

**Bun** is the package manager and runtime. Use the Makefile for all common operations:

```bash
make install           # Install all dependencies

# Local development (recommended)
make dev-services      # Start PostgreSQL + MinIO + Redis (Terminal 1)
make dev-api           # Start Bun API with hot reload (Terminal 2)
make dev-web           # Start React frontend with Vite (Terminal 3)

# Docker development (production-like)
docker compose up      # Start everything in containers
```

### Environment Configuration

Copy `.env.example` to `.env` and configure at minimum:
- `ALLOWED_EMAILS` / `ADMIN_EMAILS`: Comma-separated email lists
- `SECRET_KEY`: Change from default for security
- `DATABASE_URL`: Connection string (adjust hostname based on Docker/local)

## Architecture

### Backend (`apps/api`)

**Stack**: Elysia, Prisma, PostgreSQL, Redis, MinIO

| Directory | Purpose |
|-----------|---------|
| `src/routes/` | Feature-specific Elysia route plugins |
| `src/services/` | Business logic (S3, images, notifications, webhooks) |
| `src/jobs/` | Cron jobs (`@elysiajs/cron`) |
| `src/middleware/` | Rate limiting, etc. |
| `src/db/` | Prisma client |
| `src/auth.ts` | JWT auth with HTTP-only cookies |
| `prisma/schema.prisma` | Database schema |

Route modules export Elysia plugins composed in `src/index.ts`. Webhook handlers integrate Radarr, Sonarr, Jellyfin, Plex, and others. Push notifications support Web Push (VAPID) and APNs.

### Frontend (`apps/web`)

**Stack**: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS 4

| Directory | Purpose |
|-----------|---------|
| `src/features/` | Feature-based modules (auth, chores, shopping, calendar, dashboard, torrents, medias, etc.) |
| `src/components/` | Shared components (+ `ui/` for Radix/CVA primitives) |
| `src/routes/` | File-based routing (TanStack Router) |
| `src/hooks/` | App-specific React hooks |
| `src/lib/` | API client, query client, utilities |
| `src/locales/` | i18next translations |
| `src/sw/` | Service Worker (PWA) |

### Shared (`apps/shared`)

| Directory | Purpose |
|-----------|---------|
| `src/types/` | TypeScript interfaces (shared between API and Web) |
| `src/endpoints/` | API endpoint constants (`CHORES_ENDPOINTS`, etc.) |
| `src/hooks/` | TanStack Query hooks (`useChores`, `useCreateChore`, etc.) |
| `src/utils/` | Shared utilities (date, sanitize, media URLs, etc.) |
| `src/queryKeys.ts` | Centralized query key factory |
| `src/api.ts` | API client factories |

## Common Commands

```bash
# Testing
make test                          # Run all tests
cd apps/web && bun run test        # Web tests only
cd apps/api && bun test            # API tests only

# Linting & Types
make lint                          # Lint all code
make typecheck                     # Type check frontend

# Database (ALWAYS use Makefile)
make migrate-dev                   # Create new migration
make migrate-deploy                # Apply pending migrations (prod)
make migrate-push                  # Push schema changes (dev only)
make migrate-studio                # Open Prisma Studio

# Build & Docker
make build                         # Build web app for production
docker build -t hously:latest .    # Build unified image (API + frontend)
docker compose up -d               # Start all services
docker compose down                # Stop all services
make rebuild                       # Rebuild containers
```

Edit `apps/api/prisma/schema.prisma` for schema changes, then run the appropriate `make migrate-*` from root.

### iOS App (External)

Maintained in `../hously-ios`. Connects to this API with native push notifications via APNs.

## Key Features

### Homelab Integrations
- **Dashboard** — Server health (Netdata), disk diagnostics (Scrutiny), torrent activity, media releases
- **Torrent Management** — qBittorrent integration with real-time SSE streaming
- **Media Pipeline** — Radarr/Sonarr + TMDB discovery + interactive release search
- **Tracker Statistics** — Private tracker stats (C411, Torr9, La Cale)
- **Jellyfin/Plex** — Latest media additions + webhook notifications
- **External Notifications** — Webhooks for Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma

### Life Management
- **Shopping List** — Collaborative with real-time updates
- **Chores** — Assignment, tracking, recurring schedules
- **Calendar** — Shared calendar with reminders and iCal export
- **Meal Plans** — Weekly planning with recipe management

## Important Notes

- **Unstable Project**: Early-stage, subject to breaking changes
- **Access Control**: Users must be on `ALLOWED_EMAILS` to register; admins need `ADMIN_EMAILS`
- **Image Storage**: MinIO (S3-compatible) for avatars, chores, recipes
- **Push Notifications**: Web Push (VAPID) + APNs (iOS)
- **Rate Limiting**: 1000 requests/hour per IP
