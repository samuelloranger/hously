# Downloads Import Table — Design

**Status:** Approved (pending spec review)
**Date:** 2026-05-11
**Branch:** `feat/rescan-import-from-downloads` (re-purposed)
**Supersedes:** the in-flight changes on PR #171 (`scanAndImportLibraryFiles` auto-match in `postProcessor.ts` + `downloadFilenameMatch.ts`)

## Problem

The Downloads folder fills up with completed video files that aren't part of the Hously library. Some are already hardlinked into the library, others are orphaned (failed match, never imported, manually downloaded outside the normal flow). Today there is no UI to see what's in Downloads, what's already imported, and to assign unmatched files to a TMDB id.

## Goal

A new admin-only page that lists every video file in the configured Downloads folders, shows release metadata and hardlink status, and lets the operator stage TMDB assignments and submit them as a single batch that creates library items and hardlinks in one pass.

## Non-goals (v1)

- Auto-match / one-click bulk TMDB assignment (filename → TMDB heuristics).
- Multi-select bulk actions other than the staged-queue submit flow.
- Delete-from-disk action on rows.
- Grouping the table by release folder. The view is a flat list of video files (folders are walked recursively).
- Sidecar files (`.srt`, `.nfo`, samples). Filtered out.
- Files smaller than 100 MB (sample filter, hard-cut).
- Persisting the staged queue across page reloads.
- In-progress qBittorrent partial files (skipped by extension and size filter).

## User flow

1. Operator opens **Library → Downloads** (admin-gated).
2. Table renders every video file in Downloads with a status badge: `Hardlinked` (greyed out), `Ready to assign`, or `Parse failed`.
3. Operator clicks the search icon on an unmatched row. A popover opens, pre-filled with the parsed title (and year, if extracted). The popover queries TMDB on the auto-detected kind (movie if no `SxxEyy`, tv if `SxxEyy` was parsed).
4. Operator picks a TMDB result. The popover closes. **No API call yet** — the pick is staged on the row (poster thumb + title + year chip, with an `×` to unstage and an "Edit" button to change).
5. Repeat for as many rows as desired.
6. A sticky footer bar appears once ≥1 row is staged: `N items staged · Clear staged · Submit`.
7. Operator clicks **Submit**. Footer becomes a progress bar `Processing X / N…`. The runner iterates staged rows **sequentially** (not in parallel). Each row in turn shows a spinner, then transitions to ✓ Hardlinked or ✗ Error (with the server message and a per-row Retry button).
8. After the run completes: `Done — X succeeded, Y failed`. Successes are now `Hardlinked` (greyed). Failures remain staged for retry.

## Architecture

### Backend (`apps/api`)

New folder `apps/api/src/routes/library/downloads/` with two endpoints, plus one new service.

#### Service: `apps/api/src/services/downloadsScanner.ts`

Single exported function `scanDownloads(): Promise<DownloadEntry[]>`. Steps:

1. Read `MediaSettings` (singleton id=1). Derive Downloads paths as `dirname(moviesLibraryPath)` and `dirname(showsLibraryPath)`.
2. Recursively walk both paths using the existing `listVideoFilesUnder()` helper. Collect absolute file paths.
3. For each file: `fs.stat` → `{ size, mtime, dev, ino }`. **Drop** any file where `size < 100 MB`.
4. Build a hardlink-detection inode set: `fs.stat` every `MediaFile.filePath` in the DB, key each as `${dev}:${ino}`. Cache this set for the duration of the scan call.
5. For each Downloads file: run `parseReleaseTitle(basename)` (existing helper in `apps/api/src/utils/medias/filenameParser.ts`) to extract title, year, season, episode, quality, codec, releaseGroup, hdr, audio, subtitles.
6. Set `is_hardlinked = inodeSet.has(${dev}:${ino})`.
7. Set `kind = "tv"` if `season` and `episode` were parsed, else `"movie"`.
8. Return a sorted array (default: size desc).

Wrap the result in a module-level **30-second in-memory cache**: `{ data, expiresAt }`. Cache is bypassed when:

- The endpoint is called with `?refresh=1` (manual Refresh button), or
- A successful `assign` call invalidates it.

During a Submit run that processes multiple staged rows, the cache is invalidated **once** at the first successful assign and suppressed for the rest of the run, so we don't rescan 20 times for a 20-row queue.

#### Endpoint: `GET /api/library/downloads/list`

Admin-gated (same middleware as `libraryMediaAdmin.ts`). Calls `scanDownloads()`. Returns:

```json
{
  "items": [
    {
      "file_path": "/srv/downloads/movies/Inception.2010.1080p.GRP.mkv",
      "file_name": "Inception.2010.1080p.GRP.mkv",
      "size_bytes": 8589934592,
      "modified_at": "2026-05-09T14:22:00Z",
      "dev": 64512,
      "ino": 12345678,
      "is_hardlinked": false,
      "parsed": {
        "title": "Inception",
        "year": 2010,
        "season": null,
        "episode": null,
        "quality": "1080p",
        "codec": "x264",
        "release_group": "GRP",
        "hdr": null,
        "audio": ["DTS"],
        "subtitles": [],
        "kind": "movie"
      }
    }
  ]
}
```

Query params: `?refresh=1` (bypass cache).

#### Endpoint: `POST /api/library/downloads/assign`

Admin-gated. Request body:

```ts
{
  file_path: string,        // absolute path of the Downloads file
  tmdb_id: number,
  kind: "movie" | "tv",
  // For tv only; if omitted, parsed from filename:
  season?: number,
  episode?: number,
}
```

Server flow:

1. **Validate** the file still exists, is under one of the Downloads roots, and is not already hardlinked (re-stat + re-check inode set — protects against concurrent assigns).
2. **Ensure `LibraryMedia` exists** — find by `tmdbId`. If missing, fetch TMDB details (reuse the existing TMDB client used by `routes/library/libraryMediaAdmin.ts`) and create the row.
3. **For TV**: ensure the `LibraryEpisode` row exists for `(season, episode)`. Create from TMDB episode data if missing.
4. **Build destination path** — reuse the path-template logic already in `postProcessor.ts` so the new file lands in the same canonical location as files created by the normal post-process pipeline.
5. **Hardlink** source → destination via `fs.link`. If the destination already exists with a different inode, return 409.
6. **Create the `MediaFile` row** — `filePath`, `fileName`, `sizeBytes`, parsed metadata (releaseGroup, videoCodec, etc.), linked via `mediaId` (movie) or `episodeId` (tv).
7. **Invalidate the scanner cache** (or suppress invalidation during a batch — handled by the cache layer with a `since` timestamp marker).
8. Return `{ library_media_id, media_file_id }`.

Error cases the API surfaces with clear codes/messages:

- `404` file not found on disk
- `409` already hardlinked, or destination collision with a different inode
- `422` TMDB lookup failed, or episode not found on TMDB for the given `(season, episode)`
- `400` validation (`file_path` not inside any Downloads root)

### Cleanup of the PR #171 in-flight code

The current branch (`feat/rescan-import-from-downloads`) added `scanAndImportLibraryFiles()` to `postProcessor.ts` plus `downloadFilenameMatch.ts`. These implement an auto-match approach that we are explicitly replacing with the staged-queue flow.

Action: **remove** `apps/api/src/utils/medias/downloadFilenameMatch.ts`, its test `apps/api/test/downloadFilenameMatch.test.ts`, and the `scanAndImportLibraryFiles` additions to `postProcessor.ts`. Reverts the relevant hunks of commit `9eb04cb8`.

### Frontend (`apps/web`)

New feature folder `apps/web/src/features/downloadsImport/`:

```
features/downloadsImport/
├── index.tsx                       # page shell + footer bar
├── components/
│   ├── DownloadsTable.tsx          # table + toolbar (filter, sort, search)
│   ├── DownloadRow.tsx             # row with expand + staged-pick chip
│   ├── ReleaseDetails.tsx          # expanded panel content
│   ├── StatusBadge.tsx
│   ├── TmdbAssignPopover.tsx       # search + pick, returns to row (no API)
│   ├── StagedQueueFooter.tsx       # sticky footer with Submit
│   └── SubmitRunner.tsx            # sequential runner with per-row progress
└── hooks/
    ├── useDownloads.ts             # GET /downloads/list
    └── useAssignDownload.ts        # POST /downloads/assign (single-shot)
```

Route: `apps/web/src/pages/library/downloads.tsx` (TanStack Router, admin-gated).

**Columns:** File name · Size · Quality · Release group · Status · Action (chevron-expand + search icon).

**Status badges:**

- `Hardlinked` — file's inode is found in the library `MediaFile` set. Row is greyed and the action column is empty.
- `Ready to assign` — not hardlinked, parser extracted at least a title. Search icon active.
- `Parse failed` — not hardlinked, no title extracted. Search icon still active; the popover opens with an empty search box.

**Expanded row** shows: full file path, codec, HDR, audio tracks, subtitle tracks, modified date, detected title/year/S–E.

**Toolbar:**

- Refresh button (calls `useDownloads` with `?refresh=1`).
- Status filter: All / Ready to assign / Hardlinked / Parse failed.
- Sort: Size desc (default) / Name / Modified.
- Filename search box (client-side substring filter).

**TMDB assign popover:**

- Opens on search-icon click.
- Search box pre-populated with `parsed.title` + (if present) ` ${year}`.
- Auto-detected `kind` (from `parsed.kind`) constrains the TMDB search to movies or TV.
- Hits `GET /api/medias/tmdb-search?q=...&kind=...`.
- Result list: poster, title, year, short overview.
- Clicking a result hands the pick back to the row state (no network call). Popover closes.

**Staged queue (client state):**

Held in a Zustand store local to the feature (no need to globalize). Keyed by `file_path`. Each entry stores `{ tmdb_id, kind, season?, episode?, tmdb_preview }`. The TV `season`/`episode` are pre-filled from `parsed` and not user-editable in v1 (the filename's S/E is the source of truth, matching the auto-resolve decision).

**Row state machine (client):**

```
unmatched ─pick TMDB─▶ staged ─Submit─▶ submitting ─▶ success (→ Hardlinked, row greys)
                          │                       └─▶ error (red, with Retry on row)
                          └── × (remove) ─▶ unmatched
```

**Sticky footer bar (`StagedQueueFooter.tsx`):**

Visible whenever `stagedCount > 0`. Idle state:

```
[N items staged]                              [Clear staged]  [Submit]
```

Running state:

```
[Processing 2 / 5…  ▓▓▓░░]                                [Cancel]
```

`Cancel` aborts at the next row boundary (does not interrupt the in-flight HTTP request).

Done state:

```
[Done — 4 succeeded, 1 failed]                              [Dismiss]
```

**Submit runner (`SubmitRunner.tsx`):**

- Iterates staged rows **sequentially** (`for…of await`). Sequential, not parallel: avoids TMDB rate-limit pressure, keeps disk hardlinking serialized.
- For each row: set row status to `submitting`, call `useAssignDownload.mutateAsync(...)`. On success → mark row `success`, drop from staged store. On error → mark row `error`, keep in staged store with `lastError` so Retry on the row can re-run just that one.
- After the run completes, invalidate `useDownloads` query once.

**Loading / empty / error states:**

- Loading: skeleton rows in the table.
- Empty (no files): "No video files in Downloads folder."
- API error on list: error card with a Retry button that bypasses the cache (`?refresh=1`).

## Data model

No schema changes. We reuse existing tables:

- `LibraryMedia` (created or found by `tmdbId`)
- `LibraryEpisode` (created from TMDB if missing, for TV)
- `MediaFile` (created per assign)

## Testing

### API tests

- `apps/api/test/downloadsScanner.test.ts`
  - Walks a tmpdir tree, collects only video extensions.
  - Drops files smaller than 100 MB.
  - Detects a real hardlink (`fs.link`) as `is_hardlinked: true`.
  - `parsed.kind` is `"tv"` when `SxxEyy` is in the filename, else `"movie"`.
  - Cache returns the same snapshot within 30s; `refresh=1` bypasses it.

- `apps/api/test/downloadsAssign.test.ts`
  - First call with a fresh `tmdb_id` creates the `LibraryMedia` row and the `MediaFile` row, and the destination is a hardlink (same inode as source).
  - Second call with the same `tmdb_id` reuses the existing `LibraryMedia`.
  - Re-assigning an already-hardlinked file returns 409.
  - Assigning a missing-on-disk file returns 404.
  - TV path with explicit `season`/`episode` creates the `LibraryEpisode` if missing.
  - TV path with `season`/`episode` outside the show's known episodes returns 422.

### Web tests

- `DownloadsTable.test.tsx`: renders rows with each badge variant.
- `TmdbAssignPopover.test.tsx`: opening the popover pre-fills the search input with `parsed.title` + year.
- `SubmitRunner.test.tsx`: 3 staged rows, one mocked to fail; runner processes sequentially, footer ends with `2 succeeded, 1 failed`, failed row remains staged.

## Open questions

None.

## Risks

- **Inode-based hardlink check requires the library and Downloads to be on the same filesystem.** That's already an invariant of the existing post-process pipeline (hardlinks can't cross filesystems), so this doesn't introduce a new constraint, but it's worth surfacing in an admin-facing error if the two paths end up on different devices.
- **TMDB rate limits** during a large Submit run. The sequential runner is the mitigation; we are well under TMDB's per-second budget at one request per row.
- **Race with the normal post-process pipeline** — if qBittorrent finishes a torrent and the post-processor hardlinks it while the operator has it staged, the assign call will return 409 (already hardlinked). The UI surfaces the error and the operator can dismiss the staged row.
