# Media Info Edit — Design Spec

**Date:** 2026-05-21  
**Feature:** Manually edit library media info fields from the management tab

---

## Overview

Users can manually override library item metadata (title, sort title, year, overview, poster URL) and media file release group directly from the management tab of any library item page. Manually set fields are locked against future TMDB auto-refresh overrides.

---

## Scope

Two distinct edit surfaces in the management tab:

1. **Library item overrides** — title, sort title, year, overview, poster URL (stored in a new JSON column on `library_media`)
2. **File release group** — inline edit of `MediaFile.release_group` per file row

---

## Data Layer

### New column: `library_media.overrides`

```prisma
overrides  Json?  @map("overrides")
```

Shape:

```ts
type LibraryMediaOverrides = {
  title?: string;
  sort_title?: string;
  year?: number;
  overview?: string;
  poster_url?: string;
};
```

Any key present in `overrides` is considered manually locked. A `null` value for a key removes the override and restores TMDB sync for that field.

### Migration

Single `ALTER TABLE library_media ADD COLUMN overrides jsonb`.

### Mapper (`libraryHelpers.ts`)

After fetching a `LibraryMedia` record, merge overrides before returning to client:

```ts
title: overrides?.title ?? item.title;
sort_title: overrides?.sort_title ?? item.sortTitle;
year: overrides?.year ?? item.year;
overview: overrides?.overview ?? item.overview;
poster_url: overrides?.poster_url ?? item.posterUrl;
```

The raw `overrides` object is also returned to the client so the frontend knows which fields are locked.

### TMDB refresh protection (`libraryTmdbRefresh.ts`)

When syncing a field from TMDB, skip it if `overrides[field]` is set. Fields not present in `overrides` continue to receive TMDB updates normally.

### `MediaFile.release_group`

Already exists as `String?` — no schema change needed. Edited directly via a new patch endpoint.

---

## API

### `PATCH /api/library/:id/overrides`

Added to `libraryMetaRoutes.ts`.

**Body:** Partial `LibraryMediaOverrides` — any subset of fields. To clear a lock, send `null` for that key.

**Behavior:**

1. Fetch current `overrides` from DB (default `{}`)
2. Deep-merge incoming fields: present keys overwrite, `null` keys are deleted from the object
3. `prisma.libraryMedia.update({ data: { overrides: merged } })`
4. Return updated library item via existing `libraryMediaInclude`

**Auth:** Requires session (same as all other `libraryMetaRoutes` endpoints).

### `PATCH /api/library/files/:fileId`

Added to `libraryFilesRoutes.ts`.

**Body:** `{ release_group?: string | null }`

**Behavior:**

- `prisma.mediaFile.update({ where: { id: fileId }, data: { releaseGroup: body.release_group } })`
- Returns updated file record
- Invalidation: client invalidates parent library item query

**Auth:** Requires session.

---

## Frontend

### New hooks

| Hook                        | File                                                 | Purpose                                                                 |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `useUpdateLibraryOverrides` | `features/medias/hooks/useUpdateLibraryOverrides.ts` | `PATCH /api/library/:id/overrides`, invalidates `queryKeys.library.all` |
| `useUpdateMediaFile`        | `features/medias/hooks/useUpdateMediaFile.ts`        | `PATCH /api/library/files/:fileId`, invalidates `queryKeys.library.all` |

### New component: `LibraryInfoOverridesSection`

**File:** `pages/medias/_component/LibraryInfoOverridesSection.tsx`  
**Placed:** First section inside `LibraryManagementPanel`, above `LibraryQualityProfileSection`

**Behavior:**

- Collapsed by default — shows a single "Edit info" row with a pencil icon button
- Clicking expands an inline form (no modal)
- Form fields (in order): Title, Sort title, Year (number), Overview (textarea), Poster URL
- Each field pre-filled with the current merged value
- Fields with an active override show a small lock icon (🔒) indicator
- Each field has an **×** clear button — sends `null` for that key to remove the override
- **Save changes** button — sends only fields that differ from their original pre-filled values; no-op fields are omitted
- On save success: form collapses, query invalidates and refreshes displayed values
- On save error: toast error, form stays open

### Release group inline edit

**Location:** Within the existing file rows in `LibraryMediaSection` / `LibraryFileDetailBlock`

**Behavior:**

- Each file row displays the release group value (or `—` when empty)
- Click-to-edit: clicking the value (or an edit icon) reveals a text input inline
- Saves on blur or Enter key — calls `useUpdateMediaFile`
- Sends `null` to clear the value
- Optimistic update on the displayed value; reverts on error

---

## Out of Scope

- Custom poster image upload (only URL input for now)
- Per-episode metadata overrides
- Bulk editing across multiple library items
- Undo/history of overrides
