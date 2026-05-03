# Library Sort: Digital Release Date & File Size — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Digital Release Date" and "File Size" sort options to the media library list.

**Architecture:** Add `total_size_bytes` to the library list response (computed from `MediaFile` rows via the existing Prisma relations), extend the shared `LibraryMedia` type, then wire up two new sort cases in the frontend sort utility.

**Tech Stack:** Bun/Elysia API, Prisma (PostgreSQL), React + Vitest, i18next

---

## File Map

| File                                      | Change                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `apps/shared/src/types/library.ts`        | Add `total_size_bytes: string \| null` to `LibraryMedia`                            |
| `apps/api/src/routes/library/index.ts`    | Extend `libraryMediaInclude`, add `computeTotalSizeBytes`, update `mapLibraryMedia` |
| `apps/web/src/utils/libraryUtils.ts`      | Add two new `SortKey` values and their sort logic                                   |
| `apps/web/src/utils/libraryUtils.test.ts` | New — unit tests for the two new sort cases                                         |
| `apps/web/src/locales/en/common.json`     | Two new sort label keys                                                             |
| `apps/web/src/locales/fr/common.json`     | Two new sort label keys (French)                                                    |

---

## Task 1: Add `total_size_bytes` to the shared `LibraryMedia` type

**Files:**

- Modify: `apps/shared/src/types/library.ts:71-89`

- [ ] **Step 1: Add the field**

  Open `apps/shared/src/types/library.ts`. In the `LibraryMedia` interface (starts at line 71), add `total_size_bytes` after `last_grabbed_at`:

  ```typescript
  export interface LibraryMedia {
    id: number;
    tmdb_id: number;
    type: LibraryMediaType;
    title: string;
    sort_title: string | null;
    year: number | null;
    status: LibraryMediaStatus;
    monitored: boolean;
    poster_url: string | null;
    overview: string | null;
    digital_release_date: string | null;
    quality_profile_id: number | null;
    search_attempts: number;
    quality_profile: LibraryQualityProfileRef | null;
    added_at: string;
    updated_at: string;
    last_grabbed_at: string | null;
    total_size_bytes: string | null;
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add apps/shared/src/types/library.ts
  git commit -m "feat(shared): add total_size_bytes to LibraryMedia type"
  ```

---

## Task 2: Compute and return `total_size_bytes` from the API

**Files:**

- Modify: `apps/api/src/routes/library/index.ts:30-80`

- [ ] **Step 1: Add `computeTotalSizeBytes` helper**

  Add this function immediately before `mapLibraryMedia` (before line 30):

  ```typescript
  function computeTotalSizeBytes(
    files: { sizeBytes: bigint }[],
    episodes: { files: { sizeBytes: bigint }[] }[],
  ): string | null {
    let total = 0n;
    for (const f of files) total += f.sizeBytes;
    for (const ep of episodes) for (const f of ep.files) total += f.sizeBytes;
    return total === 0n ? null : total.toString();
  }
  ```

- [ ] **Step 2: Update `mapLibraryMedia` input type to accept files and episodes**

  Extend the parameter type of `mapLibraryMedia` (currently ends at line 48). Add two optional fields at the bottom:

  ```typescript
  function mapLibraryMedia(item: {
    id: number;
    tmdbId: number;
    type: string;
    title: string;
    sortTitle: string | null;
    year: number | null;
    status: string;
    monitored: boolean;
    posterUrl: string | null;
    overview: string | null;
    digitalReleaseDate: Date | null;
    qualityProfileId: number | null;
    searchAttempts: number;
    qualityProfile: { id: number; name: string } | null;
    downloadHistories?: { grabbedAt: Date }[];
    addedAt: Date;
    updatedAt: Date;
    files?: { sizeBytes: bigint }[];
    episodes?: { files: { sizeBytes: bigint }[] }[];
  }) {
  ```

- [ ] **Step 3: Add `total_size_bytes` to the return value of `mapLibraryMedia`**

  In the `return { ... }` block (lines 49–70), add after `last_grabbed_at`:

  ```typescript
    total_size_bytes: computeTotalSizeBytes(item.files ?? [], item.episodes ?? []),
  ```

- [ ] **Step 4: Add files and episodes to `libraryMediaInclude`**

  The current `libraryMediaInclude` (lines 73–80) becomes:

  ```typescript
  const libraryMediaInclude = {
    qualityProfile: { select: { id: true, name: true } },
    downloadHistories: {
      orderBy: { grabbedAt: "desc" as const },
      take: 1,
      select: { grabbedAt: true },
    },
    files: { select: { sizeBytes: true } },
    episodes: {
      include: {
        files: { select: { sizeBytes: true } },
      },
    },
  } as const;
  ```

- [ ] **Step 5: Typecheck the API**

  ```bash
  cd apps/api && bun run typecheck 2>&1 | head -30
  ```

  Expected: no new errors (there are pre-existing passkey-related errors on this branch that can be ignored).

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/routes/library/index.ts
  git commit -m "feat(api): include total_size_bytes in library list response"
  ```

---

## Task 3: Add sort logic for the two new keys

**Files:**

- Modify: `apps/web/src/utils/libraryUtils.ts`
- Create: `apps/web/src/utils/libraryUtils.test.ts`

- [ ] **Step 1: Write the failing tests first**

  Create `apps/web/src/utils/libraryUtils.test.ts`:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { sortItems } from "./libraryUtils";
  import type { LibraryMedia } from "@hously/shared/types";

  function makeMedia(overrides: Partial<LibraryMedia>): LibraryMedia {
    return {
      id: 1,
      tmdb_id: 1,
      type: "movie",
      title: "Test",
      sort_title: null,
      year: 2020,
      status: "wanted",
      monitored: true,
      poster_url: null,
      overview: null,
      digital_release_date: null,
      quality_profile_id: null,
      search_attempts: 0,
      quality_profile: null,
      added_at: "2024-01-01T00:00:00.000Z",
      updated_at: "2024-01-01T00:00:00.000Z",
      last_grabbed_at: null,
      total_size_bytes: null,
      ...overrides,
    };
  }

  describe("sortItems — digital_release_date", () => {
    it("sorts ascending by digital release date", () => {
      const items = [
        makeMedia({ id: 1, digital_release_date: "2023-06-01T00:00:00.000Z" }),
        makeMedia({ id: 2, digital_release_date: "2021-01-01T00:00:00.000Z" }),
        makeMedia({ id: 3, digital_release_date: "2025-12-01T00:00:00.000Z" }),
      ];
      const result = sortItems(items, "digital_release_date", "asc");
      expect(result.map((i) => i.id)).toEqual([2, 1, 3]);
    });

    it("sorts descending by digital release date", () => {
      const items = [
        makeMedia({ id: 1, digital_release_date: "2023-06-01T00:00:00.000Z" }),
        makeMedia({ id: 2, digital_release_date: "2021-01-01T00:00:00.000Z" }),
      ];
      const result = sortItems(items, "digital_release_date", "desc");
      expect(result.map((i) => i.id)).toEqual([1, 2]);
    });

    it("places null release dates last when sorting ascending", () => {
      const items = [
        makeMedia({ id: 1, digital_release_date: null }),
        makeMedia({ id: 2, digital_release_date: "2023-06-01T00:00:00.000Z" }),
      ];
      const result = sortItems(items, "digital_release_date", "asc");
      expect(result.map((i) => i.id)).toEqual([2, 1]);
    });
  });

  describe("sortItems — file_size", () => {
    it("sorts ascending by file size", () => {
      const items = [
        makeMedia({ id: 1, total_size_bytes: "5000000000" }),
        makeMedia({ id: 2, total_size_bytes: "1000000000" }),
        makeMedia({ id: 3, total_size_bytes: "20000000000" }),
      ];
      const result = sortItems(items, "file_size", "asc");
      expect(result.map((i) => i.id)).toEqual([2, 1, 3]);
    });

    it("sorts descending by file size", () => {
      const items = [
        makeMedia({ id: 1, total_size_bytes: "5000000000" }),
        makeMedia({ id: 2, total_size_bytes: "20000000000" }),
      ];
      const result = sortItems(items, "file_size", "desc");
      expect(result.map((i) => i.id)).toEqual([2, 1]);
    });

    it("places null sizes last when sorting ascending", () => {
      const items = [
        makeMedia({ id: 1, total_size_bytes: null }),
        makeMedia({ id: 2, total_size_bytes: "5000000000" }),
      ];
      const result = sortItems(items, "file_size", "asc");
      expect(result.map((i) => i.id)).toEqual([2, 1]);
    });
  });
  ```

- [ ] **Step 2: Run the tests and verify they fail**

  ```bash
  cd apps/web && bun run test src/utils/libraryUtils.test.ts
  ```

  Expected: type errors or test failures because `"digital_release_date"` and `"file_size"` are not in `SortKey` yet.

- [ ] **Step 3: Implement the new sort keys**

  Replace the entire contents of `apps/web/src/utils/libraryUtils.ts` with:

  ```typescript
  import type { LibraryMedia, TmdbMediaSearchItem } from "@hously/shared/types";

  export type SortKey =
    | "title"
    | "year"
    | "added_at"
    | "status"
    | "last_grabbed_at"
    | "digital_release_date"
    | "file_size";
  export type SortDir = "asc" | "desc";
  export type FilterType = "all" | "movie" | "show";
  export type FilterStatus =
    | "all"
    | "wanted"
    | "downloading"
    | "downloaded"
    | "skipped";

  export const LIBRARY_SORT_KEYS: readonly SortKey[] = [
    "added_at",
    "last_grabbed_at",
    "title",
    "year",
    "status",
    "digital_release_date",
    "file_size",
  ] as const;

  export function sortItems(
    items: LibraryMedia[],
    sortBy: SortKey,
    sortDir: SortDir,
  ): LibraryMedia[] {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "title") cmp = a.title.localeCompare(b.title);
      else if (sortBy === "year") cmp = (a.year ?? 0) - (b.year ?? 0);
      else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
      else if (sortBy === "last_grabbed_at") {
        const aTime = a.last_grabbed_at
          ? new Date(a.last_grabbed_at).getTime()
          : 0;
        const bTime = b.last_grabbed_at
          ? new Date(b.last_grabbed_at).getTime()
          : 0;
        cmp = aTime - bTime;
      } else if (sortBy === "digital_release_date") {
        const aTime = a.digital_release_date
          ? new Date(a.digital_release_date).getTime()
          : 0;
        const bTime = b.digital_release_date
          ? new Date(b.digital_release_date).getTime()
          : 0;
        cmp = aTime - bTime;
      } else if (sortBy === "file_size") {
        const aSize = a.total_size_bytes ? BigInt(a.total_size_bytes) : 0n;
        const bSize = b.total_size_bytes ? BigInt(b.total_size_bytes) : 0n;
        cmp = aSize < bSize ? -1 : aSize > bSize ? 1 : 0;
      } else
        cmp = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  export function libraryItemToSearchItem(
    item: LibraryMedia,
  ): TmdbMediaSearchItem {
    return {
      id: String(item.id),
      tmdb_id: item.tmdb_id,
      media_type: item.type === "show" ? "tv" : "movie",
      title: item.title,
      release_year: item.year,
      poster_url: item.poster_url,
      overview: item.overview,
      vote_average: null,
      already_exists: true,
      can_add: false,
      source_id: null,
      library_id: item.id,
    };
  }
  ```

- [ ] **Step 4: Run tests and verify they pass**

  ```bash
  cd apps/web && bun run test src/utils/libraryUtils.test.ts
  ```

  Expected: 6 tests pass.

- [ ] **Step 5: Typecheck the web app**

  ```bash
  cd apps/web && bun run typecheck 2>&1 | head -30
  ```

  Expected: no new errors.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/utils/libraryUtils.ts apps/web/src/utils/libraryUtils.test.ts
  git commit -m "feat(web): add digital_release_date and file_size sort options to library"
  ```

---

## Task 4: Add i18n labels for the two new sort keys

**Files:**

- Modify: `apps/web/src/locales/en/common.json:1410-1416`
- Modify: `apps/web/src/locales/fr/common.json:1410-1416`

- [ ] **Step 1: Add English labels**

  In `apps/web/src/locales/en/common.json`, find the `"sort"` block (around line 1410) and add the two new keys:

  ```json
  "sort": {
    "added_at": "Date added",
    "last_grabbed_at": "Last grab",
    "title": "Title",
    "year": "Year",
    "status": "Status",
    "digital_release_date": "Release Date",
    "file_size": "File Size"
  },
  ```

- [ ] **Step 2: Add French labels**

  In `apps/web/src/locales/fr/common.json`, same location:

  ```json
  "sort": {
    "added_at": "Date d'ajout",
    "last_grabbed_at": "Dernier grab",
    "title": "Titre",
    "year": "Année",
    "status": "Statut",
    "digital_release_date": "Date de sortie",
    "file_size": "Taille"
  },
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/locales/en/common.json apps/web/src/locales/fr/common.json
  git commit -m "feat(i18n): add sort labels for release date and file size"
  ```

---

## Task 5: Final verification

- [ ] **Step 1: Run full web test suite**

  ```bash
  cd apps/web && bun run test
  ```

  Expected: all tests pass.

- [ ] **Step 2: Run full typecheck**

  ```bash
  make typecheck
  ```

  Expected: no new errors vs. baseline.

- [ ] **Step 3: Start dev server and manually verify**

  ```bash
  make dev-api   # Terminal 1
  make dev-web   # Terminal 2
  ```

  Open the library page. Confirm:
  - "Release Date" appears in the sort dropdown
  - "File Size" appears in the sort dropdown
  - Sorting by "Release Date" orders items by `digital_release_date` (items with no release date go last)
  - Sorting by "File Size" orders items by total file size (items with no files go last)
  - Ascending/descending toggle works for both
