# AGENTS.md

Instructions for **Cursor Agent** (and compatible tools) working in this repository.

## Personality

Act as a rigorous, honest mentor. Do not default to agreement. Identify weaknesses, blind spots, and flawed assumptions. Challenge ideas when needed. Be direct and clear, not harsh. Prioritize helping me improve over being agreeable. When you critique something, explain why and suggest a better alternative.

## Coding rules

Detailed conventions live in **`.cursor/rules/`** as `.mdc` files (imports, DRY/shared code, naming, feature structure, TanStack Query). They apply by glob when relevant files are in context.

**Claude Code** users: the same conventions are mirrored under `.claude/rules/` for `CLAUDE.md`.

## Project overview

Hously is a self-hosted command center for homelab enthusiasts. It provides a unified dashboard for monitoring infrastructure, managing media pipelines, and organizing daily life.

This monorepo contains:

- **API** (`apps/api`): Elysia (Bun runtime) + Prisma ORM
- **Web** (`apps/web`): React 19 + Vite + TanStack Router/Query + Tailwind CSS 4
- **Shared** (`apps/shared`): Types, hooks, utilities, endpoints shared across apps

In production, the frontend is built into `apps/api/public/` and served by the API via `@elysiajs/static` (enabled with `SERVE_STATIC=true`). A single `Dockerfile` builds both.

A native companion app lives in a separate repository:

- **iOS App** (`../hously-ios`): Swift/SwiftUI

## Development setup

**Bun** is the package manager and runtime. Use the **Makefile** for common operations:

```bash
make install           # Install all dependencies

# Local development (recommended)
make dev-services      # Start PostgreSQL + MinIO + Redis (Terminal 1)
make dev-api           # Start Bun API with hot reload (Terminal 2)
make dev-web           # Start React frontend with Vite (Terminal 3)

# Docker development (production-like)
docker compose up      # Start everything in containers
```

### Environment configuration

Copy `.env.example` to `.env` and configure at minimum:

- `ALLOWED_EMAILS` / `ADMIN_EMAILS`: Comma-separated email lists
- `SECRET_KEY`: Change from default for security
- `DATABASE_URL`: Connection string (adjust hostname based on Docker/local)

## Architecture

### Backend (`apps/api`)

**Stack**: Elysia, Prisma, PostgreSQL, Redis, MinIO

| Directory              | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `src/routes/`          | Feature-specific Elysia route plugins                |
| `src/services/`        | Business logic (S3, images, notifications, webhooks) |
| `src/jobs/`            | Cron jobs (`@elysiajs/cron`)                         |
| `src/middleware/`      | Rate limiting, etc.                                  |
| `src/db/`              | Prisma client                                        |
| `src/auth.ts`          | JWT auth with HTTP-only cookies                      |
| `prisma/schema.prisma` | Database schema                                      |

Route modules export Elysia plugins composed in `src/index.ts`. Webhook handlers integrate Radarr, Sonarr, Jellyfin, Plex, and others. Push notifications support Web Push (VAPID) and APNs.

### Frontend (`apps/web`)

**Stack**: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS 4

| Directory         | Purpose                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `src/features/`   | Feature-based modules (auth, chores, shopping, calendar, dashboard, torrents, medias, etc.) |
| `src/components/` | Shared components (+ `ui/` for Radix/CVA primitives)                                        |
| `src/routes/`     | File-based routing (TanStack Router)                                                        |
| `src/hooks/<domain>/` | App-specific hooks grouped by domain (e.g. `chores`, `dashboard`, `app`, `realtime`) |
| `src/lib/`        | API client, query client, utilities                                                         |
| `src/locales/`    | i18next translations                                                                        |
| `src/sw/`         | Service Worker (PWA)                                                                        |

### Shared (`apps/shared`)

| Directory          | Purpose                                                    |
| ------------------ | ---------------------------------------------------------- |
| `src/types/`       | TypeScript interfaces (shared between API and Web)         |
| `src/endpoints/`   | API endpoint constants (`CHORES_ENDPOINTS`, etc.)          |
| `src/hooks/`       | TanStack Query hooks (`useChores`, `useCreateChore`, etc.) |
| `src/utils/`       | Shared utilities (date, sanitize, media URLs, etc.)        |
| `src/queryKeys.ts` | Centralized query key factory                              |
| `src/api.ts`       | API client factories                                       |

## Common commands

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

### iOS app (external)

Maintained in `../hously-ios`. Connects to this API with native push notifications via APNs.

## Key features

### Homelab integrations

- **Dashboard** — Server health (Netdata), disk diagnostics (Scrutiny), torrent activity, media releases
- **Torrent Management** — qBittorrent integration with real-time SSE streaming
- **Media Pipeline** — Radarr/Sonarr + TMDB discovery + interactive release search
- **Tracker Statistics** — Private tracker stats (C411, Torr9, La Cale)
- **Jellyfin/Plex** — Latest media additions + webhook notifications
- **External Notifications** — Webhooks for Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma

### Life management

- **Shopping List** — Collaborative with real-time updates
- **Chores** — Assignment, tracking, recurring schedules
- **Calendar** — Shared calendar with reminders and iCal export
- **Meal Plans** — Weekly planning with recipe management

## Important notes

- **Unstable project**: Early-stage, subject to breaking changes
- **Access control**: Users must be on `ALLOWED_EMAILS` to register; admins need `ADMIN_EMAILS`
- **Image storage**: MinIO (S3-compatible) for avatars, chores, recipes
- **Push notifications**: Web Push (VAPID) + APNs (iOS)
- **Rate limiting**: 1000 requests/hour per IP

## Documentation and APIs

When answering questions about library APIs, configuration, or migrations, prefer **up-to-date docs** (e.g. Context7 MCP or official docs) over guessing from memory.
