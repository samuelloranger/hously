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
- **Jellyfin Watchlist Sync** — Two-way sync between the Hously watchlist and a Jellyfin "What's Next" collection (via the companion plugin)
- **Collections** — Manage and complete your media collections

**Infrastructure**

- **Dashboard** — Server health (Netdata), disk diagnostics (Scrutiny), torrent activity, upcoming releases
- **Plugins** — Configurable integrations with external services
- **External Notifications** — Inbound webhooks from Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma

**Life Management**

- **Board** — Kanban-style task management with dependencies, time logging, and tags
- **Calendar** — Shared calendar with reminders and iCal export
- **Chores** — Assignment, tracking, and recurring schedules
- **Habits** — Habit tracking with completion history

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
| Image storage  | Local filesystem (`IMAGE_STORAGE_DIR`)      |
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

# Terminal 1 — Start PostgreSQL and Redis
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
| `SMTP_*`                                 | Email delivery                 |

See `.env.example` for the full reference.

## Common Commands

```bash
make install           # Install dependencies
make dev-services      # Start backing services (PostgreSQL, Redis)
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
│   ├── api/              # Elysia API (routes, services, workers, jobs)
│   │   └── prisma/       # Database schema and migrations
│   ├── web/              # React frontend (pages, features, components)
│   ├── shared/           # Shared types, hooks, endpoints, utilities
│   └── jellyfin-plugin/  # C# Jellyfin server plugin (watchlist sync)
├── docs/              # Integration guides
├── docker-compose.yml # Dev backing services
└── Makefile
```

Shared code (types, TanStack Query hooks, API endpoint constants) lives in `apps/shared` and is imported as `@hously/shared` by both apps.

## Jellyfin Watchlist Sync Plugin

The `apps/jellyfin-plugin/` directory contains a C# Jellyfin server plugin that keeps your Hously watchlist and Jellyfin library in sync.

### What it does

- **Hously → Jellyfin:** Items you add to the Hously watchlist that are available in your Jellyfin library appear in a per-user **"What's Next"** collection, updated in near-real-time via webhook and refreshed on a configurable timer (default: every 15 minutes).
- **Jellyfin → Hously:** When you mark an item as played in Jellyfin, it is automatically removed from your Hously watchlist.

### Installing the plugin

1. Go to **Dashboard → Plugins → Repositories** in your Jellyfin admin panel.
2. Add a new repository and point it at the `manifest.json` URL from the latest GitHub release (available under **Releases** → `manifest.json`).
3. Go to **Dashboard → Plugins → Catalog**, find **Hously Watchlist Sync**, and install it.
4. Restart Jellyfin.

Alternatively, download `Jellyfin.Plugin.HouslyWatchlist_v{version}.zip` from a GitHub release, extract the `.dll`, place it in your Jellyfin `plugins/` directory, and restart.

### Configuring the plugin

1. In Jellyfin, go to **Dashboard → Plugins → Hously Watchlist Sync**.
2. Set **Hously Base URL** — the URL of your Hously instance (e.g. `https://hously.example.com`).
3. Set **Admin Token** — the sync token generated in Hously (see below).
4. Set **Sync Interval** — how often (in minutes) to run a full watchlist sync (default: 15).
5. Add **User Mappings** — one row per user, mapping a Jellyfin User ID to the corresponding Hously user ID.
6. Click **Save**, then **Sync Now** to trigger an immediate sync.

#### Generating the sync token in Hously

1. Open Hously → **Settings → Integrations → Jellyfin**.
2. Scroll to the **Watchlist Sync** section.
3. Click **Regenerate** to generate a new token — copy it immediately (it is only shown once).
4. Paste the token into the **Admin Token** field in the Jellyfin plugin config.

#### Finding Jellyfin User IDs

Jellyfin User IDs are GUIDs (e.g. `3d4b2c1a-8e6f-4a9b-b2e7-1c5d9f3a7e2b`). You can find them under **Dashboard → Users → [username]** — the ID appears in the browser URL.

### How it is built and released

The plugin is built automatically when a new GitHub release is published, but only if files under `apps/jellyfin-plugin/` changed. The workflow (`.github/workflows/jellyfin-plugin.yml`):

1. Detects whether plugin files changed since the previous release tag.
2. Builds the plugin with `dotnet build --configuration Release`.
3. Packages the `.dll` into a versioned zip and computes its MD5.
4. Updates `manifest.json` with the new version entry.
5. Uploads the zip as a release asset.

The plugin version matches the Hously release tag directly.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development conventions, branch naming, and PR guidelines.

## License

[MIT](./LICENSE)
