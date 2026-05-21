import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowDownAZ, ArrowUpZA, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type {
  InteractiveSortKey,
  InteractiveSortDir,
} from "@/lib/utils/interactive-search";
import {
  Toggle,
  ChipMultiSelect,
  FilterSection,
  type FilterOption,
} from "./InteractiveSearchFilters";

interface InteractiveSearchMobileDrawerProps {
  open: boolean;
  onClose: () => void;

  isShow: boolean;
  availableSeasons: number[];
  selectedSeason: number | "complete" | null;
  onSeasonChange: (s: number | "complete" | null) => void;

  needsSearchQuery: boolean;
  visibleCount: number;
  totalReleases: number;
  hiddenCount: number;
  searchApiQuery: string;
  canToggleSearchTitle: boolean;
  isOriginalTitleQuery: boolean;
  onToggleSearchTitle: () => void;

  hideRejected: boolean;
  onHideRejectedChange: (v: boolean) => void;
  showPacksOnly: boolean;
  onShowPacksOnlyChange: (v: boolean) => void;

  hasViewOverrides: boolean;
  onResetView: () => void;

  sortBy: InteractiveSortKey;
  sortDir: InteractiveSortDir;
  onSortByChange: (v: InteractiveSortKey) => void;
  onToggleSortDir: () => void;

  totalActiveFilters: number;
  hasAdvancedFilters: boolean;
  onClearFilters: () => void;

  trackerOptions: FilterOption[];
  includedTrackers: string[];
  excludedTrackers: string[];
  onIncludedTrackersChange: (v: string[]) => void;
  onExcludedTrackersChange: (v: string[]) => void;

  languageOptions: FilterOption[];
  includedLanguages: string[];
  onIncludedLanguagesChange: (v: string[]) => void;
}

export function InteractiveSearchMobileDrawer({
  open,
  onClose,
  isShow,
  availableSeasons,
  selectedSeason,
  onSeasonChange,
  needsSearchQuery,
  visibleCount,
  totalReleases,
  hiddenCount,
  searchApiQuery,
  canToggleSearchTitle,
  isOriginalTitleQuery,
  onToggleSearchTitle,
  hideRejected,
  onHideRejectedChange,
  showPacksOnly,
  onShowPacksOnlyChange,
  hasViewOverrides,
  onResetView,
  sortBy,
  sortDir,
  onSortByChange,
  onToggleSortDir,
  totalActiveFilters,
  hasAdvancedFilters,
  onClearFilters,
  trackerOptions,
  includedTrackers,
  excludedTrackers,
  onIncludedTrackersChange,
  onExcludedTrackersChange,
  languageOptions,
  includedLanguages,
  onIncludedLanguagesChange,
}: InteractiveSearchMobileDrawerProps) {
  const { t } = useTranslation("common");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.[0]?.focus();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "Tab") {
      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("medias.interactive.filtersTitle")}
            onKeyDown={handleKeyDown}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 32,
              stiffness: 380,
              mass: 0.9,
            }}
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-neutral-900"
          >
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t("medias.interactive.filtersTitle")}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Toggles */}
              <section className="flex flex-col gap-1">
                <Toggle
                  checked={hideRejected}
                  onChange={onHideRejectedChange}
                  label={t("medias.interactive.hideRejected")}
                />
                <Toggle
                  checked={showPacksOnly}
                  onChange={onShowPacksOnlyChange}
                  label={t("medias.interactive.packsOnly")}
                />
              </section>

              {/* Status strip */}
              {!needsSearchQuery && (
                <section className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                    {t("medias.interactive.resultsVisible", {
                      visible: visibleCount,
                      total: totalReleases,
                    })}
                  </span>
                  {hiddenCount > 0 && (
                    <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                      {t("medias.interactive.hiddenCount", {
                        count: hiddenCount,
                      })}
                    </span>
                  )}
                  <div className="flex min-w-0 max-w-full items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
                    {canToggleSearchTitle ? (
                      <button
                        type="button"
                        onClick={onToggleSearchTitle}
                        title={
                          isOriginalTitleQuery
                            ? t("medias.interactive.useLocalizedTitleHint")
                            : t("medias.interactive.useOriginalTitleHint")
                        }
                        className="-mx-0.5 flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-0.5 text-left"
                      >
                        <span className="shrink-0 text-neutral-400">
                          Search:
                        </span>
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
                        <span className="shrink-0 text-neutral-400">
                          Search:
                        </span>
                        <span
                          className="truncate font-medium text-neutral-700 dark:text-neutral-200"
                          title={searchApiQuery}
                        >
                          {searchApiQuery || "…"}
                        </span>
                      </>
                    )}
                  </div>
                </section>
              )}

              {/* Season selector */}
              {isShow && availableSeasons.length > 0 && (
                <section>
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                    {t("medias.interactive.seasonSearch")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSeasonChange(null)}
                      className={cn(
                        "min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        selectedSeason === null
                          ? "bg-primary-600 text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                      )}
                    >
                      {t("medias.interactive.seasonAll")}
                    </button>
                    {availableSeasons.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          onSeasonChange(selectedSeason === s ? null : s)
                        }
                        className={cn(
                          "min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium transition-all",
                          selectedSeason === s
                            ? "bg-primary-600 text-white shadow-sm"
                            : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                        )}
                      >
                        S{String(s).padStart(2, "0")}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        onSeasonChange(
                          selectedSeason === "complete" ? null : "complete",
                        )
                      }
                      className={cn(
                        "min-h-[40px] rounded-xl px-4 py-2 text-sm font-medium transition-all",
                        selectedSeason === "complete"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                      )}
                    >
                      {t("medias.interactive.completeSeries")}
                    </button>
                  </div>
                </section>
              )}

              {/* Sort */}
              <section>
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                  {t("medias.interactive.sortLabel")}
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      "seeders",
                      "age",
                      "size",
                      "title",
                      "quality",
                    ] as InteractiveSortKey[]
                  ).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onSortByChange(key)}
                      className={cn(
                        "min-h-[40px] rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                        sortBy === key
                          ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                          : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                      )}
                    >
                      {t(`medias.interactive.sortOptions.${key}`)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => sortDir !== "asc" && onToggleSortDir()}
                    className={cn(
                      "flex min-h-[40px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                      sortDir === "asc"
                        ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                    )}
                  >
                    <ArrowDownAZ size={14} />
                    {t("medias.sortDirectionAsc")}
                  </button>
                  <button
                    type="button"
                    onClick={() => sortDir !== "desc" && onToggleSortDir()}
                    className={cn(
                      "flex min-h-[40px] items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all",
                      sortDir === "desc"
                        ? "bg-neutral-900 text-white shadow-sm dark:bg-neutral-100 dark:text-neutral-900"
                        : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
                    )}
                  >
                    <ArrowUpZA size={14} />
                    {t("medias.sortDirectionDesc")}
                  </button>
                </div>
              </section>

              {/* Advanced filters */}
              <section>
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                    {t("medias.interactive.filtersButton")}
                    {totalActiveFilters > 0 && (
                      <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] font-bold text-white">
                        {totalActiveFilters}
                      </span>
                    )}
                  </p>
                  {hasAdvancedFilters && (
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="text-[11px] font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                    >
                      {t("medias.interactive.clearFilters")}
                    </button>
                  )}
                </div>
                <div className="space-y-4 divide-y divide-neutral-100 dark:divide-neutral-800">
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
                  <div className="pt-3">
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
                  <div className="pt-3">
                    <FilterSection
                      title={t("medias.interactive.languagesInclude")}
                      badge={includedLanguages.length}
                    >
                      <ChipMultiSelect
                        options={languageOptions}
                        selected={includedLanguages}
                        onChange={onIncludedLanguagesChange}
                        emptyText={t("medias.interactive.noLanguages")}
                      />
                    </FilterSection>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div
              className="flex shrink-0 items-center gap-3 border-t border-neutral-100 px-5 py-4 dark:border-neutral-800"
              style={{
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              }}
            >
              {hasViewOverrides && (
                <button
                  type="button"
                  onClick={onResetView}
                  className="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
                >
                  {t("medias.interactive.resetView")}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="ml-auto rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                {t("medias.library.done")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
