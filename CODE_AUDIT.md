# Hously Code Audit

> Generated: 2026-04-14  
> Tools: manual exploration (3 parallel agents) + jscpd (261 clones found, 4.49% duplication across 691 files)

---

## Summary

The codebase is well-structured and follows its own conventions consistently. The vertical refactoring landed cleanly. The issues below are real but none are blocking — they are technical debt worth tackling incrementally.

**Overall verdict:** Clean architecture, some oversized files, predictable patterns of duplication in Create/Edit form pairs and route handlers.

---

## 1. Copy-Paste Clones (jscpd)

Ordered by severity (lines duplicated). Only clones ≥12 lines in non-test, non-generated files.

### 🔴 High Priority

#### Create/Edit form pairs — `CreateChoreForm` vs `EditChoreForm` (258L duplicated across 5 clone pairs)

```
145L  apps/web/src/pages/chores/_component/CreateChoreForm.tsx:277-421
      apps/web/src/pages/chores/_component/EditChoreForm.tsx:350-483

113L  apps/web/src/pages/chores/_component/CreateChoreForm.tsx:162-274
      apps/web/src/pages/chores/_component/EditChoreForm.tsx:171-252

 36L  apps/web/src/pages/chores/_component/CreateChoreForm.tsx:60-95
      apps/web/src/pages/chores/_component/EditChoreForm.tsx:74-109

 29L  apps/web/src/pages/chores/_component/CreateChoreForm.tsx:122-150
      apps/web/src/pages/chores/_component/EditChoreForm.tsx:133-161

 27L  apps/web/src/pages/chores/_component/CreateChoreForm.tsx:267-293
      apps/web/src/pages/chores/_component/EditChoreForm.tsx:339-365
```

**Fix:** Extract a shared `ChoreFormFields` component with an `initialValues` prop, used by both create and edit modals.

---

#### Media info duplicated — `ExploreCardDetailDialog` vs `LibraryItemInfoTab` (152L)

```
121L  apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx:707-827
      apps/web/src/pages/medias/_component/LibraryItemInfoTab.tsx:56-142

 31L  apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx:731-761
      apps/web/src/pages/medias/_component/LibraryItemInfoTab.tsx:84-112
```

**Fix:** Extract shared `MediaInfoBlock` component used by both.

---

#### Torrent list vs grid — `TorrentRow` vs `TorrentGridCard` (174L across 5 clone pairs)

```
 81L  apps/web/src/pages/torrents/_component/TorrentGridCard.tsx:80-160
      apps/web/src/pages/torrents/_component/TorrentRow.tsx:98-178

 63L  apps/web/src/pages/torrents/_component/TorrentGridCard.tsx:101-163
      apps/web/src/pages/torrents/_component/TorrentRow.tsx:119-179

 38L  apps/web/src/pages/torrents/_component/TorrentGridCard.tsx:253-290
      apps/web/src/pages/torrents/_component/TorrentRow.tsx:217-254

 32L  apps/web/src/pages/torrents/_component/TorrentGridCard.tsx:47-78
      apps/web/src/pages/torrents/_component/TorrentRow.tsx:62-93

 28L  apps/web/src/pages/torrents/_component/TorrentGridCard.tsx:1-28
      apps/web/src/pages/torrents/_component/TorrentRow.tsx:1-29
```

**Fix:** Extract shared `useTorrentActions` hook and `TorrentStatusBadge` / `TorrentProgressBar` sub-components used by both views.

---

#### Activity list duplicated — `RecentActivityPage` vs `RecentActivityTab` (112L across 3 pairs)

```
 70L  apps/web/src/pages/activity/_component/RecentActivityPage.tsx:123-192
      apps/web/src/pages/settings/_component/RecentActivityTab.tsx:111-180

 30L  apps/web/src/pages/activity/_component/RecentActivityPage.tsx:146-175
      apps/web/src/pages/settings/_component/RecentActivityTab.tsx:134-163

 21L  apps/web/src/pages/activity/_component/RecentActivityPage.tsx:124-144
      apps/web/src/pages/settings/_component/RecentActivityTab.tsx:112-132
```

**Fix:** Extract shared `ActivityFeed` component used by both the standalone page and the settings tab.

---

### 🟡 Medium Priority

#### Create/Edit habit forms

```
 61L  apps/web/src/pages/habits/_component/CreateHabitForm.tsx:40-100
      apps/web/src/pages/habits/_component/EditHabitForm.tsx:52-112
```

**Fix:** Same pattern as chores — extract `HabitFormFields`.

---

#### Habits route — internal duplication (API)

```
 48L  apps/api/src/routes/habits/index.ts:534-581
      apps/api/src/routes/habits/index.ts:378-425

 23L  apps/api/src/routes/habits/index.ts:581-603
      apps/api/src/routes/habits/index.ts:425-447
```

Two route handlers within the same file share 70+ lines of identical logic. **Fix:** Extract a shared handler function.

---

#### Auth profile update duplicated in `auth.ts` and `users/index.ts`

```
 43L  apps/api/src/auth.ts:793-835
      apps/api/src/routes/users/index.ts:284-326

 23L  apps/api/src/auth.ts:723-745
      apps/api/src/routes/users/index.ts:233-255
```

Profile update logic (avatar upload + field update) duplicated across the auth module and users route. **Fix:** Extract to a `userService.updateProfile()` helper.

---

#### Library episode upsert — `libraryFromTmdb` vs `libraryTmdbRefresh`

```
 32L  apps/api/src/services/libraryFromTmdb.ts:179-210
      apps/api/src/services/libraryTmdbRefresh.ts:105-135

 24L  apps/api/src/services/libraryFromTmdb.ts:15-38
      apps/api/src/services/libraryTmdbRefresh.ts:5-35

 21L  apps/api/src/services/libraryTmdbRefresh.ts:14-34
      apps/api/src/routes/library/libraryMediaAdmin.ts:21-41
```

TMDB client setup and episode upsert logic copied across three files. **Fix:** The episode upsert block belongs in `libraryHelpers.ts`.

---

#### `dashboardServices.ts` type duplicated in `@hously/shared`

```
 30L  apps/api/src/types/dashboardServices.ts:87-116
      apps/shared/src/types/dashboard.ts:271-300
```

A type definition exists in both the API-local types file and the shared package. **Fix:** Delete the local copy, use the shared type.

---

#### `refreshUpcoming` duplicates `dashboard/upcoming` TMDB fetch

```
 20L  apps/api/src/workers/refreshUpcoming.ts:69-88
      apps/api/src/routes/dashboard/upcoming/index.ts:55-74
```

**Fix:** Both should call the existing `collectTmdbUpcoming()` helper in `utils/dashboard/tmdbUpcoming.ts`.

---

#### APN push setup duplicated

```
 24L  apps/api/src/utils/apnLiveActivity.ts:48-71
      apps/api/src/utils/apnPush.ts:53-73
```

**Fix:** Extract shared APN client initializer.

---

#### Calendar event query duplicated

```
 21L  apps/api/src/routes/calendar/events.ts:129-149
      apps/api/src/routes/calendar/ical.ts:128-148
```

**Fix:** Extract shared event query builder used by both routes.

---

#### Plugin form fields — `AdguardPluginSection` vs `QbittorrentPluginSection`

```
 28L  apps/web/src/pages/settings/_component/plugins/AdguardPluginSection.tsx:83-110
      apps/web/src/pages/settings/_component/plugins/QbittorrentPluginSection.tsx:95-122
```

Both render the same "URL + API key" form layout. **Fix:** Extract shared `PluginUrlKeyForm` component.

---

### 🟢 Low Priority / Acceptable

- `recurrence.ts` internal clones (algorithm variants — intentional)
- `shopping/useShopping.ts` internal mutation patterns (optimistic update boilerplate — tolerable until a mutation factory is built)
- `useHabits.ts` internal clones (toggle/activate variants — similar structure but different semantics)

---

## 2. DRY Violations (non-clone)

### `sortTitle` regex — helper exists, 8 files ignore it

`sortTitleFromName()` lives in `apps/api/src/utils/medias/libraryHelpers.ts:6` but only the refresh script uses it. All other files inline the regex:

| File                                                 | Lines              |
| ---------------------------------------------------- | ------------------ |
| `apps/api/src/services/libraryFromTmdb.ts`           | 107, 119, 150, 161 |
| `apps/api/src/services/jobs/libraryMigrateWorker.ts` | 429, 627           |
| `apps/api/src/routes/library/libraryMediaAdmin.ts`   | 238, 288           |

**Fix:** Replace all 8 inline occurrences with `sortTitleFromName(title)`.

---

### Plugin config loading — 55 raw `prisma.plugin.findFirst()` calls

Every service and route that needs a plugin config does its own DB query without caching. Only `getQbittorrentPluginConfig()` in `apps/api/src/services/qbittorrent/config.ts` has a 24-hour cache.

**Files with the raw pattern (partial list):** `mediaGrabber.ts`, `libraryFromTmdb.ts`, `libraryTmdbRefresh.ts`, `libraryMigrateWorker.ts`, all 8 dashboard utils, all 10 plugin routes.

**Fix:** Generalize `getQbittorrentPluginConfig()` into a generic `getPluginConfig(type)` with short-lived caching (60s TTL is enough) in a shared `pluginConfigCache.ts`.

---

### `buildDisabledSummary` pattern repeated across 5 dashboard utils

Each dashboard integration (`beszel.ts`, `adguard.ts`, `scrutiny.ts`, `netdata.ts`, `jellyfin.ts`) defines its own function that returns `{ enabled: false, connected: false, updated_at: ..., error? }`. Structure is identical, only the service-specific fields differ.

**Fix:** Single `buildDisabledSummary(fields, error?)` factory in `utils/dashboard/index.ts`.

---

### `useToggle` mutation pattern — chores, shopping, habits all identical

`useToggleChore`, `useToggleShoppingItem`, and habits toggle mutations share the same optimistic update shape: cancel → snapshot → setQueryData → rollback on error → invalidate on settle.

**Fix:** `useToggleMutation(endpoint, queryKey, extraInvalidations?)` factory in `apps/web/src/lib/hooks/`.

---

## 3. Oversized Files

| File                                                               | Lines    | Problem                                                                              |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| `apps/api/src/services/qbittorrent/torrents.ts`                    | **1141** | 20+ exported functions: queries, mutations, filtering, sorting — needs splitting     |
| `apps/api/src/routes/library/index.ts`                             | **1095** | 42 route definitions with inline business logic                                      |
| `apps/web/src/features/board/BoardView.tsx`                        | **1053** | State, filtering, sorting, drag-drop, bulk ops all in one component                  |
| `apps/api/src/routes/chores/index.ts`                              | **955**  | All chore operations (list, create, update, delete, reorder, recurrence) in one file |
| `apps/api/src/services/qbittorrent/client.ts`                      | **948**  | 40+ methods; mixes HTTP client, API translation, and state management                |
| `apps/api/src/routes/medias/tmdb/index.ts`                         | **935**  | Heavy TMDB API interaction logic lives inside route handlers                         |
| `apps/api/src/routes/board-tasks/index.ts`                         | **925**  | All board operations with inline validation                                          |
| `apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx` | **924**  | Mega-modal: search, filters, sort, state, UI                                         |
| `apps/api/src/services/postProcessor.ts`                           | **882**  | File scanning, episode matching, notifications all in one service                    |
| `apps/api/src/routes/habits/index.ts`                              | **882**  | Contains internal 70L duplication (see §1)                                           |
| `apps/api/src/utils/medias/tmdbFetchers.ts`                        | **877**  | 10+ fetch functions; could split by entity (movie vs series vs search)               |

---

## 4. Type Safety Gaps

### `ctx: any` on 30+ handlers in `dashboard/qbittorrent/index.ts`

Every handler in `apps/api/src/routes/dashboard/qbittorrent/index.ts` uses `async (ctx: any)` instead of typed destructuring. Root cause: the file never calls `.use(auth).use(requireUser)`, unlike every other dashboard sub-route. TypeScript can't infer the context shape without those plugins applied locally.

**Fix:** Add `.use(auth).use(requireUser)` at the top of `dashboardQbittorrentRoutes`. This eliminates all `ctx: any` casts and aligns with every other sub-route in the dashboard.

---

### `user!.id` — 115+ non-null assertions across 14 route files

After `requireUser` middleware, TypeScript still types `user` as potentially null, forcing `user!.id` everywhere. Files with the highest count: `chores/index.ts` (22), `shopping/index.ts` (15), `custom-events/index.ts` (14).

**Fix:** Declare a typed `AuthorizedContext` that narrows `user` to `NonNullable<User>` and use it as the handler context type. One type declaration eliminates ~115 assertions.

---

### `dashboardServices.ts` type duplicated in `@hously/shared`

```
apps/api/src/types/dashboardServices.ts:87-116
apps/shared/src/types/dashboard.ts:271-300
```

Same type exists in both places. **Fix:** Delete the local copy, import from `@hously/shared`.

---

## 5. Silent Error Handling

Empty catch blocks that swallow errors with no logging:

| File                                                 | Lines              | Risk                                            |
| ---------------------------------------------------- | ------------------ | ----------------------------------------------- |
| `apps/api/src/services/mediaGrabber.ts`              | 114, 166, 416, 473 | Silent torrent parse/URL failures               |
| `apps/api/src/services/qbittorrentPoller.ts`         | 95, 336, 345       | Silent poller failures → stale dashboard        |
| `apps/api/src/services/postProcessor.ts`             | 89, 456, 667, 877  | Silent file processing failures                 |
| `apps/api/src/services/jobs/libraryMigrateWorker.ts` | 418, 603           | Silent migration failures                       |
| `apps/api/src/routes/library/index.ts`               | 165                | SSE `controller.close()` failure unlogged       |
| `apps/api/src/services/trackers/torr9.ts`            | 65                 | Parse failure indistinguishable from no-results |
| `apps/api/src/services/trackers/g3mini.ts`           | 78                 | Same                                            |

**Fix:** At minimum, `catch (e) { console.warn(..., e); }`. For trackers, distinguish between "no results" (return `null`) and "parse error" (log + return `null`).

---

## 6. Minor Issues

### Missing endpoint constant

`apps/web/src/lib/notifications/useCloseReadNotifications.ts:27` hardcodes `"/api/notifications/unread-ids"`. Add `UNREAD_IDS` to `NOTIFICATION_ENDPOINTS`.

### `console.log` audit trail in route handlers

~25 `console.log` calls in `chores/index.ts`, `shopping/index.ts`, `notifications/index.ts` used as action audit trail. These should be either removed or replaced with the `logActivity()` helper that already exists in `apps/api/src/utils/activityLogs.ts`.

---

## What's Clean ✅

- **Architecture:** Routes → Services → Utils separation is solid throughout
- **Query keys:** All TanStack Query hooks use the centralized `queryKeys` factory — zero hardcoded strings found
- **Hook co-location:** Vertical refactoring completed cleanly — no orphaned hooks in global `hooks/` folders
- **Shared package boundaries:** `apps/shared` contains only true cross-app code (types, utils, constants) after the refactoring
- **Error helpers:** All route handlers use `badRequest`/`notFound`/`serverError` — no raw error objects returned
- **Route registration:** All 23 route plugins are registered in `src/index.ts` — no orphaned routes
- **Endpoint constants:** All fetchers (except 1 noted above) use endpoint constants — no hardcoded `/api/...` strings
- **Snake_case mapping:** API responses consistently map Prisma camelCase to snake_case
- **`PRISMA_TO_API_STATUS`:** Defined once in `board-tasks/mappers.ts`, imported by both consumers — not duplicated

---

## Recommended Order of Attack

| Priority | Task                                                                                      | Effort |
| -------- | ----------------------------------------------------------------------------------------- | ------ |
| 1        | Add `.use(auth).use(requireUser)` to `dashboardQbittorrentRoutes` → eliminates `ctx: any` | 15 min |
| 2        | Replace 8 inline `sortTitle` regexes with `sortTitleFromName()`                           | 15 min |
| 3        | Add missing `UNREAD_IDS` endpoint constant                                                | 5 min  |
| 4        | Delete `dashboardServices.ts` duplicate type, use shared                                  | 10 min |
| 5        | Add `console.warn` to empty catch blocks (at minimum the 4 in `mediaGrabber.ts`)          | 30 min |
| 6        | Extract `ChoreFormFields` from Create/Edit chore forms (145L clone)                       | 1-2h   |
| 7        | Extract `ActivityFeed` component from activity page/tab (70L clone)                       | 1h     |
| 8        | Extract `HabitFormFields` from Create/Edit habit forms                                    | 1h     |
| 9        | Extract `useToggleMutation` factory for chores/shopping/habits                            | 1-2h   |
| 10       | Generic `getPluginConfig(type)` with caching to replace 55 raw DB calls                   | 2-3h   |
| 11       | Split `library/index.ts` (1095L) into sub-routers                                         | 2-3h   |
| 12       | Extract `AuthorizedContext` type → eliminate 115 `user!` assertions                       | 1h     |
| 13       | Split `BoardView.tsx` (1053L) into state hooks + render                                   | 3-4h   |
