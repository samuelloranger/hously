# CLAUDE.md

This file provides guidance to **Claude Code** (claude.ai/code) when working in this repository.

**Cursor Agent:** Use [`AGENTS.md`](./AGENTS.md) at the repo root and [`.cursor/rules/*.mdc`](./.cursor/rules/) for the same project context and conventions. Custom slash-style workflows live in [`.cursor/commands/`](./.cursor/commands/).

## Personality

Act as a rigorous, honest mentor. Do not default to agreement. Identify weaknesses, blind spots, and flawed assumptions. Challenge ideas when needed. Be direct and clear, not harsh. Prioritize helping me improve over being agreeable. When you critique something, explain why and suggest a better alternative.

## Coding Rules

Detailed coding conventions live in `.claude/rules/` (Claude Code) and are mirrored as `.mdc` files in `.cursor/rules/` (Cursor). Topics:

- **Imports** — `@/` for web, `@hously/api/*` for internal API code, `@hously/shared` for cross-app primitives
- **DRY / shared code** — What belongs in `apps/shared` vs `apps/web`
- **Naming** — Files, snake_case responses, URL paths
- **Feature structure** — Web features and Elysia route folders
- **TanStack Query** — Hooks placement + `@/lib/queryKeys`

## Project Overview

Hously is a self-hosted command center for homelab enthusiasts.

- **API** (`apps/api`): Elysia + Prisma
- **Web** (`apps/web`): React 19 + TanStack Router/Query
- **Shared** (`apps/shared`): Types, utilities, constants used by API and web

Frontend is served from `apps/api/public/` when `SERVE_STATIC=true`.

## Development Setup

```bash
make install           # Root `bun install` — all workspaces
make dev-services      # docker-compose.yml: PostgreSQL + Redis
make dev-api
make dev-web

# Full stack Docker (production-like):
# Copy docker-compose.prod-example.yml → docker-compose.prod.yml, then:
docker compose -f docker-compose.prod.yml up -d
```

## Architecture

### Backend (`apps/api`)

| Directory              | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `src/routes/`          | Plugins, often `routes/<name>/index.ts` (+ `integrations/` etc.) |
| `src/services/`        | Business logic                                                   |
| `src/jobs/`            | Cron (`@elysiajs/cron`)                                          |
| `src/db/`              | Prisma                                                           |
| `src/auth.ts`          | Routes wiring (`lib/auth.ts` — Better Auth)                      |
| `prisma/schema.prisma` | Schema                                                           |

Internal imports use `@hously/api/...`.

### Frontend (`apps/web`)

| Directory         | Purpose                           |
| ----------------- | --------------------------------- |
| `src/features/`   | Feature UI                        |
| `src/components/` | Shared + `ui/` primitives         |
| `src/routes/`     | TanStack Router                   |
| `src/lib/`        | Clients, **`queryKeys`**, helpers |

### Shared (`apps/shared`)

`types/`, `utils/`, `constants/` — no React hooks or SPA-only caches here today.

---

## Global Settings (AppSettings)

Singleton row (id=1): `country_code`, `calendar_subdivision_code`, `upcoming_window_months`, `upcoming_languages`, `dashboard_widget_visibility`. API: `/api/settings`. Worker/dashboard/UI integration — see AGENTS.md.

---

## Common Commands

```bash
make test                          # Equivalent to root `bun run test`
cd apps/web && bun run test        # Web tests only
cd apps/api && bun test            # API tests only

make lint                          # Web ESLint — matches CI (`bun run --filter @hously/web lint`)
make typecheck                     # Every workspace with a `typecheck` script

make migrate-dev                   # Makefile wraps Prisma
make build

docker compose -f docker-compose.prod.yml up -d    # Requires your prod compose file
docker compose down
```

## Key Features

### Homelab

- Dashboard, qBittorrent/SSE, TMDB, trackers, Jellyfin/Plex, webhooks.
- **Hously replaces Radarr/Sonarr** — movies and TV in one built-in library, not a sidecar integration. Media search, quality profiles, and grab workflows live in Hously. **Settings → Library import** provides a one-time Radarr/Sonarr importer for users switching from an existing \*arr stack.

### Life

- Chores, calendar, habits, board.

## Important Notes

- **Unstable** — expect breakage.
- **`ALLOWED_EMAILS` / `ADMIN_EMAILS`**
- **Images** — `IMAGE_STORAGE_DIR`
- **Push** — Web Push (VAPID)
- **Rate limit** — 1000 requests/hour per IP
