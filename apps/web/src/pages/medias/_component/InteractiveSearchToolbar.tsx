import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownAZ,
  ArrowUpZA,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InteractiveSortKey, InteractiveSortDir } from "@/lib/utils/interactive-search";
import {
  Toggle,
  ChipMultiSelect,
  FilterSection,
  type FilterOption,
} from "./InteractiveSearchFilters";
import { Button } from "@/components/ui/button";
import type { FilterState } from "@/features/medias/hooks/useInteractiveSearchState";

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
  visibleCount: number;
  totalReleases: number;
  hiddenCount: number;
  hasViewOverrides: boolean;
  onResetView: () => void;
}

export function InteractiveSearchToolbar({
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
  setFilters,
  isShow,
  canToggleSearchTitle,
  isOriginalTitleQuery,
  availableSeasons,
  trackerOptions,
  languageOptions,
  hasAdvancedFilters,
  totalActiveFilters,
  isFetching,
  needsSearchQuery,
  onOpenMobileDrawer,
  searchInputRef,
  onToggleSearchTitleVariant,
  onRefetch,
  onIncludedTrackersChange,
  onExcludedTrackersChange,
  visibleCount,
  totalReleases,
  hiddenCount,
  hasViewOverrides,
  onResetView,
}: InteractiveSearchToolbarProps) {
  const { t } = useTranslation("common");

  return (
    <div className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/95 pb-3 pt-2 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95">
      {/* ── Mobile layout (< sm): search + toggles + drawer trigger ── */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
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
            className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          {filterQuery && (
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, filterQuery: "" }))
              }
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
              aria-label={t("medias.interactive.clearSearch")}
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefetch}
            disabled={isFetching || needsSearchQuery}
            className="h-9 w-9 shrink-0 border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
            title={t("medias.interactive.refresh")}
          >
            <RefreshCw
              size={13}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>

          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className={cn(
              "relative inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors",
              totalActiveFilters > 0 ||
                selectedSeason != null ||
                !hideRejected ||
                showPacksOnly
                ? "border-primary-400/50 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300"
                : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-white hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
            )}
          >
            <SlidersHorizontal size={13} />
            {t("medias.interactive.filtersButton")}
            {(totalActiveFilters > 0 || selectedSeason != null) && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                {totalActiveFilters + (selectedSeason != null ? 1 : 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Desktop layout (sm+): full inline toolbar ── */}
      <div className="hidden sm:flex sm:flex-col sm:gap-2.5">
        {/* Season selector */}
        {isShow && availableSeasons.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
              {t("medias.interactive.seasonSearch")}
            </span>
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({ ...prev, selectedSeason: null }))
              }
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                selectedSeason === null
                  ? "bg-primary-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
              )}
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
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  selectedSeason === s
                    ? "bg-primary-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
                )}
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
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors",
                selectedSeason === "complete"
                  ? "bg-violet-600 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
              )}
            >
              {t("medias.interactive.completeSeries")}
            </button>
          </div>
        )}

        {/* Search row: input + filter toggle + refresh */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
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
              className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50 pl-9 pr-9 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, filterQuery: "" }))
                }
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                aria-label={t("medias.interactive.clearSearch")}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                showFilters: !prev.showFilters,
              }))
            }
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors",
              showFilters || hasAdvancedFilters
                ? "border-primary-400/50 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300"
                : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-white hover:text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700",
            )}
          >
            <SlidersHorizontal size={13} />
            {t("medias.interactive.filtersButton")}
            {totalActiveFilters > 0 && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                {totalActiveFilters}
              </span>
            )}
          </button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRefetch}
            disabled={isFetching || needsSearchQuery}
            className="h-10 w-10 shrink-0 border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
            title={t("medias.interactive.refresh")}
          >
            <RefreshCw
              size={13}
              className={isFetching ? "animate-spin" : ""}
            />
          </Button>
        </div>

        {/* Controls row: toggles left, sort controls right */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
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
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {hasViewOverrides && (
              <button
                type="button"
                onClick={onResetView}
                className="text-xs font-medium text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
              >
                {t("medias.interactive.resetView")}
              </button>
            )}
            <div className="flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: event.target.value as InteractiveSortKey,
                  }))
                }
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
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

        {/* Status strip */}
        {!needsSearchQuery && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {t("medias.interactive.resultsVisible", {
                visible: visibleCount,
                total: totalReleases,
              })}
            </span>
            {hiddenCount > 0 && (
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {t("medias.interactive.hiddenCount", {
                  count: hiddenCount,
                })}
              </span>
            )}
            <span className="flex min-w-0 max-w-[260px] items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] dark:bg-neutral-800">
              {canToggleSearchTitle ? (
                <button
                  type="button"
                  onClick={onToggleSearchTitleVariant}
                  title={
                    isOriginalTitleQuery
                      ? t("medias.interactive.useLocalizedTitleHint")
                      : t("medias.interactive.useOriginalTitleHint")
                  }
                  className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1 rounded-md px-0.5 text-left transition-colors hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
                >
                  <span className="shrink-0 text-neutral-400">Search:</span>
                  <span
                    className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                    title={searchApiQuery}
                  >
                    {searchApiQuery || "…"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
                      isOriginalTitleQuery
                        ? "bg-amber-200/80 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100"
                        : "bg-primary-200/70 text-primary-900 dark:bg-primary-900/40 dark:text-primary-100",
                    )}
                  >
                    {isOriginalTitleQuery
                      ? t("medias.interactive.titleBadgeOriginal")
                      : t("medias.interactive.titleBadgeLocalized")}
                  </span>
                </button>
              ) : (
                <>
                  <span className="shrink-0 text-neutral-400">Search:</span>
                  <span
                    className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                    title={searchApiQuery}
                  >
                    {searchApiQuery || "…"}
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-3 dark:border-neutral-700/80 dark:bg-neutral-800/50">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                {t("medias.interactive.filtersTitle")}
                {totalActiveFilters > 0 && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
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
                  className="text-[11px] font-medium text-primary-600 transition-colors hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
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
                  onChange={onIncludedTrackersChange}
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
                    onChange={onExcludedTrackersChange}
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
  );
}
