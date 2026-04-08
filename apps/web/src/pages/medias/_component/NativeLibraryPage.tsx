import { useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { Search, Film, Tv, Clock, CheckCircle2, ArrowUpAZ, ArrowDownAZ, ChevronLeft, ChevronRight } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { useLibrary, useSearchLibraryMovie } from "@/hooks/useLibrary";
import { useLibraryEvents } from "@/hooks/useLibraryEvents";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";
import type { LibraryMedia, TmdbMediaSearchItem } from "@hously/shared/types";
import type { LibrarySearchParams } from "@/pages/library/index";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SortKey = "title" | "year" | "added_at" | "status";
type SortDir = "asc" | "desc";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_MAP = {
  wanted: { label: "Wanted", className: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300" },
  downloading: { label: "Downloading", className: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300" },
  downloaded: { label: "Downloaded", className: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" },
  skipped: { label: "Skipped", className: "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400" },
} as const;

type CardStatus = "downloaded" | "downloading" | "missing";

function toCardStatus(status: LibraryMedia["status"]): CardStatus {
  if (status === "downloaded") return "downloaded";
  if (status === "downloading") return "downloading";
  return "missing";
}

// ─── Library item card ────────────────────────────────────────────────────────

function LibraryItemCard({
  item,
  onOpen,
  onMovieSearch,
  movieSearchPending,
}: {
  item: LibraryMedia;
  onOpen: (item: LibraryMedia) => void;
  onMovieSearch?: (id: number) => void;
  movieSearchPending?: boolean;
}) {
  const { t } = useTranslation("common");
  const statusInfo = STATUS_MAP[item.status] ?? STATUS_MAP.wanted;
  const digitalLabel =
    item.type === "movie" && item.digital_release_date
      ? new Date(item.digital_release_date).toLocaleDateString(undefined, {
          dateStyle: "medium",
        })
      : null;

  return (
    <div
      className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden cursor-pointer group"
      onClick={() => onOpen(item)}
    >
      <MediaPosterCard
        posterUrl={item.poster_url}
        title={item.title}
        status={toCardStatus(item.status)}
        statusLabel={statusInfo.label}
      >
        <div className="pb-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {item.year ?? "—"}
            </span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", statusInfo.className)}>
              {statusInfo.label}
            </span>
          </div>
          {digitalLabel && (
            <p className="text-[9px] text-neutral-500 dark:text-neutral-400 leading-tight">
              Digital {digitalLabel}
            </p>
          )}
          {item.type === "movie" &&
            item.status === "wanted" &&
            onMovieSearch &&
            item.search_attempts < 5 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMovieSearch(item.id);
                }}
                disabled={movieSearchPending}
                className="mt-0.5 w-full rounded-lg bg-indigo-600/90 hover:bg-indigo-600 disabled:opacity-50 text-white text-[10px] font-medium py-1 flex items-center justify-center gap-1 transition-colors"
              >
                <Search size={10} />
                {t("library.management.searchNow")}
              </button>
            )}
        </div>
      </MediaPosterCard>
    </div>
  );
}

/** Build a TmdbMediaSearchItem from a native LibraryMedia for ExploreCardDetailDialog */
function libraryItemToSearchItem(item: LibraryMedia): TmdbMediaSearchItem {
  return {
    id: String(item.id),
    tmdb_id: item.tmdb_id,
    media_type: item.type === "show" ? "tv" : "movie",
    title: item.title,
    release_year: item.year,
    poster_url: item.poster_url,
    overview: item.overview,
    vote_average: null,
    service: "library",
    already_exists: true,
    can_add: false,
    source_id: null,
    library_id: item.id,
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterType = "all" | "movie" | "show";
type FilterStatus = "all" | "wanted" | "downloading" | "downloaded" | "skipped";

const PAGE_SIZE = 48;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "added_at", label: "Date added" },
  { key: "title", label: "Title" },
  { key: "year", label: "Year" },
  { key: "status", label: "Status" },
];

function sortItems(items: LibraryMedia[], sortBy: SortKey, sortDir: SortDir): LibraryMedia[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "title") cmp = a.title.localeCompare(b.title);
    else if (sortBy === "year") cmp = (a.year ?? 0) - (b.year ?? 0);
    else if (sortBy === "status") cmp = a.status.localeCompare(b.status);
    else cmp = new Date(a.added_at).getTime() - new Date(b.added_at).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });
}

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

  const sorted = useMemo(() => sortItems(allItems, sortBy, sortDir), [allItems, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const movieCount = allItems.filter((i) => i.type === "movie").length;
  const showCount = allItems.filter((i) => i.type === "show").length;

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
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setParam({ search: e.target.value || undefined, page: undefined })}
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
                  onClick={() => setParam({ type: f !== "all" ? f : undefined, page: undefined })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    typeFilter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                  )}
                >
                  {f === "all" ? "All" : f === "movie" ? (
                    <span className="flex items-center gap-1"><Film size={12} /> Movies ({movieCount})</span>
                  ) : (
                    <span className="flex items-center gap-1"><Tv size={12} /> Shows ({showCount})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Status filter */}
            <div className="flex rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {(["all", "downloaded", "wanted", "downloading"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setParam({ status: f !== "all" ? f : undefined, page: undefined })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800",
                  )}
                >
                  {f === "all" ? "All" : f === "downloaded" ? (
                    <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Downloaded</span>
                  ) : f === "wanted" ? (
                    <span className="flex items-center gap-1"><Clock size={12} /> Wanted</span>
                  ) : "Downloading"}
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5 ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setParam({ sortBy: e.target.value as SortKey, page: undefined })}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setParam({ sortDir: sortDir === "asc" ? "desc" : "asc", page: undefined })}
                className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                title={sortDir === "asc" ? "Ascending" : "Descending"}
              >
                {sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
              </button>
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
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
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
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
          defaultTab={(currentTab as "info" | "management") ?? (selectedItem.status === "downloaded" ? "management" : "info")}
          onRefetchLibrary={() => refetch()}
        />
      )}
    </PageLayout>
  );
}
