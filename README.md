# Hously

A self-hosted command center for homelab enthusiasts. Monitor your infrastructure, manage your media pipeline, and keep your life organized -- all from a single dashboard.

> **Early stage project** -- expect breaking changes between releases.

## Features

### Infrastructure & Media
- **Dashboard** -- Unified overview: server health, disk status, torrent activity, media releases
- **Torrent Management** -- Full qBittorrent integration with real-time SSE streaming, filtering, and uploads
- **Media Pipeline** -- Radarr & Sonarr integration with TMDB discovery and interactive release search
- **Tracker Statistics** -- Ratio, upload stats, and account health across private trackers
- **Server Monitoring** -- Live CPU, RAM, disk, and network stats via Netdata
- **Disk Health** -- S.M.A.R.T. monitoring via Scrutiny
- **Jellyfin/Plex** -- Latest media additions on your dashboard

### Life Management
- **Shopping List** -- Collaborative with drag-and-drop reordering
- **Chores** -- Assignment, tracking, recurring schedules, and reminders
- **Calendar** -- Shared calendar with custom events and iCal export
- **Recipes & Meal Plans** -- Recipe management with ingredients, images, and weekly planning
- **Habits** -- Daily habit tracking with streaks

### Notifications
- **Webhook Integrations** -- Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma, Prowlarr
- **Customizable Templates** -- Per-service notification templates with variables
- **Multi-Channel Push** -- Web Push (VAPID) and Apple Push Notifications (APNs)

## Quick Start

Hously runs as a **single Docker container** -- the API serves the frontend directly.

### 1. Create a project directory

```bash
mkdir hously && cd hously
```

### 2. Download the compose file and environment template

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/samuelloranger/hously/main/docker-compose.prod-example.yml
curl -o .env https://raw.githubusercontent.com/samuelloranger/hously/main/.env.example
```

### 3. Configure environment

Edit `.env` and set at minimum:

```bash
# Required
ALLOWED_EMAILS=your-email@example.com
ADMIN_EMAILS=your-email@example.com
SECRET_KEY=generate-a-random-secret-here

# Database (must match the db service)
POSTGRES_DB=hously
POSTGRES_USER=hously
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://hously:change-me@db:5432/hously

# Redis
REDIS_PASSWORD=change-me

# MinIO (S3-compatible storage for images)
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change-me
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=change-me
```

### 4. Start the application

```bash
docker compose up -d
```

Hously will be available at `http://localhost:3000`. Register with an email from your `ALLOWED_EMAILS` list.

### 5. (Optional) Enable push notifications

Generate VAPID keys for browser push notifications:

```bash
bunx web-push generate-vapid-keys
```

Copy the output into your `.env`:

```bash
VAPID_PUBLIC_KEY=BPxr...your-public-key
VAPID_PRIVATE_KEY=abc...your-private-key
VAPID_CONTACT_EMAIL=mailto:your-email@example.com
```

Restart the container after updating:

```bash
docker compose up -d
```

### 6. (Optional) Reverse proxy

Put Hously behind a reverse proxy (Caddy, Nginx, Traefik) for HTTPS. Update `BASE_URL` and `CORS_ORIGIN` in `.env` to match your domain.

## Updating

```bash
docker compose pull
docker compose up -d
```

Migrations run automatically on startup.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `ALLOWED_EMAILS` | Comma-separated list of emails allowed to register |
| `ADMIN_EMAILS` | Comma-separated list of admin emails |
| `SECRET_KEY` | Secret key for JWT signing (change from default) |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Database credentials |
| `REDIS_PASSWORD` | Redis password |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | MinIO credentials |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | S3 credentials (same as MinIO by default) |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Public URL of the app | `http://localhost:5000` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` |
| `TZ` | Timezone for cron jobs and date boundaries | `America/New_York` |
| `TMDB_API_KEY` | TMDB API key for media discovery | -- |
| `OMDB_API_KEY` | OMDB API key for additional media data | -- |
| `VAPID_CONTACT_EMAIL` | Contact email for web push notifications | -- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP server for email notifications | -- |
| `SMTP_FROM` / `SMTP_FROM_NAME` | Email sender address and name | -- |
| `APNS_TEAM_ID` / `APNS_KEY_ID` / `APNS_AUTH_KEY` / `APNS_TOPIC` | Apple Push Notification service credentials | -- |
| `LOG_LEVEL` | Log level (`DEBUG`, `INFO`, `WARN`, `ERROR`) | `DEBUG` |

## External Notifications

Hously supports webhook-based notifications from external services.

### Supported Services

- **Media Servers**: Jellyfin, Plex
- **Media Management**: Radarr, Sonarr, Prowlarr
- **Backup**: Kopia
- **Monitoring**: UptimeKuma
- **Generic**: Any JSON webhook with `title` and `body`

### Setup

1. Go to **Settings > External Notifications**
2. Enable the service and click **Regenerate Token**
3. Copy the webhook URL (`https://your-domain.com/api/webhooks/{service}?token=TOKEN`)
4. Add the URL as a webhook in your external service

Each service has customizable notification templates with per-event variables.

## Development

**Requirements**: [Bun](https://bun.sh) v1.3+

```bash
git clone https://github.com/samuelloranger/hously.git
cd hously
cp .env.example .env
# Edit .env: set ALLOWED_EMAILS, ADMIN_EMAILS, SECRET_KEY

make install          # Install dependencies
make dev-services     # Start PostgreSQL + MinIO + Redis (Terminal 1)
make dev-api          # Start API with hot reload (Terminal 2)
make dev-web          # Start frontend with Vite (Terminal 3)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | [Elysia](https://elysiajs.com) (Bun runtime) + [Prisma](https://prisma.io) ORM |
| **Frontend** | React 19 + [Vite](https://vite.dev) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query) + [Tailwind CSS](https://tailwindcss.com) 4 |
| **Database** | PostgreSQL 15 |
| **Cache** | Redis 7 |
| **Storage** | MinIO (S3-compatible) |

### Project Structure

```
apps/
  api/       Elysia API server + Prisma schema + cron jobs
  web/       React frontend (SPA)
  shared/    Types, hooks, utilities shared between API and web
```

### Useful Commands

```bash
make test             # Run all tests
make lint             # Lint frontend
make typecheck        # Type check all workspaces
make migrate-dev      # Create a new Prisma migration
make migrate-deploy   # Apply pending migrations
make build            # Build frontend for production
```

## Building from Source

```bash
docker build -t hously:latest .
```

The Dockerfile builds the frontend, bundles it into the API's `public/` directory, and produces a single image that serves everything on port 3000.

## License

TBD
