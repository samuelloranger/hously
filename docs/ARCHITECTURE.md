# Architecture

System-level overview of the Hously monorepo: how the three workspaces relate, request flow from web to API to Prisma, and how SSE/webhooks/push/background jobs fit in.

Last verified: 2026-06-11

## Monorepo Layout

Hously is a Bun workspaces monorepo with three apps:

| Workspace        | Stack                                                              | Path          |
| ---------------- | ------------------------------------------------------------------ | ------------- |
| `@hously/api`    | Bun + Elysia + Prisma + PostgreSQL + Redis (BullMQ) + Better Auth  | `apps/api`    |
| `@hously/web`    | React 19 + Vite + TanStack Router/Query + Tailwind CSS 4 + i18next | `apps/web`    |
| `@hously/shared` | TypeScript types, pure utilities, cross-app constants              | `apps/shared` |

The web app and API run as two processes in development. **In production they are a single container**: `Dockerfile` builds `apps/web/dist` into `apps/api/public/` and the API serves it via `@elysiajs/static` whenever `SERVE_STATIC=true` (see `apps/api/src/index.ts:43-46`, `:150-175`).

Why a single container: keeps the public attack surface to one port, lets the API inject the bootstrapped user payload directly into `index.html` (`__HOUSLY_BOOTSTRAP__`, `apps/api/src/index.ts:162-174`), and avoids a separate static-host service.

## Workspace Relationships

- `@hously/shared` is the only package both other workspaces import. It holds TypeScript interfaces (`apps/shared/src/types/`), pure utilities, and cross-app constants — **no runtime dependencies on either app**.
- `@hously/web` consumes `@hously/shared` for types/utilities only. **TanStack Query hooks and the query-key factory stay in `apps/web`** (`apps/web/src/lib/queryKeys.ts`), per `AGENTS.md`. Do not move them to `@hously/shared`.
- `@hously/api` consumes `@hously/shared` for the same shared types. It never imports from `@hously/web`.
- Each app imports internally via a path alias: web uses `@/`, api uses `@hously/api/*`. See `.claude/rules/imports.md`.

## Request Flow (Web → API → Prisma)

1. **Web** calls `fetchApi(endpoint, …)` through `useFetcher()` and the shared client under `apps/web/src/lib/api/`. TanStack Query hooks wrap this — `useLibrary()` in `apps/web/src/features/medias/hooks/useLibrary.ts` is a typical example.
2. **API** routes are Elysia plugins composed in `apps/api/src/index.ts`. Each feature mounts under a kebab-case URL prefix like `/api/quality-profiles`. Cross-cutting middleware: CORS (`@elysiajs/cors`), a global rate limiter (`apps/api/src/middleware/rateLimit.ts` — 1000 req/hr per IP, authed bypass), and a centralized `onError` that maps Elysia codes to `{ error }` JSON.
3. **Auth** is Better Auth (`apps/api/src/lib/auth.ts`). Routes opt in by composing `.use(auth)` (resolve session into `user`) and `.use(requireUser)` or `.use(requireAdmin)` (`apps/api/src/middleware/auth.ts`).
4. **Prisma** is a singleton from `apps/api/src/db/`. Route handlers query Prisma directly for simple CRUD and delegate to `src/services/` for business logic. Responses **always map Prisma camelCase to snake_case** before returning (see `PATTERNS.md`).

## SSE, Webhooks, Push, Jobs

- **SSE** — generic helper `createJsonSseResponse()` in `apps/api/src/utils/sse.ts` polls a producer and emits dedup'd JSON frames with a 15s heartbeat. Used for download speed and similar live dashboards. Stateful web consumers can use `apps/web/src/lib/realtime/useEventSourceState.ts`; notifications and library events use domain-specific hooks.
- **Webhooks** — inbound third-party webhooks land at `POST /api/webhooks/:serviceName` (`apps/api/src/routes/webhooks/index.ts`). A registry (`apps/api/src/services/webhookHandlers/registry.ts`) dispatches to per-service handlers: `jellyfin`, `plex`, `prowlarr`, `kopia`, `uptimekuma`, `beszel`, `cross-seed`, plus the internal `hously` and `generic` handlers. qBittorrent has dedicated endpoints under `/api/webhooks/qbittorrent/*` that drive download lifecycle.
- **Background jobs** — BullMQ on Redis. Five queues: `express` (notifications + activity logs, concurrency 10), `scheduled-tasks` (concurrency 3, cron-repeatable), `library-migrate`, `library-reindex-languages`, `library-remux` (each concurrency 1). Workers and the cron schedule are wired in `apps/api/src/services/queueService.ts`; processors live under `apps/api/src/services/jobs/` and `apps/api/src/workers/`.
- **Push notifications** — Web Push (VAPID) via `web-push`. Keys load from `vapid_keys/` files or `VAPID_*` env vars (`apps/api/src/utils/webpush.ts`). User subscriptions are stored on `UserSubscription`.

## Production Static Serving

When `SERVE_STATIC=true`:

- `@elysiajs/static` serves `./public` (the built web app) under `/`, with HTML excluded so the SPA shell can be hand-rendered with bootstrap injection.
- A custom `onAfterHandle` serves pre-compressed `.gz` assets from `vite-plugin-compression2` when the client accepts gzip (`apps/api/src/index.ts:59-83`).
- A catch-all `GET *` returns `index.html` with a `<script>window.__HOUSLY_BOOTSTRAP__=…</script>` block containing the current user — avoids the client's first auth round-trip.

## Related Docs

- [API.md](./API.md) — route composition, auth, error helpers, rate limiting
- [DATA_MODEL.md](./DATA_MODEL.md) — Prisma entities and relationships
- [PATTERNS.md](./PATTERNS.md) — concrete code patterns
- [INTEGRATIONS.md](./INTEGRATIONS.md) — third-party wiring (qBittorrent, TMDB, Jellyfin, …)
- [DECISIONS.md](./DECISIONS.md) — why Hously replaces Radarr/Sonarr

## Changelog

- 2026-06-11 — Updated the request-flow examples after the task board removal.
