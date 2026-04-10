import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowDownAZ,
  ArrowUpZA,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useProwlarrInteractiveDownload,
  useProwlarrInteractiveSearch,
} from "@/hooks/medias/useMedias";
import { useLibraryGrabRelease, useLibraryEpisodes } from "@/hooks/medias/useLibrary";
import type { InteractiveReleaseItem, MediaItem } from "@hously/shared/types";
import {
  filterAndSortReleases,
  normalizeFilterKey,
  UNKNOWN_TRACKER_KEY,
  UNKNOWN_LANGUAGE_KEY,
  type InteractiveSortKey,
  type InteractiveSortDir,
} from "@hously/shared/utils";
import {
  Toggle,
  ChipMultiSelect,
  FilterSection,
  type FilterOption,
} from "./InteractiveSearchFilters";
import { ReleaseCard } from "./ReleaseCard";

export interface InteractiveSearchPanelProps {
  isActive: boolean;
  media?: MediaItem | null;
  mode?: "arr" | "prowlarr";
  /** Native library row id — enables quality scoring on Prowlarr results */
  libraryMediaId?: number | null;
  /** Prefill Prowlarr query when opening (e.g. media title) */
  defaultProwlarrQuery?: string | null;
  /** Episode to link the grab to (shows only) */
  episodeId?: number | null;
  /** Pre-select a season (number) or complete series ("complete") when opening */
  defaultSeason?: number | "complete" | null;
  onDownloadSuccess?: () => void;
}

interface FilterState {
  filterQuery: string;
  prowlarrApiQuery: string;
  showFilters: boolean;
  hideRejected: boolean;
  sortBy: InteractiveSortKey;
  sortDir: InteractiveSortDir;
  includedTrackers: string[];
  excludedTrackers: string[];
  includedLanguages: string[];
  /** null = episode/free-text, number = season pack, "complete" = full series */
  selectedSeason: number | "complete" | null;
  showPacksOnly: boolean;
}

export function InteractiveSearchPanel({
  isActive,
  media = null,
  mode = "prowlarr",
  libraryMediaId = null,
  defaultProwlarrQuery = null,
  episodeId = null,
  defaultSeason = null,
  onDownloadSuccess,
}: InteractiveSearchPanelProps) {
  const { t } = useTranslation("common");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const libId =
    libraryMediaId != null && libraryMediaId > 0 ? libraryMediaId : null;
  const isProwlarrMode = mode === "prowlarr";
  const sourceId = media?.source_id ?? null;
  const canRenderBody = isProwlarrMode || (media != null && sourceId != null);

  const buildInitialFilters = (): FilterState => ({
    filterQuery: "",
    prowlarrApiQuery: defaultProwlarrQuery?.trim() ?? "",
    showFilters: false,
    hideRejected: true,
    sortBy: libId ? "quality" : "seeders",
    sortDir: "desc",
    includedTrackers: [],
    excludedTrackers: [],
    includedLanguages: [],
    selectedSeason: defaultSeason ?? null,
    showPacksOnly: false,
  });

  const [filters, setFilters] = useState<FilterState>(buildInitialFilters);
  const [pendingReleaseKey, setPendingReleaseKey] = useState<string | null>(
    null,
  );

  const {
    filterQuery,
    prowlarrApiQuery,
    showFilters,
    hideRejected,
    sortBy,
    sortDir,
    includedTrackers,
    excludedTrackers,
    includedLanguages,
    selectedSeason,
    showPacksOnly,
  } = filters;

  const isShow = media?.media_type === "series";
  const mediaTmdbId = media?.tmdb_id ?? null;
  const episodesQuery = useLibraryEpisodes(isShow && isActive ? libId : null);
  const availableSeasons = useMemo(() => {
    if (!episodesQuery.data?.seasons) return [];
    return episodesQuery.data.seasons
      .map((s) => s.season)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);
  }, [episodesQuery.data]);

  const prowlarrSearchQuery = useProwlarrInteractiveSearch(prowlarrApiQuery, {
    enabled: isActive,
    library_media_id: libId,
    season: selectedSeason,
    tmdb_id: selectedSeason != null ? mediaTmdbId : null,
  });
  const prowlarrDownloadMutation = useProwlarrInteractiveDownload();
  const libraryGrabMutation = useLibraryGrabRelease(libId);
  const activeQuery = prowlarrSearchQuery;
  const grabBusy =
    libraryGrabMutation.isPending || prowlarrDownloadMutation.isPending;

  useLayoutEffect(() => {
    if (!isActive) return;
    setFilters(buildInitialFilters());
    setPendingReleaseKey(null);
    // buildInitialFilters reads defaultProwlarrQuery, defaultSeason, libId from closure
  }, [isActive, media?.id, defaultProwlarrQuery, defaultSeason, libId]);

  useEffect(() => {
    if (!isActive) return;
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isActive, media?.id, defaultProwlarrQuery, libId]);

  const trackerOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of activeQuery.data?.releases ?? []) {
      const trackerLabel =
        release.indexer?.trim() || t("medias.interactive.unknownIndexer");
      const trackerKey = release.indexer?.trim()
        ? normalizeFilterKey(release.indexer)
        : UNKNOWN_TRACKER_KEY;
      if (!options.has(trackerKey)) options.set(trackerKey, trackerLabel);
    }

    return [...options.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      );
  }, [activeQuery.data?.releases, t]);

  const languageOptions = useMemo<FilterOption[]>(() => {
    const options = new Map<string, string>();

    for (const release of activeQuery.data?.releases ?? []) {
      const languages =
        release.languages.length > 0
          ? release.languages
          : [t("medias.interactive.unknownLanguage")];
      for (const language of languages) {
        const trimmed = language.trim();
        if (!trimmed) continue;
        const languageKey =
          release.languages.length > 0
            ? normalizeFilterKey(trimmed)
            : UNKNOWN_LANGUAGE_KEY;
        if (!options.has(languageKey)) options.set(languageKey, trimmed);
      }
    }

    return [...options.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      );
  }, [activeQuery.data?.releases, t]);

  const releases = useMemo(() => {
    let list = filterAndSortReleases(activeQuery.data?.releases ?? [], {
      filterQuery,
      hideRejected,
      includedTrackers,
      excludedTrackers,
      includedLanguages,
      sortBy,
      sortDir,
      isProwlarrMode: true,
      mediaTitle: media?.title ?? defaultProwlarrQuery ?? null,
      mediaYear: media?.year ?? null,
    });
    if (showPacksOnly || selectedSeason != null) {
      list = list.filter((r) => r.is_season_pack || r.is_complete_series);
    }
    return list;
  }, [
    activeQuery.data?.releases,
    defaultProwlarrQuery,
    excludedTrackers,
    filterQuery,
    hideRejected,
    includedLanguages,
    includedTrackers,
    media?.title,
    media?.year,
    selectedSeason,
    showPacksOnly,
    sortBy,
    sortDir,
  ]);

  const downloadRelease = async (release: InteractiveReleaseItem) => {
    const releaseKey = `${release.guid}-${release.indexer_id ?? "x"}`;
    setPendingReleaseKey(releaseKey);

    try {
      if (isProwlarrMode && libId != null && release.download_url) {
        // Library grab — records in DB and sends URL to qBittorrent
        if (libraryGrabMutation.isPending) return;
        await libraryGrabMutation.mutateAsync({
          download_url: release.download_url,
          release_title: release.title,
          indexer: release.indexer,
          quality_parsed: release.parsed_quality ?? undefined,
          size_bytes: release.size_bytes,
          episode_id: episodeId,
        });
      } else if (isProwlarrMode && release.download_token) {
        // Token-based Prowlarr download (fallback when download_url unavailable)
        if (prowlarrDownloadMutation.isPending) return;
        await prowlarrDownloadMutation.mutateAsync({
          token: release.download_token,
        });
      } else {
        return;
      }

      toast.success(t("medias.interactive.downloadStarted"));
      onDownloadSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("medias.interactive.downloadFailed");
      toast.error(message);
    } finally {
      setPendingReleaseKey(null);
    }
  };

  const totalReleases = activeQuery.data?.releases.length ?? 0;
  const hasAdvancedFilters =
    includedTrackers.length > 0 ||
    excludedTrackers.length > 0 ||
    includedLanguages.length > 0;
  const totalActiveFilters =
    includedTrackers.length +
    excludedTrackers.length +
    includedLanguages.length;
  const hasViewOverrides = totalActiveFilters > 0 || !hideRejected;
  const visibleCount = releases.length;
  const hiddenCount = Math.max(0, totalReleases - visibleCount);
  const errorMessage =
    activeQuery.error instanceof Error ? activeQuery.error.message : null;
  const needsProwlarrQuery = prowlarrApiQuery.length < 2;

  if (!canRenderBody) return null;

  const resetView = () => {
    setFilters((prev) => ({
      ...prev,
      hideRejected: false,
      includedTrackers: [],
      excludedTrackers: [],
      includedLanguages: [],
    }));
  };

  const handleIncludedTrackersChange = (values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      includedTrackers: values,
      excludedTrackers: prev.excludedTrackers.filter(
        (k) => !values.includes(k),
      ),
    }));
  };

  const handleExcludedTrackersChange = (values: string[]) => {
    setFilters((prev) => ({
      ...prev,
      excludedTrackers: values,
      includedTrackers: prev.includedTrackers.filter(
        (k) => !values.includes(k),
      ),
    }));
  };

  return (
    <div className="flex flex-col">
      <div className="md:sticky md:top-0 md:z-10 border-b border-neutral-200 pt-1 pb-4 dark:border-neutral-700 bg-white dark:bg-neutral-900">
        <div className="flex flex-col gap-3">
          {/* Season pack search — shows only */}
          {isShow && availableSeasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 shrink-0">
                {t("medias.interactive.seasonSearch")}
              </span>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, selectedSeason: null }))
                }
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedSeason === null
                    ? "bg-indigo-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {t("medias.interactive.seasonAll")}
              </button>
              {availableSeasons.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      selectedSeason: prev.selectedSeason === s ? null : s,
                    }))
                  }
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    selectedSeason === s
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  }`}
                >
                  S{String(s).padStart(2, "0")}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    selectedSeason:
                      prev.selectedSeason === "complete" ? null : "complete",
                  }))
                }
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  selectedSeason === "complete"
                    ? "bg-violet-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {t("medias.interactive.completeSeries")}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                ref={searchInputRef}
                value={filterQuery}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    filterQuery: event.target.value,
                  }))
                }
                placeholder={t("medias.interactive.filterPlaceholder")}
                className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({ ...prev, filterQuery: "" }))
                  }
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                  aria-label={t("medias.interactive.clearSearch")}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    showFilters: !prev.showFilters,
                  }))
                }
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  showFilters || hasAdvancedFilters
                    ? "border-indigo-500/40 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                    : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                {t("medias.interactive.filtersButton")}
                {totalActiveFilters > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">
                    {totalActiveFilters}
                  </span>
                )}
              </button>

              <Toggle
                checked={hideRejected}
                onChange={(v) =>
                  setFilters((prev) => ({ ...prev, hideRejected: v }))
                }
                label={t("medias.interactive.hideRejected")}
              />
              <Toggle
                checked={showPacksOnly}
                onChange={(v) =>
                  setFilters((prev) => ({ ...prev, showPacksOnly: v }))
                }
                label={t("medias.interactive.packsOnly")}
              />

              <button
                type="button"
                onClick={() => void activeQuery.refetch()}
                disabled={activeQuery.isFetching || needsProwlarrQuery}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <RefreshCw
                  size={13}
                  className={activeQuery.isFetching ? "animate-spin" : ""}
                />
                {t("medias.interactive.refresh")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              {!needsProwlarrQuery && (
                <span className="font-medium text-neutral-700 dark:text-neutral-200">
                  {t("medias.interactive.resultsVisible", {
                    visible: visibleCount,
                    total: totalReleases,
                  })}
                </span>
              )}
              {!needsProwlarrQuery && hiddenCount > 0 && (
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] dark:bg-neutral-800">
                  {t("medias.interactive.hiddenCount", { count: hiddenCount })}
                </span>
              )}
              <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] dark:bg-neutral-800 flex items-center gap-1 max-w-[200px]">
                <span className="text-neutral-400 shrink-0">Prowlarr:</span>
                <span
                  className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                  title={prowlarrApiQuery}
                >
                  {prowlarrApiQuery || "…"}
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {hasViewOverrides && (
                <button
                  type="button"
                  onClick={resetView}
                  className="text-xs font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                >
                  {t("medias.interactive.resetView")}
                </button>
              )}

              <div className="flex items-center gap-1.5">
                <label className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("medias.interactive.sortLabel")}
                </label>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: event.target.value as InteractiveSortKey,
                    }))
                  }
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                >
                  <option value="seeders">
                    {t("medias.interactive.sortOptions.seeders")}
                  </option>
                  <option value="age">
                    {t("medias.interactive.sortOptions.age")}
                  </option>
                  <option value="size">
                    {t("medias.interactive.sortOptions.size")}
                  </option>
                  <option value="title">
                    {t("medias.interactive.sortOptions.title")}
                  </option>
                  <option value="quality">
                    {t("medias.interactive.sortOptions.quality")}
                  </option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      sortDir: prev.sortDir === "asc" ? "desc" : "asc",
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  title={
                    sortDir === "asc"
                      ? t("medias.sortDirectionAsc")
                      : t("medias.sortDirectionDesc")
                  }
                >
                  {sortDir === "asc" ? (
                    <ArrowDownAZ size={13} />
                  ) : (
                    <ArrowUpZA size={13} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {(showFilters || hasAdvancedFilters) && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700/80 dark:bg-neutral-900/50">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                  {t("medias.interactive.filtersTitle")}
                  {totalActiveFilters > 0 && (
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white">
                      {totalActiveFilters}
                    </span>
                  )}
                </p>
                {hasAdvancedFilters && (
                  <button
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        includedTrackers: [],
                        excludedTrackers: [],
                        includedLanguages: [],
                      }))
                    }
                    className="text-[11px] font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                  >
                    {t("medias.interactive.clearFilters")}
                  </button>
                )}
              </div>

              <div className="space-y-3 divide-y divide-neutral-200/70 dark:divide-neutral-700/60">
                <FilterSection
                  title={t("medias.interactive.trackersInclude")}
                  badge={includedTrackers.length}
                >
                  <ChipMultiSelect
                    options={trackerOptions}
                    selected={includedTrackers}
                    onChange={handleIncludedTrackersChange}
                    emptyText={t("medias.interactive.noTrackers")}
                  />
                </FilterSection>

                <div className="pt-1.5">
                  <FilterSection
                    title={t("medias.interactive.trackersExclude")}
                    badge={excludedTrackers.length}
                  >
                    <ChipMultiSelect
                      options={trackerOptions}
                      selected={excludedTrackers}
                      onChange={handleExcludedTrackersChange}
                      emptyText={t("medias.interactive.noTrackers")}
                    />
                  </FilterSection>
                </div>

                <div className="pt-1.5">
                  <FilterSection
                    title={t("medias.interactive.languagesInclude")}
                    badge={includedLanguages.length}
                  >
                    <ChipMultiSelect
                      options={languageOptions}
                      selected={includedLanguages}
                      onChange={(values) =>
                        setFilters((prev) => ({
                          ...prev,
                          includedLanguages: values,
                        }))
                      }
                      emptyText={t("medias.interactive.noLanguages")}
                    />
                  </FilterSection>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4">
        {needsProwlarrQuery ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md text-center text-sm text-neutral-500 dark:text-neutral-400">
              {t("medias.interactive.minQuery")}
            </div>
          </div>
        ) : activeQuery.isLoading ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("medias.interactive.loading")}
            </div>
          </div>
        ) : activeQuery.isError ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-700/40 dark:bg-amber-950/20">
              <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <TriangleAlert size={18} />
              </div>
              <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t("medias.interactive.errorTitle")}
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {errorMessage ?? t("medias.interactive.errorDescription")}
              </p>
              <button
                type="button"
                onClick={() => void activeQuery.refetch()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                <RefreshCw size={14} />
                {t("medias.interactive.retry")}
              </button>
            </div>
          </div>
        ) : releases.length === 0 ? (
          <div className="flex h-full items-center justify-center py-8">
            <div className="max-w-md text-center">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {totalReleases > 0
                  ? t("medias.interactive.noMatches")
                  : t("medias.interactive.empty")}
              </p>
              {totalReleases > 0 && (
                <button
                  type="button"
                  onClick={resetView}
                  className="mt-3 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
                >
                  {t("medias.interactive.resetView")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-2">
              {releases.map((release) => {
                const releaseKey = `${release.guid}-${release.indexer_id ?? "x"}`;
                return (
                  <ReleaseCard
                    key={releaseKey}
                    release={release}
                    onDownload={() => void downloadRelease(release)}
                    isDownloading={pendingReleaseKey === releaseKey}
                    isBusy={grabBusy}
                    t={t}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
