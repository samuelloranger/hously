import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, useNavigate } from "@tanstack/react-router";
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
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useLibrary, useSearchLibraryMovie } from "@/hooks/useLibrary";
import { useLibraryEvents } from "@/hooks/useLibraryEvents";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";
import type { LibraryMedia } from "@hously/shared/types";
import type { LibrarySearchParams } from "@/pages/library/index";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LibraryItemCard } from "./LibraryItemCard";
import {
  type FilterType,
  type FilterStatus,
  type SortKey,
  type SortDir,
  SORT_OPTIONS,
  sortItems,
  libraryItemToSearchItem,
} from "@/utils/libraryUtils";

const PAGE_SIZE = 48;

export function NativeLibraryPage() {
  const { t } = useTranslation("common");
  const searchParams = useSearch({ from: "/library/" }) as LibrarySearchParams;
  const navigate = useNavigate({ from: "/library/" });

  const typeFilter = (searchParams.type as FilterType) ?? "all";
  const statusFilter = (searchParams.status as FilterStatus) ?? "all";
  const search = searchParams.search ?? "";
  const sortBy = (searchParams.sortBy as SortKey) ?? "added_at";
  const sortDir = searchParams.sortDir ?? "desc";
  const page = searchParams.page ?? 1;
  const currentMediaId = searchParams.current_media_id;
  const currentTab = searchParams.current_media_tab;

  const setParam = (updates: Partial<LibrarySearchParams>) =>
    navigate({ search: (prev) => ({ ...prev, ...updates }) });

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
    if (page > totalPages && totalPages > 0) {
      setParam({ page: totalPages > 1 ? totalPages : undefined });
    }
  }, [page, totalPages]);

  const selectedItem = useMemo(
    () => allItems.find((i) => i.id === currentMediaId) ?? null,
    [allItems, currentMediaId],
  );

  const openItem = (item: LibraryMedia) =>
    setParam({
      current_media_id: item.id,
      current_media_tab: item.status === "downloaded" ? "management" : "info",
    });

  const closeItem = () =>
    setParam({ current_media_id: undefined, current_media_tab: undefined });

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
                setParam({
                  search: e.target.value || undefined,
                  page: undefined,
                })
              }
              placeholder="Search library…"
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 dark:focus:border-indigo-500 transition"
            />
          </div>

          {/* Type filter */}
          <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {(["all", "movie", "show"] as FilterType[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() =>
                  setParam({
                    type: f !== "all" ? f : undefined,
                    page: undefined,
                  })
                }
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  typeFilter === f
                    ? "bg-indigo-600 text-white"
                    : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                )}
              >
                {f === "all" ? (
                  "All"
                ) : f === "movie" ? (
                  <span className="flex items-center gap-1">
                    <Film size={12} /> Movies ({movieCount})
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Tv size={12} /> Shows ({showCount})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            {(["all", "downloaded", "wanted", "downloading"] as const).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setParam({
                      status: f !== "all" ? f : undefined,
                      page: undefined,
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                  )}
                >
                  {f === "all" ? (
                    "All"
                  ) : f === "downloaded" ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={12} /> Downloaded
                    </span>
                  ) : f === "wanted" ? (
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> Wanted
                    </span>
                  ) : (
                    "Downloading"
                  )}
                </button>
              ),
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 ml-auto">
            <select
              value={sortBy}
              onChange={(e) =>
                setParam({ sortBy: e.target.value as SortKey, page: undefined })
              }
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setParam({
                  sortDir: sortDir === "asc" ? "desc" : "asc",
                  page: undefined,
                })
              }
              className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              title={sortDir === "asc" ? "Ascending" : "Descending"}
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
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
              />
            ))}
          </div>
        ) : pagedItems.length === 0 ? (
          <EmptyState
            icon="🎬"
            title="No items in library"
            description="Search for movies or shows in the panel on the right and add them to your library."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3">
            {pagedItems.map((item) => (
              <LibraryItemCard
                key={item.id}
                item={item}
                onOpen={openItem}
                onMovieSearch={handleMovieSearch}
                movieSearchPending={
                  searchMovie.isPending && searchMovie.variables?.id === item.id
                }
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setParam({ page: safePage - 1 })}
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
                onClick={() => setParam({ page: safePage + 1 })}
                disabled={safePage >= totalPages}
                className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <ExploreCardDetailDialog
          item={libraryItemToSearchItem(selectedItem)}
          isOpen={!!selectedItem}
          onClose={closeItem}
          onAdded={() => refetch()}
          defaultTab={
            (currentTab as "info" | "management") ??
            (selectedItem.status === "downloaded" ? "management" : "info")
          }
          onRefetchLibrary={() => refetch()}
        />
      )}
    </PageLayout>
  );
}
