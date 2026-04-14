# Hously

A self-hosted command center for homelab enthusiasts. Hously provides a unified dashboard for managing media pipelines, monitoring infrastructure, tracking torrents, and organizing daily life — all from a single web app.

> **Early-stage project.** Breaking changes may occur between releases.

## Features

**Media & Entertainment**

- **Media Library** — Radarr/Sonarr integration with TMDB discovery, release search, and quality profiles
- **Watchlist** — Track what you want to watch with one-click add to Radarr/Sonarr
- **Torrents** — qBittorrent management with real-time activity streaming (SSE)
- **Tracker Stats** — Private tracker statistics (C411, Torr9, La Cale)
- **Jellyfin/Plex** — Latest additions and webhook notifications

**Infrastructure**

- **Dashboard** — Server health (Netdata), disk diagnostics (Scrutiny), torrent activity, upcoming releases
- **Plugins** — Configurable integrations with external services
- **External Notifications** — Inbound webhooks from Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma

**Life Management**

- **Board** — Kanban-style task management with dependencies, time logging, and tags
- **Calendar** — Shared calendar with reminders and iCal export
- **Chores** — Assignment, tracking, and recurring schedules
- **Habits** — Habit tracking with completion history
- **Shopping List** — Collaborative list with real-time updates
- **Collections** — Organize and track personal collections

**Platform**

- Push notifications (Web Push + APNs for iOS)
- i18n support via i18next
- PWA-ready with service worker
- Activity log across all features

## Tech Stack

| Layer          | Technology                                  |
| -------------- | ------------------------------------------- |
| Runtime        | [Bun](https://bun.sh)                       |
| API framework  | [Elysia](https://elysiajs.com)              |
| Database       | PostgreSQL 15 + [Prisma](https://prisma.io) |
| Cache / Queues | Redis + BullMQ                              |
| Object storage | MinIO (S3-compatible)                       |
| Frontend       | React 19 + Vite                             |
| Routing        | TanStack Router                             |
| Data fetching  | TanStack Query                              |
| Styling        | Tailwind CSS 4                              |
| Auth           | JWT (HTTP-only cookies)                     |

## Quick Start (Docker)

The production image runs both the API and the pre-built frontend from a single container.

```bash
# 1. Copy and edit the example compose file
cp docker-compose.prod-example.yml docker-compose.prod.yml

# 2. Create your .env from the example
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY, ALLOWED_EMAILS, ADMIN_EMAILS, DATABASE_URL

# 3. Start everything
docker compose -f docker-compose.prod.yml up -d

# 4. Run database migrations
docker compose -f docker-compose.prod.yml exec hously bunx prisma migrate deploy
```

The app will be available on port `3000` by default.

## Development Setup

**Prerequisites:** [Bun](https://bun.sh) >= 1.3

```bash
# Install dependencies and git hooks
make install

# Copy and configure environment
cp .env.example .env

# Terminal 1 — Start PostgreSQL, MinIO, and Redis
make dev-services

# Terminal 2 — Start the API with hot reload
make dev-api

# Terminal 3 — Start the React frontend
make dev-web
```

The API runs on `http://localhost:3001` and the frontend on `http://localhost:5173` by default.

## Configuration

Copy `.env.example` to `.env`. Required variables:

| Variable         | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `SECRET_KEY`     | JWT signing secret — change from default                  |
| `DATABASE_URL`   | PostgreSQL connection string                              |
| `ALLOWED_EMAILS` | Comma-separated list of emails allowed to register        |
| `ADMIN_EMAILS`   | Comma-separated list of admin emails                      |
| `BASE_URL`       | Public URL of the app (e.g. `https://hously.example.com`) |

Optional integrations:

| Variable                                 | Description                    |
| ---------------------------------------- | ------------------------------ |
| `TMDB_API_KEY`                           | Required for media discovery   |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notifications         |
| `APNS_*`                                 | Apple Push Notifications (iOS) |
| `SMTP_*`                                 | Email delivery                 |

See `.env.example` for the full reference.

## Common Commands

```bash
make install           # Install dependencies
make dev-services      # Start backing services (PostgreSQL, MinIO, Redis)
make dev-api           # Start API with hot reload
make dev-web           # Start frontend with live reload
make build             # Build frontend for production
make test              # Run all tests
make lint              # Lint all code
make typecheck         # Type-check the frontend

# Database
make migrate-dev       # Create a new migration
make migrate-deploy    # Apply pending migrations (production)
make migrate-studio    # Open Prisma Studio
```

## Project Structure

```
hously/
├── apps/
│   ├── api/           # Elysia API (routes, services, workers, jobs)
│   │   └── prisma/    # Database schema and migrations
│   ├── web/           # React frontend (pages, features, components)
│   └── shared/        # Shared types, hooks, endpoints, utilities
├── docs/              # Integration guides
├── docker-compose.yml # Dev backing services
└── Makefile
```

Shared code (types, TanStack Query hooks, API endpoint constants) lives in `apps/shared` and is imported as `@hously/shared` by both apps.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development conventions, branch naming, and PR guidelines.

## License

[MIT](./LICENSE)
