import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Clock,
  ExternalLink,
  Film,
  Info,
  Play,
  Search,
  Settings2,
  Sparkles,
  Star,
} from "lucide-react";
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
import { MediaDetailInfoSections } from "./MediaDetailInfoSections";
import { InteractiveSearchPanel } from "./InteractiveSearchPanel";
import { SimilarMediasPanel } from "./SimilarMediasPanel";

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

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
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

  const [episodeSearchCtx, setEpisodeSearchCtx] = useState<{
    id: number;
    season: number;
    episode: number;
    title: string | null;
  } | null>(null);
  const [seasonSearchCtx, setSeasonSearchCtx] = useState<number | null>(null);
  const [backdropLoaded, setBackdropLoaded] = useState(false);
  const [posterError, setPosterError] = useState(false);

  const detailsData = modalData?.details ?? null;
  const ratingsData = modalData?.ratings ?? null;
  const creditsData = modalData?.credits ?? null;
  const trailerData = modalData?.trailer ?? null;
  const providers = modalData?.providers ?? null;
  const isInWatchlist = modalData?.watchlist_status ?? false;

  const overview = item?.overview ?? detailsData?.overview ?? null;
  const runtime = detailsData?.runtime ?? null;
  const genres = detailsData?.genres ?? [];
  const heroBackdropUrl =
    detailsData?.primary_backdrop_url ??
    detailsData?.media_stills?.backdrops?.[0]?.url ??
    null;
  const voteAverage = detailsData?.vote_average ?? null;
  const rtScore = ratingsData?.rotten_tomatoes ?? null;

  const hasProviders =
    providers &&
    (providers.streaming.length > 0 ||
      providers.free.length > 0 ||
      providers.rent.length > 0 ||
      providers.buy.length > 0);

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
          <ArrowLeft size={14} />
          {t("medias.library.pageTitle", "Library")}
        </button>
        <p className="text-neutral-500 dark:text-neutral-400">
          {t("library.notFound", "Item not found in library.")}
        </p>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[item.status] ?? STATUS_BADGE.wanted;
  const tmdbUrl = `https://www.themoviedb.org/${mediaType}/${item.tmdb_id}`;
  const mediaItem = libraryToMediaItem(item);

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden",
          heroBackdropUrl
            ? "min-h-[260px] md:min-h-[340px]"
            : "min-h-[160px]",
        )}
      >
        {/* Backdrop */}
        {heroBackdropUrl ? (
          <>
            <div className="absolute inset-0 bg-neutral-950" />
            <img
              src={heroBackdropUrl}
              alt=""
              aria-hidden
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
                backdropLoaded ? "opacity-100" : "opacity-0",
              )}
              onLoad={() => setBackdropLoaded(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-900/75 to-neutral-900/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/50 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-neutral-950" />
        )}

        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-7">
          {/* Back */}
          <button
            type="button"
            onClick={() => navigate({ to: "/library" })}
            className="inline-flex items-center gap-1.5 text-xs text-white/55 hover:text-white/90 transition-colors mb-5"
          >
            <ArrowLeft size={13} />
            {t("medias.library.pageTitle", "Library")}
          </button>

          {/* Poster + meta row */}
          <div className="flex gap-5 md:gap-7 items-start">
            {/* Poster */}
            <div className="shrink-0">
              {item.poster_url && !posterError ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className="w-[86px] md:w-[116px] rounded-xl object-cover shadow-2xl ring-1 ring-white/15"
                  onError={() => setPosterError(true)}
                />
              ) : (
                <div className="w-[86px] md:w-[116px] aspect-[2/3] rounded-xl bg-white/8 ring-1 ring-white/12 flex items-center justify-center text-2xl">
                  🎬
                </div>
              )}
            </div>

            {/* Meta */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <h1 className="text-xl md:text-2xl lg:text-[1.65rem] font-bold text-white leading-tight">
                {item.title}
              </h1>

              {detailsData?.tagline && (
                <p className="text-sm italic text-white/65 leading-snug">
                  {detailsData.tagline}
                </p>
              )}

              {/* Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-indigo-600/80 text-white">
                  {item.type === "show"
                    ? t("medias.series")
                    : t("medias.movie")}
                </span>
                {item.year && (
                  <span className="text-xs text-white/55">{item.year}</span>
                )}
                {runtime != null && (
                  <span className="flex items-center gap-0.5 text-xs text-white/55">
                    <Clock size={10} />
                    {formatRuntime(runtime)}
                  </span>
                )}
                {detailsData?.number_of_seasons != null && (
                  <span className="flex items-center gap-0.5 text-xs text-white/55">
                    <Film size={10} />
                    {detailsData.number_of_seasons}S ·{" "}
                    {detailsData.number_of_episodes}E
                  </span>
                )}
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                    statusBadge.cls,
                  )}
                >
                  {t(statusBadge.labelKey)}
                </span>
              </div>

              {/* Ratings */}
              {(voteAverage != null || rtScore) && (
                <div className="flex flex-wrap items-center gap-3">
                  {voteAverage != null && (
                    <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                      <Star size={11} className="fill-amber-400" />
                      {voteAverage.toFixed(1)}
                      <span className="text-[10px] font-normal text-white/45">
                        TMDB
                      </span>
                    </span>
                  )}
                  {rtScore && (
                    <span className="flex items-center gap-1 text-sm">
                      <img
                        src={
                          parseInt(rtScore) >= 60
                            ? "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-fresh.149b5e8adc3.svg"
                            : "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-rotten.f1ef4f02ce3.svg"
                        }
                        alt=""
                        className="h-4 w-4"
                      />
                      <span className="text-white/75 font-semibold">
                        {rtScore}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Genres */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {genres.slice(0, 5).map((g) => (
                    <span
                      key={g.id}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/75 ring-1 ring-white/12"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={handleWatchlistToggle}
                  disabled={
                    addToWatchlist.isPending || removeFromWatchlist.isPending
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                    isInWatchlist
                      ? "bg-amber-500/25 text-amber-300 hover:bg-amber-500/35"
                      : "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20",
                  )}
                >
                  {isInWatchlist ? (
                    <BookmarkCheck size={12} />
                  ) : (
                    <Bookmark size={12} />
                  )}
                  {isInWatchlist
                    ? t("medias.detail.inWatchlist")
                    : t("medias.detail.addToWatchlist")}
                </button>

                <a
                  href={tmdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/15 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-600/25 transition-colors"
                >
                  <ExternalLink size={12} />
                  TMDB
                </a>

                {trailerData?.key && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailerData.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/15 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-600/25 transition-colors"
                  >
                    <Play size={12} />
                    {t("medias.detail.watchTrailer")}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
          {/* Info */}
          {activeTab === "info" && (
            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              {modalPending && !detailsData ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-neutral-200 border-t-indigo-600 dark:border-neutral-700 dark:border-t-indigo-400" />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Trailer embed */}
                  {trailerData?.key && (
                    <div
                      className="relative w-full overflow-hidden rounded-xl bg-black"
                      style={{ aspectRatio: "16/9" }}
                    >
                      <iframe
                        src={`https://www.youtube.com/embed/${trailerData.key}?rel=0`}
                        title={trailerData.name ?? "Trailer"}
                        allow="encrypted-media; fullscreen"
                        allowFullScreen
                        className="absolute inset-0 h-full w-full"
                      />
                    </div>
                  )}

                  {/* Cast */}
                  {creditsData && creditsData.cast.length > 0 && (
                    <div>
                      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                        {t("medias.detail.cast", "Cast")}
                      </p>
                      <div
                        className="flex gap-3 overflow-x-auto pb-1"
                        style={{ scrollbarWidth: "none" }}
                      >
                        {creditsData.cast.map((member) => (
                          <div
                            key={member.id}
                            className="flex w-[54px] shrink-0 flex-col items-center gap-1"
                          >
                            {member.profile_url ? (
                              <img
                                src={member.profile_url}
                                alt={member.name}
                                className="h-[54px] w-[54px] rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
                              />
                            ) : (
                              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 text-lg">
                                👤
                              </div>
                            )}
                            <p className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-neutral-700 dark:text-neutral-300">
                              {member.name}
                            </p>
                            {member.character && (
                              <p className="line-clamp-1 text-center text-[9px] leading-tight text-neutral-400 dark:text-neutral-500">
                                {member.character}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Where to watch */}
                  {hasProviders && (
                    <div>
                      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                        {t("medias.detail.whereToWatch")}
                      </p>
                      <div className="flex flex-col gap-2">
                        {[
                          {
                            list: providers!.streaming,
                            label: t("medias.detail.stream"),
                          },
                          {
                            list: providers!.free,
                            label: t("medias.detail.free"),
                          },
                          {
                            list: providers!.rent,
                            label: t("medias.detail.rent"),
                          },
                          {
                            list: providers!.buy,
                            label: t("medias.detail.buy"),
                          },
                        ]
                          .filter(({ list }) => list.length > 0)
                          .map(({ list, label }) => (
                            <div
                              key={label}
                              className="flex items-center gap-2"
                            >
                              <span className="w-12 shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">
                                {label}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {list.map((p) => (
                                  <img
                                    key={p.id}
                                    src={p.logo_url}
                                    alt={p.name}
                                    title={p.name}
                                    className="h-7 w-7 rounded-md object-cover"
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {detailsData && (
                    <MediaDetailInfoSections
                      details={detailsData}
                      displayTitle={item.title}
                      mediaType={mediaType}
                      tmdbId={item.tmdb_id}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Similar */}
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

          {/* Search */}
          {activeTab === "search" && (
            <div className="min-h-[300px] pb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
              {episodeSearchCtx && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2">
                  <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {t("medias.detail.searchingEpisode", "Searching for")}{" "}
                    S{String(episodeSearchCtx.season).padStart(2, "0")}E
                    {String(episodeSearchCtx.episode).padStart(2, "0")}
                    {episodeSearchCtx.title ? ` — ${episodeSearchCtx.title}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEpisodeSearchCtx(null)}
                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    {t("common.clear", "Clear")}
                  </button>
                </div>
              )}
              <InteractiveSearchPanel
                isActive
                media={mediaItem}
                libraryMediaId={item.id}
                defaultProwlarrQuery={
                  episodeSearchCtx
                    ? `${item.title} S${String(episodeSearchCtx.season).padStart(2, "0")}E${String(episodeSearchCtx.episode).padStart(2, "0")}`
                    : item.title
                }
                episodeId={episodeSearchCtx?.id ?? null}
                defaultSeason={seasonSearchCtx}
              />
            </div>
          )}

          {/* Management */}
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
