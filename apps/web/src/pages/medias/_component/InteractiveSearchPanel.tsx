import { useState } from "react";
import { useInteractiveSearchState } from "@/features/medias/hooks/useInteractiveSearchState";
import { useLocalAiIntegration } from "@/pages/settings/useLocalAiIntegration";
import { useAiPick } from "@/pages/medias/_component/useAiPick";
import { AiPickBanner } from "@/pages/medias/_component/AiPickBanner";
import { InteractiveSearchToolbar } from "./InteractiveSearchToolbar";
import { InteractiveSearchStatusStrip } from "./InteractiveSearchStatusStrip";
import { InteractiveSearchResultsList } from "./InteractiveSearchResultsList";
import { InteractiveSearchMobileDrawer } from "./InteractiveSearchMobileDrawer";
import type { MediaItem } from "@hously/shared/types";

export interface InteractiveSearchPanelProps {
  isActive: boolean;
  media?: MediaItem | null;
  mode?: "arr" | "search";
  /** Native library row id — enables quality scoring on search results */
  libraryMediaId?: number | null;
  /** Prefill search query when opening (e.g. media title) — localized EN/FR (UI) title */
  defaultSearchQuery?: string | null;
  /** Same query shape but using TMDB original-language title; enables title toggle */
  searchQueryOriginal?: string | null;
  /** Episode to link the grab to (shows only) */
  episodeId?: number | null;
  /** Pre-select a season (number) or complete series ("complete") when opening */
  defaultSeason?: number | "complete" | null;
  /** When true, grabs are sent with is_upgrade: true */
  isUpgradeMode?: boolean;
  onDownloadSuccess?: () => void;
}

export function InteractiveSearchPanel(props: InteractiveSearchPanelProps) {
  const state = useInteractiveSearchState(props);

  const { data: aiConfig } = useLocalAiIntegration();
  const aiEnabled = Boolean(aiConfig?.integration?.enabled);

  const mediaType =
    props.media?.media_type === "series"
      ? "tv"
      : (props.media?.media_type ?? "movie");

  const aiPick = useAiPick({
    enabled:
      aiEnabled && state.releases.length > 0 && !state.activeQuery.isLoading,
    releases: state.releases,
    mediaTitle: props.media?.title ?? props.defaultSearchQuery ?? "",
    mediaYear: props.media?.year ?? null,
    mediaType: mediaType as "movie" | "tv",
  });

  const pickedRelease =
    aiPick.data?.release_key != null
      ? (state.releases.find((r) => r.guid === aiPick.data?.release_key) ??
        null)
      : null;

  const [aiDismissed, setAiDismissed] = useState(false);

  if (!state.canRenderBody) return null;

  return (
    <div className="flex flex-col">
      <InteractiveSearchToolbar
        filterQuery={state.filterQuery}
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
        availableSeasons={state.availableSeasons}
        trackerOptions={state.trackerOptions}
        languageOptions={state.languageOptions}
        hasAdvancedFilters={state.hasAdvancedFilters}
        totalActiveFilters={state.totalActiveFilters}
        isFetching={state.activeQuery.isFetching}
        needsSearchQuery={state.needsSearchQuery}
        onOpenMobileDrawer={() => state.setMobileDrawerOpen(true)}
        searchInputRef={state.searchInputRef}
        onRefetch={() => void state.activeQuery.refetch()}
        onIncludedTrackersChange={state.handleIncludedTrackersChange}
        onExcludedTrackersChange={state.handleExcludedTrackersChange}
      />

      {/* Mobile bottom drawer — all controls except search + toggles */}
      <InteractiveSearchMobileDrawer
        open={state.mobileDrawerOpen}
        onClose={() => state.setMobileDrawerOpen(false)}
        isShow={state.isShow}
        availableSeasons={state.availableSeasons}
        selectedSeason={state.selectedSeason}
        onSeasonChange={(s) =>
          state.setFilters((prev) => ({ ...prev, selectedSeason: s }))
        }
        needsSearchQuery={state.needsSearchQuery}
        visibleCount={state.visibleCount}
        totalReleases={state.totalReleases}
        hiddenCount={state.hiddenCount}
        searchApiQuery={state.searchApiQuery}
        canToggleSearchTitle={state.canToggleSearchTitle}
        isOriginalTitleQuery={state.isOriginalTitleQuery}
        onToggleSearchTitle={state.toggleSearchTitleVariant}
        hideRejected={state.hideRejected}
        onHideRejectedChange={(v) =>
          state.setFilters((prev) => ({ ...prev, hideRejected: v }))
        }
        showPacksOnly={state.showPacksOnly}
        onShowPacksOnlyChange={(v) =>
          state.setFilters((prev) => ({ ...prev, showPacksOnly: v }))
        }
        hasViewOverrides={state.hasViewOverrides}
        onResetView={state.resetView}
        sortBy={state.sortBy}
        sortDir={state.sortDir}
        onSortByChange={(v) =>
          state.setFilters((prev) => ({ ...prev, sortBy: v }))
        }
        onToggleSortDir={() =>
          state.setFilters((prev) => ({
            ...prev,
            sortDir: prev.sortDir === "asc" ? "desc" : "asc",
          }))
        }
        totalActiveFilters={state.totalActiveFilters}
        hasAdvancedFilters={state.hasAdvancedFilters}
        onClearFilters={() =>
          state.setFilters((prev) => ({
            ...prev,
            includedTrackers: [],
            excludedTrackers: [],
            includedLanguages: [],
          }))
        }
        trackerOptions={state.trackerOptions}
        includedTrackers={state.includedTrackers}
        excludedTrackers={state.excludedTrackers}
        onIncludedTrackersChange={state.handleIncludedTrackersChange}
        onExcludedTrackersChange={state.handleExcludedTrackersChange}
        languageOptions={state.languageOptions}
        includedLanguages={state.includedLanguages}
        onIncludedLanguagesChange={(values) =>
          state.setFilters((prev) => ({ ...prev, includedLanguages: values }))
        }
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
        canToggleSearchTitle={state.canToggleSearchTitle}
        isOriginalTitleQuery={state.isOriginalTitleQuery}
        onToggleSearchTitleVariant={state.toggleSearchTitleVariant}
      />

      {!aiDismissed && aiEnabled && (
        <AiPickBanner
          isLoading={aiPick.isLoading}
          isError={aiPick.isError}
          release={pickedRelease}
          reasoning={aiPick.data?.reasoning ?? null}
          grabBusy={state.grabBusy}
          onGrab={state.downloadRelease}
          onRetry={() => void aiPick.refetch()}
          onDismiss={() => setAiDismissed(true)}
        />
      )}

      <InteractiveSearchResultsList
        releases={state.releases}
        isLoading={state.activeQuery.isLoading}
        needsSearchQuery={state.needsSearchQuery}
        errorMessage={state.errorMessage}
        grabBusy={state.grabBusy}
        pendingReleaseKey={state.pendingReleaseKey}
        grabbedTitles={state.grabbedTitles}
        onDownload={state.downloadRelease}
        onRefetch={() => void state.activeQuery.refetch()}
        totalReleases={state.totalReleases}
        isError={state.activeQuery.isError}
        onResetView={state.resetView}
      />
    </div>
  );
}
