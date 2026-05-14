# Remove qBittorrent Client Page

**Date:** 2026-05-13  
**Goal:** Strip out the full qBittorrent torrent-management UI (the `/torrents` route) while keeping the grab flow, webhook/post-processing pipeline, and a simplified dashboard widget. Rename widget-level code to be torrent-client-agnostic so adding future clients (Transmission, Deluge, etc.) requires only a new service backend — not a new endpoint, hook, or component.

---

## What Gets Removed

### Web (`apps/web`)

- `/torrents` route page and `/$hash` sub-route
- All components under `src/features/torrents/_component/` (TorrentRow, TorrentGridCard, TorrentDetailPage, TorrentPropertiesTab, TorrentFilesTab, TorrentTrackersTab, TorrentPeersTab, TorrentFilterSheet, TorrentFilterPopover, AddTorrentPanel)
- `src/features/torrents/_hooks/useDashboardQbittorrent.ts`
- `src/features/torrents/_hooks/useQbittorrentStatus.ts`
- Navigation entry for `/torrents` in `src/lib/routing/navigation.ts`
- All `queryKeys` entries that only served the client page (torrent list, detail, properties, trackers, files, peers, categories, tags, pin)
- `QBITTORRENT_ENDPOINTS` entries for client-page routes; keep only those still needed by grab/settings

### API (`apps/api`)

- All routes in `routes/dashboard/qbittorrent/index.ts` — the entire file is replaced by the new generic speed route
- `services/qbittorrentPoller.ts` — SSE/delta-sync poller no longer needed
- `utils/dashboard/qbittorrent.ts` — `getQbittorrentSnapshot()` no longer called
- `utils/qbittorrent/helpers.ts` — if exclusively used by the removed routes

### Shared (`apps/shared`)

UI-only utilities in `utils/qbittorrent.ts` that only served the client page:
- `getQbittorrentStatusConfig`, `getQbittorrentStatusDot`, `getQbittorrentProgressBarGradient`
- `getQbittorrentTrackerStatusLabelKey`, `getQbittorrentTrackerStatusColor`
- `filterAndSortQbittorrentTorrents`, `countQbittorrentTorrentsByState`
- `createQbittorrentUploadFormData`, `normalizeQbittorrentUploadTags`, `toggleQbittorrentTagSelection`
- `getUniqueQbittorrentCategories`, `getUniqueQbittorrentTags`
- `formatQbittorrentEta`, `formatQbittorrentTrackerNumber`
- `QbittorrentStateFilter`, `QbittorrentSortKey`, `QbittorrentSortDir` types (if unreferenced after removal)
- `QBITTORRENT_TORRENTS_PAGE_SIZE` constant

---

## What Stays Unchanged

- `routes/integrations/qbittorrent/*` — settings, test connection, autorun setup
- `QbittorrentIntegrationSection.tsx` in settings
- `services/qbittorrent/client.ts` and `config.ts` — needed by grab, webhook, and new speed endpoint
- `services/qbittorrent/torrents.ts` — needed by `mediaGrabber.ts` and `postProcessor.ts`
- `webhookEnrichment.ts`, `postProcessor.ts`, `checkDownloadCompletion.ts` worker
- `InteractiveSearchPanel` grab flow in `/medias`
- `shared/types/integrations.ts` — `QbittorrentIntegration` type

---

## What Gets Simplified / Created

### New API endpoint

```
GET /api/dashboard/downloads/speed
```

- Route file: `routes/dashboard/downloads/index.ts`
- Calls `services/qbittorrent/client.ts` → qBittorrent `/api/v2/transfer/info` internally
- Returns a client-agnostic shape:
  ```ts
  { dl_speed: number; up_speed: number }
  ```
- Auth-guarded (same as other dashboard routes)
- When a second torrent client is supported later, only the service call inside this route changes

### New web hook

- `src/features/downloads/hooks/useDownloadsSpeed.ts`
- Single TanStack Query hook: `refetchInterval: 4000`
- Query key: `downloads.speed` in `queryKeys.ts`
- References `DOWNLOADS_ENDPOINTS.speed` in a new `src/lib/endpoints/downloads.ts`

### Simplified `DownloadsPanel`

- Keeps the speed graph
- Removes pinned torrent section, pin/unpin button, all torrent-level rendering
- Imports only `useDownloadsSpeed` — zero qBittorrent-specific imports
- If active/paused counts are not available from `transfer/info`, they are dropped from the widget

### Shared type

- `DownloadClientSpeed` in `apps/shared/src/types/downloads.ts`:
  ```ts
  export type DownloadClientSpeed = { dl_speed: number; up_speed: number }
  ```

---

## Architecture Principle

The qBittorrent service layer (`services/qbittorrent/`) remains the only place that knows about qBittorrent. Everything above it (routes, hooks, components) speaks the generic `downloads` vocabulary. This is the boundary that makes future client additions additive rather than invasive.
