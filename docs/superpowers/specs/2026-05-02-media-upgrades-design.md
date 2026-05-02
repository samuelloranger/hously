# Media Upgrades Design

**Date:** 2026-05-02
**Status:** Approved

## Problem

Once a media item reaches `downloaded` status, Hously's pipeline stops. There is no mechanism to obtain a better-quality release if the user raises their quality expectations. Radarr/Sonarr solve this with automatic background upgrade hunting; Hously's approach is intentionally lighter: upgrades are user-triggered by changing the quality profile on an already-downloaded item.

## Scope

- Movies and TV shows both supported.
- For shows, a single upgrade decision fans out to all downloaded episodes.
- Trigger: user changes `quality_profile_id` on a `downloaded` item via the library detail page.
- Detection: the API scores existing files against the new profile and only prompts if they fail.
- User chooses: **Auto Search**, **Search Manually**, or **Keep Current File**.
- Old file is deleted automatically after the upgraded download completes post-processing.

## Data Layer

### `DownloadHistory` — new field

```prisma
is_upgrade Boolean @default(false) @map("is_upgrade")
```

Stamps upgrade grabs so the post-processor knows to delete old files after placing the new one. First-time grabs are unaffected (`false` by default).

### Status union — new value: `"upgrading"`

Added to both `LibraryMedia.status` and `LibraryEpisode.status`.

| Entity              | Transition                                                                       |
| ------------------- | -------------------------------------------------------------------------------- |
| Movie               | `downloaded → upgrading` (grab in flight) → `downloaded` (post-process complete) |
| Episode             | `downloaded → upgrading` (grab in flight) → `downloaded` (post-process complete) |
| Show (LibraryMedia) | Stays `downloaded` throughout — old files remain playable                        |

The `LibraryMediaStatus` shared type in `apps/shared/src/types/library.ts` must include `"upgrading"`.

No changes to `QualityProfile` schema. Existing fields (`minResolution`, `preferredSources`, `preferredCodecs`, `preferredLanguages`, `requireHdr`, `maxSizeGb`) are sufficient for scoring.

## API Layer

### `PATCH /api/library/{id}` — enhanced

When `quality_profile_id` changes and the item's current `status` is `"downloaded"`:

1. Fetch the most recent `DownloadHistory` row(s) where `failed: false` and `qualityParsed IS NOT NULL`, joined with the linked `MediaFile` to get `sizeBytes`.
   - Movie: one row for the item.
   - Show: one row per episode with `status: "downloaded"`.
2. Run `scoreRelease(qualityParsed, newProfile, mediaFile.sizeBytes ?? null)` for each. If no `MediaFile` is linked, pass `null` for `sizeBytes` (skips the size rejection check).
3. Count failures (where `scoreRelease` returns `string[]`).

Response gains two optional fields:

```ts
{
  // ...existing library media fields
  needs_upgrade?: boolean;       // true if any current file fails the new profile
  affected_episodes?: number;    // show only: count of failing downloaded episodes
}
```

The profile is saved regardless. The upgrade prompt is always opt-in. If the item is not `downloaded`, or the profile did not change, these fields are absent.

### `POST /api/library/{id}/upgrade` — new endpoint

Request body:

```ts
{
  mode: "auto" | "manual";
}
```

**`mode: "auto"`**

- Movie: sets `LibraryMedia.status = "upgrading"` immediately, then enqueues a `searchAndGrab()` job (BullMQ `scheduled-tasks` queue) with `is_upgrade: true`. Running inline would time out for large shows.
- Show: sets each `status: "downloaded"` episode to `"upgrading"`, then enqueues one `searchAndGrab()` job per episode.
- If a job finds no releases: status reverts to `"downloaded"` immediately. No data loss.

**`mode: "manual"`**

- Not a real API endpoint — the "Search Manually" button navigates the frontend directly to the interactive search tab carrying upgrade context in React state. No server round-trip needed. The `POST /api/library/{id}/upgrade` endpoint only handles `mode: "auto"`.

### `POST /api/medias/interactive-download` — extended

New optional body field:

```ts
{ is_upgrade?: boolean }
```

When `true`, `grabRelease()` stamps `DownloadHistory.is_upgrade = true` and sets item status to `"upgrading"` instead of `"downloading"`. Covers the manual search path without a separate code path.

### `grabRelease()` — extended

Accepts `is_upgrade?: boolean` in its opts. When true:

- Sets `DownloadHistory.is_upgrade = true`.
- Sets `LibraryMedia.status` (or `LibraryEpisode.status`) to `"upgrading"` instead of `"downloading"`.

## Post-processor

When processing a completed `DownloadHistory` row where `is_upgrade: true`:

1. Place and register the new `MediaFile` as normal.
2. **Only after successful placement:** find all other `MediaFile` rows for the same `mediaId` (or `episodeId`) that are not the newly created file.
3. Delete each old file from the filesystem.
4. Remove old `MediaFile` DB rows.
5. Set `LibraryMedia.status` (or `LibraryEpisode.status`) to `"downloaded"`.

**Failure safety:** if placement fails for any reason, bail before step 2. Old files are never deleted until the new file is confirmed on disk. The item reverts to `"downloaded"` with the original file intact.

## Frontend

### Upgrade modal

Triggered when `PATCH /api/library/{id}` returns `needs_upgrade: true`. Shown instead of the normal success toast.

**Movie copy:**

> Your current file doesn't meet the new profile. How would you like to find an upgrade?

**Show copy:**

> {N} downloaded episodes don't meet the new profile. How would you like to find upgrades?
> _(Note: Manual search lets you search episode by episode in the search tab.)_

**Actions:**

| Button            | Behaviour                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Auto Search       | `POST /api/library/{id}/upgrade { mode: "auto" }` → toast "Upgrade search started"       |
| Search Manually   | Navigates to interactive search tab with `is_upgrade: true` in React state — no API call |
| Keep Current File | Dismiss modal. Profile already saved, no further action.                                 |

### `upgrading` status badge

Reuses the existing `downloading` visual treatment (spinner/indicator). Requires:

- A new label string for `"upgrading"` in the status badge component.
- New i18n keys in both `en` and `fr` locale files.

### Interactive search tab — upgrade mode

When opened via "Search Manually," the tab passes `is_upgrade: true` to `POST /api/medias/interactive-download` when the user selects a release. No other UI changes needed — the tab already supports all needed functionality.

## Out of Scope

- Automatic background upgrade hunting (no daemon, no RSS-based upgrade detection).
- Delay profiles before upgrade grabs.
- Usenet/NZB support.
- Bulk profile changes across multiple library items at once.
