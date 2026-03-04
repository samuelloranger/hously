# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hously is a self-hosted command center for homelab enthusiasts. It provides a unified dashboard for monitoring infrastructure, managing media pipelines, and organizing daily life — replacing the need to juggle dozens of separate service UIs.

This monorepo contains:
- **API** (`apps/api`): Backend API built with Elysia (Bun runtime) and Prisma ORM
- **Web** (`apps/web`): React frontend with Vite, TanStack Router, and TanStack Query

A native companion app is located in a separate repository:
- **iOS App** (`../hously-ios`): Native Swift/SwiftUI app

## Development Setup

This project uses **Bun** as the package manager and runtime. Use the Makefile commands for all common operations:

```bash
# Install all dependencies
make install

# Local development (recommended - faster iteration)
make dev-services  # Start PostgreSQL + MinIO + Redis (Terminal 1)
make dev-api       # Start Bun API with hot reload (Terminal 2)
make dev-web       # Start React frontend with Vite (Terminal 3)

# Docker development (production-like)
docker compose up  # Start everything in containers
```

### Environment Configuration

Copy `.env.example` to `.env` and configure at minimum:
- `ALLOWED_EMAILS`: Comma-separated list of allowed user emails
- `ADMIN_EMAILS`: Comma-separated list of admin emails
- `SECRET_KEY`: Change from default for security
- `DATABASE_URL`: Connection string (adjust hostname based on Docker/local)

## Architecture

### Backend (apps/api)

**Stack**: Elysia (Bun), Prisma, PostgreSQL, Redis, MinIO (S3-compatible storage)

**Key directories**:
- `src/auth.ts`: JWT-based authentication with cookie handling
- `src/routes/`: Feature-specific route modules (e.g., `chores.ts`, `shopping.ts`, `calendar.ts`)
- `src/services/`: Business logic services (S3, images, external notifications, webhooks)
- `src/jobs/`: Cron job implementations (reminders, tracker stats, notifications cleanup)
- `src/middleware/`: Rate limiting and other middleware
- `src/db/`: Prisma client initialization
- `prisma/schema.prisma`: Database schema

**Architecture patterns**:
- Route modules export Elysia plugins that are composed in `src/index.ts`
- Authentication uses JWT tokens stored in HTTP-only cookies
- Cron jobs run in-process using `@elysiajs/cron`
- Webhook handlers for external services (Radarr, Sonarr, Jellyfin, Plex, etc.)
- Push notifications via Web Push (VAPID) and Apple Push Notifications (APNs)

### Frontend (apps/web)

**Stack**: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS 4

**Key directories**:
- `src/features/`: Feature-based organization (auth, chores, shopping, calendar, dashboard, torrents, medias, etc.)
- `src/components/`: Shared UI components
- `src/routes/`: File-based routing with TanStack Router
- `src/hooks/`: Custom React hooks
- `src/lib/`: Utility libraries (API client, query client, etc.)

**Architecture patterns**:
- Feature-based folder structure (each feature contains its components, hooks, and API logic)
- TanStack Query for server state management with optimistic updates
- TanStack Router for type-safe routing
- Internationalization with i18next (locales in `src/locales/`)
- Service Worker for PWA support (`src/sw/`)

## Common Commands

### Testing
```bash
make test              # Run all tests
cd apps/web && bun run test       # Web tests only
cd apps/api && bun test           # API tests only
```

### Linting & Type Checking
```bash
make lint              # Lint all code
make typecheck         # Type check frontend
```

### Database Migrations (Prisma)
```bash
# ALWAYS use Makefile commands for database operations
make migrate-dev       # Create new migration (development)
make migrate-deploy    # Apply pending migrations (production)
make migrate-push      # Push schema changes (dev only, bypasses migrations)
make migrate-studio    # Open Prisma Studio for DB exploration
```

When creating migrations, navigate to `apps/api` context and edit `prisma/schema.prisma`, then run the appropriate make command from the root.

### Building
```bash
make build             # Build web app for production
```

### iOS App (External)

The iOS application is maintained in a separate repository at `../hously-ios`. It connects to the API in this monorepo and supports native features like push notifications via APNs.

### Docker
```bash
docker compose up -d            # Start all services
docker compose down             # Stop all services
make rebuild                    # Rebuild containers (fixes dependency issues)
```

## Key Features

### Homelab Integrations
- **Dashboard** - Unified overview with server health (Netdata), disk diagnostics (Scrutiny), torrent activity, and media releases
- **Torrent Management** - Full qBittorrent integration with real-time SSE streaming
- **Media Pipeline** - Radarr & Sonarr integration with TMDB discovery and interactive release search
- **Tracker Statistics** - Monitor ratio and stats across private trackers (C411, Torr9, La Cale)
- **Jellyfin Integration** - Latest media additions on the dashboard
- **External Notifications** - Webhook integrations for Radarr, Sonarr, Jellyfin, Plex, Kopia, UptimeKuma

### Life Management
- **Shopping List** - Collaborative shopping with real-time updates
- **Chores** - Task assignment and tracking with recurring schedules
- **Calendar** - Shared calendar with reminders and iCal feed export
- **Meal Plans** - Weekly meal planning with recipe management

## Important Notes

- **Unstable Project**: This is an early-stage project subject to breaking changes
- **Access Control**: Users must be on the `ALLOWED_EMAILS` list to register
- **Admin Functions**: Admin-only features require `ADMIN_EMAILS` configuration
- **Image Storage**: Uses MinIO (S3-compatible) for image uploads (avatars, chores, recipes)
- **Push Notifications**: Supports Web Push (VAPID) and APNs (iOS)
- **Rate Limiting**: Global rate limit of 1000 requests/hour per IP
