# Component Split Design — 600+ Line Files

**Date:** 2026-05-23  
**Goal:** Break every frontend component over 600 lines into sub-components of ~300 lines max.  
**Approach:** Sub-component extraction (Option B) — identify self-contained visual units, promote them to named components with clear prop interfaces. Extract a hook when state/logic clearly belongs together. Zero behavior changes.

---

## Files in scope

| File | Current lines | Target files |
|------|--------------|--------------|
| `InteractiveSearchPanel.tsx` | 998 | 5 |
| `ExploreCardDetailDialog.tsx` | 913 | 3 |
| `Calendar.tsx` | 814 | 4 |
| `LibraryHistoryTab.tsx` | 633 | 4 |
| `QualityProfileForm.tsx` | 640 | 3 |
| `LibraryPage.tsx` | 621 | 4 |

All files live in `apps/web/src/`.

---

## 1. InteractiveSearchPanel.tsx (998 → ~5 files)

**Location:** `pages/medias/_component/`

### New files

**`useInteractiveSearchState.ts`** (~200 lines)  
Hook that owns all state and derived values currently in the component body.  
- `FilterState` type + `useState<FilterState>`  
- `pendingReleaseKey`, `indexerWarningsDismissed`, `mobileDrawerOpen` state  
- `trackerOptions` and `languageOptions` useMemo  
- `releases` useMemo (filtered + sorted)  
- `downloadRelease` async handler  
- `resetView`, `handleIncludedTrackersChange`, `handleExcludedTrackersChange` handlers  
- Returns the full state surface + all callbacks  

**`InteractiveSearchToolbar.tsx`** (~350 lines)  
The sticky header block. Two layouts inside: mobile (`< sm`) and desktop (`sm+`).  
Desktop contains: season selector, search input + title-toggle, sort controls (key + dir), refresh button, filter toggle, advanced filters panel.  
Mobile contains: search input, refresh button, filter toggle, drawer trigger.  
Props: state surface from hook + setFilters callback.

**`InteractiveSearchStatusStrip.tsx`** (~80 lines)  
Indexer warnings banner (dismissible) + hidden-results info strip.  
Props: `indexerWarnings`, `dismissed`, `onDismiss`, `hiddenCount`, `hasViewOverrides`, `onResetView`.

**`InteractiveSearchResultsList.tsx`** (~80 lines)  
Loading skeleton, "needs query" empty state, results-empty state, and `releases.map(ReleaseCard)`.  
Props: `releases`, `isLoading`, `needsSearchQuery`, `grabBusy`, `pendingReleaseKey`, `grabbedTitles`, `onDownload`.

**`InteractiveSearchPanel.tsx`** (~100 lines, orchestrator)  
Calls `useInteractiveSearchState`, renders `InteractiveSearchToolbar` + `InteractiveSearchStatusStrip` + `InteractiveSearchResultsList` + `InteractiveSearchMobileDrawer`.

---

## 2. ExploreCardDetailDialog.tsx (913 → ~3 files)

**Location:** `pages/medias/_component/`

Already imports `MediaDetailInfoSections` and `SimilarMediasPanel`. What remains splits into a hero and an actions bar.

### New files

**`ExploreCardHero.tsx`** (~320 lines)  
Backdrop image (with fade-in on load), poster thumbnail, and the meta column:  
- Title  
- Type badge + year + runtime  
- Ratings (TMDB vote, Rotten Tomatoes, Metacritic if present)  
- Director  
- Collection link  

Props: `item`, `detailsData`, `modalDataPending`, image-loaded callbacks (`onBackdropLoaded`, `onPosterLoaded`), loaded state flags.

**`ExploreCardActions.tsx`** (~120 lines)  
Watchlist toggle, TMDB external link, trailer link, "Add to library" CTA, "Already in library" indicator.  
Props: `item`, `isInWatchlist`, mutation pending flags, `onAdd`, `onWatchlistToggle`, `trailerData`, `tmdbUrl`.

**`ExploreCardDetailDialog.tsx`** (~250 lines, orchestrator)  
Dialog shell + tab state (`"info" | "similar"`) + data fetching (`useMediaModalData`) + derived values (`episodesBySeason`, `heroBackdropUrl`, `hasProviders`, etc.) + handlers. Renders `ExploreCardHero` + `ExploreCardActions` + tab pills + `MediaDetailInfoSections` / `SimilarMediasPanel`.

---

## 3. Calendar.tsx (814 → ~4 files)

**Location:** `pages/calendar/_component/`

### New files

**`calendarUtils.ts`** (~40 lines)  
Pure functions extracted from the top of the file:  
- `parseCalendarSearchDate(dateStr?: string): Date | null`  
- `localDateKey(date: Date): string`  
- `upcomingToDialogItem(item: DashboardUpcomingItem): TmdbMediaSearchItem`  

**`CalendarGrid.tsx`** (~280 lines)  
Month navigation (prev/next/today, month+year heading), day-of-week headers, day cell grid (date number, event-type dots, release poster thumbnails at the bottom of each cell), legend.  
Props: `currentMonth`, `eventsByDay`, `upcomingByDay`, `selectedDate`, `today`, `onDaySelect`, `onMonthChange`.

**`CalendarDayPanel.tsx`** (~250 lines)  
Selected-day side panel: header (formatted date + "Add event" button), events list rendering all event types (releases, chores, habits, custom events, reminders), empty state.  
Props: `selectedDate`, `dayEvents`, `onCreateEvent`, `onEditEvent`, `onDeleteEvent`, `onMediaClick`.

**`Calendar.tsx`** (~200 lines, orchestrator)  
`Calendar` (search-param wrapper) + `CalendarBody`: state, data fetching (`useCalendarEvents`, `useDashboardUpcoming`), event processing and bucketing by day, renders `CalendarGrid` + `CalendarDayPanel` + create/edit dialogs + `ExploreCardDetailDialog`.

---

## 4. LibraryHistoryTab.tsx (633 → ~4 files)

**Location:** `pages/medias/_component/`

The file's existing section comment headers map cleanly to files.

### New files

**`LibraryHistoryCharts.tsx`** (~220 lines)  
- `ChartTooltip` (shared tooltip wrapper)  
- `IndexersBarChart`  
- `GrabsAreaChart`  
- `GrabStatusDonut`  

**`LibraryHistoryStats.tsx`** (~130 lines)  
- `StatCard` (single metric card)  
- `StatsSection` (5 metric cards + charts row, fetches its own data via existing hooks)

**`LibraryHistoryRow.tsx`** (~110 lines)  
- `formatRelativeShort` and `formatDateShort` helpers  
- `HistoryRow` component (single download-history row)

**`LibraryHistoryTab.tsx`** (~100 lines, orchestrator)  
Main export: state (search query, pagination), data fetching, renders `StatsSection` + history list of `HistoryRow`s + pagination.

---

## 5. QualityProfileForm.tsx (640 → ~3 files)

**Location:** `pages/settings/_component/`

### New files

**`QualityProfileMultiSelect.tsx`** (~150 lines)  
`MultiSelect` component: Radix Popover trigger + scrollable checkbox list + clear button. Used for sources, codecs, languages.  
Props: `options`, `value`, `onChange`, `placeholder`, `label`.

**`QualityProfileTrackerSection.tsx`** (~190 lines)  
`TrackerPrioritySection`: drag-to-reorder tracker list, per-tracker bonus display (`trackerBonus` helper lives here), add/remove tracker controls.  
Props: `trackers`, `preferOverQuality`, `onChange`.

**`QualityProfileForm.tsx`** (~250 lines, remains)  
Option constants (`SOURCE_OPTIONS`, `CODEC_OPTIONS`, `LANGUAGE_OPTIONS`), `FieldLabel`, `QualityProfileForm` export. Form state, submit handler, renders all fields using `QualityProfileMultiSelect` and `QualityProfileTrackerSection`.

---

## 6. LibraryPage.tsx (621 → ~4 files)

**Location:** `pages/medias/_component/`

### New files

**`useLibraryPageState.ts`** (~70 lines)  
Wraps `useUrlState("/library/", ...)` and exposes:  
- Typed `state` destructure (typeFilter, statusFilter, languageFilter, search, sortBy, sortDir, page, viewMode)  
- `setState` callback  
- Derived values: `activeFilterCount`, `safePage` (clamped to totalPages)  
Accepts `totalPages` as input so `safePage` is computed inside.

**`LibraryToolbar.tsx`** (~220 lines)  
Type chip tabs, status chip tabs, language filter (swap bare `<select>` for the existing `Select` primitive from `components/ui/select`), sort key + direction controls, view mode toggles, "Add to Library" button, mobile filter sheet trigger with active-filter badge.  
Props: full filter state + setters.

**`LibraryGrid.tsx`** (~200 lines)  
Loading skeleton (grid and list variants), empty state, grid/compact/list rendering with `motion` stagger variants, pagination controls (range label + prev/next buttons).  
Props: `items`, `isLoading`, `viewMode`, `page`, `totalPages`, `onPageChange`, `onMovieSearch`, `movieSearchPending`, `movieSearchId`.

**`LibraryPage.tsx`** (~100 lines, orchestrator)  
Calls `useLibraryPageState`, `useLibrary`, `useLibraryLanguageTags`, `useLibraryEvents`, `useSearchLibraryMovie`. Renders `LibraryPageHeader` + `LibraryToolbar` + `LibraryGrid` + `LibraryMobileFilterSheet` + `TmdbSearchModal`.

---

## Cross-cutting rules

- No behavior changes. Split files only.
- Each new file lives in the same `_component/` directory as its parent unless it is a hook, in which case it goes in the feature's `hooks/` directory (`features/medias/hooks/` or co-located as appropriate).
- `calendarUtils.ts` goes in `pages/calendar/_component/` alongside the existing `utils.ts` — check for merging opportunities with what's already there.
- Imports stay within existing `@/` alias conventions.
- Run `make typecheck` after each file to catch prop-shape mismatches early.
- No new tests required for this refactor (pure structural split).
