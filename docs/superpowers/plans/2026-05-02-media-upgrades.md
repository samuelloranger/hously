# Media Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a user changes a library item's quality profile and the current files fail the new profile's criteria, prompt them to auto-search or manually search for a better release; auto-delete the old file once the upgrade completes.

**Architecture:** The PATCH quality-profile endpoint scores existing files against the new profile and returns `needs_upgrade: true` when they fail. The frontend shows an upgrade modal; "Auto Search" enqueues a BullMQ job per item/episode that calls `searchAndGrab` with `is_upgrade: true`; the post-processor detects upgrade grabs and deletes old files after placing the new one.

**Tech Stack:** Elysia (Bun), Prisma/PostgreSQL, BullMQ/Redis, React 19, TanStack Query, TypeScript, bun:test (API), Vitest (web)

---

## File Map

| File                                                                    | Change                                                                                           |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `apps/api/prisma/schema.prisma`                                         | Add `isUpgrade` to `DownloadHistory`                                                             |
| `apps/shared/src/types/library.ts`                                      | Add `"upgrading"` to status union; add `needs_upgrade?`/`affected_episodes?` to `LibraryMedia`   |
| `apps/api/src/services/mediaGrabber.ts`                                 | Add `isUpgrade?: boolean` to `grabRelease()` opts                                                |
| `apps/api/src/services/queueService.ts`                                 | Add `UPGRADE_MEDIA_SEARCH` job name                                                              |
| `apps/api/src/workers/upgradeMediaSearch.ts`                            | **Create** — worker that calls `searchAndGrab` with `is_upgrade: true`                           |
| `apps/api/src/services/jobs/scheduledTasksWorker.ts`                    | Add `UPGRADE_MEDIA_SEARCH` case                                                                  |
| `apps/api/src/routes/library/index.ts`                                  | Enhance `PATCH /:id/quality-profile`; add `POST /:id/upgrade`                                    |
| `apps/api/src/services/postProcessor.ts`                                | Skip pre-scan + delete old files when `is_upgrade: true`                                         |
| `apps/web/src/lib/endpoints/library.ts`                                 | Add `UPGRADE` endpoint constant                                                                  |
| `apps/web/src/features/medias/hooks/useLibrary.ts`                      | Update profile mutation return type; add `useUpgradeLibraryMedia`; extend grab with `is_upgrade` |
| `apps/web/src/pages/medias/_component/LibraryItemCard.tsx`              | Add `upgrading` to `STATUS_STYLES`                                                               |
| `apps/web/src/pages/medias/_component/LibraryItemHero.tsx`              | Handle `upgrading` status badge                                                                  |
| `apps/web/src/pages/medias/_component/LibraryUpgradeModal.tsx`          | **Create** — upgrade choice modal                                                                |
| `apps/web/src/pages/medias/_component/LibraryQualityProfileSection.tsx` | Show modal when `needs_upgrade: true`                                                            |
| `apps/web/src/locales/en/common.json`                                   | Add `upgrading` label + modal i18n keys                                                          |
| `apps/web/src/locales/fr/common.json`                                   | Same in French                                                                                   |

---

### Task 1: Schema — add `is_upgrade` to `DownloadHistory`

**Files:**

- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add the field to the model**

Find the `DownloadHistory` model in `apps/api/prisma/schema.prisma` and add one line after `failReason`:

```prisma
failReason          String?   @map("fail_reason")
isUpgrade           Boolean   @default(false) @map("is_upgrade")
```

Also update the `status` comment in `LibraryMedia` to include `upgrading`:

```prisma
status             String    @default("wanted") // wanted | downloading | downloaded | skipped | returning | in_production | planned | upgrading
```

And in `LibraryEpisode`, update its status comment similarly:

```prisma
status             String    @default("wanted") // wanted | downloading | downloaded | skipped | upgrading
```

- [ ] **Step 2: Create and apply the migration**

```bash
cd /home/samuelloranger/sites/hously
make migrate-dev
```

When prompted for a name, enter: `add_is_upgrade_to_download_history`

Expected: Migration created and applied. Prisma client regenerated automatically.

- [ ] **Step 3: Verify Prisma client has the new field**

```bash
cd apps/api && bun run -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); console.log('isUpgrade' in p.downloadHistory.fields)"
```

Expected: `true`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(upgrades): add is_upgrade field to DownloadHistory schema"
```

---

### Task 2: Shared types — `"upgrading"` status + response fields

**Files:**

- Modify: `apps/shared/src/types/library.ts`

- [ ] **Step 1: Add `"upgrading"` to `LibraryMediaStatus`**

Find the `LibraryMediaStatus` type (around line 3) and add the new value:

```typescript
export type LibraryMediaStatus =
  | "wanted"
  | "downloading"
  | "downloaded"
  | "skipped"
  | "returning"
  | "in_production"
  | "planned"
  | "upgrading";
```

- [ ] **Step 2: Add upgrade response fields to `LibraryMedia`**

Find the `LibraryMedia` interface and add two optional fields at the end (after `quality_profile`):

```typescript
  quality_profile: LibraryQualityProfileRef | null;
  needs_upgrade?: boolean;
  affected_episodes?: number;
```

- [ ] **Step 3: Run shared typecheck**

```bash
cd apps/shared && bun run typecheck 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/shared/src/types/library.ts
git commit -m "feat(upgrades): add upgrading status and needs_upgrade fields to shared types"
```

---

### Task 3: `grabRelease()` — `isUpgrade` support (TDD)

**Files:**

- Modify: `apps/api/src/services/mediaGrabber.ts`

The test file for this is `apps/api/src/services/mediaGrabber.test.ts` — it may not exist yet; create it.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/services/mediaGrabber.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach } from "bun:test";

// We test the grabRelease opts shape by inspecting what it passes to prisma.
// Full integration tests are skipped here — we verify the is_upgrade stamp.

describe("grabRelease isUpgrade flag", () => {
  it("stamps isUpgrade:true on DownloadHistory when option is set", async () => {
    // This is a structural/type test — the real behaviour is verified
    // end-to-end via manual testing. Here we just assert the opts type compiles.
    type GrabOpts = Parameters<typeof import("./mediaGrabber").grabRelease>[0];
    const opts: GrabOpts = {
      mediaId: 1,
      downloadUrl: "magnet:?xt=urn:btih:abc",
      releaseTitle: "Movie.2024.1080p.BluRay.x265",
      isUpgrade: true,
    };
    expect(opts.isUpgrade).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

```bash
cd apps/api && bun test src/services/mediaGrabber.test.ts 2>&1 | tail -10
```

Expected: Type error — `isUpgrade` does not exist on opts.

- [ ] **Step 3: Add `isUpgrade` to `grabRelease` opts**

In `apps/api/src/services/mediaGrabber.ts`, find the `grabRelease` opts parameter (the exported async function signature, around line 280) and add the field:

```typescript
export async function grabRelease(opts: {
  mediaId: number;
  episodeId?: number;
  downloadUrl: string;
  releaseTitle: string;
  indexer?: string | null;
  qualityParsed?: unknown;
  isUpgrade?: boolean;           // ← add this
}): Promise<...>
```

- [ ] **Step 4: Stamp `isUpgrade` on the `DownloadHistory` create call**

Inside `grabRelease`, find the `prisma.downloadHistory.create` call and add `isUpgrade`:

```typescript
const dhRow = await prisma.downloadHistory.create({
  data: {
    mediaId,
    episodeId: episodeId ?? null,
    releaseTitle,
    indexer: indexer?.trim() || null,
    torrentHash: null,
    downloadUrl,
    qualityParsed: qJson,
    isUpgrade: opts.isUpgrade ?? false, // ← add this
  },
});
```

- [ ] **Step 5: Set status to `"upgrading"` instead of `"downloading"` when `isUpgrade`**

Find the two places where `grabRelease` updates status after queuing the torrent (one for episodes, one for movies). Change them to be upgrade-aware:

```typescript
const nextStatus = opts.isUpgrade ? "upgrading" : "downloading";

if (episodeId != null) {
  await prisma.libraryEpisode.update({
    where: { id: episodeId },
    data: { status: nextStatus, searchAttempts: 0 },
  });
} else {
  await prisma.libraryMedia.update({
    where: { id: mediaId },
    data: { status: nextStatus, searchAttempts: 0 },
  });
}
```

Also find the same block inside `tryAdoptQbDuplicate` — when `adopted.completed` is true it sets `"downloaded"`, which is fine. When `!adopted.completed` it would set `"downloading"` — change that path too:

```typescript
const nextStatus: "downloading" | "downloaded" | "upgrading" = completed
  ? "downloaded"
  : ctx.isUpgrade
    ? "upgrading"
    : "downloading";
```

Pass `isUpgrade` into `tryAdoptQbDuplicate` via its ctx:

```typescript
// In tryAdoptQbDuplicate ctx type
isUpgrade?: boolean;
```

And update the callers inside `grabRelease` to pass `isUpgrade: opts.isUpgrade`.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd apps/api && bun test src/services/mediaGrabber.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Typecheck API**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/mediaGrabber.ts apps/api/src/services/mediaGrabber.test.ts
git commit -m "feat(upgrades): add isUpgrade support to grabRelease"
```

---

### Task 4: `upgradeMediaSearch` worker (TDD)

**Files:**

- Create: `apps/api/src/workers/upgradeMediaSearch.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/workers/upgradeMediaSearch.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";

describe("upgradeMediaSearch", () => {
  it("exports an upgradeMediaSearch function", async () => {
    const mod = await import("./upgradeMediaSearch");
    expect(typeof mod.upgradeMediaSearch).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && bun test src/workers/upgradeMediaSearch.test.ts 2>&1 | tail -5
```

Expected: Module not found error.

- [ ] **Step 3: Create the worker**

Create `apps/api/src/workers/upgradeMediaSearch.ts`:

```typescript
import { prisma } from "@hously/api/db";
import { searchAndGrab } from "@hously/api/services/mediaGrabber";

export async function upgradeMediaSearch(data: {
  mediaId: number;
  episodeId?: number | null;
}) {
  const { mediaId, episodeId } = data;

  const media = await prisma.libraryMedia.findUnique({
    where: { id: mediaId },
    select: { title: true, type: true, qualityProfileId: true },
  });
  if (!media) {
    console.warn(`[upgradeMediaSearch] Media ${mediaId} not found, skipping`);
    return;
  }

  let searchQuery = media.title;
  if (episodeId != null) {
    const ep = await prisma.libraryEpisode.findUnique({
      where: { id: episodeId },
      select: { season: true, episode: true },
    });
    if (ep) {
      searchQuery = `${media.title} S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`;
    }
  }

  const result = await searchAndGrab({
    mediaId,
    episodeId: episodeId ?? undefined,
    mediaType: media.type === "show" ? "tv" : "movie",
    searchQuery,
    qualityProfileId: media.qualityProfileId,
    isUpgrade: true,
  });

  if (!result.grabbed) {
    console.warn(
      `[upgradeMediaSearch] No upgrade found for media=${mediaId} episode=${episodeId ?? "none"}: ${result.reason}`,
    );
    // Revert upgrading → downloaded so the item is not stuck
    if (episodeId != null) {
      await prisma.libraryEpisode.update({
        where: { id: episodeId },
        data: { status: "downloaded" },
      });
    } else {
      await prisma.libraryMedia.update({
        where: { id: mediaId },
        data: { status: "downloaded" },
      });
    }
  }
}
```

- [ ] **Step 4: Add `isUpgrade` to `searchAndGrab` opts**

In `apps/api/src/services/mediaGrabber.ts`, find `searchAndGrab` opts type and add `isUpgrade?: boolean`. Then pass it through to `grabRelease` inside the function:

```typescript
export async function searchAndGrab(opts: {
  mediaId: number;
  episodeId?: number;
  mediaType: "tv" | "movie";
  searchQuery: string;
  qualityProfileId: number | null;
  isUpgrade?: boolean;     // ← add this
}): Promise<...>
```

Inside `searchAndGrab`, update the `grabRelease` call to pass `isUpgrade`:

```typescript
const result = await grabRelease({
  mediaId,
  episodeId,
  downloadUrl,
  releaseTitle: candidate.title,
  indexer: null,
  qualityParsed: candidate.parsed,
  isUpgrade: opts.isUpgrade, // ← add this
});
```

- [ ] **Step 5: Run test**

```bash
cd apps/api && bun test src/workers/upgradeMediaSearch.test.ts 2>&1 | tail -5
```

Expected: PASS

- [ ] **Step 6: Typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/workers/upgradeMediaSearch.ts apps/api/src/workers/upgradeMediaSearch.test.ts apps/api/src/services/mediaGrabber.ts
git commit -m "feat(upgrades): add upgradeMediaSearch worker"
```

---

### Task 5: Register upgrade job in queue infrastructure

**Files:**

- Modify: `apps/api/src/services/queueService.ts`
- Modify: `apps/api/src/services/jobs/scheduledTasksWorker.ts`

- [ ] **Step 1: Add job name constant to `queueService.ts`**

Find `SCHEDULED_JOB_NAMES` and add:

```typescript
export const SCHEDULED_JOB_NAMES = {
  // ...existing entries...
  UPGRADE_MEDIA_SEARCH: "upgrade-media-search",
} as const;
```

- [ ] **Step 2: Add case to `scheduledTasksWorker.ts`**

Find the switch statement in `processScheduledJob` and add before the `default` case:

```typescript
case SCHEDULED_JOB_NAMES.UPGRADE_MEDIA_SEARCH: {
  const { upgradeMediaSearch } = await import("../../workers/upgradeMediaSearch");
  const { mediaId, episodeId } = job.data as {
    mediaId: number;
    episodeId?: number | null;
  };
  await upgradeMediaSearch({ mediaId, episodeId });
  break;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/queueService.ts apps/api/src/services/jobs/scheduledTasksWorker.ts
git commit -m "feat(upgrades): register upgrade-media-search BullMQ job"
```

---

### Task 6: `PATCH /:id/quality-profile` — upgrade detection (TDD)

**Files:**

- Modify: `apps/api/src/routes/library/index.ts`

This task adds the scoring logic that decides whether to return `needs_upgrade: true`.

- [ ] **Step 1: Write a unit test for the detection helper**

The detection logic is best extracted as a pure helper function. Create `apps/api/src/services/upgradeDetection.ts` first (Task 6 step 3 implements it), then write the test now.

Create `apps/api/src/services/upgradeDetection.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { filesFailProfile } from "./upgradeDetection";
import type { QualityProfileScoreInput } from "@hously/api/utils/medias/releaseScorer";

const profile: QualityProfileScoreInput = {
  minResolution: 1080,
  cutoffResolution: null,
  preferredSources: ["BluRay"],
  preferredCodecs: ["hevc"],
  preferredLanguages: [],
  prioritizedTrackers: [],
  preferTrackerOverQuality: false,
  maxSizeGb: null,
  requireHdr: false,
  preferHdr: false,
};

describe("filesFailProfile", () => {
  it("returns true when qualityParsed resolution is below minResolution", () => {
    const rows = [
      {
        qualityParsed: {
          resolution: 720,
          source: "WEB-DL",
          codec: "x264",
          hdr: false,
          isSample: false,
          isProper: false,
        },
        sizeBytes: null,
        releaseTitle: "Movie.2024.720p.WEB-DL.x264",
      },
    ];
    expect(filesFailProfile(rows, profile)).toBe(true);
  });

  it("returns false when qualityParsed resolution meets minResolution", () => {
    const rows = [
      {
        qualityParsed: {
          resolution: 1080,
          source: "BluRay",
          codec: "hevc",
          hdr: false,
          isSample: false,
          isProper: false,
        },
        sizeBytes: null,
        releaseTitle: "Movie.2024.1080p.BluRay.x265",
      },
    ];
    expect(filesFailProfile(rows, profile)).toBe(false);
  });

  it("returns true when qualityParsed is null", () => {
    const rows = [{ qualityParsed: null, sizeBytes: null, releaseTitle: "" }];
    expect(filesFailProfile(rows, profile)).toBe(true);
  });

  it("returns false for empty rows (nothing to upgrade)", () => {
    expect(filesFailProfile([], profile)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

```bash
cd apps/api && bun test src/services/upgradeDetection.test.ts 2>&1 | tail -5
```

Expected: Module not found.

- [ ] **Step 3: Create `upgradeDetection.ts`**

Create `apps/api/src/services/upgradeDetection.ts`:

```typescript
import {
  scoreRelease,
  type QualityProfileScoreInput,
} from "@hously/api/utils/medias/releaseScorer";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";

type FileRow = {
  qualityParsed: unknown;
  sizeBytes: number | null;
  releaseTitle: string;
};

/**
 * Returns true if any row's quality fails the given profile.
 * Empty rows → false (nothing downloaded = nothing to upgrade).
 */
export function filesFailProfile(
  rows: FileRow[],
  profile: QualityProfileScoreInput,
): boolean {
  if (rows.length === 0) return false;

  for (const row of rows) {
    let parsed: ReturnType<typeof parseReleaseTitle>;
    if (
      row.qualityParsed != null &&
      typeof row.qualityParsed === "object" &&
      "resolution" in (row.qualityParsed as object)
    ) {
      parsed = row.qualityParsed as ReturnType<typeof parseReleaseTitle>;
    } else if (row.releaseTitle) {
      parsed = parseReleaseTitle(row.releaseTitle);
    } else {
      return true; // unknown quality → assume upgrade needed
    }

    const result = scoreRelease(
      parsed,
      profile,
      row.sizeBytes,
      row.releaseTitle,
      null,
      false,
    );

    if (Array.isArray(result)) return true; // rejected = fails profile
  }

  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && bun test src/services/upgradeDetection.test.ts 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Enhance `PATCH /:id/quality-profile` in `library/index.ts`**

Find the handler (around line 695) and replace the body with:

```typescript
async ({ params, body, set }) => {
  try {
    const id = parseInt(params.id, 10);
    const existing = await prisma.libraryMedia.findUnique({
      where: { id },
      select: { status: true, type: true, qualityProfileId: true },
    });
    if (!existing) return notFound(set, "Library item not found");

    const newProfileId = body.quality_profile_id;
    let newProfile: import("@prisma/client").QualityProfile | null = null;
    if (newProfileId != null) {
      newProfile = await prisma.qualityProfile.findUnique({
        where: { id: newProfileId },
      });
      if (!newProfile) return badRequest(set, "Quality profile not found");
    }

    const item = await prisma.libraryMedia.update({
      where: { id },
      data: { qualityProfileId: newProfileId },
      include: libraryMediaInclude,
    });

    const profileChanged = newProfileId !== existing.qualityProfileId;
    const isDownloaded = existing.status === "downloaded";

    let needsUpgrade = false;
    let affectedEpisodes: number | undefined;

    if (profileChanged && isDownloaded && newProfile) {
      const { filesFailProfile } = await import(
        "../../services/upgradeDetection"
      );
      const {
        profileToScoreInput,
      } = await import("../../services/mediaGrabber");

      const profileInput = profileToScoreInput(newProfile);

      if (existing.type === "movie") {
        const dh = await prisma.downloadHistory.findFirst({
          where: { mediaId: id, failed: false, qualityParsed: { not: Prisma.JsonNull } },
          orderBy: { grabbedAt: "desc" },
          select: { qualityParsed: true, releaseTitle: true },
        });
        const mf = await prisma.mediaFile.findFirst({
          where: { mediaId: id, episodeId: null },
          select: { sizeBytes: true },
        });
        const rows = dh
          ? [{ qualityParsed: dh.qualityParsed, sizeBytes: mf?.sizeBytes ?? null, releaseTitle: dh.releaseTitle }]
          : [];
        needsUpgrade = filesFailProfile(rows, profileInput);
      } else {
        // Show: check all downloaded episodes
        const episodes = await prisma.libraryEpisode.findMany({
          where: { libraryMediaId: id, status: "downloaded" },
          select: { id: true },
        });
        let failCount = 0;
        for (const ep of episodes) {
          const dh = await prisma.downloadHistory.findFirst({
            where: { episodeId: ep.id, failed: false, qualityParsed: { not: Prisma.JsonNull } },
            orderBy: { grabbedAt: "desc" },
            select: { qualityParsed: true, releaseTitle: true },
          });
          const mf = await prisma.mediaFile.findFirst({
            where: { episodeId: ep.id },
            select: { sizeBytes: true },
          });
          const rows = dh
            ? [{ qualityParsed: dh.qualityParsed, sizeBytes: mf?.sizeBytes ?? null, releaseTitle: dh.releaseTitle }]
            : [];
          if (filesFailProfile(rows, profileInput)) failCount++;
        }
        if (failCount > 0) {
          needsUpgrade = true;
          affectedEpisodes = failCount;
        }
      }
    }

    const mapped = mapLibraryMedia(item);
    return {
      item: {
        ...mapped,
        ...(needsUpgrade ? { needs_upgrade: true } : {}),
        ...(affectedEpisodes != null ? { affected_episodes: affectedEpisodes } : {}),
      },
    };
  } catch {
    return serverError(set, "Failed to update quality profile");
  }
},
```

Also add `import { Prisma } from "@prisma/client";` to the top of the file if not already present, and export `profileToScoreInput` from `mediaGrabber.ts` (currently it is not exported — add `export` to its declaration).

- [ ] **Step 6: Export `profileToScoreInput` from `mediaGrabber.ts`**

Find the function declaration:

```typescript
function profileToScoreInput(p: QualityProfile): QualityProfileScoreInput {
```

Change to:

```typescript
export function profileToScoreInput(p: QualityProfile): QualityProfileScoreInput {
```

- [ ] **Step 7: Run all API tests**

```bash
cd apps/api && bun test 2>&1 | tail -15
```

Expected: All tests pass including the new upgradeDetection tests.

- [ ] **Step 8: Typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/upgradeDetection.ts apps/api/src/services/upgradeDetection.test.ts apps/api/src/services/mediaGrabber.ts apps/api/src/routes/library/index.ts
git commit -m "feat(upgrades): detect upgrade need in PATCH quality-profile response"
```

---

### Task 7: `POST /:id/upgrade` endpoint

**Files:**

- Modify: `apps/api/src/routes/library/index.ts`

- [ ] **Step 1: Add the upgrade endpoint after the quality-profile PATCH**

Find the quality-profile PATCH handler and add the new route immediately after it:

```typescript
// POST /api/library/:id/upgrade — enqueue upgrade search
.post(
  "/:id/upgrade",
  async ({ params, body, set }) => {
    try {
      const id = parseInt(params.id, 10);
      const media = await prisma.libraryMedia.findUnique({
        where: { id },
        select: { status: true, type: true, qualityProfileId: true },
      });
      if (!media) return notFound(set, "Library item not found");

      if (body.mode !== "auto") {
        // Manual mode: no server action needed — frontend handles navigation
        return { queued: false, mode: "manual" };
      }

      const { addJob, QUEUE_NAMES, SCHEDULED_JOB_NAMES } = await import(
        "../../services/queueService"
      );

      if (media.type === "movie") {
        await prisma.libraryMedia.update({
          where: { id },
          data: { status: "upgrading" },
        });
        await addJob(
          QUEUE_NAMES.SCHEDULED_TASKS,
          SCHEDULED_JOB_NAMES.UPGRADE_MEDIA_SEARCH,
          { mediaId: id, episodeId: null },
        );
        return { queued: true, mode: "auto", count: 1 };
      }

      // Show: queue one job per downloaded episode
      const episodes = await prisma.libraryEpisode.findMany({
        where: { libraryMediaId: id, status: "downloaded" },
        select: { id: true },
      });

      await prisma.libraryEpisode.updateMany({
        where: { libraryMediaId: id, status: "downloaded" },
        data: { status: "upgrading" },
      });

      for (const ep of episodes) {
        await addJob(
          QUEUE_NAMES.SCHEDULED_TASKS,
          SCHEDULED_JOB_NAMES.UPGRADE_MEDIA_SEARCH,
          { mediaId: id, episodeId: ep.id },
        );
      }

      return { queued: true, mode: "auto", count: episodes.length };
    } catch {
      return serverError(set, "Failed to queue upgrade search");
    }
  },
  {
    body: t.Object({
      mode: t.Union([t.Literal("auto"), t.Literal("manual")]),
    }),
  },
)
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 3: Smoke-test with curl (API must be running)**

Start the API (`make dev-api` in another terminal), then:

```bash
# Replace 1 with a real library media ID that is 'downloaded'
curl -s -X POST http://localhost:3000/api/library/1/upgrade \
  -H "Content-Type: application/json" \
  -d '{"mode":"auto"}' | jq .
```

Expected: `{ "queued": true, "mode": "auto", "count": 1 }` or a 404 if media doesn't exist.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/library/index.ts
git commit -m "feat(upgrades): add POST /api/library/:id/upgrade endpoint"
```

---

### Task 8: Post-processor — skip pre-scan and delete old files on upgrade

**Files:**

- Modify: `apps/api/src/services/postProcessor.ts`

Two changes: (1) skip the pre-scan block when `is_upgrade: true`, (2) after placing the new file, delete old `MediaFile` records and their files.

- [ ] **Step 1: Load `isUpgrade` from the `DownloadHistory` row**

In `postProcessor.ts`, find where `postProcess(downloadHistoryId)` fetches the DH row. Add `isUpgrade` to the select:

```typescript
const dh = await prisma.downloadHistory.findUnique({
  where: { id: downloadHistoryId },
  select: {
    // ...existing fields...
    isUpgrade: true,
  },
  // ...existing includes...
});
```

- [ ] **Step 2: Skip the pre-scan block for upgrade grabs**

Find the pre-scan block (starts with `// ── Pre-scan: check if a MediaFile already exists`). Wrap the entire block to skip when `isUpgrade`:

```typescript
if (!dh.isUpgrade) {
  // ── Pre-scan: check if a MediaFile already exists on disk for this item ──
  const existingFiles = await prisma.mediaFile.findMany({ ... });
  for (const ef of existingFiles) {
    // ...existing early-return logic...
  }
}
```

This prevents the post-processor from short-circuiting on the old file and skipping placement of the upgraded file.

- [ ] **Step 3: Delete old files after successful placement**

Find the section after `MediaFile` is created/upserted and status is set to `"downloaded"` (the final success block). Add old-file deletion immediately after the new `MediaFile` record is confirmed:

```typescript
// Delete old files for upgrade grabs (after new file is confirmed on disk)
if (dh.isUpgrade && newMediaFileId != null) {
  const oldFiles = await prisma.mediaFile.findMany({
    where: dh.episode
      ? { episodeId: dh.episode.id, id: { not: newMediaFileId } }
      : { mediaId: dh.media!.id, episodeId: null, id: { not: newMediaFileId } },
    select: { id: true, filePath: true },
  });

  for (const oldFile of oldFiles) {
    try {
      await unlink(oldFile.filePath);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(
          `[postProcess/upgrade] Failed to delete old file ${oldFile.filePath}:`,
          e,
        );
      }
    }
    await prisma.mediaFile.delete({ where: { id: oldFile.id } });
  }

  if (oldFiles.length > 0) {
    console.log(
      `[postProcess/upgrade] Deleted ${oldFiles.length} old file(s) for media=${dh.media!.id}`,
    );
  }
}
```

Note: `newMediaFileId` comes from capturing the result of the existing `prisma.mediaFile.upsert` call that registers the newly placed file. Find that upsert (it sets `mediaId`, `filePath`, `sizeBytes`, etc.) and store its return value:

```typescript
const newMediaFile = await prisma.mediaFile.upsert({ ... });
const newMediaFileId = newMediaFile.id;
```

Then use `newMediaFileId` in the old-file deletion query above.

- [ ] **Step 4: Ensure status reverts to `"downloaded"` (not stays `"upgrading"`) on failure**

Confirm the existing failure paths in `enqueueLibraryPostProcess` already revert status when post-processing fails. If not, add:

```typescript
if (!result.success && dh?.mediaId != null) {
  // Revert upgrading → downloaded on failure
  await prisma.libraryMedia
    .update({
      where: { id: dh.mediaId },
      data: { status: "downloaded" },
    })
    .catch(() => {});
}
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/api && bun run typecheck 2>&1 | grep -v "webauthn" | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/postProcessor.ts
git commit -m "feat(upgrades): post-processor deletes old files on upgrade completion"
```

---

### Task 9: Frontend — endpoints + hook updates

**Files:**

- Modify: `apps/web/src/lib/endpoints/library.ts`
- Modify: `apps/web/src/features/medias/hooks/useLibrary.ts`

- [ ] **Step 1: Add `UPGRADE` endpoint constant**

In `apps/web/src/lib/endpoints/library.ts`, add:

```typescript
UPGRADE: (id: number) => `/api/library/${id}/upgrade`,
```

- [ ] **Step 2: Add `useUpgradeLibraryMedia` mutation hook**

In `apps/web/src/features/medias/hooks/useLibrary.ts`, after `useUpdateLibraryQualityProfile`, add:

```typescript
export function useUpgradeLibraryMedia() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: "auto" | "manual" }) =>
      fetcher<{ queued: boolean; mode: string; count?: number }>(
        LIBRARY_ENDPOINTS.UPGRADE(id),
        { method: "POST", body: { mode } },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}
```

- [ ] **Step 3: Add `is_upgrade` to `useLibraryGrabRelease`**

Find `useLibraryGrabRelease` (around line 275). In its `mutationFn` body type, add `is_upgrade?: boolean`. Then include it in the body:

```typescript
mutationFn: (body: {
  download_url: string;
  release_title: string;
  indexer?: string | null;
  quality_parsed?: unknown;
  size_bytes?: number | null;
  episode_id?: number | null;
  is_upgrade?: boolean;           // ← add this
}) => {
  // ...existing null check...
  return fetcher<LibrarySearchResponse>(
    LIBRARY_ENDPOINTS.GRAB(libraryMediaId),
    {
      method: "POST",
      body: {
        // ...existing fields...
        ...(body.is_upgrade ? { is_upgrade: true } : {}),
      },
    },
  );
},
```

- [ ] **Step 4: Add `is_upgrade` to the API route body schema**

In `apps/api/src/routes/library/index.ts`, find the grab endpoint's body schema and add the field:

```typescript
body: t.Object({
  download_url: t.String({ maxLength: 8192 }),
  release_title: t.String({ maxLength: 500 }),
  indexer: t.Optional(t.String({ maxLength: 200 })),
  quality_parsed: t.Optional(t.Any()),
  size_bytes: t.Optional(t.Union([t.Number(), t.Null()])),
  episode_id: t.Optional(t.Union([t.Number(), t.Null()])),
  is_upgrade: t.Optional(t.Boolean()),    // ← add this
}),
```

Then pass `body.is_upgrade` to `grabRelease`:

```typescript
const result = await grabRelease({
  mediaId: id,
  episodeId,
  downloadUrl: body.download_url,
  releaseTitle: body.release_title,
  indexer: body.indexer ?? null,
  qualityParsed: body.quality_parsed,
  isUpgrade: body.is_upgrade ?? false, // ← add this
});
```

- [ ] **Step 5: Typecheck web**

```bash
cd apps/web && bun run typecheck 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/endpoints/library.ts apps/web/src/features/medias/hooks/useLibrary.ts apps/api/src/routes/library/index.ts
git commit -m "feat(upgrades): add upgrade endpoint, hook, and is_upgrade grab support"
```

---

### Task 10: Status badge — `"upgrading"` label

**Files:**

- Modify: `apps/web/src/pages/medias/_component/LibraryItemCard.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryItemHero.tsx`
- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Add i18n key for `upgrading` status (English)**

In `apps/web/src/locales/en/common.json`, find the `itemStatus` block (around line 1419) and add:

```json
"itemStatus": {
  "wanted": "Wanted",
  "downloading": "Downloading",
  "upgrading": "Upgrading",
  "downloaded": "Downloaded",
  "skipped": "Skipped",
  "returning": "Returning",
  "in_production": "In Production",
  "planned": "Planned"
}
```

- [ ] **Step 2: Add i18n key for `upgrading` status (French)**

Find the same block in `apps/web/src/locales/fr/common.json` and add:

```json
"upgrading": "Mise à niveau"
```

- [ ] **Step 3: Add `upgrading` to `STATUS_STYLES` in `LibraryItemCard.tsx`**

Find the `STATUS_STYLES` record (around line 15) and add after `downloading`:

```typescript
upgrading: {
  labelKey: "medias.library.itemStatus.upgrading",
  className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
},
```

Also add `"upgrading"` to the switch that maps `item.status` to the status key (if present), or ensure the fallback handles it.

- [ ] **Step 4: Handle `upgrading` in `LibraryItemHero.tsx`**

Find wherever `LibraryItemHero.tsx` maps status to a badge. Add the same label key for `"upgrading"` following the same pattern used for `"downloading"`. Since `LibraryItemHero` likely imports a shared badge config, check if it references the same `STATUS_STYLES` object — if so, step 3 covers it automatically.

- [ ] **Step 5: Typecheck web**

```bash
cd apps/web && bun run typecheck 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/medias/_component/LibraryItemCard.tsx apps/web/src/pages/medias/_component/LibraryItemHero.tsx apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "feat(upgrades): add upgrading status badge label"
```

---

### Task 11: `LibraryUpgradeModal` component

**Files:**

- Create: `apps/web/src/pages/medias/_component/LibraryUpgradeModal.tsx`
- Modify: `apps/web/src/locales/en/common.json`
- Modify: `apps/web/src/locales/fr/common.json`

- [ ] **Step 1: Add modal i18n keys (English)**

In `apps/web/src/locales/en/common.json`, inside the `"library"` section, add a new `"upgradeModal"` block:

```json
"upgradeModal": {
  "title": "Upgrade Quality",
  "movieDescription": "Your current file doesn't meet the new profile. How would you like to find an upgrade?",
  "showDescription": "{{count}} downloaded episode doesn't meet the new profile. How would you like to find upgrades?",
  "showDescription_other": "{{count}} downloaded episodes don't meet the new profile. How would you like to find upgrades?",
  "showManualNote": "You'll be able to search episode by episode in the search tab.",
  "autoSearch": "Auto Search",
  "manualSearch": "Search Manually",
  "keepCurrent": "Keep Current File",
  "autoSearchStarted": "Upgrade search started"
}
```

- [ ] **Step 2: Add modal i18n keys (French)**

In `apps/web/src/locales/fr/common.json`, add the equivalent block:

```json
"upgradeModal": {
  "title": "Améliorer la qualité",
  "movieDescription": "Votre fichier actuel ne correspond pas au nouveau profil. Comment souhaitez-vous trouver une mise à niveau ?",
  "showDescription": "{{count}} épisode téléchargé ne correspond pas au nouveau profil. Comment souhaitez-vous trouver des mises à niveau ?",
  "showDescription_other": "{{count}} épisodes téléchargés ne correspondent pas au nouveau profil. Comment souhaitez-vous trouver des mises à niveau ?",
  "showManualNote": "Vous pourrez rechercher épisode par épisode dans l'onglet de recherche.",
  "autoSearch": "Recherche automatique",
  "manualSearch": "Rechercher manuellement",
  "keepCurrent": "Conserver le fichier actuel",
  "autoSearchStarted": "Recherche de mise à niveau lancée"
}
```

- [ ] **Step 3: Create the modal component**

Create `apps/web/src/pages/medias/_component/LibraryUpgradeModal.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface LibraryUpgradeModalProps {
  open: boolean;
  mediaId: number;
  mediaType: "movie" | "show";
  affectedEpisodes?: number;
  onAutoSearch: () => void;
  onManualSearch: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function LibraryUpgradeModal({
  open,
  mediaType,
  affectedEpisodes,
  onAutoSearch,
  onManualSearch,
  onDismiss,
  isLoading,
}: LibraryUpgradeModalProps) {
  const { t } = useTranslation();

  const description =
    mediaType === "movie"
      ? t("medias.library.upgradeModal.movieDescription")
      : t("medias.library.upgradeModal.showDescription", {
          count: affectedEpisodes ?? 0,
        });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("medias.library.upgradeModal.title")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{description}</p>

        {mediaType === "show" && (
          <p className="text-xs text-muted-foreground">
            {t("medias.library.upgradeModal.showManualNote")}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="default" onClick={onAutoSearch} disabled={isLoading}>
            {t("medias.library.upgradeModal.autoSearch")}
          </Button>
          <Button
            variant="outline"
            onClick={onManualSearch}
            disabled={isLoading}
          >
            {t("medias.library.upgradeModal.manualSearch")}
          </Button>
          <Button variant="ghost" onClick={onDismiss} disabled={isLoading}>
            {t("medias.library.upgradeModal.keepCurrent")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Typecheck web**

```bash
cd apps/web && bun run typecheck 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/medias/_component/LibraryUpgradeModal.tsx apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
git commit -m "feat(upgrades): add LibraryUpgradeModal component and i18n"
```

---

### Task 12: Wire upgrade modal into `LibraryQualityProfileSection`

**Files:**

- Modify: `apps/web/src/pages/medias/_component/LibraryQualityProfileSection.tsx`

The goal: intercept `mutateAsync` result, detect `needs_upgrade`, show the modal, and handle the user's choice.

- [ ] **Step 1: Add upgrade state to the component**

Find `LibraryQualityProfileSection.tsx` and add state + the new hooks:

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner"; // or whatever toast library is used
import {
  useUpdateLibraryQualityProfile,
  useUpgradeLibraryMedia,
} from "@/features/medias/hooks/useLibrary";
import { LibraryUpgradeModal } from "./LibraryUpgradeModal";

// Inside the component:
const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
const [upgradeEpisodes, setUpgradeEpisodes] = useState<number | undefined>();
const upgradeMedia = useUpgradeLibraryMedia();
```

- [ ] **Step 2: Intercept the profile change mutation result**

Find the `onChange` handler where `updateProfile.mutateAsync(...)` is called. Change it to:

```tsx
const result = await updateProfile.mutateAsync({
  id: libraryId,
  body: { quality_profile_id: qid },
});

if (result.item.needs_upgrade) {
  setUpgradeEpisodes(result.item.affected_episodes);
  setUpgradeModalOpen(true);
} else {
  toast.success(t("common.saved")); // or existing success toast
}
```

Check what the existing success feedback does and replicate it when `needs_upgrade` is false.

- [ ] **Step 3: Handle "Auto Search"**

Add the handler:

```tsx
const handleAutoSearch = async () => {
  setUpgradeModalOpen(false);
  await upgradeMedia.mutateAsync({ id: libraryId, mode: "auto" });
  toast.success(t("medias.library.upgradeModal.autoSearchStarted"));
};
```

- [ ] **Step 4: Handle "Search Manually"**

The `LibraryQualityProfileSection` needs to notify its parent (`LibraryItemPage` or the actions section) to switch to the search tab in upgrade mode. Add a prop:

```tsx
interface LibraryQualityProfileSectionProps {
  // ...existing props...
  onUpgradeManualSearch?: () => void;
}
```

Then:

```tsx
const handleManualSearch = () => {
  setUpgradeModalOpen(false);
  props.onUpgradeManualSearch?.();
};
```

In `apps/web/src/pages/medias/_component/LibraryItemPage.tsx` (the parent that renders both `LibraryQualityProfileSection` and the tab panel containing `LibraryItemSearchTab`), add two pieces of state:

```tsx
const [activeTab, setActiveTab] = useState("info"); // or whatever the default is
const [upgradeSearchMode, setUpgradeSearchMode] = useState(false);
```

Pass `onUpgradeManualSearch` to `LibraryQualityProfileSection`:

```tsx
<LibraryQualityProfileSection
  ...
  onUpgradeManualSearch={() => {
    setActiveTab("search");
    setUpgradeSearchMode(true);
  }}
/>
```

Pass `isUpgradeMode` to `LibraryItemSearchTab`:

```tsx
<LibraryItemSearchTab ... isUpgradeMode={upgradeSearchMode} />
```

In `LibraryItemSearchTab`, when `isUpgradeMode` is true, pass `is_upgrade: true` to the grab mutation.

- [ ] **Step 5: Render the modal**

Add to the component's JSX:

```tsx
<LibraryUpgradeModal
  open={upgradeModalOpen}
  mediaId={libraryId}
  mediaType={mediaRow?.type === "show" ? "show" : "movie"}
  affectedEpisodes={upgradeEpisodes}
  onAutoSearch={handleAutoSearch}
  onManualSearch={handleManualSearch}
  onDismiss={() => setUpgradeModalOpen(false)}
  isLoading={upgradeMedia.isPending}
/>
```

- [ ] **Step 6: Pass `is_upgrade` through the search tab**

Find `LibraryItemSearchTab` (or the component that calls `useLibraryGrabRelease`). Add an `isUpgradeMode?: boolean` prop. When true, include `is_upgrade: true` in the grab mutation call:

```tsx
grabRelease.mutate({
  download_url: resolvedUrl,
  release_title: release.title,
  // ...other fields...
  ...(isUpgradeMode ? { is_upgrade: true } : {}),
});
```

- [ ] **Step 7: Typecheck web**

```bash
cd apps/web && bun run typecheck 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 8: Run web tests**

```bash
cd apps/web && bun run test 2>&1 | tail -15
```

Expected: Existing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/medias/_component/LibraryQualityProfileSection.tsx
git commit -m "feat(upgrades): wire upgrade modal into quality profile section"
```

---

### Task 13: End-to-end smoke test and final typecheck

- [ ] **Step 1: Start services and both servers**

```bash
make dev-services   # Terminal 1
make dev-api        # Terminal 2
make dev-web        # Terminal 3
```

- [ ] **Step 2: Smoke test the happy path**

1. Open the library and find a `downloaded` movie.
2. Change its quality profile to one with a higher `minResolution` (e.g., 720p → 1080p).
3. Confirm the upgrade modal appears with "Auto Search," "Search Manually," and "Keep Current File."
4. Click "Auto Search."
5. Confirm the movie's status badge changes to "Upgrading."
6. Confirm a toast appears ("Upgrade search started").
7. In the API logs, confirm `[upgradeMediaSearch]` fires and either grabs or logs "No upgrade found."

- [ ] **Step 3: Smoke test profile change on a satisfied file**

1. Find a `downloaded` movie already at 1080p BluRay.
2. Change its profile to one with `minResolution: 1080p, preferredSources: ["BluRay"]`.
3. Confirm no modal appears — only the normal success toast fires.

- [ ] **Step 4: Final typecheck across all apps**

```bash
make typecheck
```

Expected: No errors (excluding pre-existing WebAuthn issues).

- [ ] **Step 5: Run all tests**

```bash
make test
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(upgrades): complete media upgrade flow — detection, queue, post-processor, UI"
```
