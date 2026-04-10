import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Info, Search, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/hooks/useLibrary";
import { useLibraryEvents } from "@/hooks/useLibraryEvents";
import {
  useAddToWatchlist,
  useMediaModalData,
  useRemoveFromWatchlist,
} from "@/hooks/useMedias";
import type { LibraryMedia, MediaItem } from "@hously/shared/types";
import { LibraryManagementPanel } from "./LibraryManagementPanel";
import { SimilarMediasPanel } from "./SimilarMediasPanel";
import { LibraryItemHero } from "./LibraryItemHero";
import { LibraryItemInfoTab } from "./LibraryItemInfoTab";
import { LibraryItemSearchTab, type EpisodeSearchCtx } from "./LibraryItemSearchTab";

export type LibraryItemSearchParams = {
  tab?: "info" | "similar" | "search" | "management";
};

type PageTab = "info" | "similar" | "search" | "management";

function libraryToMediaItem(item: LibraryMedia): MediaItem {
  return {
    id: String(item.id),
    media_type: item.type === "show" ? "series" : "movie",
    source_id: null,
    title: item.title,
    sort_title: null,
    year: item.year,
    status: item.status,
    monitored: true,
    downloaded: item.status === "downloaded",
    downloading: item.status === "downloading",
    added_at: item.added_at,
    tmdb_id: item.tmdb_id,
    imdb_id: null,
    tvdb_id: null,
    season_count: null,
    episode_count: null,
    poster_url: item.poster_url,
    release_tags: null,
  };
}

const STATUS_BADGE: Record<
  LibraryMedia["status"],
  { labelKey: string; cls: string }
> = {
  wanted: {
    labelKey: "medias.library.itemStatus.wanted",
    cls: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30",
  },
  downloading: {
    labelKey: "medias.library.itemStatus.downloading",
    cls: "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30",
  },
  downloaded: {
    labelKey: "medias.library.itemStatus.downloaded",
    cls: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30",
  },
  skipped: {
    labelKey: "medias.library.itemStatus.skipped",
    cls: "bg-neutral-500/20 text-neutral-400 ring-1 ring-neutral-500/30",
  },
};

export function LibraryItemPage() {
  const { libraryId } = useParams({ from: "/library/$libraryId" });
  const navigate = useNavigate({ from: "/library/$libraryId" });
  const { t } = useTranslation("common");
  const search = useSearch({
    from: "/library/$libraryId",
  }) as LibraryItemSearchParams;

  useLibraryEvents();

  const id = parseInt(libraryId, 10);
  const { data: libData, isLoading: libLoading } = useLibrary();

  const item = useMemo(
    () => libData?.items.find((i) => i.id === id) ?? null,
    [libData, id],
  );

  const mediaType = item ? (item.type === "show" ? "tv" : "movie") : "movie";

  const { data: modalData, isPending: modalPending } = useMediaModalData(
    mediaType,
    item?.tmdb_id ?? 0,
    undefined,
    { enabled: !!item },
  );

  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const [episodeSearchCtx, setEpisodeSearchCtx] =
    useState<EpisodeSearchCtx | null>(null);
  const [seasonSearchCtx, setSeasonSearchCtx] = useState<number | null>(null);

  const detailsData = modalData?.details ?? null;
  const ratingsData = modalData?.ratings ?? null;
  const creditsData = modalData?.credits ?? null;
  const trailerData = modalData?.trailer ?? null;
  const providers = modalData?.providers ?? null;
  const isInWatchlist = modalData?.watchlist_status ?? false;

  const overview = item?.overview ?? detailsData?.overview ?? null;
  const voteAverage = detailsData?.vote_average ?? null;

  const tabs = useMemo(() => {
    const result: { key: PageTab; label: string; icon: typeof Info }[] = [
      { key: "info", label: t("medias.detail.tabInfo", "Info"), icon: Info },
    ];
    if (item?.tmdb_id)
      result.push({
        key: "similar",
        label: t("medias.detail.tabSimilar", "Similar"),
        icon: Sparkles,
      });
    result.push({
      key: "search",
      label: t("medias.detail.tabSearch", "Search"),
      icon: Search,
    });
    result.push({
      key: "management",
      label: t("medias.detail.tabManagement", "Management"),
      icon: Settings2,
    });
    return result;
  }, [item?.tmdb_id, t]);

  const activeTab = useMemo((): PageTab => {
    if (search.tab && tabs.some((tab) => tab.key === search.tab))
      return search.tab as PageTab;
    if (!item) return "info";
    return item.status === "downloaded" || item.status === "downloading"
      ? "management"
      : "info";
  }, [search.tab, item, tabs]);

  const setActiveTab = (tab: PageTab) =>
    navigate({ search: (prev: LibraryItemSearchParams) => ({ ...prev, tab }) });

  const handleWatchlistToggle = async () => {
    if (!item) return;
    if (isInWatchlist) {
      await removeFromWatchlist.mutateAsync({
        tmdb_id: item.tmdb_id,
        media_type: mediaType,
      });
    } else {
      await addToWatchlist.mutateAsync({
        tmdb_id: item.tmdb_id,
        media_type: mediaType,
        title: item.title,
        poster_url: item.poster_url,
        overview: item.overview,
        release_year: item.year,
        vote_average: voteAverage,
        release_date:
          mediaType === "movie" ? (detailsData?.release_date ?? null) : null,
      });
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (libLoading && !libData) {
    return (
      <div>
        <div className="relative h-[260px] md:h-[340px] bg-neutral-900 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-3">
          <div className="h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded w-20 animate-pulse" />
          <div className="h-6 bg-neutral-200 dark:bg-neutral-800 rounded w-56 animate-pulse" />
          <div className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-80 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!item) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <button
          type="button"
          onClick={() => navigate({ to: "/library" })}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 mb-8 transition-colors"
        >
          {t("medias.library.pageTitle", "Library")}
        </button>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t("library.notFound", "Item not found in library.")}
        </p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[item.status] ?? STATUS_BADGE.wanted;
  const mediaItem = libraryToMediaItem(item);

  return (
    <div>
      <LibraryItemHero
        item={item}
        detailsData={detailsData}
        ratingsData={ratingsData}
        trailerData={trailerData}
        isInWatchlist={isInWatchlist}
        watchlistPending={
          addToWatchlist.isPending || removeFromWatchlist.isPending
        }
        mediaType={mediaType}
        statusBadge={statusBadge}
        onBack={() => navigate({ to: "/library" })}
        onWatchlistToggle={handleWatchlistToggle}
      />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">
        {/* Overview */}
        {overview && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-2xl">
            {overview}
          </p>
        )}

        {/* Tabs */}
        <div className="border-b border-neutral-200 dark:border-neutral-700/60">
          <div className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                      : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600",
                  )}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab panels */}
        <div>
          {activeTab === "info" && (
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              <LibraryItemInfoTab
                item={item}
                detailsData={detailsData}
                creditsData={creditsData}
                trailerData={trailerData}
                providers={providers}
                mediaType={mediaType}
                isPending={modalPending}
              />
            </div>
          )}

          {activeTab === "similar" && (
            <div className="min-h-[300px] pb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              <SimilarMediasPanel
                isActive
                tmdbId={item.tmdb_id}
                mediaType={mediaType}
                onAdded={() => {}}
              />
            </div>
          )}

          {activeTab === "search" && (
            <div className="min-h-[300px] pb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              <LibraryItemSearchTab
                item={item}
                mediaItem={mediaItem}
                episodeSearchCtx={episodeSearchCtx}
                seasonSearchCtx={seasonSearchCtx}
                onClearEpisodeCtx={() => setEpisodeSearchCtx(null)}
              />
            </div>
          )}

          {activeTab === "management" && (
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              <LibraryManagementPanel
                libraryId={item.id}
                onDeleted={() => navigate({ to: "/library" })}
                onSearchEpisode={(ep) => {
                  setEpisodeSearchCtx(ep);
                  setSeasonSearchCtx(null);
                  setActiveTab("search");
                }}
                onSearchSeason={(season) => {
                  setSeasonSearchCtx(season);
                  setEpisodeSearchCtx(null);
                  setActiveTab("search");
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
