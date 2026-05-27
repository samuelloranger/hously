# Integrations

How Hously talks to third-party services. Each integration follows the same shape: a row in the `Integration` table (type-keyed, encrypted secrets), a route plugin under `apps/api/src/routes/integrations/<name>/`, and a service module under `apps/api/src/services/`.

Last verified: 2026-05-25

## Pattern

The generic `Integration` model (`apps/api/prisma/schema.prisma:230`) stores `type` (unique), `enabled`, and a JSON `config` blob. Secrets inside `config` are encrypted via `apps/api/src/services/crypto.ts` (`encrypt` / `decrypt`). Config is read through a per-service helper (e.g. `getQbittorrentIntegrationConfig()`) that caches the decrypted view; admin updates call `invalidate*IntegrationConfigCache()`.

Settings → Integrations UI in the web app uses `useIntegrations()` and the per-service hooks (`useQbittorrentIntegration`, `useTmdbIntegration`, etc., all in `apps/web/src/pages/settings/`).

## qBittorrent

Hously's torrent client of record. The library grab/post-process pipeline depends on it.

- **Code**: `apps/api/src/services/qbittorrent/` (`clientFetch.ts`, `clientSession.ts`, `torrentAdd.ts`, `torrentMutations.ts`, `torrentQueries.ts`, `config.ts`), `apps/api/src/routes/integrations/qbittorrent/`.
- **SSE**: download speed and torrent list use `createJsonSseResponse()` (`apps/api/src/utils/sse.ts`); endpoints under `apps/api/src/routes/dashboard/downloads/`.
- **Webhooks (inbound)**: `POST /api/webhooks/qbittorrent/added` and `/completed`. Auto-configured by the "Configure Webhooks" button in Settings, which writes a `curl … ?hash=%I` command into qBittorrent's "Run external program" hooks with a shared bearer secret (`apps/api/src/routes/webhooks/index.ts:42-180`).
- **Config**: stored URL + credentials, plus `webhook_secret` and category names (`hously-movies`, `hously-shows` from `apps/api/src/constants/libraryGrab.ts`).
- **Why a webhook + ?hash=%I**: qBittorrent natively supports running an external program on torrent add/finish, but has no native HTTP hook. Spawning `curl` keeps the integration zero-dependency on the qBittorrent side and routes the `info-hash` substitution through a query param.

## TMDB

Media discovery + metadata source for the library.

- **Code**: `apps/api/src/utils/medias/tmdbFetcher*.ts` (split across `Core`, `Details`, `Endpoints`, `Types`), `apps/api/src/utils/medias/tmdbRegion.ts`.
- **Routes**: `apps/api/src/routes/medias/tmdb/` powers TMDB-backed search and trending in the web app. `apps/api/src/routes/integrations/tmdb/` exposes admin-only test/config endpoints.
- **Env**: `TMDB_API_KEY` (free at themoviedb.org/settings/api). Optional `OMDB_API_KEY` for IMDb ratings overlay.
- **Cron**: `REFRESH_UPCOMING` (every 12h at :30) refreshes the dashboard upcoming-releases widget for the country/languages set in `AppSettings`.

## Radarr / Sonarr — Migration Only

Hously **replaces** Radarr/Sonarr; it does not wrap them at runtime. The only Radarr/Sonarr code paths are:

1. **One-time importer** — Settings → Library import runs `apps/api/src/services/jobs/libraryMigrate{Radarr,Sonarr}.ts` to pull metadata, files, and MediaInfo into `LibraryMedia` / `MediaFile`. The job runs on the `library-migrate` queue (concurrency 1). Endpoints in `apps/api/src/routes/library/libraryJobWorkerRoutes.ts` (`POST /api/library/migrate`, `GET /api/library/migrate/status`).
2. **Filename conventions** — `apps/api/src/utils/medias/filenameParser.ts` / `releaseTitleParser.ts` recognize Radarr/Sonarr-formatted release filenames during downloads import.

See [DECISIONS.md](./DECISIONS.md) for the rationale.

Optional env for the importer: `MEDIA_PATH_FROM` / `MEDIA_PATH_TO` — remap `*arr`-internal paths to your container's mount path (e.g. `/data/Movies` → `/mnt/storage/Movies`).

## Indexers (Prowlarr / Jackett)

Used by the library grab pipeline to search torrent indexers.

- **Code**: `apps/api/src/services/indexerManager/` — strategy interface with `prowlarrAdapter.ts` and `jackettAdapter.ts`. `MediaSettings.activeIndexerManager` selects which one is active.
- **Routes**: `apps/api/src/routes/integrations/prowlarr/`, `.../jackett/`.
- **Cron**: `POLL_INDEXER_RSS` every 15 min (`apps/api/src/workers/pollIndexerRss.ts`) ingests RSS feeds for "wanted" items.

## Jellyfin

Powers the dashboard "latest media" widget and receives play/added events.

- **Code**: `apps/api/src/routes/integrations/jellyfin/`, `apps/api/src/services/jellyfinEpisodeBatcher.ts`, `apps/api/src/services/jellyfinLibraryRefresh.ts`, `apps/api/src/services/webhookHandlers/jellyfin.ts`.
- **Routes**: dashboard endpoints under `apps/api/src/routes/dashboard/jellyfin/`.
- **Webhook (inbound)**: `POST /api/webhooks/jellyfin` — episode-add events are batched (`jellyfinEpisodeBatcher`) so a season import doesn't fan out into N notifications.
- **Config**: URL + API key in the `jellyfin` Integration row.

## Plex

Webhook-only — Hously listens for "newly added" events.

- **Handler**: `apps/api/src/services/webhookHandlers/plex.ts`. Endpoint: `POST /api/webhooks/plex`.
- No outbound calls to Plex; if you want Plex *and* Jellyfin, both webhooks feed the same in-app notification path.

## Kopia

Backup tool. Hously surfaces snapshot success/failure as notifications.

- **Handler**: `apps/api/src/services/webhookHandlers/kopia.ts`. Endpoint: `POST /api/webhooks/kopia`.

## UptimeKuma

Heartbeat / status monitor.

- **Handler**: `apps/api/src/services/webhookHandlers/uptimekuma.ts`. Endpoint: `POST /api/webhooks/uptimekuma`.
- **Outbound** (status pull): `apps/api/src/routes/integrations/uptimekuma/`, `apps/api/src/utils/integrations/uptimekuma.ts`.

## Home Assistant

Dashboard widget + on-demand entity discovery.

- **Code**: `apps/api/src/services/homeAssistant.ts`, `apps/api/src/routes/integrations/home-assistant/`, `apps/api/src/routes/dashboard/home-assistant/`, `apps/api/src/utils/integrations/homeAssistantUtils.ts`.
- **Web hooks**: `apps/web/src/hooks/home-assistant/`.
- **Config**: HA base URL + long-lived access token.

## System Monitoring

- **Beszel** — server health agent. Outbound: `apps/api/src/routes/integrations/beszel/`. Inbound webhook: `apps/api/src/services/webhookHandlers/beszel.ts`.
- **Scrutiny** — disk SMART health. Outbound only: `apps/api/src/routes/integrations/scrutiny/`, `apps/api/src/routes/dashboard/scrutiny/`.
- **AdGuard Home** — DNS filtering stats. `apps/api/src/routes/integrations/adguard/`, `apps/api/src/routes/dashboard/adguard/`.

## Trackers (Private)

Stats scrapers for C411, Torr9, La Cale, YggReborn (a fork tracked under `YggReborn`).

- **Code**: `apps/api/src/services/trackers/` (`c411.ts`, `torr9.ts`, plus HTTP scrapers `http*.ts`), `apps/api/src/routes/integrations/trackers/`, dashboard endpoints under `apps/api/src/routes/dashboard/trackers/`.
- **Cron**: each tracker is fetched hourly on a staggered minute (`:00`, `:05`, `:10`, `:15`) — see `FETCH_*_STATS` in `queueService.ts`.

## Minecraft

Multi-server status pinger.

- **Code**: `apps/api/src/routes/integrations/minecraft/`, `apps/api/src/utils/minecraft/`, `apps/api/src/workers/pingMinecraftServers.ts`.
- **Cron**: `POLL_MINECRAFT_SERVERS` every 5 min.
- **Schema**: dedicated `MinecraftServer` table (one row per server, see [DATA_MODEL.md](./DATA_MODEL.md#integrations)).

## OIDC

Generic OAuth/OIDC providers configured via Settings (stored in `OidcProvider`).

- **Code**: `apps/api/src/routes/integrations/oidc/`, `apps/api/src/lib/auth.ts:loadOidcProviders` + `refreshOidcProviders()`.
- Better Auth loads enabled providers at startup; admin edits trigger `refreshOidcProviders()` to update without a restart.

## Notifications Out

- **Web Push (VAPID)** — `apps/api/src/utils/webpush.ts` loads keys from `vapid_keys/` files or `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` env vars; uses `VAPID_CONTACT_EMAIL` as the contact identity. Subscriptions persisted on `UserSubscription`.
- **APNs** — not currently wired in the API. The Dockerfile mounts `./certs:/app/certs:ro` for a future APNs cert path; the native iOS app in `../hously-ios` handles its own APNs registration today.
- **External webhooks out** — `ExternalNotificationService` rows define outbound targets (e.g. Discord, ntfy) with per-event `NotificationTemplate`s. Driver: `apps/api/src/services/externalNotificationService.ts`. Used internally by the qBittorrent and library workflows.

## Other Webhook Inbounds

- **Hously internal** (`apps/api/src/services/webhookHandlers/hously.ts`) — for self-tests and forwarding from one Hously instance to another.
- **Generic** (`generic.ts`) — catch-all for ad-hoc webhook URLs.
- **cross-seed** (`crossSeed.ts`) — integration with the cross-seed.org tool.
- **Prowlarr** (`prowlarr.ts`) — Prowlarr notify-on-grab pipeline.
