# Jellyfin Watchlist Sync — Design Spec

**Date:** 2026-05-04  
**Status:** Approved

## Overview

Two-way sync between the Hously watchlist and Jellyfin:

- **Hously → Jellyfin:** Watchlist items available in the Jellyfin library appear in a per-user "What's Next" Jellyfin collection, updated in near-real-time.
- **Jellyfin → Hously:** When a user marks an item as played in Jellyfin, it is removed from their Hously watchlist.

A new C# Jellyfin plugin (`apps/jellyfin-plugin/`) lives in the Hously monorepo and is released as a zip artifact on every GitHub release where plugin files changed.

---

## Data Flow

### Hously → Jellyfin (collection update)

Three triggers, all resulting in `WatchlistSyncService` rebuilding the "What's Next" collection for one or all mapped users:

1. **Event-driven (item add/remove):** After `POST /api/medias/watchlist` or `DELETE /api/medias/watchlist/:tmdbId` succeeds, Hously fires a non-blocking background HTTP call to `POST {jellyfin_website_url}/hously/webhook/sync` with the affected user and item.
2. **Manual sync:** Admin clicks "Sync" (per-user) or "Sync All" in Hously settings, or clicks "Sync Now" in the Jellyfin plugin config page.
3. **Fallback timer:** `WatchlistSyncService` runs a full sync for all mapped users every 15 minutes.

### Jellyfin → Hously (watched removal)

`WatchlistSyncService` subscribes to `IUserDataManager.UserDataSaved`. When `userData.Played == true`:

1. Extract `ProviderIds["Tmdb"]` from the item.
2. Look up the Jellyfin user in the configured mappings.
3. Call `DELETE /api/sync/jellyfin/watchlist/:jellyfinUserId/item/:tmdbId?type=movie|tv` on Hously.
4. Hously removes the item from the mapped Hously user's watchlist.

---

## Jellyfin Plugin (`apps/jellyfin-plugin/`)

Based on the `~/sites/jellyfin-vfq` plugin structure (.NET 9, Jellyfin 10.11.7).

### File structure

```
apps/jellyfin-plugin/
├── Jellyfin.Plugin.HouslyWatchlist.sln
├── Directory.Build.props                        # version tracking
├── build.yaml
├── manifest.json
└── Jellyfin.Plugin.HouslyWatchlist/
    ├── Jellyfin.Plugin.HouslyWatchlist.csproj   # net9.0, Jellyfin.Controller 10.11.7
    ├── Plugin.cs                                # BasePlugin<PluginConfiguration>, IHasWebPages
    ├── PluginServiceRegistrator.cs              # registers services in DI
    ├── PluginConfiguration.cs                   # settings model
    ├── Configuration/
    │   └── configPage.html                      # admin UI (base URL, token, mappings, Sync Now)
    └── Services/
        ├── HouslyApiClient.cs                   # HttpClient wrapper
        └── WatchlistSyncService.cs              # IHostedService: timer + events + webhook receiver
```

### PluginConfiguration

```csharp
public string HouslyBaseUrl { get; set; } = "";
public string AdminToken { get; set; } = "";
public int SyncIntervalMinutes { get; set; } = 15;
public List<UserMapping> UserMappings { get; set; } = [];

public class UserMapping {
    public string JellyfinUserId { get; set; } = "";
    public int HouslyUserId { get; set; }
}
```

### WatchlistSyncService responsibilities

- **Timer:** Full sync for all mapped users every `SyncIntervalMinutes`.
- **Webhook receiver:** ASP.NET middleware at `POST /hously/webhook/sync` (validated via `Authorization: Bearer {AdminToken}`). Handles both specific-item updates and full rebuilds.
- **Playback event:** Subscribes to `IUserDataManager.UserDataSaved`; fires Hously DELETE when played.
- **Collection management:** Uses `ILibraryManager` to match items by `ProviderIds["Tmdb"]`; uses `ICollectionManager` to create/update a collection named `"What's Next"` per Jellyfin user.

### HouslyApiClient

Thin `HttpClient` wrapper with two methods:

- `GetWatchlist(jellyfinUserId)` → list of `{ tmdb_id, media_type }`
- `RemoveWatchlistItem(jellyfinUserId, tmdbId, mediaType)` → DELETE

### Webhook payload shapes

```json
// Event-driven (specific item)
{ "jellyfin_user_id": "abc-123", "tmdb_id": 12345, "media_type": "movie", "action": "added" | "removed" }

// Full sync (one or all users)
{ "jellyfin_user_id": "abc-123" | null }
```

---

## Hously API changes

### New route file

`apps/api/src/routes/sync/jellyfin.ts` — composed into `src/index.ts`.

All endpoints authenticated via `Authorization: Bearer {sync_token}` validated against the encrypted `sync_token` in the Jellyfin integration config.

| Method   | Path                                                        | Purpose                                                                |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GET`    | `/api/sync/jellyfin/watchlist/:jellyfinUserId`              | Plugin fetches watchlist for a mapped user                             |
| `DELETE` | `/api/sync/jellyfin/watchlist/:jellyfinUserId/item/:tmdbId` | Plugin removes a watched item (`?type=movie\|tv`)                      |
| `POST`   | `/api/sync/jellyfin/trigger`                                | Manual sync — body: `{ jellyfin_user_id?: string }` (null = all users) |
| `POST`   | `/api/integrations/jellyfin/sync-token`                     | Regenerate sync token without touching other integration config        |

### Watchlist mutation side-effects

After `POST /api/medias/watchlist` and `DELETE /api/medias/watchlist/:tmdbId` succeed, fire a non-blocking background call to `POST {website_url}/hously/webhook/sync`. Failure is logged but does not affect the watchlist response.

### Integration config additions

Stored in the existing `Integration.config` JSON — no schema migration needed:

```json
{
  "website_url": "...",
  "api_key": "...",
  "sync_token": "<encrypted>",
  "user_mappings": [{ "jellyfin_user_id": "abc-123", "hously_user_id": 1 }]
}
```

`sync_token` is generated server-side (`crypto.randomBytes(32).toString('hex')`), stored encrypted (same mechanism as `api_key`).

---

## Hously Settings UI

Extend `JellyfinIntegrationSection.tsx` with a **"Watchlist Sync"** subsection:

- **Sync token field:** masked value, copy-to-clipboard button, "Regenerate" button (calls `POST /api/integrations/jellyfin/sync-token` — generates and saves a new token without touching other config fields).
- **User mapping table:** one row per mapping — Jellyfin User ID (text input) + Hously user (dropdown of existing users) + per-row "Sync" button.
- **"Sync All" button:** triggers `POST /api/sync/jellyfin/trigger` with no body.
- Add/remove mapping rows dynamically; saved via the existing Jellyfin integration PUT endpoint (config JSON extended).

---

## CI/CD

New workflow: `.github/workflows/jellyfin-plugin.yml`

- **Trigger:** `release: types: [published]` — same as `docker-publish.yml`.
- **Change detection:** On startup, `git diff --name-only <prev-tag> HEAD -- apps/jellyfin-plugin/` — all subsequent steps skipped if no changes.
- **Steps (when changes detected):**
  1. Setup .NET 9
  2. `dotnet build --configuration Release`
  3. Zip `Jellyfin.Plugin.HouslyWatchlist.dll` → `Jellyfin.Plugin.HouslyWatchlist_v{release-tag}.zip`, compute MD5
  4. Update `manifest.json` with new version entry
  5. Upload zip to the GitHub release as an artifact

Plugin version tracks the Hously release tag directly — no separate auto-versioning.

---

## What is NOT in scope

- Syncing watch progress (only played/not-played matters).
- Multi-library Jellyfin setups (single library assumed).
- Plex equivalent (Jellyfin only).
- Hously mobile (iOS) app changes.
