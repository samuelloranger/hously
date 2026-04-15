# Jackett Indexer Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Jackett as an alternative indexer manager alongside Prowlarr using an adapter pattern, so users can configure either or both but activate only one at a time.

**Architecture:** An `IndexerManagerAdapter` interface abstracts all indexer operations (search, list indexers, grab release). Prowlarr and Jackett each implement this interface. A factory reads the active indexer from `MediaSettings.activeIndexerManager` and returns the correct adapter. Existing Prowlarr-specific routes become generic, indexer-agnostic routes.

**Tech Stack:** Elysia (Bun), Prisma, React 19, TanStack Query, i18next

**Spec:** `docs/superpowers/specs/2026-04-14-jackett-indexer-manager-design.md`

---

### Task 1: Prisma Migration — Add `activeIndexerManager` to MediaSettings

**Files:**

- Modify: `apps/api/prisma/schema.prisma:662-677`
- Create: `apps/api/prisma/migrations/<timestamp>_add_active_indexer_manager/migration.sql` (auto-generated)

- [ ] **Step 1: Add field to Prisma schema**

In `apps/api/prisma/schema.prisma`, add `activeIndexerManager` to the `MediaSettings` model:

```prisma
model MediaSettings {
  id                      Int      @id @default(1)
  moviesLibraryPath       String?  @map("movies_library_path")
  showsLibraryPath        String?  @map("shows_library_path")
  fileOperation           String   @default("hardlink") @map("file_operation")
  movieTemplate           String   @default("{title} ({year}) [{resolution} {source}]") @map("movie_template")
  episodeTemplate         String   @default("{show}/Season {season}/{show} - S{season:02}E{episode:02} - {title} [{resolution} {source}]") @map("episode_template")
  minSeedRatio            Float    @default(1) @map("min_seed_ratio")
  postProcessingEnabled   Boolean  @default(false) @map("post_processing_enabled")
  defaultQualityProfileId Int?     @map("default_quality_profile_id")
  activeIndexerManager    String?  @map("active_indexer_manager")
  updatedAt               DateTime @updatedAt @map("updated_at")

  defaultQualityProfile QualityProfile? @relation("DefaultQualityProfile", fields: [defaultQualityProfileId], references: [id], onDelete: SetNull)

  @@map("media_settings")
}
```

- [ ] **Step 2: Generate and apply migration**

Run:

```bash
cd /home/samuelloranger/sites/hously && make migrate-dev
```

When prompted for a name, enter: `add_active_indexer_manager`

Expected: Migration created successfully, new file under `apps/api/prisma/migrations/`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add activeIndexerManager field to MediaSettings"
```

---

### Task 2: Shared Types — IndexerManagerType, Jackett Plugin, Settings Update

**Files:**

- Modify: `apps/shared/src/types/media.ts:65-96`
- Modify: `apps/shared/src/types/plugins.ts:34-40,145-148`
- Modify: `apps/shared/src/types/library.ts:197-225`

- [ ] **Step 1: Add IndexerManagerType and widen source/service in media.ts**

In `apps/shared/src/types/media.ts`, add the union type before `InteractiveReleaseItem` and update `source` and `service`:

```typescript
export type IndexerManagerType = "prowlarr" | "jackett";

export interface InteractiveReleaseItem {
  guid: string;
  title: string;
  indexer: string | null;
  indexer_id: number | null;
  languages: string[];
  protocol: string | null;
  size_bytes: number | null;
  age: number | null;
  seeders: number | null;
  leechers: number | null;
  rejected: boolean;
  rejection_reason: string | null;
  info_url: string | null;
  source: IndexerManagerType;
  download_token?: string | null;
  download_url?: string | null;
  quality_score?: number | null;
  parsed_quality?: ParsedQualityFields | null;
  is_season_pack?: boolean;
  is_complete_series?: boolean;
}

export interface MediaInteractiveSearchResponse {
  success: boolean;
  service: IndexerManagerType;
  releases: InteractiveReleaseItem[];
}
```

- [ ] **Step 2: Add Jackett plugin types in plugins.ts**

In `apps/shared/src/types/plugins.ts`, add after the `ProwlarrPlugin` interface (around line 40):

```typescript
export interface JackettPlugin {
  type: "jackett";
  enabled: boolean;
  website_url: string;
  api_key: string;
}
```

And after `ProwlarrPluginUpdateResponse` (around line 148):

```typescript
export interface JackettPluginUpdateResponse {
  success: boolean;
  plugin: JackettPlugin;
}
```

- [ ] **Step 3: Add active_indexer_manager to library settings types**

In `apps/shared/src/types/library.ts`, update `MediaPostProcessingSettings`:

```typescript
export interface MediaPostProcessingSettings {
  movies_library_path: string | null;
  shows_library_path: string | null;
  file_operation: MediaFileOperation;
  movie_template: string;
  episode_template: string;
  min_seed_ratio: number;
  post_processing_enabled: boolean;
  default_quality_profile_id: number | null;
  active_indexer_manager: string | null;
  updated_at: string;
}
```

And `UpdateMediaPostProcessingSettingsRequest`:

```typescript
export interface UpdateMediaPostProcessingSettingsRequest {
  movies_library_path?: string | null;
  shows_library_path?: string | null;
  file_operation?: MediaFileOperation;
  movie_template?: string;
  episode_template?: string;
  min_seed_ratio?: number;
  post_processing_enabled?: boolean;
  default_quality_profile_id?: number | null;
  active_indexer_manager?: string | null;
}
```

- [ ] **Step 4: Verify types compile**

Run:

```bash
cd /home/samuelloranger/sites/hously && make typecheck
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/shared/src/types/media.ts apps/shared/src/types/plugins.ts apps/shared/src/types/library.ts
git commit -m "feat: add IndexerManagerType union, Jackett plugin types, and active_indexer_manager setting"
```

---

### Task 3: Backend — IndexerManagerAdapter Interface and Types

**Files:**

- Create: `apps/api/src/services/indexerManager/types.ts`
- Create: `apps/api/src/services/indexerManager/index.ts`

- [ ] **Step 1: Create adapter types file**

Create `apps/api/src/services/indexerManager/types.ts`:

```typescript
export interface IndexerSearchParams {
  query?: string;
  type: "freetext" | "tvsearch";
  tmdbId?: number | null;
  season?: number | null;
  limit?: number;
}

export interface NormalizedRelease {
  guid: string;
  title: string;
  indexer: string | null;
  indexerId: number | null;
  languages: string[];
  protocol: string | null;
  sizeBytes: number | null;
  age: number | null;
  seeders: number | null;
  leechers: number | null;
  rejected: boolean;
  rejections: string[];
  infoUrl: string | null;
  downloadUrl: string | null;
  magnetUrl: string | null;
  infoHash: string | null;
  /** Original raw payload — used by Prowlarr adapter for grab POST */
  rawPayload?: Record<string, unknown>;
}

export interface NormalizedIndexer {
  id: number;
  name: string;
  protocol: string;
  enabled: boolean;
  privacy: string;
}

export interface GrabResult {
  success: boolean;
  downloadUrl?: string;
  magnetUrl?: string;
  error?: string;
}

export interface IndexerManagerAdapter {
  readonly name: "prowlarr" | "jackett";

  search(params: IndexerSearchParams): Promise<NormalizedRelease[]>;

  getIndexers(): Promise<NormalizedIndexer[]>;

  /**
   * Grab/download a release.
   * - Prowlarr: POSTs stored payload back to Prowlarr API
   * - Jackett: returns the direct download URL/magnet
   */
  grabRelease(token: string): Promise<GrabResult>;

  /**
   * Store a release and return a download token for later grab.
   * - Prowlarr: stores the full raw payload for POST-back
   * - Jackett: stores the download URL/magnet
   * Returns null if the release has no downloadable target.
   */
  storeReleaseToken(release: NormalizedRelease): string | null;
}
```

- [ ] **Step 2: Create barrel export**

Create `apps/api/src/services/indexerManager/index.ts`:

```typescript
export type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/indexerManager/
git commit -m "feat: add IndexerManagerAdapter interface and types"
```

---

### Task 4: Backend — ProwlarrAdapter

**Files:**

- Create: `apps/api/src/services/indexerManager/prowlarrAdapter.ts`

This adapter absorbs logic from `apps/api/src/routes/medias/prowlarr/index.ts` (fetchReleases, buildTvSearchUrl, buildFreeSearchUrl) and `apps/api/src/utils/medias/prowlarrSearchUtils.ts` (extractProwlarrDownloadTarget, indexerNameFromRaw, etc.) and `apps/api/src/utils/medias/mappers.ts` (token store, mapInteractiveRelease).

- [ ] **Step 1: Create ProwlarrAdapter**

Create `apps/api/src/services/indexerManager/prowlarrAdapter.ts`:

```typescript
import type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
import type { ProwlarrPluginConfig } from "@hously/shared/types";
import {
  toRecord,
  toStringOrNull,
  toNumberOrNull,
  extractProwlarrDownloadTarget,
  indexerNameFromRaw,
  infoHashFromMagnet,
  toBoolean,
} from "../../utils/medias/prowlarrSearchUtils";
import { mapInteractiveRelease } from "../../utils/medias/mappers";
import { randomUUID } from "crypto";

const RELEASE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const releasePayloads = new Map<
  string,
  { payload: Record<string, unknown>; expiresAt: number }
>();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of releasePayloads.entries()) {
    if (entry.expiresAt <= now) releasePayloads.delete(token);
  }
}

function storePayload(payload: Record<string, unknown>): string {
  cleanupExpired();
  const token = randomUUID();
  releasePayloads.set(token, {
    payload,
    expiresAt: Date.now() + RELEASE_TTL_MS,
  });
  return token;
}

function takePayload(token: string): Record<string, unknown> | null {
  cleanupExpired();
  const entry = releasePayloads.get(token);
  if (!entry) return null;
  releasePayloads.delete(token);
  return entry.payload;
}

export class ProwlarrAdapter implements IndexerManagerAdapter {
  readonly name = "prowlarr" as const;
  private readonly config: ProwlarrPluginConfig;

  constructor(config: ProwlarrPluginConfig) {
    this.config = config;
  }

  private headers(): Record<string, string> {
    return {
      "X-Api-Key": this.config.api_key,
      Accept: "application/json",
    };
  }

  private baseUrl(): string {
    return this.config.website_url.replace(/\/+$/, "");
  }

  async search(params: IndexerSearchParams): Promise<NormalizedRelease[]> {
    const url = new URL("/api/v1/search", this.config.website_url);
    const limit = String(params.limit ?? 100);

    if (params.type === "tvsearch") {
      url.searchParams.set("type", "tvsearch");
      url.searchParams.set("limit", limit);
      if (params.season != null)
        url.searchParams.set("season", String(params.season));
      if (params.tmdbId != null) {
        url.searchParams.set("tmdbid", String(params.tmdbId));
      } else if (params.query) {
        url.searchParams.set("query", params.query);
      }
    } else {
      url.searchParams.set("type", "search");
      url.searchParams.set("query", params.query ?? "");
      url.searchParams.set("limit", limit);
    }

    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const body = await res.json().catch(() => null);
    if (!Array.isArray(body)) return [];

    const base = this.baseUrl();
    return body
      .map((raw: unknown) => this.normalizeRelease(raw, base))
      .filter((r): r is NormalizedRelease => r !== null);
  }

  async getIndexers(): Promise<NormalizedIndexer[]> {
    const url = new URL("/api/v1/indexer", this.config.website_url);
    const res = await fetch(url.toString(), {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const raw = (await res.json().catch(() => [])) as Array<
      Record<string, unknown>
    >;

    const indexers = raw.map((item) => ({
      id: Number(item.id),
      name: String(item.name ?? ""),
      protocol: String(item.protocol ?? "torrent"),
      enabled: Boolean(item.enable),
      privacy: String(item.privacy ?? "public"),
    }));

    indexers.sort((a, b) => {
      if (a.privacy === b.privacy) return a.name.localeCompare(b.name);
      return a.privacy === "private" ? -1 : 1;
    });

    return indexers;
  }

  async grabRelease(token: string): Promise<GrabResult> {
    const payload = takePayload(token);
    if (!payload) {
      return { success: false, error: "Release token expired or not found" };
    }

    const searchUrl = new URL("/api/v1/search", this.config.website_url);
    const res = await fetch(searchUrl.toString(), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).catch(() => null);

    if (!res?.ok) {
      return {
        success: false,
        error: `Prowlarr grab failed (${res?.status ?? "network error"})`,
      };
    }

    return { success: true };
  }

  storeReleaseToken(release: NormalizedRelease): string | null {
    if (!release.rawPayload) return null;
    return storePayload(release.rawPayload);
  }

  private normalizeRelease(
    raw: unknown,
    baseUrl: string,
  ): NormalizedRelease | null {
    const row = toRecord(raw);
    if (!row) return null;

    const guid = toStringOrNull(row.guid);
    const title = toStringOrNull(row.title);
    if (!guid || !title) return null;

    const target = extractProwlarrDownloadTarget(row, baseUrl);
    const magnetUrl = target?.isMagnet ? target.url : null;
    const downloadUrl = target && !target.isMagnet ? target.url : null;

    const rejections = Array.isArray(row.rejections) ? row.rejections : [];
    const rejectionStrings = rejections
      .map((r) => {
        const record = toRecord(r);
        return (
          toStringOrNull(record?.reason) || toStringOrNull(record?.type) || null
        );
      })
      .filter((v): v is string => Boolean(v));

    const indexerRecord = toRecord(row.indexer);

    return {
      guid,
      title,
      indexer:
        toStringOrNull(row.indexer) ||
        toStringOrNull(indexerRecord?.name) ||
        toStringOrNull(indexerRecord?.title) ||
        null,
      indexerId:
        toNumberOrNull(row.indexerId) ||
        toNumberOrNull(row.indexerID) ||
        toNumberOrNull(indexerRecord?.id) ||
        null,
      languages: extractLanguages(row),
      protocol: toStringOrNull(row.protocol),
      sizeBytes: toNumberOrNull(row.size),
      age: toNumberOrNull(row.age),
      seeders: toNumberOrNull(row.seeders),
      leechers: toNumberOrNull(row.leechers),
      rejected: toBoolean(row.rejected),
      rejections: rejectionStrings,
      infoUrl: toStringOrNull(row.infoUrl),
      downloadUrl,
      magnetUrl,
      infoHash: magnetUrl ? infoHashFromMagnet(magnetUrl) : null,
      rawPayload: row,
    };
  }
}

/** Extract language strings from Prowlarr's nested languages array. */
function extractLanguages(row: Record<string, unknown>): string[] {
  const langs = row.languages;
  if (!Array.isArray(langs)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of langs) {
    const record = toRecord(entry);
    const name = toStringOrNull(record?.name) || toStringOrNull(entry);
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
```

- [ ] **Step 2: Verify it compiles**

Run:

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors referencing `prowlarrAdapter.ts`. Fix any import path issues if they arise.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/indexerManager/prowlarrAdapter.ts
git commit -m "feat: implement ProwlarrAdapter for indexer manager abstraction"
```

---

### Task 5: Backend — JackettAdapter

**Files:**

- Create: `apps/api/src/services/indexerManager/jackettAdapter.ts`

- [ ] **Step 1: Create JackettAdapter**

Create `apps/api/src/services/indexerManager/jackettAdapter.ts`:

```typescript
import type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
import { randomUUID } from "crypto";

interface JackettConfig {
  api_key: string;
  website_url: string;
}

const RELEASE_TTL_MS = 10 * 60 * 1000;

const releasePayloads = new Map<
  string,
  { url: string; isMagnet: boolean; expiresAt: number }
>();

function cleanupExpired() {
  const now = Date.now();
  for (const [token, entry] of releasePayloads.entries()) {
    if (entry.expiresAt <= now) releasePayloads.delete(token);
  }
}

function storeDownloadUrl(url: string, isMagnet: boolean): string {
  cleanupExpired();
  const token = randomUUID();
  releasePayloads.set(token, {
    url,
    isMagnet,
    expiresAt: Date.now() + RELEASE_TTL_MS,
  });
  return token;
}

function takeDownloadUrl(
  token: string,
): { url: string; isMagnet: boolean } | null {
  cleanupExpired();
  const entry = releasePayloads.get(token);
  if (!entry) return null;
  releasePayloads.delete(token);
  return { url: entry.url, isMagnet: entry.isMagnet };
}

export class JackettAdapter implements IndexerManagerAdapter {
  readonly name = "jackett" as const;
  private readonly config: JackettConfig;

  constructor(config: JackettConfig) {
    this.config = config;
  }

  private baseUrl(): string {
    return this.config.website_url.replace(/\/+$/, "");
  }

  async search(params: IndexerSearchParams): Promise<NormalizedRelease[]> {
    const url = new URL(
      "/api/v2.0/indexers/all/results",
      this.config.website_url,
    );
    url.searchParams.set("apikey", this.config.api_key);

    if (params.query) {
      url.searchParams.set("Query", params.query);
    }

    // Jackett uses Torznab categories; 2000 = Movies, 5000 = TV
    if (params.type === "tvsearch") {
      url.searchParams.append("Category[]", "5000");
      if (params.tmdbId != null) {
        url.searchParams.set("tmdbid", String(params.tmdbId));
      }
    }

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const body = await res.json().catch(() => null);

    // Jackett /api/v2.0/indexers/all/results returns { Results: [...] }
    const results = Array.isArray(body?.Results)
      ? body.Results
      : Array.isArray(body)
        ? body
        : [];

    return results
      .map((raw: Record<string, unknown>) => this.normalizeRelease(raw))
      .filter((r): r is NormalizedRelease => r !== null);
  }

  async getIndexers(): Promise<NormalizedIndexer[]> {
    const url = new URL("/api/v2.0/indexers", this.config.website_url);
    url.searchParams.set("apikey", this.config.api_key);
    url.searchParams.set("configured", "true");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res?.ok) return [];

    const raw = (await res.json().catch(() => [])) as Array<
      Record<string, unknown>
    >;

    const indexers: NormalizedIndexer[] = raw.map((item, idx) => ({
      id: typeof item.id === "string" ? idx : Number(item.id ?? idx),
      name: String(item.name ?? item.title ?? ""),
      protocol: "torrent",
      enabled: item.configured !== false,
      privacy:
        item.type === "private" || item.type === "semi-private"
          ? "private"
          : "public",
    }));

    indexers.sort((a, b) => {
      if (a.privacy === b.privacy) return a.name.localeCompare(b.name);
      return a.privacy === "private" ? -1 : 1;
    });

    return indexers;
  }

  async grabRelease(token: string): Promise<GrabResult> {
    const stored = takeDownloadUrl(token);
    if (!stored) {
      return { success: false, error: "Release token expired or not found" };
    }

    // Jackett has no grab endpoint — return the download URL/magnet directly
    // for the caller to pass to qBittorrent.
    if (stored.isMagnet) {
      return { success: true, magnetUrl: stored.url };
    }
    return { success: true, downloadUrl: stored.url };
  }

  storeReleaseToken(release: NormalizedRelease): string | null {
    const url = release.magnetUrl ?? release.downloadUrl;
    if (!url) return null;
    return storeDownloadUrl(url, url.startsWith("magnet:"));
  }

  private normalizeRelease(
    raw: Record<string, unknown>,
  ): NormalizedRelease | null {
    // Jackett Results fields: Title, Guid, Link, MagnetUri, Size, Seeders,
    // Peers, Tracker, PublishDate, CategoryDesc, InfoHash, Details
    const title = toString(raw.Title) || toString(raw.title);
    const guid =
      toString(raw.Guid) || toString(raw.guid) || toString(raw.Link) || title;
    if (!guid || !title) return null;

    const magnetUrl =
      toString(raw.MagnetUri) || toString(raw.magnetUri) || null;
    const link = toString(raw.Link) || toString(raw.link) || null;
    const downloadUrl = link && !link.startsWith("magnet:") ? link : null;

    const trackerName = toString(raw.Tracker) || toString(raw.tracker) || null;

    const infoHash =
      toString(raw.InfoHash) ||
      toString(raw.infoHash) ||
      (magnetUrl ? extractInfoHash(magnetUrl) : null);

    return {
      guid,
      title,
      indexer: trackerName,
      indexerId: null,
      languages: [],
      protocol: "torrent",
      sizeBytes: toNumber(raw.Size) ?? toNumber(raw.size) ?? null,
      age: null,
      seeders: toNumber(raw.Seeders) ?? toNumber(raw.seeders) ?? null,
      leechers: toNumber(raw.Peers) ?? toNumber(raw.peers) ?? null,
      rejected: false,
      rejections: [],
      infoUrl: toString(raw.Details) || toString(raw.details) || null,
      downloadUrl,
      magnetUrl,
      infoHash,
    };
  }
}

function toString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function extractInfoHash(magnet: string): string | null {
  const m = /btih:([a-fA-F0-9]{40})/i.exec(magnet);
  return m ? m[1].toLowerCase() : null;
}
```

- [ ] **Step 2: Update barrel export**

In `apps/api/src/services/indexerManager/index.ts`, add:

```typescript
export type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
export { ProwlarrAdapter } from "./prowlarrAdapter";
export { JackettAdapter } from "./jackettAdapter";
```

- [ ] **Step 3: Verify it compiles**

Run:

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/indexerManager/
git commit -m "feat: implement JackettAdapter for indexer manager abstraction"
```

---

### Task 6: Backend — Normalizer and Factory

**Files:**

- Modify: `apps/api/src/utils/plugins/normalizers.ts:132-148`
- Create: `apps/api/src/services/indexerManager/factory.ts`
- Modify: `apps/api/src/services/indexerManager/index.ts`

- [ ] **Step 1: Add normalizeJackettConfig**

In `apps/api/src/utils/plugins/normalizers.ts`, add after `normalizeProwlarrConfig` (after line 148):

```typescript
export const normalizeJackettConfig = (
  config: unknown,
): ProwlarrPluginConfig | null => {
  // Jackett uses the same config shape as Prowlarr: { api_key, website_url }
  if (!config || typeof config !== "object" || Array.isArray(config))
    return null;
  const cfg = config as Record<string, unknown>;

  const apiKey = normalizeSecret(cfg.api_key);
  const websiteUrl =
    typeof cfg.website_url === "string" ? cfg.website_url.trim() : "";

  if (!apiKey || !websiteUrl) return null;
  return {
    api_key: apiKey,
    website_url: websiteUrl.replace(/\/+$/, ""),
  };
};
```

Note: This reuses the `ProwlarrPluginConfig` return type since the config shape is identical (`{ api_key, website_url }`). If the shared types later add a `JackettPluginConfig` type with the same shape, switch to that.

- [ ] **Step 2: Create factory**

Create `apps/api/src/services/indexerManager/factory.ts`:

```typescript
import { prisma } from "../../db";
import { getPluginConfigRecord } from "../pluginConfigCache";
import {
  normalizeProwlarrConfig,
  normalizeJackettConfig,
} from "../../utils/plugins/normalizers";
import { ProwlarrAdapter } from "./prowlarrAdapter";
import { JackettAdapter } from "./jackettAdapter";
import type { IndexerManagerAdapter } from "./types";

/**
 * Return the currently active IndexerManagerAdapter based on
 * MediaSettings.activeIndexerManager.
 *
 * Returns null if no indexer is configured or the selected plugin is disabled.
 */
export async function getActiveIndexerManager(): Promise<IndexerManagerAdapter | null> {
  let row = await prisma.mediaSettings.findUnique({ where: { id: 1 } });
  if (!row) {
    row = await prisma.mediaSettings.create({ data: { id: 1 } });
  }

  const active = row.activeIndexerManager;
  if (!active) return null;

  if (active === "prowlarr") {
    const plugin = await getPluginConfigRecord("prowlarr");
    if (!plugin?.enabled) return null;
    const config = normalizeProwlarrConfig(plugin.config);
    if (!config) return null;
    return new ProwlarrAdapter(config);
  }

  if (active === "jackett") {
    const plugin = await getPluginConfigRecord("jackett");
    if (!plugin?.enabled) return null;
    const config = normalizeJackettConfig(plugin.config);
    if (!config) return null;
    return new JackettAdapter(config);
  }

  return null;
}
```

- [ ] **Step 3: Update barrel export**

Update `apps/api/src/services/indexerManager/index.ts`:

```typescript
export type {
  IndexerManagerAdapter,
  IndexerSearchParams,
  NormalizedRelease,
  NormalizedIndexer,
  GrabResult,
} from "./types";
export { ProwlarrAdapter } from "./prowlarrAdapter";
export { JackettAdapter } from "./jackettAdapter";
export { getActiveIndexerManager } from "./factory";
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/utils/plugins/normalizers.ts apps/api/src/services/indexerManager/
git commit -m "feat: add normalizeJackettConfig and indexer manager factory"
```

---

### Task 7: Backend — Search Strategy (Shared Tiered Logic)

**Files:**

- Create: `apps/api/src/services/indexerManager/searchStrategy.ts`

This extracts the tiered search logic from the current Prowlarr route into a reusable module that works with any adapter.

- [ ] **Step 1: Create searchStrategy.ts**

Create `apps/api/src/services/indexerManager/searchStrategy.ts`:

```typescript
import type { IndexerManagerAdapter, NormalizedRelease } from "./types";

interface TieredSearchOpts {
  query: string;
  tmdbId?: number | null;
  season?: number | null;
  complete?: boolean;
}

/**
 * Tiered search strategy (mirrors Sonarr's approach).
 * Works with any IndexerManagerAdapter.
 */
export async function tieredSearch(
  adapter: IndexerManagerAdapter,
  opts: TieredSearchOpts,
): Promise<NormalizedRelease[]> {
  const { query, tmdbId, season, complete } = opts;

  if (complete) {
    return completeSeriesSearch(adapter, query, tmdbId);
  }

  if (season != null) {
    return seasonSearch(adapter, query, tmdbId, season);
  }

  return adapter.search({ query, type: "freetext" });
}

async function seasonSearch(
  adapter: IndexerManagerAdapter,
  query: string,
  tmdbId: number | null | undefined,
  season: number,
): Promise<NormalizedRelease[]> {
  const sN = String(season).padStart(2, "0");

  const [tvById, tvByTitle, seasonEn, seasonFr, seasonScene] =
    await Promise.all([
      tmdbId != null
        ? adapter.search({ type: "tvsearch", tmdbId, season })
        : Promise.resolve([]),
      adapter.search({ type: "tvsearch", query, season }),
      adapter.search({ type: "freetext", query: `${query} Season ${season}` }),
      adapter.search({ type: "freetext", query: `${query} Saison ${season}` }),
      adapter.search({ type: "freetext", query: `${query} S${sN}` }),
    ]);

  return deduplicateByGuid([
    tvById,
    tvByTitle,
    seasonEn,
    seasonFr,
    seasonScene,
  ]);
}

async function completeSeriesSearch(
  adapter: IndexerManagerAdapter,
  query: string,
  tmdbId: number | null | undefined,
): Promise<NormalizedRelease[]> {
  const [tvById, tvByTitle, integrale, completeSeries] = await Promise.all([
    tmdbId != null
      ? adapter.search({ type: "tvsearch", tmdbId })
      : Promise.resolve([]),
    adapter.search({ type: "tvsearch", query }),
    adapter.search({ type: "freetext", query: `${query} integrale` }),
    adapter.search({ type: "freetext", query: `${query} complete series` }),
  ]);

  return deduplicateByGuid([tvById, tvByTitle, integrale, completeSeries]);
}

function deduplicateByGuid(
  batches: NormalizedRelease[][],
): NormalizedRelease[] {
  const seen = new Set<string>();
  const result: NormalizedRelease[] = [];
  for (const batch of batches) {
    for (const release of batch) {
      if (release.guid && !seen.has(release.guid)) {
        seen.add(release.guid);
        result.push(release);
      }
    }
  }
  return result;
}
```

- [ ] **Step 2: Export from barrel**

Add to `apps/api/src/services/indexerManager/index.ts`:

```typescript
export { tieredSearch } from "./searchStrategy";
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/indexerManager/searchStrategy.ts apps/api/src/services/indexerManager/index.ts
git commit -m "feat: extract tiered search strategy for adapter-agnostic use"
```

---

### Task 8: Backend — Generic Search Routes (Replace Prowlarr Media Routes)

**Files:**

- Create: `apps/api/src/routes/medias/search/index.ts`
- Modify: `apps/api/src/routes/medias/index.ts`

- [ ] **Step 1: Create generic search routes**

Create `apps/api/src/routes/medias/search/index.ts`:

```typescript
import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import {
  getActiveIndexerManager,
  tieredSearch,
} from "@hously/api/services/indexerManager";
import type { QualityProfile } from "@prisma/client";
import type {
  InteractiveReleaseItem,
  QualityProfileScoreInput,
} from "@hously/shared/types";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";
import { scoreRelease } from "@hously/api/utils/medias/qualityScorer";
import {
  isSeasonPack,
  isCompleteSeries,
} from "@hously/api/utils/medias/mappers";
import {
  badRequest,
  badGateway,
  notFound,
  serverError,
} from "@hously/api/errors";

function toScoreInput(p: QualityProfile): QualityProfileScoreInput {
  return {
    minResolution: p.minResolution,
    cutoffResolution: p.cutoffResolution,
    preferredSources: p.preferredSources,
    preferredCodecs: p.preferredCodecs,
    preferredLanguages: p.preferredLanguages ?? [],
    prioritizedTrackers: p.prioritizedTrackers ?? [],
    preferTrackerOverQuality: p.preferTrackerOverQuality ?? false,
    maxSizeGb: p.maxSizeGb,
    requireHdr: p.requireHdr,
    preferHdr: p.preferHdr,
  };
}

function normalizedToInteractive(
  r: NormalizedRelease,
  source: "prowlarr" | "jackett",
  downloadToken: string | null,
): InteractiveReleaseItem {
  return {
    guid: r.guid,
    title: r.title,
    indexer: r.indexer,
    indexer_id: r.indexerId,
    languages: r.languages,
    protocol: r.protocol,
    size_bytes: r.sizeBytes,
    age: r.age,
    seeders: r.seeders,
    leechers: r.leechers,
    rejected: r.rejected,
    rejection_reason: r.rejections.length > 0 ? r.rejections.join(", ") : null,
    info_url: r.infoUrl,
    source,
    download_token: downloadToken,
    download_url: r.magnetUrl ?? r.downloadUrl ?? null,
    is_season_pack: isSeasonPack(r.title),
    is_complete_series: isCompleteSeries(r.title),
  };
}

export const mediasSearchRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/interactive-search",
    async ({ user, set, query }) => {
      const searchQuery = query.q.trim();
      const seasonNumber =
        query.season != null ? parseInt(String(query.season), 10) : null;
      const tmdbId =
        query.tmdb_id != null ? parseInt(String(query.tmdb_id), 10) : null;
      const isSeasonSearch =
        seasonNumber != null && Number.isFinite(seasonNumber);
      const isCompleteSearch =
        query.complete === "true" || query.complete === true;

      if (!isSeasonSearch && !isCompleteSearch && searchQuery.length < 2) {
        return badRequest(
          set,
          "Search query must be at least 2 characters long",
        );
      }

      try {
        const adapter = await getActiveIndexerManager();
        if (!adapter) {
          return badRequest(
            set,
            "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
          );
        }

        const rawReleases = await tieredSearch(adapter, {
          query: searchQuery,
          tmdbId,
          season: isSeasonSearch ? seasonNumber : null,
          complete: isCompleteSearch,
        });

        // Convert NormalizedRelease to InteractiveReleaseItem with tokens
        let mapped: InteractiveReleaseItem[] = rawReleases.map((r) => {
          const downloadToken = adapter.storeReleaseToken(r);
          return normalizedToInteractive(r, adapter.name, downloadToken);
        });

        // Quality profile scoring
        const lmRaw = query.library_media_id;
        if (lmRaw != null && lmRaw !== "") {
          const libId =
            typeof lmRaw === "number" ? lmRaw : parseInt(String(lmRaw), 10);
          if (Number.isFinite(libId)) {
            const media = await prisma.libraryMedia.findUnique({
              where: { id: libId },
              include: { qualityProfile: true },
            });
            const qp = media?.qualityProfile;
            if (qp) {
              const profile = toScoreInput(qp);
              mapped = mapped.map((r) => {
                const parsed = parseReleaseTitle(r.title);
                const score = scoreRelease(
                  parsed,
                  profile,
                  r.size_bytes,
                  r.title,
                  r.indexer,
                );
                const qualityReject = score === null;
                const parsed_quality = {
                  resolution: parsed.resolution,
                  source: parsed.source,
                  codec: parsed.codec,
                  hdr: parsed.hdr,
                };
                const rejected = r.rejected || qualityReject;
                const qmsg = "Does not match quality profile";
                let rejection_reason = r.rejection_reason;
                if (qualityReject) {
                  rejection_reason = rejection_reason
                    ? `${rejection_reason}; ${qmsg}`
                    : qmsg;
                }
                return {
                  ...r,
                  quality_score: score,
                  parsed_quality,
                  rejected,
                  rejection_reason,
                };
              });
              mapped.sort((a, b) => {
                const ar = a.rejected ? 1 : 0;
                const br = b.rejected ? 1 : 0;
                if (ar !== br) return ar - br;
                const as = a.quality_score ?? -Number.MAX_SAFE_INTEGER;
                const bs = b.quality_score ?? -Number.MAX_SAFE_INTEGER;
                if (as !== bs) return bs - as;
                return a.title.localeCompare(b.title);
              });
            }
          }
        }

        return {
          success: true,
          service: adapter.name,
          releases: mapped,
        };
      } catch (error) {
        console.error("Error loading interactive search releases:", error);
        return serverError(set, "Failed to load interactive search releases");
      }
    },
    {
      query: t.Object({
        q: t.String(),
        library_media_id: t.Optional(t.Union([t.String(), t.Number()])),
        season: t.Optional(t.Union([t.String(), t.Number()])),
        tmdb_id: t.Optional(t.Union([t.String(), t.Number()])),
        complete: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
    },
  )
  .get("/indexers", async ({ set }) => {
    try {
      const adapter = await getActiveIndexerManager();
      if (!adapter) {
        return badRequest(
          set,
          "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
        );
      }
      const indexers = await adapter.getIndexers();
      return { indexers };
    } catch {
      return serverError(set, "Failed to fetch indexers");
    }
  })
  .post(
    "/interactive-search/download",
    async ({ user, set, body }) => {
      const token = body.token.trim();
      if (!token) {
        return badRequest(set, "Invalid release token");
      }

      try {
        const adapter = await getActiveIndexerManager();
        if (!adapter) {
          return badRequest(
            set,
            "No indexer manager configured. Enable Prowlarr or Jackett in plugin settings.",
          );
        }

        const result = await adapter.grabRelease(token);
        if (!result.success) {
          return notFound(
            set,
            result.error ??
              "Selected release is no longer available. Run the search again.",
          );
        }

        return {
          success: true,
          service: adapter.name,
          ...(result.downloadUrl ? { download_url: result.downloadUrl } : {}),
          ...(result.magnetUrl ? { magnet_url: result.magnetUrl } : {}),
        };
      } catch (error) {
        console.error("Error downloading release:", error);
        return serverError(set, "Failed to download release");
      }
    },
    {
      body: t.Object({
        token: t.String(),
      }),
    },
  );
```

- [ ] **Step 2: Update medias route composition**

Replace `apps/api/src/routes/medias/index.ts` to swap in the new generic routes and remove the Prowlarr-specific ones:

```typescript
import { Elysia } from "elysia";
import { mediasTmdbRoutes } from "./tmdb";
import { mediasSearchRoutes } from "./search";
import { mediasWatchlistRoutes } from "./watchlist";
import { mediasCollectionsRoutes } from "./collections";
import { mediasBlocklistRoutes } from "./blocklist";

export const mediasRoutes = new Elysia({ prefix: "/api/medias" })
  .use(mediasTmdbRoutes)
  .use(mediasSearchRoutes)
  .use(mediasWatchlistRoutes)
  .use(mediasCollectionsRoutes)
  .use(mediasBlocklistRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/medias/search/ apps/api/src/routes/medias/index.ts
git commit -m "feat: add generic indexer-agnostic search routes, replace Prowlarr-specific media routes"
```

---

### Task 9: Backend — Jackett Plugin Config Routes

**Files:**

- Create: `apps/api/src/routes/plugins/jackett/index.ts`
- Modify: `apps/api/src/routes/plugins/index.ts`

- [ ] **Step 1: Create Jackett plugin routes**

Create `apps/api/src/routes/plugins/jackett/index.ts`:

```typescript
import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import { isValidHttpUrl, normalizeUrl } from "@hously/api/utils/plugins/utils";
import { normalizeJackettConfig } from "@hously/api/utils/plugins/normalizers";
import { logActivity } from "@hously/api/utils/activityLogs";
import { encrypt } from "@hously/api/services/crypto";
import { requireAdmin } from "@hously/api/middleware/auth";
import { badRequest, serverError } from "@hously/api/errors";

export const jackettPluginRoutes = new Elysia()
  .use(auth)
  .use(requireAdmin)
  .get("/jackett", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "jackett" },
      });

      const config = normalizeJackettConfig(plugin?.config);
      return {
        plugin: {
          type: "jackett",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          api_key: "",
        },
      };
    } catch (error) {
      console.error("Error fetching Jackett plugin config:", error);
      return serverError(set, "Failed to fetch Jackett plugin config");
    }
  })
  .put(
    "/jackett",
    async ({ user, body, set }) => {
      const websiteUrl = normalizeUrl(body.website_url);
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "jackett" },
      });
      const existingConfig = normalizeJackettConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const enabled = body.enabled ?? true;

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      if (!apiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "jackett" },
          update: {
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            updatedAt: now,
          },
          create: {
            type: "jackett",
            enabled,
            config: {
              website_url: websiteUrl,
              api_key: encrypt(apiKey),
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        // Auto-select: if no active indexer manager is set, set it now
        const settings = await prisma.mediaSettings.findUnique({
          where: { id: 1 },
        });
        if (enabled && !settings?.activeIndexerManager) {
          await prisma.mediaSettings.upsert({
            where: { id: 1 },
            update: { activeIndexerManager: "jackett" },
            create: { id: 1, activeIndexerManager: "jackett" },
          });
        }

        // If disabling and this was the active indexer, clear it
        if (!enabled && settings?.activeIndexerManager === "jackett") {
          // Check if prowlarr is available as fallback
          const prowlarr = await prisma.plugin.findFirst({
            where: { type: "prowlarr", enabled: true },
          });
          await prisma.mediaSettings.update({
            where: { id: 1 },
            data: {
              activeIndexerManager: prowlarr ? "prowlarr" : null,
            },
          });
        }

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "jackett" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            api_key: "",
          },
        };
      } catch (error) {
        console.error("Error saving Jackett plugin config:", error);
        return serverError(set, "Failed to save Jackett plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
```

- [ ] **Step 2: Add auto-select logic to existing Prowlarr plugin route**

In `apps/api/src/routes/plugins/prowlarr/index.ts`, add auto-select and disable logic inside the PUT handler's try block, after the `prisma.plugin.upsert` call (after line 80) and before `logActivity`:

```typescript
// Auto-select: if no active indexer manager is set, set it now
const settings = await prisma.mediaSettings.findUnique({
  where: { id: 1 },
});
if (enabled && !settings?.activeIndexerManager) {
  await prisma.mediaSettings.upsert({
    where: { id: 1 },
    update: { activeIndexerManager: "prowlarr" },
    create: { id: 1, activeIndexerManager: "prowlarr" },
  });
}

// If disabling and this was the active indexer, clear it
if (!enabled && settings?.activeIndexerManager === "prowlarr") {
  const jackett = await prisma.plugin.findFirst({
    where: { type: "jackett", enabled: true },
  });
  await prisma.mediaSettings.update({
    where: { id: 1 },
    data: {
      activeIndexerManager: jackett ? "jackett" : null,
    },
  });
}
```

- [ ] **Step 3: Register Jackett plugin routes**

In `apps/api/src/routes/plugins/index.ts`, add the import and use:

```typescript
import { Elysia } from "elysia";
import { weatherPluginRoutes } from "./weather";
import { tmdbPluginRoutes } from "./tmdb";
import { qbittorrentPluginRoutes } from "./qbittorrent";
import { homeAssistantPluginRoutes } from "./home-assistant";
import { jellyfinPluginRoutes } from "./jellyfin";
import { prowlarrPluginRoutes } from "./prowlarr";
import { jackettPluginRoutes } from "./jackett";

import { scrutinyPluginRoutes } from "./scrutiny";
import { beszelPluginRoutes } from "./beszel";
import { adguardPluginRoutes } from "./adguard";
import { trackerPluginsRoutes } from "./trackers";

export const pluginsRoutes = new Elysia({ prefix: "/api/plugins" })
  .use(weatherPluginRoutes)
  .use(tmdbPluginRoutes)
  .use(qbittorrentPluginRoutes)
  .use(homeAssistantPluginRoutes)
  .use(jellyfinPluginRoutes)
  .use(prowlarrPluginRoutes)
  .use(jackettPluginRoutes)

  .use(scrutinyPluginRoutes)
  .use(beszelPluginRoutes)
  .use(adguardPluginRoutes)
  .use(trackerPluginsRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/plugins/jackett/ apps/api/src/routes/plugins/index.ts apps/api/src/routes/plugins/prowlarr/index.ts
git commit -m "feat: add Jackett plugin routes with auto-select logic"
```

---

### Task 10: Backend — Update MediaSettings API (PATCH Route + mapSettings)

**Files:**

- Modify: `apps/api/src/routes/library/libraryMediaAdmin.ts:35-63,77-142`

- [ ] **Step 1: Update mapSettings to include activeIndexerManager**

In `apps/api/src/routes/library/libraryMediaAdmin.ts`, update the `mapSettings` function (line 35) to add the new field:

```typescript
function mapSettings(row: {
  moviesLibraryPath: string | null;
  showsLibraryPath: string | null;
  fileOperation: string;
  movieTemplate: string;
  episodeTemplate: string;
  minSeedRatio: number;
  postProcessingEnabled: boolean;
  defaultQualityProfileId?: number | null;
  activeIndexerManager?: string | null;
  updatedAt: Date;
}) {
  return {
    movies_library_path: row.moviesLibraryPath,
    shows_library_path: row.showsLibraryPath,
    file_operation: row.fileOperation,
    movie_template: row.movieTemplate,
    episode_template: row.episodeTemplate,
    min_seed_ratio: row.minSeedRatio,
    post_processing_enabled: row.postProcessingEnabled,
    default_quality_profile_id: row.defaultQualityProfileId ?? null,
    active_indexer_manager: row.activeIndexerManager ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Update PATCH handler to accept active_indexer_manager**

In the PATCH handler's update object (around line 90), add:

```typescript
if (body.active_indexer_manager !== undefined) {
  if (
    body.active_indexer_manager !== null &&
    body.active_indexer_manager !== "prowlarr" &&
    body.active_indexer_manager !== "jackett"
  ) {
    return badRequest(
      set,
      "active_indexer_manager must be prowlarr, jackett, or null",
    );
  }
  update.activeIndexerManager = body.active_indexer_manager;
}
```

And add `activeIndexerManager?: string | null;` to the `update` type.

- [ ] **Step 3: Update PATCH body schema**

In the Elysia body schema for the PATCH route (around line 140), add:

```typescript
        active_indexer_manager: t.Optional(
          t.Union([
            t.Literal("prowlarr"),
            t.Literal("jackett"),
            t.Null(),
          ]),
        ),
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/library/libraryMediaAdmin.ts
git commit -m "feat: expose active_indexer_manager in media settings API"
```

---

### Task 11: Backend — Update mediaGrabber.ts to Use Adapter

**Files:**

- Modify: `apps/api/src/services/mediaGrabber.ts:429-561`

- [ ] **Step 1: Refactor searchAndGrab to use getActiveIndexerManager**

Replace the Prowlarr-specific code in `searchAndGrab` (starting at line 442 where it calls `getPluginConfigRecord("prowlarr")`) with the adapter factory. The key changes:

1. Replace `getPluginConfigRecord("prowlarr")` + `normalizeProwlarrConfig` with `getActiveIndexerManager()`
2. Replace the direct `fetch` to Prowlarr with `adapter.search()`
3. Keep the scoring, blocklist, and `grabRelease` logic intact

Update the imports at the top of the file to add:

```typescript
import { getActiveIndexerManager } from "@hously/api/services/indexerManager";
import type { NormalizedRelease } from "@hously/api/services/indexerManager";
```

Then replace the body of `searchAndGrab` from line 442 to the Prowlarr search logic (approximately lines 442-500) with:

```typescript
const adapter = await getActiveIndexerManager();
if (!adapter) {
  return { grabbed: false, reason: "No indexer manager configured" };
}

const releases = await adapter.search({
  query: qTrim,
  type: "freetext",
  limit: 100,
});

if (releases.length === 0) {
  return { grabbed: false, reason: "No matching releases found" };
}

const rows: CandidateRow[] = [];

let profileInput: QualityProfileScoreInput | null = null;
if (qualityProfileId != null) {
  const prof = await prisma.qualityProfile.findUnique({
    where: { id: qualityProfileId },
  });
  if (prof) profileInput = profileToScoreInput(prof);
}

for (const release of releases) {
  if (release.rejected) continue;
  const title = release.title;
  if (!title) continue;
  const downloadUrl = release.magnetUrl ?? release.downloadUrl;
  if (!downloadUrl) continue;
  const parsed = parseReleaseTitle(title);
  const size = release.sizeBytes;

  if (parsed.isSample) continue;

  if (profileInput) {
    const sc = scoreRelease(parsed, profileInput, size, title, release.indexer);
    if (sc === null) continue;
    rows.push({
      raw: { _downloadUrl: downloadUrl, _isMagnet: Boolean(release.magnetUrl) },
      parsed,
      score: sc,
      title,
      size,
    });
  } else {
    rows.push({
      raw: { _downloadUrl: downloadUrl, _isMagnet: Boolean(release.magnetUrl) },
      parsed,
      score: 0,
      title,
      size,
    });
  }
}
```

And update the download candidate loop to use the stored `_downloadUrl` instead of `extractProwlarrDownloadTarget`:

```typescript
for (const candidate of rows) {
  if (blocklistTitles.has(candidate.title.toLowerCase())) continue;

  const downloadUrl = candidate.raw._downloadUrl as string;
  if (!downloadUrl) continue;

  const result = await grabRelease({
    mediaId,
    episodeId,
    downloadUrl,
    releaseTitle: candidate.title,
    indexer: null, // indexer name from NormalizedRelease is already used in scoring
    qualityParsed: candidate.parsed,
  });

  if (result.grabbed) return result;
  if (!result.grabbed && result.reason.startsWith("Blocklisted:")) continue;
  return result;
}
```

Note: The `CandidateRow` type's `raw` field may need its type loosened from `Record<string, unknown>` since we're now storing `_downloadUrl` directly. Adjust the type if needed.

- [ ] **Step 2: Remove unused Prowlarr imports**

Remove the now-unused imports from mediaGrabber.ts:

```typescript
// Remove these:
import { getPluginConfigRecord } from "@hously/api/services/pluginConfigCache";
import { normalizeProwlarrConfig } from "@hously/api/utils/plugins/normalizers";
// Keep extractProwlarrDownloadTarget ONLY if prowlarrHeadersForTorrentUrl still uses it
```

- [ ] **Step 3: Verify it compiles**

Run:

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/mediaGrabber.ts
git commit -m "refactor: use IndexerManagerAdapter in mediaGrabber.searchAndGrab"
```

---

### Task 12: Backend — Update notifications utility

**Files:**

- Modify: `apps/shared/src/utils/notifications.ts:70`

- [ ] **Step 1: Add "jackett" to the notification normalization check**

At line 70 of `apps/shared/src/utils/notifications.ts`, update the condition:

```typescript
  if (normalized === "prowlarr" || normalized === "jackett" || normalized === "cross-seed") {
```

- [ ] **Step 2: Commit**

```bash
git add apps/shared/src/utils/notifications.ts
git commit -m "fix: include jackett in notification normalization"
```

---

### Task 13: Backend — Delete Old Prowlarr Media Routes

**Files:**

- Delete: `apps/api/src/routes/medias/prowlarr/index.ts`

- [ ] **Step 1: Delete the old Prowlarr media routes file**

```bash
rm apps/api/src/routes/medias/prowlarr/index.ts
rmdir apps/api/src/routes/medias/prowlarr/
```

The route composition in `apps/api/src/routes/medias/index.ts` was already updated in Task 8 to use `mediasSearchRoutes` instead of `mediasProwlarrRoutes`.

- [ ] **Step 2: Verify no dangling imports**

Run:

```bash
grep -rn "mediasProwlarrRoutes\|medias/prowlarr" /home/samuelloranger/sites/hously/apps/api/src/ | grep -v node_modules
```

Expected: No results. If there are, fix the imports.

- [ ] **Step 3: Verify it compiles**

Run:

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/api/src/routes/medias/prowlarr/
git commit -m "refactor: remove old Prowlarr-specific media routes (replaced by generic search routes)"
```

---

### Task 14: Frontend — Update Endpoints and Query Keys

**Files:**

- Modify: `apps/web/src/lib/endpoints/medias.ts:22-25`
- Modify: `apps/web/src/lib/endpoints/plugins.ts:8`
- Modify: `apps/web/src/lib/queryKeys.ts:128,179-191,348-350`

- [ ] **Step 1: Update media endpoints to generic paths**

In `apps/web/src/lib/endpoints/medias.ts`, replace the Prowlarr-specific endpoints:

```typescript
  // Replace these:
  // PROWLARR_INTERACTIVE_SEARCH: "/api/medias/prowlarr/interactive-search",
  // PROWLARR_INTERACTIVE_SEARCH_DOWNLOAD: "/api/medias/prowlarr/interactive-search/download",
  // PROWLARR_INDEXERS: "/api/medias/prowlarr/indexers",

  // With:
  INTERACTIVE_SEARCH: "/api/medias/interactive-search",
  INTERACTIVE_SEARCH_DOWNLOAD: "/api/medias/interactive-search/download",
  INDEXERS: "/api/medias/indexers",
```

- [ ] **Step 2: Add Jackett plugin endpoint**

In `apps/web/src/lib/endpoints/plugins.ts`, add after the PROWLARR line:

```typescript
  JACKETT: "/api/plugins/jackett",
```

- [ ] **Step 3: Update query keys**

In `apps/web/src/lib/queryKeys.ts`:

1. Add `jackett` to the plugins section (near line 128):

```typescript
    jackett: () => [...queryKeys.plugins.all, "jackett"] as const,
```

2. Rename `prowlarrInteractiveSearch` to `interactiveSearch` (around line 179):

```typescript
    interactiveSearch: (
      query: string,
      libraryMediaId?: number | null,
      season?: number | "complete" | null,
    ) =>
      [
        ...queryKeys.medias.all,
        "interactive-search",
        query,
        libraryMediaId ?? null,
        season ?? null,
      ] as const,
```

3. Rename `prowlarr` namespace to `indexerManager` (around line 348):

```typescript
  indexerManager: {
    all: ["indexer-manager"] as const,
    indexers: () => [...queryKeys.indexerManager.all, "indexers"] as const,
  },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/endpoints/medias.ts apps/web/src/lib/endpoints/plugins.ts apps/web/src/lib/queryKeys.ts
git commit -m "feat: update endpoints and query keys for generic indexer manager"
```

---

### Task 15: Frontend — Update Hooks (usePlugins, useQualityProfiles, useMedias)

**Files:**

- Modify: `apps/web/src/pages/settings/usePlugins.ts:110-119,258-275`
- Modify: `apps/web/src/pages/settings/useQualityProfiles.ts:113-122`
- Modify: `apps/web/src/features/medias/hooks/useMedias.ts:78-100`

- [ ] **Step 1: Add Jackett hooks to usePlugins.ts**

In `apps/web/src/pages/settings/usePlugins.ts`, add:

1. Import `JackettPlugin` and `JackettPluginUpdateResponse` from `@hously/shared/types`
2. Add fetch hook (after `useProwlarrPlugin`):

```typescript
export function useJackettPlugin() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.plugins.jackett(),
    queryFn: () => fetcher<{ plugin: JackettPlugin }>(PLUGIN_ENDPOINTS.JACKETT),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
```

3. Add mutation hook (after `useUpdateProwlarrPlugin`):

```typescript
export function useUpdateJackettPlugin() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key: string;
      enabled: boolean;
    }) =>
      fetcher<JackettPluginUpdateResponse>(PLUGIN_ENDPOINTS.JACKETT, {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.jackett() });
    },
  });
}
```

- [ ] **Step 2: Rename useProwlarrIndexers to useIndexers**

In `apps/web/src/pages/settings/useQualityProfiles.ts`, rename and update:

```typescript
export function useIndexers(enabled: boolean) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.indexerManager.indexers(),
    queryFn: () => fetcher<ProwlarrIndexersResponse>(MEDIAS_ENDPOINTS.INDEXERS),
    enabled,
    staleTime: 60_000,
  });
}
```

Note: The response type `ProwlarrIndexersResponse` still works since the shape is identical. Optionally rename it later.

- [ ] **Step 3: Update useMedias interactive search hook**

In `apps/web/src/features/medias/hooks/useMedias.ts`, update the query key and endpoint references:

```typescript
    queryKey: queryKeys.medias.interactiveSearch(
      trimmed,
      libId,
      season,
    ),
    queryFn: () =>
      fetcher<MediaInteractiveSearchResponse>(
        MEDIAS_ENDPOINTS.INTERACTIVE_SEARCH,
        {
```

- [ ] **Step 4: Find and update all references to old names**

Run:

```bash
grep -rn "PROWLARR_INTERACTIVE_SEARCH\|PROWLARR_INDEXERS\|prowlarrInteractiveSearch\|useProwlarrIndexers\|queryKeys.prowlarr" /home/samuelloranger/sites/hously/apps/web/src/ | grep -v node_modules
```

Update each reference to use the new names (`INTERACTIVE_SEARCH`, `INDEXERS`, `interactiveSearch`, `useIndexers`, `queryKeys.indexerManager`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/settings/usePlugins.ts apps/web/src/pages/settings/useQualityProfiles.ts apps/web/src/features/medias/hooks/useMedias.ts
git commit -m "feat: add Jackett hooks, rename indexer hooks to be adapter-agnostic"
```

---

### Task 16: Frontend — JackettPluginSection Component

**Files:**

- Create: `apps/web/src/pages/settings/_component/plugins/JackettPluginSection.tsx`

- [ ] **Step 1: Create JackettPluginSection**

Create `apps/web/src/pages/settings/_component/plugins/JackettPluginSection.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useJackettPlugin,
  useUpdateJackettPlugin,
} from "@/pages/settings/usePlugins";
import { toast } from "sonner";
import { PluginSectionCard } from "@/pages/settings/_component/plugins/PluginSectionCard";
import { PluginUrlInput } from "@/pages/settings/_component/plugins/PluginUrlInput";

export function JackettPluginSection() {
  const { data, isLoading } = useJackettPlugin();
  return (
    <JackettPluginSectionImpl
      key={data?.plugin?.type ?? "pending"}
      data={data}
      isLoading={isLoading}
    />
  );
}

function JackettPluginSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useJackettPlugin>["data"];
  isLoading: boolean;
}) {
  const { t } = useTranslation("common");
  const saveMutation = useUpdateJackettPlugin();

  const [websiteUrl, setWebsiteUrl] = useState(data?.plugin?.website_url || "");
  const [apiKey, setApiKey] = useState(data?.plugin?.api_key || "");
  const [enabled, setEnabled] = useState(Boolean(data?.plugin?.enabled));

  const isDirty = useMemo(() => {
    if (!data?.plugin) return false;
    return (
      websiteUrl !== (data.plugin.website_url || "") ||
      apiKey !== (data.plugin.api_key || "") ||
      enabled !== Boolean(data.plugin.enabled)
    );
  }, [apiKey, data, enabled, websiteUrl]);

  const handleCancel = () => {
    setWebsiteUrl(data?.plugin.website_url || "");
    setApiKey(data?.plugin.api_key || "");
    setEnabled(Boolean(data?.plugin.enabled));
  };

  const handleSave = () => {
    saveMutation
      .mutateAsync({
        website_url: websiteUrl,
        api_key: apiKey,
        enabled,
      })
      .then(() => toast.success(t("settings.plugins.saveSuccess")))
      .catch(() => toast.error(t("settings.plugins.saveError")));
  };

  return (
    <PluginSectionCard
      title="Jackett"
      description={t("settings.plugins.jackett.help")}
      enabled={enabled}
      onEnabledChange={setEnabled}
      onCancel={handleCancel}
      onSave={handleSave}
      loading={isLoading}
      saving={saveMutation.isPending}
      isDirty={isDirty}
      logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/jackett.png"
    >
      <PluginUrlInput
        label={t("settings.plugins.jackett.websiteUrl")}
        value={websiteUrl}
        onChange={setWebsiteUrl}
        placeholder="https://jackett.example.com"
      />

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("settings.plugins.jackett.apiKey")}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t("settings.plugins.jackett.apiKeyPlaceholder")}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 font-mono text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
        />
      </div>
    </PluginSectionCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/settings/_component/plugins/JackettPluginSection.tsx
git commit -m "feat: add JackettPluginSection settings component"
```

---

### Task 17: Frontend — Add Jackett to Plugins Tab and Group Under "Indexers"

**Files:**

- Modify: The plugins tab component that renders `ProwlarrPluginSection`

- [ ] **Step 1: Find and update the plugins tab**

Find where `ProwlarrPluginSection` is rendered:

```bash
grep -rn "ProwlarrPluginSection" /home/samuelloranger/sites/hously/apps/web/src/ | grep -v node_modules
```

In the file that imports and renders `<ProwlarrPluginSection />`, add:

1. Import `JackettPluginSection`:

```typescript
import { JackettPluginSection } from "@/pages/settings/_component/plugins/JackettPluginSection";
```

2. Group Prowlarr and Jackett under an "Indexers" heading. Add a heading before `ProwlarrPluginSection` and render `JackettPluginSection` right after it:

```tsx
<h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
  {t("settings.plugins.indexers")}
</h3>
<ProwlarrPluginSection />
<JackettPluginSection />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/settings/
git commit -m "feat: group Prowlarr and Jackett under Indexers heading in plugins tab"
```

---

### Task 18: Frontend — Active Indexer Picker in Media Library Settings

**Files:**

- Modify: `apps/web/src/pages/settings/_component/MediaPostProcessingSettingsBody.tsx`

- [ ] **Step 1: Add active indexer state and dropdown**

In `MediaPostProcessingSettingsBody.tsx`:

1. Add state for the active indexer:

```typescript
const [activeIndexerManager, setActiveIndexerManager] = useState<string | null>(
  settings.active_indexer_manager,
);
```

2. Import the plugin hooks:

```typescript
import {
  useProwlarrPlugin,
  useJackettPlugin,
} from "@/pages/settings/usePlugins";
```

3. Fetch enabled status:

```typescript
const { data: prowlarrData } = useProwlarrPlugin();
const { data: jackettData } = useJackettPlugin();
const prowlarrEnabled = Boolean(prowlarrData?.plugin?.enabled);
const jackettEnabled = Boolean(jackettData?.plugin?.enabled);
const indexerOptions = [
  ...(prowlarrEnabled ? [{ value: "prowlarr", label: "Prowlarr" }] : []),
  ...(jackettEnabled ? [{ value: "jackett", label: "Jackett" }] : []),
];
```

4. Add a dropdown in the JSX (before or near the quality profile selector):

```tsx
<div>
  <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
    {t("settings.mediaLibrary.activeIndexerManager")}
  </label>
  {indexerOptions.length === 0 ? (
    <p className="text-sm text-neutral-500 dark:text-neutral-400">
      {t("settings.mediaLibrary.noIndexerConfigured")}
    </p>
  ) : (
    <select
      value={activeIndexerManager ?? ""}
      onChange={(e) => setActiveIndexerManager(e.target.value || null)}
      className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2 text-neutral-900 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white"
    >
      <option value="">{t("settings.mediaLibrary.noIndexerSelected")}</option>
      {indexerOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )}
</div>
```

5. Include `active_indexer_manager` in the save payload (find where `updateMut.mutateAsync` is called and add the field):

```typescript
active_indexer_manager: activeIndexerManager,
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/settings/_component/MediaPostProcessingSettingsBody.tsx
git commit -m "feat: add active indexer manager picker to media library settings"
```

---

### Task 19: Frontend — i18n Keys

**Files:**

- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Add English i18n keys**

In `apps/web/src/locales/en/common.json`:

1. In `settings.plugins`, add `"indexers"` heading key:

```json
"indexers": "Indexers"
```

2. Add `jackett` section (next to `prowlarr`):

```json
"jackett": {
  "help": "Connect Jackett to run global release searches across your configured indexers.",
  "websiteUrl": "Jackett URL",
  "apiKey": "Jackett API Key",
  "apiKeyPlaceholder": "Paste your Jackett API key"
}
```

3. In `settings.mediaLibrary`, add:

```json
"activeIndexerManager": "Indexer Manager",
"noIndexerConfigured": "No indexer manager configured. Enable Prowlarr or Jackett in Plugins settings.",
"noIndexerSelected": "None selected"
```

- [ ] **Step 2: Add French i18n keys**

In `apps/web/src/locales/fr/common.json`:

1. In `settings.plugins`, add:

```json
"indexers": "Indexeurs"
```

2. Add `jackett` section:

```json
"jackett": {
  "help": "Connectez Jackett pour effectuer des recherches globales de releases sur vos indexeurs configurés.",
  "websiteUrl": "URL de Jackett",
  "apiKey": "Clé API Jackett",
  "apiKeyPlaceholder": "Collez votre clé API Jackett"
}
```

3. In `settings.mediaLibrary`, add:

```json
"activeIndexerManager": "Gestionnaire d'indexeurs",
"noIndexerConfigured": "Aucun gestionnaire d'indexeurs configuré. Activez Prowlarr ou Jackett dans les paramètres des Plugins.",
"noIndexerSelected": "Aucune sélection"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "feat: add Jackett and indexer manager i18n keys (en + fr)"
```

---

### Task 20: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Verify backend compiles**

```bash
cd /home/samuelloranger/sites/hously/apps/api && bunx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors.

- [ ] **Step 2: Verify frontend compiles**

```bash
cd /home/samuelloranger/sites/hously && make typecheck
```

Expected: No errors.

- [ ] **Step 3: Verify no dangling references to old Prowlarr endpoints**

```bash
grep -rn "PROWLARR_INTERACTIVE_SEARCH\|PROWLARR_INDEXERS\|/medias/prowlarr/" /home/samuelloranger/sites/hously/apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts"
```

Expected: No results (all references should be updated to generic names).

- [ ] **Step 4: Verify no broken imports**

```bash
grep -rn "from.*prowlarr/index\|from.*medias/prowlarr" /home/samuelloranger/sites/hously/apps/api/src/ | grep -v node_modules
```

Expected: No results (the old prowlarr media routes directory was deleted).

- [ ] **Step 5: Start dev server and manually test**

```bash
cd /home/samuelloranger/sites/hously && make dev-api &
cd /home/samuelloranger/sites/hously && make dev-web &
```

Test:

1. Open Settings → Plugins → verify Prowlarr and Jackett sections appear under "Indexers" heading
2. Configure Prowlarr (if available) → verify auto-select sets it as active
3. Open Settings → Media Library → verify "Indexer Manager" dropdown shows enabled indexers
4. Run an interactive search → verify results come back
5. Test the indexers endpoint → verify quality profile tracker picker works

- [ ] **Step 6: Build check**

```bash
cd /home/samuelloranger/sites/hously && make build
```

Expected: Build succeeds.
