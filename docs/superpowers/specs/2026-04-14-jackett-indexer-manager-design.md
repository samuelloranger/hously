# Jackett as Alternative Indexer Manager

**Date:** 2026-04-14
**Status:** Approved
**Approach:** Adapter Pattern — abstract indexer manager behind a common interface

## Goal

Add Jackett alongside Prowlarr so users can choose which indexer manager to use. Both can be configured in plugin settings, but only one is active at a time. The active indexer is selected in the media library settings page.

## Architecture

### Adapter Pattern

A new `IndexerManagerAdapter` interface abstracts all indexer operations. Prowlarr and Jackett each get an adapter implementation. The rest of the codebase talks to the adapter, never directly to either API.

```
routes/medias/search  →  getActiveIndexerManager()  →  ProwlarrAdapter
                                                     →  JackettAdapter
```

#### Interface

```typescript
interface IndexerManagerAdapter {
  search(params: IndexerSearchParams): Promise<NormalizedRelease[]>;
  getIndexers(): Promise<NormalizedIndexer[]>;
  grabRelease(token: string): Promise<GrabResult>;
}

interface IndexerSearchParams {
  query?: string;
  type: "freetext" | "tvsearch";
  tmdbId?: number;
  season?: number;
}

interface NormalizedRelease {
  title: string;
  guid: string;
  size: number;
  indexer: string;
  downloadUrl: string | null;
  magnetUrl: string | null;
  infoHash: string | null;
  publishDate: string;
  // ... other common fields
}

interface NormalizedIndexer {
  id: number;
  name: string;
  protocol: string;
  enabled: boolean;
  privacy: "private" | "public";
}

interface GrabResult {
  success: boolean;
  downloadUrl?: string;
  magnetUrl?: string;
  error?: string;
}
```

#### Factory

```typescript
async function getActiveIndexerManager(): Promise<IndexerManagerAdapter>;
```

Reads `MediaSettings.activeIndexerManager`, fetches the corresponding plugin config from the `Plugin` table, and returns the correct adapter instance. Throws if no indexer is configured or the selected plugin is not enabled.

### Adapter Implementations

#### ProwlarrAdapter

Wraps existing Prowlarr logic:

- **Search:** `GET {url}/api/v1/search` with `X-Api-Key` header
- **Indexers:** `GET {url}/api/v1/indexer` with `X-Api-Key` header
- **Grab:** `POST {url}/api/v1/search` with stored release payload (token-based system)

Absorbs logic currently in `routes/medias/prowlarr/index.ts` and `utils/medias/prowlarrSearchUtils.ts`.

#### JackettAdapter

Jackett's native JSON API:

- **Search:** `GET {url}/api/v2.0/indexers/all/results?apikey={key}&Query={query}` (supports `Category`, `Tracker[]` params)
- **Indexers:** `GET {url}/api/v2.0/indexers?configured=true` with `apikey` query param
- **Grab:** No grab endpoint — Jackett provides direct download URLs/magnets. The adapter returns the URL for qBittorrent to consume directly.

### Search Strategy (Shared)

The tiered search logic (Sonarr-style season search) lives _above_ the adapter in a shared `searchStrategy.ts`. The adapter only executes individual search calls. Both Prowlarr and Jackett benefit from the same strategy:

**Season search tiers:**

1. Tier 1 — tvsearch by TMDB ID + season (structured, preferred)
2. Tier 2 (parallel) — tvsearch by title + season, free-text "Season N", free-text "Saison N", free-text "S{0N}"
3. Results deduplicated by GUID

**Complete series search:**

1. tvsearch by TMDB ID (no season)
2. tvsearch by title
3. Free-text "title integrale" / "title complete series"
4. Results deduplicated by GUID

## Data Model

### Prisma Migration

Add one field to `MediaSettings`:

```prisma
model MediaSettings {
  // ... existing fields
  activeIndexerManager  String?  @map("active_indexer_manager")  // "prowlarr" | "jackett" | null
}
```

No migration needed for the `Plugin` table — Jackett gets a new row with `type: "jackett"` and `config: { website_url, api_key }` (identical shape to Prowlarr).

### Shared Types

```typescript
// New union type
type IndexerManagerType = "prowlarr" | "jackett";

// Widen existing literals
interface InteractiveReleaseItem {
  source: IndexerManagerType; // was: "prowlarr"
  // ...
}

interface MediaInteractiveSearchResponse {
  service: IndexerManagerType; // was: "prowlarr"
  // ...
}

// New plugin types
interface JackettPlugin {
  type: "jackett";
  enabled: boolean;
  website_url: string;
  api_key: string;
}

interface JackettPluginUpdateResponse {
  success: boolean;
  plugin: JackettPlugin;
}

// Add to settings
interface MediaPostProcessingSettings {
  // ... existing fields
  active_indexer_manager: IndexerManagerType | null;
}

interface UpdateMediaPostProcessingSettingsRequest {
  // ... existing fields
  active_indexer_manager?: IndexerManagerType | null;
}
```

## API Routes

### New Generic Routes (replace Prowlarr media routes)

| Method | Path                                      | Purpose                            |
| ------ | ----------------------------------------- | ---------------------------------- |
| `GET`  | `/api/medias/interactive-search`          | Search releases via active adapter |
| `POST` | `/api/medias/interactive-search/download` | Grab release via active adapter    |
| `GET`  | `/api/medias/indexers`                    | List indexers from active adapter  |

### New Plugin Routes

| Method | Path                   | Purpose                             |
| ------ | ---------------------- | ----------------------------------- |
| `GET`  | `/api/plugins/jackett` | Fetch Jackett plugin config (admin) |
| `PUT`  | `/api/plugins/jackett` | Save Jackett plugin config (admin)  |

Existing Prowlarr plugin routes (`/api/plugins/prowlarr`) remain unchanged.

### Auto-Select Logic

Both `PUT /api/plugins/prowlarr` and `PUT /api/plugins/jackett` check: if `MediaSettings.activeIndexerManager` is null and the plugin is being enabled, auto-set it to that plugin's type.

### Removed Routes

| Method | Path                                               | Reason                    |
| ------ | -------------------------------------------------- | ------------------------- |
| `GET`  | `/api/medias/prowlarr/interactive-search`          | Replaced by generic route |
| `POST` | `/api/medias/prowlarr/interactive-search/download` | Replaced by generic route |
| `GET`  | `/api/medias/prowlarr/indexers`                    | Replaced by generic route |

## File Organization

### New Files

```
apps/api/src/services/indexerManager/
├── types.ts                  # Adapter interface + normalized types
├── prowlarrAdapter.ts        # Prowlarr implementation
├── jackettAdapter.ts         # Jackett implementation
├── searchStrategy.ts         # Tiered search logic (shared)
├── factory.ts                # getActiveIndexerManager()
└── index.ts                  # Re-exports

apps/api/src/routes/medias/search/
└── index.ts                  # Generic search + indexers + download routes

apps/api/src/routes/plugins/jackett/
└── index.ts                  # GET/PUT plugin config

apps/web/src/pages/settings/_component/plugins/
└── JackettPluginSection.tsx  # Plugin settings UI
```

### Modified Files

**Backend:**

- `apps/api/src/routes/medias/prowlarr/index.ts` — **deleted** (logic moves to prowlarrAdapter + generic routes)
- `apps/api/src/utils/medias/prowlarrSearchUtils.ts` — **deleted** (absorbed into prowlarrAdapter)
- `apps/api/src/utils/medias/mappers.ts` — token store becomes adapter-agnostic
- `apps/api/src/services/mediaGrabber.ts` — uses `getActiveIndexerManager()` instead of direct Prowlarr calls
- `apps/api/src/routes/index.ts` — compose new routes, remove old prowlarr media routes
- `apps/api/src/utils/plugins/normalizers.ts` — add `normalizeJackettConfig()`
- `apps/api/prisma/schema.prisma` — add `activeIndexerManager` to MediaSettings

**Shared:**

- `apps/shared/src/types/media.ts` — widen `source`/`service` to `IndexerManagerType`
- `apps/shared/src/types/plugins.ts` — add Jackett plugin types
- `apps/shared/src/types/library.ts` — add `active_indexer_manager` to settings types
- `apps/shared/src/endpoints/` — new `MEDIA_SEARCH_ENDPOINTS`, `JACKETT_PLUGIN_ENDPOINTS`

**Frontend:**

- `apps/web/src/lib/queryKeys.ts` — add jackett + generic media search keys
- `apps/web/src/lib/endpoints/medias.ts` — update to generic search paths
- `apps/web/src/pages/settings/usePlugins.ts` — add Jackett hooks
- `apps/web/src/pages/settings/useQualityProfiles.ts` — `useIndexers()` replaces `useProwlarrIndexers()`
- `apps/web/src/pages/settings/_component/MediaPostProcessingSettingsBody.tsx` — indexer picker dropdown
- `apps/web/src/pages/settings/_component/plugins/` — Jackett section + "Indexers" grouping

**i18n:**

- `apps/web/src/locales/en/common.json` — Jackett plugin keys + indexer manager label
- `apps/web/src/locales/fr/common.json` — same

## Frontend

### Plugin Settings (Plugins Tab)

Group Prowlarr and Jackett under an "Indexers" heading in the Plugins settings tab. Both use the existing `PluginSectionCard` component (URL + API key + enable toggle). Both can be configured independently.

### Media Library Settings (Active Indexer Picker)

Add an "Indexer Manager" dropdown to `MediaPostProcessingSettingsBody.tsx`:

- Neither plugin enabled → disabled dropdown with helper text linking to plugin settings
- One enabled → shown and auto-selected on first save
- Both enabled → dropdown with Prowlarr / Jackett options

### Query Keys & Hooks

- `queryKeys.jackett` namespace (mirrors `queryKeys.prowlarr`)
- `queryKeys.media.interactiveSearch` and `queryKeys.media.indexers` for generic routes
- `useJackettPlugin()`, `useUpdateJackettPlugin()` in `usePlugins.ts`
- `useIndexers()` replaces `useProwlarrIndexers()` — calls generic `/api/medias/indexers`
- Interactive search hooks switch to generic endpoint

### Quality Profile Editor

`QualityProfileEditorPanel.tsx` switches from `useProwlarrIndexers()` to `useIndexers()`. No other changes — the response shape is normalized by the adapter.

## Edge Cases

### No indexer configured

Search routes return `422 { error: "no_indexer_configured" }`. Frontend shows a prompt linking to plugin settings. `mediaGrabber.ts` skips automatic search gracefully (logs and returns).

### Active indexer plugin disabled

Disabling a plugin that is the active indexer sets `activeIndexerManager` to null. If the other indexer plugin is enabled, it automatically becomes the active one. The settings page shows a warning if the active indexer's plugin is disabled.

### Switching indexers mid-operation

Tokens from the old indexer's grab system expire naturally via the existing token store cleanup. Download attempts with expired tokens return 404.

### Jackett unreachable

Same timeout pattern as Prowlarr (25s search, 10s indexers). Adapter surfaces errors uniformly.

### Tracker priority mismatch after switching

If a user switches indexers, saved `prioritizedTrackers` names may not match the new indexer's names. Unmatched names score 0 bonus — acceptable behavior. The quality profile editor shows the current indexer's trackers so users can update priorities.
