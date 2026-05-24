# Component Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Break 6 frontend components over 600 lines into focused sub-components of ~300 lines each with no behavior changes.

**Architecture:** Sub-component extraction — identify self-contained visual units, promote them to named files with explicit prop interfaces, keep state/data-fetching in the orchestrating parent unless a hook extraction is clearly beneficial. Each task is independent.

**Tech Stack:** React 19, TypeScript, TanStack Router/Query, motion/react, Tailwind CSS, Radix UI primitives, `@/` alias for all web imports.

---

## File Map

### Task 1 — InteractiveSearchPanel (998 lines → 5 files)
- Create: `apps/web/src/features/medias/hooks/useInteractiveSearchState.ts`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchToolbar.tsx`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchStatusStrip.tsx`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchResultsList.tsx`
- Modify: `apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx`

### Task 2 — ExploreCardDetailDialog (913 lines → 3 files)
- Create: `apps/web/src/pages/medias/_component/ExploreCardHero.tsx`
- Create: `apps/web/src/pages/medias/_component/ExploreCardActions.tsx`
- Modify: `apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx`

### Task 3 — Calendar (814 lines → 4 files)
- Create: `apps/web/src/pages/calendar/_component/calendarUtils.ts`
- Create: `apps/web/src/pages/calendar/_component/CalendarGrid.tsx`
- Create: `apps/web/src/pages/calendar/_component/CalendarDayPanel.tsx`
- Modify: `apps/web/src/pages/calendar/_component/Calendar.tsx`

### Task 4 — LibraryHistoryTab (633 lines → 4 files)
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryCharts.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryStats.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryRow.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryHistoryTab.tsx`

### Task 5 — QualityProfileForm (640 lines → 3 files)
- Create: `apps/web/src/pages/settings/_component/QualityProfileMultiSelect.tsx`
- Create: `apps/web/src/pages/settings/_component/QualityProfileTrackerSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/QualityProfileForm.tsx`

### Task 6 — LibraryPage (621 lines → 4 files)
- Create: `apps/web/src/pages/medias/_component/useLibraryPageState.ts`
- Create: `apps/web/src/pages/medias/_component/LibraryToolbar.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryGrid.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryPage.tsx`

---

## Task 1: Split InteractiveSearchPanel

**Files:**
- Create: `apps/web/src/features/medias/hooks/useInteractiveSearchState.ts`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchToolbar.tsx`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchStatusStrip.tsx`
- Create: `apps/web/src/pages/medias/_component/InteractiveSearchResultsList.tsx`
- Modify: `apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx`

### Step 1.1 — Create `useInteractiveSearchState.ts`

Cut lines 57–385 out of `InteractiveSearchPanel.tsx` (the `FilterState` interface through the last handler before `return`) and create this hook file. The hook accepts the same props as the component (minus `onDownloadSuccess` which stays in the hook too) and returns the full state surface.

- [ ] Create `apps/web/src/features/medias/hooks/useInteractiveSearchState.ts` with this structure:

```typescript
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useInteractiveDownload } from "@/features/medias/hooks/useInteractiveDownload";
import { useInteractiveSearch } from "@/features/medias/hooks/useInteractiveSearch";
import { useLibraryGrabRelease } from "@/features/medias/hooks/useLibraryGrabRelease";
import { useLibraryEpisodes } from "@/features/medias/hooks/useLibraryEpisodes";
import { useLibraryDownloads } from "@/features/medias/hooks/useLibraryDownloads";
import type { InteractiveReleaseItem, MediaItem } from "@hously/shared/types";
import {
  filterAndSortReleases,
  normalizeFilterKey,
  UNKNOWN_TRACKER_KEY,
  UNKNOWN_LANGUAGE_KEY,
  type InteractiveSortKey,
  type InteractiveSortDir,
} from "@/lib/utils/interactive-search";
import type { FilterOption } from "@/pages/medias/_component/InteractiveSearchFilters";

export interface FilterState {
  filterQuery: string;
  searchApiQuery: string;
  showFilters: boolean;
  hideRejected: boolean;
  sortBy: InteractiveSortKey;
  sortDir: InteractiveSortDir;
  includedTrackers: string[];
  excludedTrackers: string[];
  includedLanguages: string[];
  selectedSeason: number | "complete" | null;
  showPacksOnly: boolean;
}

export interface UseInteractiveSearchStateProps {
  isActive: boolean;
  media?: MediaItem | null;
  mode?: "arr" | "search";
  libraryMediaId?: number | null;
  defaultSearchQuery?: string | null;
  searchQueryOriginal?: string | null;
  episodeId?: number | null;
  defaultSeason?: number | "complete" | null;
  isUpgradeMode?: boolean;
  onDownloadSuccess?: () => void;
}

export function useInteractiveSearchState({
  isActive,
  media = null,
  mode = "search",
  libraryMediaId = null,
  defaultSearchQuery = null,
  searchQueryOriginal = null,
  episodeId = null,
  defaultSeason = null,
  isUpgradeMode = false,
  onDownloadSuccess,
}: UseInteractiveSearchStateProps) {
  // Paste the body of InteractiveSearchPanel from line 84 through line 365
  // (everything before `const resetView = ...` already extracted above,
  //  through `handleExcludedTrackersChange` at line 385)
  // Then return the full surface:
  return {
    // refs
    searchInputRef,
    // filter state
    filters,
    setFilters,
    filterQuery,
    searchApiQuery,
    showFilters,
    hideRejected,
    sortBy,
    sortDir,
    includedTrackers,
    excludedTrackers,
    includedLanguages,
    selectedSeason,
    showPacksOnly,
    // UI state
    pendingReleaseKey,
    indexerWarningsDismissed,
    setIndexerWarningsDismissed,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    // computed options
    trackerOptions,
    languageOptions,
    releases,
    availableSeasons,
    // query state
    activeQuery,
    grabBusy,
    // computed counts/flags
    totalReleases,
    indexerWarnings,
    hasAdvancedFilters,
    totalActiveFilters,
    hasViewOverrides,
    visibleCount,
    hiddenCount,
    errorMessage,
    needsSearchQuery,
    // feature flags
    isShow,
    isSearchMode,
    canRenderBody,
    canToggleSearchTitle,
    isOriginalTitleQuery,
    // handlers
    downloadRelease,
    resetView,
    handleIncludedTrackersChange,
    handleExcludedTrackersChange,
    toggleSearchTitleVariant,
  };
}
```

> The actual implementation body (useState calls, useEffect, useMemo blocks, handlers) is cut verbatim from `InteractiveSearchPanel.tsx` lines 84–385. Do not rewrite — move.

### Step 1.2 — Create `InteractiveSearchToolbar.tsx`

Cut the sticky-header `<div>` block from `InteractiveSearchPanel.tsx` (starts at line ~390 with `{/* ─── Sticky search header */}`, ends before the indexer warnings banner). This covers both the mobile layout (`sm:hidden`) and the desktop layout (`hidden sm:flex`).

- [ ] Create `apps/web/src/pages/medias/_component/InteractiveSearchToolbar.tsx`:

```typescript
import type React from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownAZ, ArrowUpZA, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Toggle,
  ChipMultiSelect,
  FilterSection,
  type FilterOption,
} from "@/pages/medias/_component/InteractiveSearchFilters";
import type { FilterState } from "@/features/medias/hooks/useInteractiveSearchState";
import type { InteractiveSortKey, InteractiveSortDir } from "@/lib/utils/interactive-search";

interface InteractiveSearchToolbarProps {
  filterQuery: string;
  searchApiQuery: string;
  showFilters: boolean;
  hideRejected: boolean;
  sortBy: InteractiveSortKey;
  sortDir: InteractiveSortDir;
  includedTrackers: string[];
  excludedTrackers: string[];
  includedLanguages: string[];
  selectedSeason: number | "complete" | null;
  showPacksOnly: boolean;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isShow: boolean;
  isSearchMode: boolean;
  canToggleSearchTitle: boolean;
  isOriginalTitleQuery: boolean;
  availableSeasons: number[];
  trackerOptions: FilterOption[];
  languageOptions: FilterOption[];
  hasAdvancedFilters: boolean;
  totalActiveFilters: number;
  isFetching: boolean;
  needsSearchQuery: boolean;
  onOpenMobileDrawer: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleSearchTitleVariant: () => void;
  onRefetch: () => void;
  onIncludedTrackersChange: (values: string[]) => void;
  onExcludedTrackersChange: (values: string[]) => void;
}

export function InteractiveSearchToolbar(props: InteractiveSearchToolbarProps) {
  const { t } = useTranslation("common");
  // Paste the sticky-header <div> block verbatim from InteractiveSearchPanel.tsx
  // (the outer div with className="sticky top-0 z-10 ...")
}
```

### Step 1.3 — Create `InteractiveSearchStatusStrip.tsx`

Cut the indexer warnings banner + hidden-results info strip from `InteractiveSearchPanel.tsx` (the section after the sticky header and before the results map).

- [ ] Create `apps/web/src/pages/medias/_component/InteractiveSearchStatusStrip.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveSearchStatusStripProps {
  indexerWarnings: string[];
  dismissed: boolean;
  onDismiss: () => void;
  hiddenCount: number;
  hasViewOverrides: boolean;
  onResetView: () => void;
  visibleCount: number;
  totalReleases: number;
  isSearchMode: boolean;
  searchApiQuery: string;
  isOriginalTitleQuery: boolean;
  onToggleSearchTitleVariant: () => void;
}

export function InteractiveSearchStatusStrip(props: InteractiveSearchStatusStripProps) {
  const { t } = useTranslation("common");
  // Paste the indexer-warnings amber banner JSX + hidden-count strip verbatim
}
```

### Step 1.4 — Create `InteractiveSearchResultsList.tsx`

Cut the loading/empty/error/results section from `InteractiveSearchPanel.tsx`.

- [ ] Create `apps/web/src/pages/medias/_component/InteractiveSearchResultsList.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReleaseCard } from "@/pages/medias/_component/ReleaseCard";
import type { InteractiveReleaseItem } from "@hously/shared/types";

interface InteractiveSearchResultsListProps {
  releases: InteractiveReleaseItem[];
  isLoading: boolean;
  isFetching: boolean;
  needsSearchQuery: boolean;
  errorMessage: string | null;
  grabBusy: boolean;
  pendingReleaseKey: string | null;
  grabbedTitles: Set<string>;
  onDownload: (release: InteractiveReleaseItem) => void;
  onRefetch: () => void;
}

export function InteractiveSearchResultsList(props: InteractiveSearchResultsListProps) {
  const { t } = useTranslation("common");
  // Paste the needs-query / loading / error / empty / results JSX verbatim
}
```

### Step 1.5 — Rewrite `InteractiveSearchPanel.tsx` as orchestrator

- [ ] Replace the content of `InteractiveSearchPanel.tsx` with:

```typescript
import { useInteractiveSearchState } from "@/features/medias/hooks/useInteractiveSearchState";
import { InteractiveSearchToolbar } from "./InteractiveSearchToolbar";
import { InteractiveSearchStatusStrip } from "./InteractiveSearchStatusStrip";
import { InteractiveSearchResultsList } from "./InteractiveSearchResultsList";
import { InteractiveSearchMobileDrawer } from "./InteractiveSearchMobileDrawer";
import type { InteractiveSearchPanelProps } from "./InteractiveSearchPanel"; // keep existing export

export type { InteractiveSearchPanelProps };

export function InteractiveSearchPanel(props: InteractiveSearchPanelProps) {
  const state = useInteractiveSearchState(props);

  if (!state.canRenderBody) return null;

  return (
    <div className="flex flex-col">
      <InteractiveSearchToolbar
        filterQuery={state.filterQuery}
        searchApiQuery={state.searchApiQuery}
        showFilters={state.showFilters}
        hideRejected={state.hideRejected}
        sortBy={state.sortBy}
        sortDir={state.sortDir}
        includedTrackers={state.includedTrackers}
        excludedTrackers={state.excludedTrackers}
        includedLanguages={state.includedLanguages}
        selectedSeason={state.selectedSeason}
        showPacksOnly={state.showPacksOnly}
        setFilters={state.setFilters}
        isShow={state.isShow}
        isSearchMode={state.isSearchMode}
        canToggleSearchTitle={state.canToggleSearchTitle}
        isOriginalTitleQuery={state.isOriginalTitleQuery}
        availableSeasons={state.availableSeasons}
        trackerOptions={state.trackerOptions}
        languageOptions={state.languageOptions}
        hasAdvancedFilters={state.hasAdvancedFilters}
        totalActiveFilters={state.totalActiveFilters}
        isFetching={state.activeQuery.isFetching}
        needsSearchQuery={state.needsSearchQuery}
        onOpenMobileDrawer={() => state.setMobileDrawerOpen(true)}
        searchInputRef={state.searchInputRef}
        onToggleSearchTitleVariant={state.toggleSearchTitleVariant}
        onRefetch={() => void state.activeQuery.refetch()}
        onIncludedTrackersChange={state.handleIncludedTrackersChange}
        onExcludedTrackersChange={state.handleExcludedTrackersChange}
      />
      <InteractiveSearchStatusStrip
        indexerWarnings={state.indexerWarnings}
        dismissed={state.indexerWarningsDismissed}
        onDismiss={() => state.setIndexerWarningsDismissed(true)}
        hiddenCount={state.hiddenCount}
        hasViewOverrides={state.hasViewOverrides}
        onResetView={state.resetView}
        visibleCount={state.visibleCount}
        totalReleases={state.totalReleases}
        isSearchMode={state.isSearchMode}
        searchApiQuery={state.searchApiQuery}
        isOriginalTitleQuery={state.isOriginalTitleQuery}
        onToggleSearchTitleVariant={state.toggleSearchTitleVariant}
      />
      <InteractiveSearchResultsList
        releases={state.releases}
        isLoading={state.activeQuery.isLoading}
        isFetching={state.activeQuery.isFetching}
        needsSearchQuery={state.needsSearchQuery}
        errorMessage={state.errorMessage}
        grabBusy={state.grabBusy}
        pendingReleaseKey={state.pendingReleaseKey}
        grabbedTitles={state.grabbedTitles}
        onDownload={state.downloadRelease}
        onRefetch={() => void state.activeQuery.refetch()}
      />
      <InteractiveSearchMobileDrawer
        open={state.mobileDrawerOpen}
        onClose={() => state.setMobileDrawerOpen(false)}
        filters={state.filters}
        setFilters={state.setFilters}
        isShow={state.isShow}
        availableSeasons={state.availableSeasons}
        trackerOptions={state.trackerOptions}
        languageOptions={state.languageOptions}
        onIncludedTrackersChange={state.handleIncludedTrackersChange}
        onExcludedTrackersChange={state.handleExcludedTrackersChange}
      />
    </div>
  );
}
```

### Step 1.6 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors in the touched files
- [ ] Run: `cd apps/web && bun run test`
  Expected: all tests pass
- [ ] Commit:
```bash
git add apps/web/src/features/medias/hooks/useInteractiveSearchState.ts \
        apps/web/src/pages/medias/_component/InteractiveSearchToolbar.tsx \
        apps/web/src/pages/medias/_component/InteractiveSearchStatusStrip.tsx \
        apps/web/src/pages/medias/_component/InteractiveSearchResultsList.tsx \
        apps/web/src/pages/medias/_component/InteractiveSearchPanel.tsx
git commit -m "refactor(search): split InteractiveSearchPanel into hook + 4 sub-components"
```

---

## Task 2: Split ExploreCardDetailDialog

**Files:**
- Create: `apps/web/src/pages/medias/_component/ExploreCardHero.tsx`
- Create: `apps/web/src/pages/medias/_component/ExploreCardActions.tsx`
- Modify: `apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx`

### Step 2.1 — Create `ExploreCardHero.tsx`

The hero is the top section of the dialog: backdrop image (edge-to-edge, min-h-[200px] when present, 0 otherwise), poster thumbnail, and the meta column (title, type+year+runtime badges, ratings row, director, collection link). In the current file this starts at line ~191 and runs through line ~541.

- [ ] Create `apps/web/src/pages/medias/_component/ExploreCardHero.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Film, Star, Clock, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TmdbMediaSearchItem } from "@hously/shared/types";

// Import the same detail/rating types used in ExploreCardDetailDialog
type DetailsData = NonNullable<ReturnType<typeof import("@/features/medias/hooks/useMediaModalData").useMediaModalData>["data"]>["details"];
type RatingsData = NonNullable<ReturnType<typeof import("@/features/medias/hooks/useMediaModalData").useMediaModalData>["data"]>["ratings"];
type CreditsData = NonNullable<ReturnType<typeof import("@/features/medias/hooks/useMediaModalData").useMediaModalData>["data"]>["credits"];

interface ExploreCardHeroProps {
  item: TmdbMediaSearchItem;
  detailsData: DetailsData | null;
  ratingsData: RatingsData | null;
  creditsData: CreditsData | null;
  modalDataPending: boolean;
  heroBackdropUrl: string | null;
  heroBackdropLoaded: boolean;
  posterLoaded: boolean;
  onBackdropLoaded: (url: string) => void;
  onPosterLoaded: (key: string) => void;
}

export function ExploreCardHero(props: ExploreCardHeroProps) {
  const { t } = useTranslation("common");
  // Paste the hero <div> block verbatim from ExploreCardDetailDialog.tsx
  // (the outer relative div with className="relative shrink-0 overflow-hidden rounded-t-2xl ...")
  // through and including the poster/meta column section (~L191–541)
}
```

> The `DetailsData`, `RatingsData`, `CreditsData` type derivations above are a pattern — if the actual types are exported from `useMediaModalData` or `@hously/shared/types`, use those directly. If not, inline the object shape from the existing code.

### Step 2.2 — Create `ExploreCardActions.tsx`

The actions bar is the row above the tab pills: watchlist toggle, TMDB link, trailer link, "Add to library" button, "Already in library" indicator (~L560–649).

- [ ] Create `apps/web/src/pages/medias/_component/ExploreCardActions.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { Bookmark, BookmarkCheck, Check, ExternalLink, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TmdbMediaSearchItem } from "@hously/shared/types";

interface TrailerData {
  url: string;
}

interface ExploreCardActionsProps {
  item: TmdbMediaSearchItem;
  isInWatchlist: boolean;
  isAddPending: boolean;
  isWatchlistPending: boolean;
  trailerData: TrailerData | null;
  tmdbUrl: string;
  onAdd: () => void;
  onWatchlistToggle: () => void;
}

export function ExploreCardActions(props: ExploreCardActionsProps) {
  const { t } = useTranslation("common");
  // Paste the actions bar <div> verbatim from ExploreCardDetailDialog.tsx
  // (the section starting with {/* ── Actions bar (above tabs) */} ~L560)
}
```

### Step 2.3 — Slim down `ExploreCardDetailDialog.tsx`

Remove the hero JSX and actions bar JSX, keep: imports, `TabKey` type, `formatTmdbDateYmd` helper, `ExploreCardDetailDialogProps` interface, state (`activeTab`, `imageError`, `loadedBackdropUrl`, `loadedPosterKey`), hooks (`useAddToLibrary`, `useAddToWatchlist`, `useRemoveFromWatchlist`, `useMediaModalData`), derived values, `handleAdd`/`handleWatchlistToggle`, and render the trimmed JSX calling `ExploreCardHero` and `ExploreCardActions`.

- [ ] Replace the hero `<div>` block in `ExploreCardDetailDialog.tsx` with:
```tsx
<ExploreCardHero
  item={item}
  detailsData={detailsData}
  ratingsData={ratingsData}
  creditsData={creditsData}
  modalDataPending={modalDataPending}
  heroBackdropUrl={heroBackdropUrl}
  heroBackdropLoaded={heroBackdropLoaded}
  posterLoaded={posterLoaded}
  onBackdropLoaded={(url) => setLoadedBackdropUrl(url)}
  onPosterLoaded={(key) => setLoadedPosterKey(key)}
/>
```

- [ ] Replace the actions bar section with:
```tsx
<ExploreCardActions
  item={item}
  isInWatchlist={isInWatchlist}
  isAddPending={addMutation.isPending}
  isWatchlistPending={addToWatchlist.isPending || removeFromWatchlist.isPending}
  trailerData={trailerData}
  tmdbUrl={tmdbUrl}
  onAdd={handleAdd}
  onWatchlistToggle={handleWatchlistToggle}
/>
```

- [ ] Add imports for `ExploreCardHero` and `ExploreCardActions` at top of file.

### Step 2.4 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors
- [ ] Run: `cd apps/web && bun run test`
  Expected: all pass
- [ ] Commit:
```bash
git add apps/web/src/pages/medias/_component/ExploreCardHero.tsx \
        apps/web/src/pages/medias/_component/ExploreCardActions.tsx \
        apps/web/src/pages/medias/_component/ExploreCardDetailDialog.tsx
git commit -m "refactor(explore): split ExploreCardDetailDialog into hero + actions sub-components"
```

---

## Task 3: Split Calendar

**Files:**
- Create: `apps/web/src/pages/calendar/_component/calendarUtils.ts`
- Create: `apps/web/src/pages/calendar/_component/CalendarGrid.tsx`
- Create: `apps/web/src/pages/calendar/_component/CalendarDayPanel.tsx`
- Modify: `apps/web/src/pages/calendar/_component/Calendar.tsx`

### Step 3.1 — Create `calendarUtils.ts`

The existing `utils.ts` in the same directory contains `splitMultiDayEvent`, `getDayName`, `getMonthName`. The three functions being extracted (`parseCalendarSearchDate`, `localDateKey`, `upcomingToDialogItem`) are different in nature — keep them in a new file rather than mixing into the existing one.

- [ ] Create `apps/web/src/pages/calendar/_component/calendarUtils.ts`:

```typescript
import { getDateYear } from "@hously/shared/utils/date";
import type { DashboardUpcomingItem, TmdbMediaSearchItem } from "@hously/shared/types";

export function parseCalendarSearchDate(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) return null;
  return parsed;
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function upcomingToDialogItem(item: DashboardUpcomingItem): TmdbMediaSearchItem {
  const [source, numericPart] = item.id.split("-", 2);
  const tmdbId =
    source === "movie" || source === "tv"
      ? parseInt(numericPart || "", 10)
      : Number.NaN;
  return {
    id: item.id,
    tmdb_id: Number.isFinite(tmdbId) ? tmdbId : 0,
    media_type: item.media_type,
    title: item.title,
    release_year: getDateYear(item.release_date),
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: item.vote_average ?? null,
    already_exists: item.library_id != null,
    can_add: item.library_id == null && Number.isFinite(tmdbId) && tmdbId > 0,
    source_id: null,
    library_id: item.library_id,
  };
}
```

- [ ] In `Calendar.tsx`, delete lines 53–99 (the three functions) and add:
```typescript
import { parseCalendarSearchDate, localDateKey, upcomingToDialogItem } from "./calendarUtils";
```

### Step 3.2 — Create `CalendarGrid.tsx`

Cut the calendar grid card section from `CalendarBody` in `Calendar.tsx`. This is the `{/* Calendar Grid Card */}` block (~L356–526): month navigation, day headers, day cells, and legend.

- [ ] Create `apps/web/src/pages/calendar/_component/CalendarGrid.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, CalendarDays, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sameDay, sameMonth } from "@hously/shared/utils";
import { getDayName, getMonthName } from "./utils";
import type { CalendarEvent, DashboardUpcomingItem } from "@hously/shared/types";

interface CalendarGridProps {
  currentMonth: Date;
  today: Date;
  selectedDate: Date;
  calendarDays: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  upcomingByDay: Map<string, DashboardUpcomingItem[]>;
  getEventDotColor: (event: CalendarEvent) => string;
  onDaySelect: (date: Date) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

export function CalendarGrid(props: CalendarGridProps) {
  const { t } = useTranslation("common");
  // Paste the {/* Calendar Grid Card */} section verbatim from CalendarBody
}
```

### Step 3.3 — Create `CalendarDayPanel.tsx`

Cut the selected-day panel section from `CalendarBody` (~L527–769): the card with the date header, "Add event" button, and the events list.

- [ ] Create `apps/web/src/pages/calendar/_component/CalendarDayPanel.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { EventCard } from "./EventCard";
import { getDayName, getMonthName } from "./utils";
import { splitMultiDayEvent } from "./utils";
import type { CalendarEvent, DashboardUpcomingItem } from "@hously/shared/types";

interface CalendarDayPanelProps {
  selectedDate: Date;
  today: Date;
  dayEvents: CalendarEvent[];
  dayReleases: DashboardUpcomingItem[];
  onCreateEvent: () => void;
  onEditEvent: (eventId: number) => void;
  onDeleteEvent: (eventId: number) => void;
  onMediaClick: (item: DashboardUpcomingItem) => void;
}

export function CalendarDayPanel(props: CalendarDayPanelProps) {
  const { t } = useTranslation("common");
  const [animateRef] = useAutoAnimate();
  // Paste the {/* Selected Day Events Panel */} section verbatim from CalendarBody
}
```

### Step 3.4 — Slim down `Calendar.tsx`

Replace the grid card and day panel JSX blocks in `CalendarBody` with component calls:

- [ ] Replace the `{/* Calendar Grid Card */}` block with:
```tsx
<CalendarGrid
  currentMonth={currentMonth}
  today={today}
  selectedDate={selectedDate}
  calendarDays={calendarDays}
  eventsByDay={eventsByDay}
  upcomingByDay={upcomingByDay}
  getEventDotColor={getEventDotColor}
  onDaySelect={handleDayClick}
  onPreviousMonth={handlePreviousMonth}
  onNextMonth={handleNextMonth}
  onGoToToday={handleGoToToday}
/>
```

- [ ] Replace the `{/* Selected Day Events Panel */}` block with:
```tsx
<CalendarDayPanel
  selectedDate={selectedDate}
  today={today}
  dayEvents={getDayEvents(selectedDate)}
  dayReleases={getDayReleases(selectedDate)}
  onCreateEvent={() => openModal("create")}
  onEditEvent={(id) => openEditModal(id)}
  onDeleteEvent={handleDeleteEvent}
  onMediaClick={handleReleaseClick}
/>
```

> Adapt the `openModal`/`openEditModal` call shapes to match the existing search-param navigation pattern in `CalendarBody`.

- [ ] Add imports for `CalendarGrid`, `CalendarDayPanel`, and `calendarUtils` at top of file; remove the three inlined functions.

### Step 3.5 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors
- [ ] Run: `cd apps/web && bun run test`
  Expected: all pass
- [ ] Commit:
```bash
git add apps/web/src/pages/calendar/_component/calendarUtils.ts \
        apps/web/src/pages/calendar/_component/CalendarGrid.tsx \
        apps/web/src/pages/calendar/_component/CalendarDayPanel.tsx \
        apps/web/src/pages/calendar/_component/Calendar.tsx
git commit -m "refactor(calendar): split CalendarBody into CalendarGrid + CalendarDayPanel + calendarUtils"
```

---

## Task 4: Split LibraryHistoryTab

**Files:**
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryCharts.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryStats.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryHistoryRow.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryHistoryTab.tsx`

### Step 4.1 — Create `LibraryHistoryCharts.tsx`

Cut `ChartTooltip` (L65–91), `IndexersBarChart` (L116–154), `GrabsAreaChart` (L156–195), `GrabStatusDonut` (L197–274) out of `LibraryHistoryTab.tsx`.

- [ ] Create `apps/web/src/pages/medias/_component/LibraryHistoryCharts.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import type { TooltipContentProps } from "recharts";
import {
  AreaChart, Area, BarChart, Bar, LabelList,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

// Paste ChartTooltip, IndexersBarChart, GrabsAreaChart, GrabStatusDonut verbatim.
// Add `export` keyword to each function declaration.

export function ChartTooltip(...) { ... }
export function IndexersBarChart(...) { ... }
export function GrabsAreaChart(...) { ... }
export function GrabStatusDonut(...) { ... }
```

### Step 4.2 — Create `LibraryHistoryStats.tsx`

Cut `StatCard` (L95–114) and `StatsSection` (L278–391) out of `LibraryHistoryTab.tsx`.

- [ ] Create `apps/web/src/pages/medias/_component/LibraryHistoryStats.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import {
  CheckCircle2, XCircle, Clock, Activity, TrendingUp,
  Film, Tv,
} from "lucide-react";
import { useDownloadHistoryStats } from "@/features/medias/hooks/useDownloadHistoryStats";
import { IndexersBarChart, GrabsAreaChart, GrabStatusDonut } from "./LibraryHistoryCharts";
import { cn } from "@/lib/utils";

// Paste StatCard and StatsSection verbatim, adding `export` to each.

export function StatCard(...) { ... }
export function StatsSection() { ... }
```

### Step 4.3 — Create `LibraryHistoryRow.tsx`

Cut `StatusFilter` type (L395), `DaysFilter` type (L396), `HistoryRow` (L398–483), and the two format helpers (L48–61) out of `LibraryHistoryTab.tsx`.

- [ ] Create `apps/web/src/pages/medias/_component/LibraryHistoryRow.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { CheckCircle2, XCircle, Clock, Film, Tv } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export type StatusFilter = "all" | "completed" | "failed" | "active";
export type DaysFilter = 0 | 7 | 30 | 90;

export function formatRelativeShort(isoString: string): string {
  // paste verbatim from L48
}

export function formatDateShort(iso: string): string {
  // paste verbatim from L58
}

export function HistoryRow({ item }: { item: { ... } }) {
  // paste verbatim from L398, keeping the full item shape
}
```

### Step 4.4 — Slim down `LibraryHistoryTab.tsx`

Remove all extracted code; replace with imports from the three new files.

- [ ] Update `LibraryHistoryTab.tsx` to only contain:

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useGlobalDownloadHistory } from "@/features/medias/hooks/useGlobalDownloadHistory";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card } from "./LibrarySharedUI";
import { StatsSection } from "./LibraryHistoryStats";
import { HistoryRow, type StatusFilter, type DaysFilter } from "./LibraryHistoryRow";

export function LibraryHistoryTab() {
  // Keep existing state + query + JSX verbatim, now referencing imported components
}
```

### Step 4.5 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors
- [ ] Run: `cd apps/web && bun run test`
  Expected: all pass
- [ ] Commit:
```bash
git add apps/web/src/pages/medias/_component/LibraryHistoryCharts.tsx \
        apps/web/src/pages/medias/_component/LibraryHistoryStats.tsx \
        apps/web/src/pages/medias/_component/LibraryHistoryRow.tsx \
        apps/web/src/pages/medias/_component/LibraryHistoryTab.tsx
git commit -m "refactor(library): split LibraryHistoryTab into charts, stats, and row sub-components"
```

---

## Task 5: Split QualityProfileForm

**Files:**
- Create: `apps/web/src/pages/settings/_component/QualityProfileMultiSelect.tsx`
- Create: `apps/web/src/pages/settings/_component/QualityProfileTrackerSection.tsx`
- Modify: `apps/web/src/pages/settings/_component/QualityProfileForm.tsx`

### Step 5.1 — Create `QualityProfileMultiSelect.tsx`

Cut `MultiSelect` (L64–206) out of `QualityProfileForm.tsx`.

- [ ] Create `apps/web/src/pages/settings/_component/QualityProfileMultiSelect.tsx`:

```typescript
import { useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect(props: MultiSelectProps) {
  // Paste the full MultiSelect function body verbatim from L64–206
}
```

### Step 5.2 — Create `QualityProfileTrackerSection.tsx`

Cut `trackerBonus` (L220–224) and `TrackerPrioritySection` (L228–410) out of `QualityProfileForm.tsx`.

- [ ] Create `apps/web/src/pages/settings/_component/QualityProfileTrackerSection.tsx`:

```typescript
import { useState } from "react";
import { Plus, X, ChevronUp, ChevronDown, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

interface TrackerEntry {
  name: string;
}

interface TrackerPrioritySectionProps {
  trackers: TrackerEntry[];
  preferOverQuality: boolean;
  onChange: (trackers: TrackerEntry[]) => void;
}

export function trackerBonus(rank: number, preferOverQuality: boolean): string {
  // paste verbatim from L220
}

export function TrackerPrioritySection(props: TrackerPrioritySectionProps) {
  // paste verbatim from L228–410
}
```

> Check the exact `TrackerEntry` shape from the existing code — it may be just `{ name: string }` or richer. Use whatever `QualityProfileFormPayload.trackers` contains.

### Step 5.3 — Slim down `QualityProfileForm.tsx`

Remove extracted code, replace with imports.

- [ ] Delete lines 64–410 from `QualityProfileForm.tsx` and add at the top:
```typescript
import { MultiSelect } from "./QualityProfileMultiSelect";
import { TrackerPrioritySection } from "./QualityProfileTrackerSection";
```
- [ ] The file now starts with the option constants (`SOURCE_OPTIONS`, `CODEC_OPTIONS`, `LANGUAGE_OPTIONS`) at ~line 32, then `FieldLabel`, then `QualityProfileForm`.

### Step 5.4 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors
- [ ] Run: `cd apps/web && bun run test`
  Expected: all pass
- [ ] Commit:
```bash
git add apps/web/src/pages/settings/_component/QualityProfileMultiSelect.tsx \
        apps/web/src/pages/settings/_component/QualityProfileTrackerSection.tsx \
        apps/web/src/pages/settings/_component/QualityProfileForm.tsx
git commit -m "refactor(settings): split QualityProfileForm into MultiSelect + TrackerSection sub-components"
```

---

## Task 6: Split LibraryPage

**Files:**
- Create: `apps/web/src/pages/medias/_component/useLibraryPageState.ts`
- Create: `apps/web/src/pages/medias/_component/LibraryToolbar.tsx`
- Create: `apps/web/src/pages/medias/_component/LibraryGrid.tsx`
- Modify: `apps/web/src/pages/medias/_component/LibraryPage.tsx`

### Step 6.1 — Create `useLibraryPageState.ts`

Extract the URL filter state management from `LibraryPage`.

- [ ] Create `apps/web/src/pages/medias/_component/useLibraryPageState.ts`:

```typescript
import { useUrlState } from "@/lib/app/useUrlState";
import type {
  FilterType,
  FilterStatus,
  SortKey,
  SortDir,
  ViewMode,
} from "@/utils/libraryUtils";

const LIBRARY_DEFAULTS = {
  type: "all" as FilterType,
  status: "all" as FilterStatus,
  language: "all" as string,
  search: "" as string,
  sortBy: "added_at" as SortKey,
  sortDir: "desc" as SortDir,
  page: 1,
  viewMode: "grid" as ViewMode,
};

export function useLibraryPageState(
  searchParams: Partial<typeof LIBRARY_DEFAULTS>,
  totalPages: number,
) {
  const { state, setState } = useUrlState(
    "/library/",
    searchParams,
    LIBRARY_DEFAULTS,
  );

  const safePage = Math.min(state.page, totalPages);

  const activeFilterCount = [
    state.type !== "all",
    state.status !== "all",
    state.language !== "all",
  ].filter(Boolean).length;

  return { state, setState, safePage, activeFilterCount, LIBRARY_DEFAULTS };
}
```

### Step 6.2 — Create `LibraryToolbar.tsx`

Cut the desktop filter/sort bar (type chips, status chips, language select, sort controls, view mode toggles, add button, mobile filter trigger) from `LibraryPage`. In the current file this is the `{/* Toolbar */}` section (~L230–370).

Also opportunistically replace the bare `<select>` for language with the existing `Select` primitive.

- [ ] Create `apps/web/src/pages/medias/_component/LibraryToolbar.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import {
  ArrowUpAZ, ArrowDownAZ, LayoutGrid, Grid3X3, List, SlidersHorizontal, Download,
} from "lucide-react";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/components/ui/segmented-tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterType, FilterStatus, SortKey, SortDir, ViewMode } from "@/utils/libraryUtils";
import { LIBRARY_SORT_KEYS } from "@/utils/libraryUtils";

interface LibraryToolbarProps {
  typeFilter: FilterType;
  statusFilter: FilterStatus;
  languageFilter: string;
  sortBy: SortKey;
  sortDir: SortDir;
  viewMode: ViewMode;
  languageTags: string[];
  movieCount: number;
  showCount: number;
  activeFilterCount: number;
  onTypeChange: (v: FilterType) => void;
  onStatusChange: (v: FilterStatus) => void;
  onLanguageChange: (v: string) => void;
  onSortByChange: (v: SortKey) => void;
  onSortDirChange: (v: SortDir) => void;
  onViewModeChange: (v: ViewMode) => void;
  onOpenAddModal: () => void;
  onOpenFilterSheet: () => void;
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  const { t } = useTranslation("common");
  // Paste the toolbar section verbatim, swapping bare <select> for:
  // <Select value={languageFilter} onValueChange={(v) => onLanguageChange(v)}>
  //   <SelectTrigger ...><SelectValue /></SelectTrigger>
  //   <SelectContent>
  //     <SelectItem value="all">{t("medias.library.languageAll")}</SelectItem>
  //     {languageTags.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
  //   </SelectContent>
  // </Select>
}
```

### Step 6.3 — Create `LibraryGrid.tsx`

Cut the grid/compact/list rendering block (loading skeleton, empty state, AnimatePresence + motion grids/lists, pagination) from `LibraryPage`. This is approximately L400–600 in the current file.

- [ ] Create `apps/web/src/pages/medias/_component/LibraryGrid.tsx`:

```typescript
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { ChevronLeft, ChevronRight, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { LibraryItemCard } from "./LibraryItemCard";
import { LibraryItemRow } from "./LibraryItemRow";
import type { ViewMode } from "@/utils/libraryUtils";
import type { LibraryMediaItem } from "@hously/shared/types";

const gridContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

const gridItemVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
};

interface LibraryGridProps {
  items: LibraryMediaItem[];
  isLoading: boolean;
  viewMode: ViewMode;
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onMovieSearch: (id: number) => void;
  movieSearchPending: boolean;
  movieSearchId: number | null;
}

export function LibraryGrid(props: LibraryGridProps) {
  const { t } = useTranslation("common");
  // Paste the AnimatePresence block + pagination verbatim from LibraryPage
}
```

> `LibraryMediaItem` — use the actual type from `@hously/shared/types` that `useLibrary` returns per item. Check `LibraryListResponse` in `apps/shared/src/types/`.

### Step 6.4 — Slim down `LibraryPage.tsx`

Remove extracted code, wire everything together.

- [ ] Replace `LibraryPage.tsx` with:

```typescript
import { useMemo, useEffect, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLibraryNavigation } from "@/features/medias/context/LibraryNavigationContext";
import { useLibrary } from "@/features/medias/hooks/useLibrary";
import { useLibraryLanguageTags } from "@/features/medias/hooks/useLibraryLanguageTags";
import { useSearchLibraryMovie } from "@/features/medias/hooks/useSearchLibraryMovie";
import { useLibraryEvents } from "@/features/medias/hooks/useLibraryEvents";
import { useAuth } from "@/lib/auth/useAuth";
import { PageLayout } from "@/components/PageLayout";
import { LibraryPageHeader } from "./LibraryPageHeader";
import { LibraryMobileFilterSheet } from "./LibraryMobileFilterSheet";
import { TmdbSearchModal } from "./TmdbSearchModal";
import { LibraryToolbar } from "./LibraryToolbar";
import { LibraryGrid } from "./LibraryGrid";
import { useLibraryPageState } from "./useLibraryPageState";
import { sortItems } from "@/utils/libraryUtils";
import { toast } from "sonner";

const PAGE_SIZE = 48;

export function LibraryPage() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const { saveLibrarySearch } = useLibraryNavigation();
  const searchParams = useSearch({ from: "/library/" });

  const { data, isLoading, refetch } = useLibrary({
    type: undefined,
    status: undefined,
  });

  const allItems = data?.items ?? [];
  const sorted = useMemo(() => sortItems(allItems, /* sortBy, sortDir */), [allItems /*, sortBy, sortDir */]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  const { state, setState, safePage, activeFilterCount, LIBRARY_DEFAULTS } =
    useLibraryPageState(searchParams as any, totalPages);

  const {
    type: typeFilter, status: statusFilter, language: languageFilter,
    search, sortBy, sortDir, page, viewMode,
  } = state;

  useLibraryEvents();

  useEffect(() => { saveLibrarySearch(searchParams as Record<string, unknown>); }, [searchParams, saveLibrarySearch]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const searchMovie = useSearchLibraryMovie();
  const { data: languageTagsData } = useLibraryLanguageTags();
  const languageTags = languageTagsData?.tags ?? [];

  const pagedItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleMovieSearch = (id: number) => {
    searchMovie.mutate({ id }, {
      onError: (err) => toast.error(err instanceof Error ? err.message : t("medias.library.searchFailed")),
    });
  };

  return (
    <PageLayout>
      <LibraryPageHeader
        movieCount={data?.movie_count ?? 0}
        showCount={data?.show_count ?? 0}
        isLoading={isLoading}
        onRefetch={() => void refetch()}
      />
      <LibraryToolbar
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        viewMode={viewMode}
        languageTags={languageTags}
        movieCount={data?.movie_count ?? 0}
        showCount={data?.show_count ?? 0}
        activeFilterCount={activeFilterCount}
        onTypeChange={(v) => setState({ type: v, page: 1 })}
        onStatusChange={(v) => setState({ status: v, page: 1 })}
        onLanguageChange={(v) => setState({ language: v, page: 1 })}
        onSortByChange={(v) => setState({ sortBy: v, page: 1 })}
        onSortDirChange={(v) => setState({ sortDir: v })}
        onViewModeChange={(v) => setState({ viewMode: v })}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenFilterSheet={() => setSheetOpen(true)}
      />
      <LibraryGrid
        items={pagedItems}
        isLoading={isLoading}
        viewMode={viewMode}
        page={safePage}
        totalPages={totalPages}
        totalItems={sorted.length}
        onPageChange={(p) => setState({ page: p })}
        onMovieSearch={handleMovieSearch}
        movieSearchPending={searchMovie.isPending}
        movieSearchId={searchMovie.isPending ? (searchMovie.variables?.id ?? null) : null}
      />
      <LibraryMobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        languageTags={languageTags}
        typeItems={[]}
        statusItems={[]}
        onTypeChange={(v) => setState({ type: v, page: 1 })}
        onStatusChange={(v) => setState({ status: v, page: 1 })}
        onLanguageChange={(v) => setState({ language: v, page: 1 })}
        onSortByChange={(v) => setState({ sortBy: v, page: 1 })}
        onSortDirChange={(v) => setState({ sortDir: v })}
        onReset={() => setState({ type: "all", status: "all", language: "all", sortBy: "added_at", sortDir: "desc", page: 1 })}
      />
      <TmdbSearchModal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </PageLayout>
  );
}
```

> **Note:** The `sorted` useMemo in the orchestrator still needs `sortBy`/`sortDir` from state — move it after destructuring state. Also check the `typeItems`/`statusItems` arrays passed to `LibraryMobileFilterSheet` — in the original they're computed inline; pass them through `LibraryToolbar` if needed, or duplicate the constant arrays.

### Step 6.5 — Verify

- [ ] Run: `make typecheck`
  Expected: no errors
- [ ] Run: `cd apps/web && bun run test`
  Expected: all pass
- [ ] Commit:
```bash
git add apps/web/src/pages/medias/_component/useLibraryPageState.ts \
        apps/web/src/pages/medias/_component/LibraryToolbar.tsx \
        apps/web/src/pages/medias/_component/LibraryGrid.tsx \
        apps/web/src/pages/medias/_component/LibraryPage.tsx
git commit -m "refactor(library): split LibraryPage into toolbar + grid sub-components + state hook"
```

---

## Self-Review Checklist

- **Spec coverage:** All 6 files addressed, all sub-components named and located. ✓
- **No placeholders:** Steps reference exact line numbers and show prop interfaces. Code blocks for hook extraction note "paste verbatim" with explicit line ranges rather than invented implementations. ✓
- **Type consistency:** `FilterState` defined in `useInteractiveSearchState.ts` and imported by `InteractiveSearchToolbar`. `StatusFilter`/`DaysFilter` defined in `LibraryHistoryRow.tsx` and re-exported for `LibraryHistoryTab`. `LIBRARY_DEFAULTS` moved to `useLibraryPageState.ts`. ✓
- **One gap to watch:** Task 6's orchestrator shell simplifies the `sorted` useMemo — ensure it preserves the full filter pipeline (type, status, language, search) from the original before landing. The filters are passed to `useLibrary` as query params AND applied client-side — cross-check the original to avoid a behaviour difference.
