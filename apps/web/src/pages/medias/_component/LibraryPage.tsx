import { useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { Link, useSearch } from "@tanstack/react-router";
import { useLibraryNavigation } from "@/features/medias/context/LibraryNavigationContext";
import {
  Search as SearchIcon,
  Film,
  Tv,
  Clock,
  CheckCircle2,
  ArrowUpAZ,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Clapperboard,
  LayoutGrid,
  Grid3X3,
  List,
  SlidersHorizontal,
  X,
} from "lucide-react";
// ─── Motion variants ──────────────────────────────────────────────────────────

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

import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/components/ui/segmented-tabs";
import { useLibrary } from "@/features/medias/hooks/useLibrary";
import { useLibraryLanguageTags } from "@/features/medias/hooks/useLibraryLanguageTags";
import { useSearchLibraryMovie } from "@/features/medias/hooks/useSearchLibraryMovie";
import { useLibraryEvents } from "@/features/medias/hooks/useLibraryEvents";
import { useUrlState } from "@/lib/app/useUrlState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LibraryItemCard } from "./LibraryItemCard";
import { LibraryItemRow } from "./LibraryItemRow";
import { LibraryMobileFilterSheet } from "./LibraryMobileFilterSheet";
import {
  type FilterType,
  type FilterStatus,
  type SortKey,
  type SortDir,
  type ViewMode,
  LIBRARY_SORT_KEYS,
  sortItems,
} from "@/utils/libraryUtils";
import { useAuth } from "@/lib/auth/useAuth";

const PAGE_SIZE = 48;

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

export function LibraryPage() {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const { saveLibrarySearch } = useLibraryNavigation();
  const searchParams = useSearch({ from: "/library/" });

  // Keep the context in sync so LibraryItemPage can navigate back with filters intact.
  useEffect(() => {
    saveLibrarySearch(searchParams as Record<string, unknown>);
  }, [searchParams, saveLibrarySearch]);

  const { state, setState } = useUrlState(
    "/library/",
    searchParams as Partial<typeof LIBRARY_DEFAULTS>,
    LIBRARY_DEFAULTS,
  );
  const {
    type: typeFilter,
    status: statusFilter,
    language: languageFilter,
    search,
    sortBy,
    sortDir,
    page,
    viewMode,
  } = state;

  useLibraryEvents();

  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount = [
    typeFilter !== "all",
    statusFilter !== "all",
    languageFilter !== "all",
  ].filter(Boolean).length;

  const searchMovie = useSearchLibraryMovie();

  const { data, isLoading, refetch } = useLibrary({
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    q: search || undefined,
    language: languageFilter !== "all" ? languageFilter : undefined,
  });

  const { data: languageTagsData } = useLibraryLanguageTags();
  const languageTags = languageTagsData?.tags ?? [];

  useEffect(() => {
    if (languageTags.length === 0 && languageFilter !== "all") {
      setState({ language: "all" });
    }
  }, [languageTags.length, languageFilter]);

  const allItems = data?.items ?? [];

  const sorted = useMemo(
    () => sortItems(allItems, sortBy, sortDir as SortDir),
    [allItems, sortBy, sortDir],
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = sorted.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // Sync page if it's out of range
  useEffect(() => {
    if (isLoading) return;
    if (page > totalPages && totalPages > 0) {
      setState({ page: totalPages > 1 ? totalPages : 1 });
    }
  }, [page, totalPages, isLoading]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  const handleMovieSearch = (id: number) => {
    searchMovie.mutate(
      { id },
      {
        onSuccess: (r) => {
          if (r.grabbed) toast.success(t("library.management.grabbed"));
          else toast.error(r.reason ?? t("library.management.grabFailed"));
        },
        onError: () => toast.error(t("library.management.grabFailed")),
      },
    );
  };

  const movieCount = data?.movie_count ?? 0;
  const showCount = data?.show_count ?? 0;
  const typeItems = [
    { id: "all", label: t("medias.library.typeAll") },
    {
      id: "movie",
      label: t("medias.library.moviesWithCount", {
        count: movieCount,
      }),
      icon: Film,
    },
    {
      id: "show",
      label: t("medias.library.showsWithCount", {
        count: showCount,
      }),
      icon: Tv,
    },
  ] satisfies SegmentedTabItem<FilterType>[];
  const statusItems = [
    { id: "all", label: t("medias.library.statusAll") },
    {
      id: "downloaded",
      label: t("medias.library.statusDownloaded"),
      icon: CheckCircle2,
    },
    {
      id: "wanted",
      label: t("medias.library.statusWanted"),
      icon: Clock,
    },
    {
      id: "downloading",
      label: t("medias.library.statusDownloading"),
      icon: Download,
    },
  ] satisfies SegmentedTabItem<FilterStatus>[];

  return (
    <PageLayout>
      <PageHeader
        icon={Film}
        iconColor="text-primary-600"
        title={t("medias.library.pageTitle")}
        subtitle={t("medias.library.pageSubtitle")}
        actions={
          user?.is_admin ? (
            <Link
              to="/library/downloads"
              className="text-xs font-semibold uppercase tracking-wide text-primary-600 hover:text-primary-500 dark:text-primary-400 whitespace-nowrap"
            >
              {t("medias.library.downloadsImport")}
            </Link>
          ) : undefined
        }
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      />

      <div className="space-y-4">
        {/* Filters + sort */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-auto">
              <SearchIcon
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
              <input
                value={search}
                onChange={(e) =>
                  setState({
                    search: e.target.value,
                    page: 1,
                  })
                }
                placeholder={t("medias.library.searchPlaceholder")}
                className="w-full sm:w-80 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 dark:focus:border-primary-500 transition"
              />
            </div>

            {/* Sort */}
            <div className="hidden sm:flex items-center gap-1.5 ml-auto">
              <select
                value={sortBy}
                onChange={(e) =>
                  setState({ sortBy: e.target.value as SortKey, page: 1 })
                }
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition"
              >
                {LIBRARY_SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`medias.library.sort.${key}`)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setState({
                    sortDir: sortDir === "asc" ? "desc" : "asc",
                    page: 1,
                  })
                }
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                title={
                  sortDir === "asc"
                    ? t("medias.sortDirectionAsc")
                    : t("medias.sortDirectionDesc")
                }
              >
                {sortDir === "asc" ? (
                  <ArrowUpAZ size={14} />
                ) : (
                  <ArrowDownAZ size={14} />
                )}
              </button>

              {/* View mode toggle */}
              <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
                {(
                  [
                    {
                      mode: "grid" as ViewMode,
                      Icon: LayoutGrid,
                      label: "Grid",
                    },
                    {
                      mode: "compact" as ViewMode,
                      Icon: Grid3X3,
                      label: "Compact",
                    },
                    { mode: "list" as ViewMode, Icon: List, label: "List" },
                  ] as const
                ).map(({ mode, Icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setState({ viewMode: mode })}
                    title={label}
                    className={cn(
                      "p-1.5 transition-colors",
                      viewMode === mode
                        ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile: filter sheet trigger + view mode toggle */}
          <div className="flex flex-col gap-2 sm:hidden">
            <div className="flex items-center gap-2">
              {/* Filters button */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="relative flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              >
                <SlidersHorizontal size={13} />
                {t("medias.library.filtersButton")}
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold leading-none text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort chip */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-500 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
              >
                {sortDir === "asc" ? (
                  <ArrowUpAZ size={12} />
                ) : (
                  <ArrowDownAZ size={12} />
                )}
                {t(`medias.library.sort.${sortBy}`)}
              </button>

              <div className="flex-1" />

              {/* View mode toggle */}
              <div className="flex overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                {(
                  [
                    { mode: "grid" as ViewMode, Icon: LayoutGrid },
                    { mode: "compact" as ViewMode, Icon: Grid3X3 },
                    { mode: "list" as ViewMode, Icon: List },
                  ] as const
                ).map(({ mode, Icon }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setState({ viewMode: mode })}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center transition-colors",
                      viewMode === mode
                        ? "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200"
                        : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
                {typeFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setState({ type: "all", page: 1 })}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    {typeItems.find((i) => i.id === typeFilter)?.label}
                    <X size={10} />
                  </button>
                )}
                {statusFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setState({ status: "all", page: 1 })}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    {statusItems.find((i) => i.id === statusFilter)?.label}
                    <X size={10} />
                  </button>
                )}
                {languageFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setState({ language: "all", page: 1 })}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300"
                  >
                    {languageFilter}
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3 sm:flex-wrap">
            <SegmentedTabs<FilterType>
              variant="chips"
              containerClassName="w-auto shrink-0"
              ariaLabel={t("medias.library.typeAll")}
              items={typeItems}
              value={typeFilter}
              onChange={(f) => setState({ type: f, page: 1 })}
            />
            <div className="h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
            <SegmentedTabs<FilterStatus>
              variant="chips"
              containerClassName="w-auto shrink-0"
              ariaLabel={t("medias.library.statusAll")}
              items={statusItems}
              value={statusFilter}
              onChange={(f) => setState({ status: f, page: 1 })}
            />
            {languageTags.length > 0 && (
              <>
                <div className="h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-700" />
                <select
                  aria-label={t("medias.library.languageAll")}
                  value={languageFilter}
                  onChange={(e) =>
                    setState({ language: e.target.value, page: 1 })
                  }
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 dark:focus:border-primary-500 transition"
                >
                  <option value="all">{t("medias.library.languageAll")}</option>
                  {languageTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Grid / Compact / List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            viewMode === "list" ? (
              <div key="skeleton" className="flex flex-col gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div
                key="skeleton"
                className={cn(
                  "grid gap-2",
                  viewMode === "compact"
                    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3",
                )}
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                  />
                ))}
              </div>
            )
          ) : pagedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Clapperboard}
                title={t("medias.library.emptyTitle")}
                description={t("medias.library.emptyDescription")}
              />
            </motion.div>
          ) : viewMode === "list" ? (
            <motion.div
              key={`list-${typeFilter}-${statusFilter}-${languageFilter}-${sortBy}-${sortDir}-${safePage}`}
              className="flex flex-col gap-1"
              variants={gridContainerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {pagedItems.map((item) => (
                <motion.div key={item.id} variants={gridItemVariants}>
                  <LibraryItemRow
                    item={item}
                    onMovieSearch={handleMovieSearch}
                    movieSearchPending={
                      searchMovie.isPending &&
                      searchMovie.variables?.id === item.id
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={`${viewMode}-${typeFilter}-${statusFilter}-${languageFilter}-${sortBy}-${sortDir}-${safePage}`}
              className={cn(
                "grid gap-2",
                viewMode === "compact"
                  ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3",
              )}
              variants={gridContainerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {pagedItems.map((item) => (
                <motion.div key={item.id} variants={gridItemVariants}>
                  <LibraryItemCard
                    item={item}
                    viewMode={viewMode}
                    onMovieSearch={handleMovieSearch}
                    movieSearchPending={
                      searchMovie.isPending &&
                      searchMovie.variables?.id === item.id
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("medias.library.paginationRange", {
                start: (safePage - 1) * PAGE_SIZE + 1,
                end: Math.min(safePage * PAGE_SIZE, sorted.length),
                total: sorted.length,
              })}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setState({ page: safePage - 1 })}
                disabled={safePage <= 1}
                className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-xs text-neutral-600 dark:text-neutral-400 min-w-[60px] text-center">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setState({ page: safePage + 1 })}
                disabled={safePage >= totalPages}
                className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      <LibraryMobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        languageFilter={languageFilter}
        sortBy={sortBy}
        sortDir={sortDir}
        languageTags={languageTags}
        typeItems={typeItems}
        statusItems={statusItems}
        onTypeChange={(v) => setState({ type: v, page: 1 })}
        onStatusChange={(v) => setState({ status: v, page: 1 })}
        onLanguageChange={(v) => setState({ language: v, page: 1 })}
        onSortByChange={(v) => setState({ sortBy: v, page: 1 })}
        onSortDirChange={(v) => setState({ sortDir: v, page: 1 })}
        onReset={() =>
          setState({
            type: "all",
            status: "all",
            language: "all",
            sortBy: "added_at",
            sortDir: "desc",
            page: 1,
          })
        }
      />
    </PageLayout>
  );
}
