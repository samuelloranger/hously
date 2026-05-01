# Library Sort: Digital Release Date & File Size

**Date:** 2026-05-01
**Status:** Approved

## Summary

Add two new sort options to the media library list: sort by digital release date (from TMDB) and sort by total file size on disk. Both surface data that already exists in the database but isn't currently exposed on the list response.

## Scope

Four files change. No new routes, no schema migrations.

## Backend — `apps/api/src/routes/library.ts`

The library list `findMany` query currently does not include file data. Add a lean include to fetch only `sizeBytes` for both the movie-direct and show-via-episodes relations:

```typescript
include: {
  files: { select: { sizeBytes: true } },           // movie files (MediaFileMedia)
  episodes: {
    include: { files: { select: { sizeBytes: true } } }  // show files (MediaFileEpisode)
  }
}
```

In the response mapping, compute `total_size_bytes` by summing all file sizes:

- Movies: `sum(media.files.map(f => f.sizeBytes))`
- Shows: `sum(media.episodes.flatMap(ep => ep.files).map(f => f.sizeBytes))`

Return as `string` (BigInt → string via `.toString()`). Return `null` if no files exist for that item.

## Shared Types — `apps/shared/src/types/library.ts`

Add one field to `LibraryMedia`:

```typescript
total_size_bytes: string | null;
```

## Sort Logic — `apps/web/src/utils/libraryUtils.ts`

Extend the `LibrarySortKey` union (or equivalent type) with `"digital_release_date"` and `"file_size"`. Add comparison logic to `sortItems()`:

- `digital_release_date`: parse ISO string to `Date.getTime()`, nulls sort last (treated as `0`)
- `file_size`: parse `total_size_bytes` to `BigInt` for comparison, nulls sort last (treated as `0n`)

Direction (asc/desc) applies the same way as existing sorts.

## Sort UI — `apps/web/src/pages/medias/_component/LibraryPage.tsx`

Add two `<option>` entries to the existing sort select:

- Value `"digital_release_date"` — label "Release Date"
- Value `"file_size"` — label "File Size"

## Performance Note

Including files per media item adds extra rows to the list query. For a personal library (hundreds of items) this is negligible. If it becomes slow at scale, replace with a `$queryRaw` aggregate — but that's premature now.

## What's Not Changing

- No database schema changes
- No new API endpoints
- No changes to the interactive search sort system
- No changes to pagination or filtering
