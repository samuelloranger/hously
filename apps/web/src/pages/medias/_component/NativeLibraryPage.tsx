import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, type Variants } from "motion/react";
import { useSearch } from "@tanstack/react-router";
import {
  Search,
  Film,
  Tv,
  Clock,
  CheckCircle2,
  ArrowUpAZ,
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
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
import {
  useLibrary,
  useSearchLibraryMovie,
} from "@/features/medias/hooks/useLibrary";
import { useLibraryEvents } from "@/features/medias/hooks/useLibraryEvents";
import { useUrlState } from "@/lib/app/useUrlState";
import { toast } from "sonner";
import { LibraryItemCard } from "./LibraryItemCard";
import {
  type FilterType,
  type FilterStatus,
  type SortKey,
  type SortDir,
  LIBRARY_SORT_KEYS,
  sortItems,
} from "@/utils/libraryUtils";

const PAGE_SIZE = 48;

const LIBRARY_DEFAULTS = {
  type: "all" as FilterType,
  status: "all" as FilterStatus,
  search: "" as string,
  sortBy: "added_at" as SortKey,
  sortDir: "desc" as SortDir,
  page: 1,
};

export function NativeLibraryPage() {
  const { t } = useTranslation("common");
  const searchParams = useSearch({ from: "/library/" });
  const { state, setState } = useUrlState(
    "/library/",
    searchParams as Partial<typeof LIBRARY_DEFAULTS>,
    LIBRARY_DEFAULTS,
  );
  const {
    type: typeFilter,
    status: statusFilter,
    search,
    sortBy,
    sortDir,
    page,
  } = state;

  useLibraryEvents();

  const searchMovie = useSearchLibraryMovie();

  const { data, isLoading, refetch } = useLibrary({
    type: typeFilter !== "all" ? typeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    q: search || undefined,
  });

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

  return (
    <PageLayout>
      <PageHeader
        icon="🎞️"
        iconColor="text-indigo-600"
        title={t("medias.library.pageTitle")}
        subtitle={t("medias.library.pageSubtitle")}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      />

      <div className="space-y-4">
        {/* Filters + sort */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
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
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 dark:focus:border-indigo-500 transition"
            />
          </div>

          {/* Type filter */}
          <SegmentedTabs<FilterType>
            ariaLabel={t("medias.library.typeAll")}
            items={
              [
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
              ] satisfies SegmentedTabItem<FilterType>[]
            }
            value={typeFilter}
            onChange={(f) => setState({ type: f, page: 1 })}
          />

          {/* Status filter */}
          <SegmentedTabs<FilterStatus>
            ariaLabel={t("medias.library.statusAll")}
            items={[
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
              },
            ]}
            value={statusFilter}
            onChange={(f) => setState({ status: f, page: 1 })}
          />

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <select
              value={sortBy}
              onChange={(e) =>
                setState({ sortBy: e.target.value as SortKey, page: 1 })
              }
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
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
          </div>
        </div>

        {/* Grid */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <div
              key="skeleton"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                />
              ))}
            </div>
          ) : pagedItems.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon="🎬"
                title={t("medias.library.emptyTitle")}
                description={t("medias.library.emptyDescription")}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${typeFilter}-${statusFilter}-${sortBy}-${sortDir}-${safePage}`}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3"
              variants={gridContainerVariants}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {pagedItems.map((item) => (
                <motion.div key={item.id} variants={gridItemVariants}>
                  <LibraryItemCard
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
    </PageLayout>
  );
}
