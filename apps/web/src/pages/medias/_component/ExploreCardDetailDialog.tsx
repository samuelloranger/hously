import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { useAddToLibrary } from "@/hooks/useLibrary";
import {
  useAddToWatchlist,
  useMediaModalData,
  useRemoveFromWatchlist,
} from "@/hooks/useMedias";
import { type TmdbMediaSearchItem } from "@hously/shared/types";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Clock,
  ExternalLink,
  Film,
  Info,
  Play,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/dialog";
import { cn } from "@/lib/utils";
import { MediaDetailInfoSections } from "@/pages/medias/_component/MediaDetailInfoSections";
import { SimilarMediasPanel } from "@/pages/medias/_component/SimilarMediasPanel";

export type TabKey = "info" | "similar";

function formatTmdbDateYmd(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}


interface ExploreCardDetailDialogProps {
  item: TmdbMediaSearchItem;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function ExploreCardDetailDialog({
  item,
  isOpen,
  onClose,
  onAdded,
}: ExploreCardDetailDialogProps) {
  const { t } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [imageError, setImageError] = useState(false);

  const addMutation = useAddToLibrary();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const itemKey = `${item.tmdb_id}:${item.media_type}`;

  const { data: modalData, isPending: modalDataPending } = useMediaModalData(
    item.media_type,
    item.tmdb_id,
    undefined,
    {
      enabled: isOpen,
    },
  );

  const [loadedBackdropUrl, setLoadedBackdropUrl] = useState<string | null>(
    null,
  );
  const [loadedPosterKey, setLoadedPosterKey] = useState<string | null>(null);

  const isInWatchlist = modalData?.watchlist_status ?? false;
  const providers = modalData?.providers ?? null;
  const trailerData = modalData?.trailer ?? null;
  const ratingsData = modalData?.ratings ?? null;
  const creditsData = modalData?.credits ?? null;
  const detailsData = modalData?.details ?? null;
  const libraryEpisodes = modalData?.library_episodes ?? null;

  const episodesBySeason = useMemo(() => {
    const m = new Map<number, { episode_number: number }[]>();
    for (const e of libraryEpisodes?.downloaded ?? []) {
      const arr = m.get(e.season_number) ?? [];
      arr.push({ episode_number: e.episode_number });
      m.set(e.season_number, arr);
    }
    return m;
  }, [libraryEpisodes?.downloaded]);

  const hasTmdbId = item.tmdb_id > 0;

  const tabs = useMemo(() => {
    const result: { key: TabKey; label: string; icon: typeof Info }[] = [
      { key: "info", label: t("medias.detail.tabInfo", "Info"), icon: Info },
    ];
    if (hasTmdbId)
      result.push({
        key: "similar",
        label: t("medias.detail.tabSimilar", "Similar"),
        icon: Sparkles,
      });
    return result;
  }, [hasTmdbId, t]);

  const validTab = tabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : "info";

  const handleAdd = async () => {
    if (addMutation.isPending || !item.can_add) return;
    try {
      await addMutation.mutateAsync({
        tmdb_id: item.tmdb_id,
        type: item.media_type === "tv" ? "show" : "movie",
      });
      toast.success(t("medias.addSuccess", { title: item.title }));
      onAdded();
    } catch {
      toast.error(t("medias.addFailed"));
    }
  };

  const handleWatchlistToggle = async () => {
    if (isInWatchlist) {
      await removeFromWatchlist.mutateAsync({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
      });
    } else {
      await addToWatchlist.mutateAsync({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        title: item.title,
        poster_url: item.poster_url,
        overview: item.overview,
        release_year: item.release_year,
        vote_average: item.vote_average,
        release_date:
          item.media_type === "movie"
            ? (detailsData?.release_date ?? null)
            : null,
      });
    }
  };

  const tmdbUrl = `https://www.themoviedb.org/${item.media_type}/${item.tmdb_id}`;

  const overview = item.overview ?? detailsData?.overview ?? null;
  const voteAverage = item.vote_average ?? detailsData?.vote_average ?? null;
  const runtime = detailsData?.runtime ?? null;
  const collection = detailsData?.belongs_to_collection ?? null;

  const runtimeStr = runtime
    ? `${Math.floor(runtime / 60)}h ${runtime % 60 > 0 ? ` ${runtime % 60}m` : ""}`
    : null;

  /** First backdrop: primary TMDB image, else first still in "Visuels" — used as hero background */
  const heroBackdropUrl =
    detailsData?.primary_backdrop_url ??
    detailsData?.media_stills?.backdrops?.[0]?.url ??
    null;

  // Derived: reset automatically when the URL or item key changes — no effect needed.
  const heroBackdropLoaded = loadedBackdropUrl === heroBackdropUrl;
  const posterLoaded = isOpen && loadedPosterKey === itemKey;
  const heroVisualReady = !heroBackdropUrl || heroBackdropLoaded;

  const hasProviders =
    providers &&
    (providers.streaming.length > 0 ||
      providers.free.length > 0 ||
      providers.rent.length > 0 ||
      providers.buy.length > 0);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={item.title}
      hideTitle
      bodyScroll
      panelClassName="max-w-3xl p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* ── Hero: backdrop edge-to-edge; padding on inner row (or outer when no image) ─ */}
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-t-2xl transition-[min-height] duration-500 ease-out",
            heroBackdropUrl ? "min-h-[200px]" : "min-h-0",
            !heroBackdropUrl && "px-5 pt-5 pb-3",
          )}
        >
          {heroBackdropUrl ? (
            <>
              <div
                className="absolute inset-0 bg-neutral-900 dark:bg-neutral-950"
                aria-hidden
              />
              <img
                src={heroBackdropUrl}
                alt=""
                loading="eager"
                decoding="async"
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none",
                  heroBackdropLoaded
                    ? "opacity-100 scale-100"
                    : "opacity-0 scale-[1.03]",
                )}
                onLoad={() => setLoadedBackdropUrl(heroBackdropUrl)}
              />
              <div
                className={cn(
                  "absolute inset-0 bg-black/75 transition-opacity duration-500 ease-out motion-reduce:transition-none",
                  heroBackdropLoaded ? "opacity-100" : "opacity-90",
                )}
                aria-hidden
              />
            </>
          ) : null}

          <div
            className={cn(
              "relative z-10 flex gap-4 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              heroBackdropUrl ? "px-5 pb-4 pt-5 text-white" : "px-0 py-1 pt-0",
              heroVisualReady
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-[0.92]",
            )}
          >
            {/* Poster thumbnail */}
            <div className="shrink-0">
              {item.poster_url && !imageError ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  className={cn(
                    "w-[88px] rounded-xl object-cover shadow-md ring-1 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
                    heroBackdropUrl
                      ? "ring-white/25"
                      : "ring-black/10 dark:ring-white/10",
                    posterLoaded
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1",
                  )}
                  onLoad={() => setLoadedPosterKey(itemKey)}
                  onError={() => setImageError(true)}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-32 w-[88px] items-center justify-center rounded-xl text-2xl transition-opacity duration-500 motion-reduce:transition-none",
                    heroVisualReady ? "opacity-100" : "opacity-80",
                    heroBackdropUrl
                      ? "bg-white/15 ring-1 ring-white/20"
                      : "bg-neutral-200 dark:bg-neutral-700",
                  )}
                >
                  🎬
                </div>
              )}
            </div>

            {/* Meta column */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
              {/* Title */}
              <h2
                className={cn(
                  "text-xl font-semibold leading-snug",
                  heroBackdropUrl
                    ? "text-white"
                    : "text-neutral-900 dark:text-white",
                )}
              >
                {item.title}
              </h2>

              {detailsData?.tagline && (
                <p
                  className={cn(
                    "text-sm italic leading-snug",
                    heroBackdropUrl
                      ? "text-white/85"
                      : "text-neutral-600 dark:text-neutral-400",
                  )}
                >
                  {detailsData.tagline}
                </p>
              )}

              {/* Type + year + runtime */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-md bg-indigo-600/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  {item.media_type === "movie"
                    ? t("medias.movie")
                    : t("medias.series")}
                </span>
                {item.release_year && (
                  <span
                    className={cn(
                      "text-xs",
                      heroBackdropUrl
                        ? "text-white/75"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    {item.release_year}
                  </span>
                )}
                {runtimeStr && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs",
                      heroBackdropUrl
                        ? "text-white/75"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    <Clock size={10} />
                    {runtimeStr}
                  </span>
                )}
                {detailsData?.number_of_seasons != null && (
                  <span
                    className={cn(
                      "flex items-center gap-0.5 text-xs",
                      heroBackdropUrl
                        ? "text-white/75"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    <Film size={10} />
                    {detailsData.number_of_seasons}S ·{" "}
                    {detailsData.number_of_episodes}E
                  </span>
                )}
              </div>

              {/* Ratings */}
              <div className="flex flex-wrap items-center gap-3">
                {voteAverage != null && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-amber-400">
                    <Star size={12} className="fill-amber-400" />
                    {voteAverage.toFixed(1)}
                    <span
                      className={cn(
                        "text-[10px] font-normal",
                        heroBackdropUrl ? "text-white/60" : "text-neutral-400",
                      )}
                    >
                      TMDB
                    </span>
                  </span>
                )}
                {ratingsData?.rotten_tomatoes &&
                  (() => {
                    const score = parseInt(ratingsData.rotten_tomatoes);
                    const isFresh = score >= 60;
                    return (
                      <span className="flex items-center gap-1 text-sm font-semibold">
                        <img
                          src={
                            isFresh
                              ? "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-fresh.149b5e8adc3.svg"
                              : "https://www.rottentomatoes.com/assets/pizza-pie/images/icons/tomatometer/tomatometer-rotten.f1ef4f02ce3.svg"
                          }
                          alt={isFresh ? "Fresh" : "Rotten"}
                          className="h-4 w-4"
                        />
                        <span
                          className={cn(
                            isFresh
                              ? "text-red-300"
                              : heroBackdropUrl
                                ? "text-white/70"
                                : "text-neutral-400",
                          )}
                        >
                          {ratingsData.rotten_tomatoes}
                        </span>
                      </span>
                    );
                  })()}
                {ratingsData?.metacritic && (
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    <svg
                      viewBox="0 0 32 32"
                      className="h-4 w-4"
                      aria-label="Metacritic"
                    >
                      <circle cx="16" cy="16" r="16" fill="#FFCC34" />
                      <text
                        x="16"
                        y="22"
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="900"
                        fontFamily="Arial, sans-serif"
                        fill="#000"
                      >
                        M
                      </text>
                    </svg>
                    <span
                      className={cn(
                        heroBackdropUrl
                          ? "text-white/90"
                          : "text-neutral-700 dark:text-neutral-300",
                      )}
                    >
                      {ratingsData.metacritic}
                    </span>
                  </span>
                )}
              </div>

              {(detailsData?.genres?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(detailsData?.genres ?? []).map((g) => (
                    <span
                      key={g.id}
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                        heroBackdropUrl
                          ? "bg-white/15 text-white ring-1 ring-white/25"
                          : "bg-neutral-200/90 text-neutral-700 dark:bg-neutral-700/70 dark:text-neutral-300",
                      )}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              {item.media_type === "movie" &&
                formatTmdbDateYmd(detailsData?.release_date) && (
                  <p
                    className={cn(
                      "text-xs",
                      heroBackdropUrl
                        ? "text-white/80"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    <span
                      className={
                        heroBackdropUrl
                          ? "text-white/55"
                          : "text-neutral-400 dark:text-neutral-500"
                      }
                    >
                      {t("medias.detail.releaseDate")}{" "}
                    </span>
                    {formatTmdbDateYmd(detailsData?.release_date)}
                  </p>
                )}

              {item.media_type === "tv" &&
                (formatTmdbDateYmd(detailsData?.first_air_date) ||
                  formatTmdbDateYmd(detailsData?.last_air_date) ||
                  detailsData?.status) && (
                  <p
                    className={cn(
                      "text-xs",
                      heroBackdropUrl
                        ? "text-white/80"
                        : "text-neutral-500 dark:text-neutral-400",
                    )}
                  >
                    {[
                      formatTmdbDateYmd(detailsData?.first_air_date) &&
                        `${t("medias.detail.firstAir")} ${formatTmdbDateYmd(detailsData?.first_air_date)}`,
                      formatTmdbDateYmd(detailsData?.last_air_date) &&
                        `${t("medias.detail.lastAir")} ${formatTmdbDateYmd(detailsData?.last_air_date)}`,
                      detailsData?.status &&
                        `${t("medias.detail.showStatus")} ${detailsData.status}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

              {/* Director */}
              {creditsData?.directors && creditsData.directors.length > 0 && (
                <p
                  className={cn(
                    "text-xs",
                    heroBackdropUrl
                      ? "text-white/80"
                      : "text-neutral-500 dark:text-neutral-400",
                  )}
                >
                  <span
                    className={
                      heroBackdropUrl
                        ? "text-white/55"
                        : "text-neutral-400 dark:text-neutral-500"
                    }
                  >
                    {t("medias.detail.director")}{" "}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      heroBackdropUrl
                        ? "text-white"
                        : "text-neutral-600 dark:text-neutral-300",
                    )}
                  >
                    {creditsData.directors.join(", ")}
                  </span>
                </p>
              )}

              {/* Collection */}
              {collection && (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex min-w-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      heroBackdropUrl
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-indigo-500/25 bg-indigo-500/8 text-indigo-600 dark:text-indigo-400",
                    )}
                  >
                    <span className="shrink-0">
                      {t("medias.detail.partOfCollection")}
                    </span>
                    <span className="truncate">{collection.name}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable body (actions, tabs, panels) ───────────────── */}
        <div className="ios-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-4">
          {modalDataPending && !modalData ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16"
              aria-busy="true"
              aria-label={t("common.loading")}
            >
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-indigo-600 dark:border-neutral-600 dark:border-t-indigo-400" />
            </div>
          ) : (
            <div
              className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out motion-reduce:animate-none"
              key={
                modalData ? `detail-${item.tmdb_id}` : `item-${item.tmdb_id}`
              }
            >
              {/* ── Actions bar (above tabs) ──────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2 border-y border-neutral-200 dark:border-neutral-700/60 py-2 mb-3">
                {/* Watchlist toggle */}
                <button
                  type="button"
                  onClick={handleWatchlistToggle}
                  disabled={
                    addToWatchlist.isPending || removeFromWatchlist.isPending
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-[background-color] disabled:opacity-50",
                    isInWatchlist
                      ? "bg-amber-500/25 text-amber-700 hover:bg-amber-500/35 dark:text-amber-400"
                      : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
                  )}
                >
                  {isInWatchlist ? (
                    <BookmarkCheck size={12} />
                  ) : (
                    <Bookmark size={12} />
                  )}
                  {isInWatchlist
                    ? t("medias.detail.inWatchlist", "Watchlist ✓")
                    : t("medias.detail.addToWatchlist", "Watchlist")}
                </button>

                {/* TMDB link */}
                <a
                  href={tmdbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/10 px-3 py-1.5 text-xs font-medium text-sky-700 transition-[background-color] hover:bg-sky-600/20 dark:text-sky-400"
                >
                  <ExternalLink size={12} />
                  TMDB
                </a>

                {/* Trailer link */}
                {trailerData?.key && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailerData.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/10 px-3 py-1.5 text-xs font-medium text-red-700 transition-[background-color] hover:bg-red-600/20 dark:text-red-400"
                  >
                    <Play size={12} />
                    {t("medias.detail.watchTrailer")}
                  </a>
                )}

                <div className="flex-1" />

                {/* Add to library — primary CTA */}
                {!item.already_exists && item.can_add && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={addMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-[background-color] hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50"
                    >
                      {addMutation.isPending ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Plus size={12} />
                      )}
                      {t("medias.detail.addToLibrary")}
                    </button>
                  </div>
                )}

                {/* Already in library */}
                {item.already_exists && item.library_id && (
                  <Link
                    to="/library/$libraryId"
                    params={{ libraryId: String(item.library_id) }}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-[background-color] hover:bg-emerald-500/20 dark:text-emerald-400"
                  >
                    <Check size={12} /> {t("medias.detail.inLibrary")}
                  </Link>
                )}
                {item.already_exists && !item.library_id && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check size={12} /> {t("medias.detail.inLibrary")}
                  </span>
                )}
              </div>

              {/* ── Tab pills ─────────────────────────────────────────────── */}
              {tabs.length > 1 && (
                <div className="flex gap-1 mb-3">
                  {tabs.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,color] duration-150",
                        validTab === key
                          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300",
                      )}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Info tab ─────────────────────────────────────────────── */}
              {validTab === "info" && (
                <div className="flex flex-col gap-4 pb-4 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                  {/* Trailer */}
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

                  {/* Overview */}
                  {overview && (
                    <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                      {overview}
                    </p>
                  )}
                  {!overview && (
                    <p className="text-sm italic text-neutral-400 dark:text-neutral-500">
                      {t("medias.detail.noOverview")}
                    </p>
                  )}

                  {detailsData && (
                    <MediaDetailInfoSections
                      details={detailsData}
                      displayTitle={item.title}
                      mediaType={item.media_type}
                      tmdbId={item.tmdb_id}
                    />
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

                  {item.media_type === "tv" &&
                    detailsData &&
                    detailsData.seasons.length > 0 && (
                      <div>
                        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                          {t("medias.detail.seasons", "Seasons")}
                        </p>
                        <div className="flex flex-col gap-4">
                          {detailsData.seasons.map((s) => {
                            const seasonEps =
                              episodesBySeason.get(s.season_number) ?? [];
                            const onDisk = libraryEpisodes?.in_library
                              ? seasonEps.length
                              : null;
                            const total = s.episode_count;
                            const complete =
                              onDisk != null &&
                              total != null &&
                              total > 0 &&
                              onDisk === total;
                            const hasEpisodeData =
                              libraryEpisodes?.in_library &&
                              seasonEps.length > 0;

                            return (
                              <div key={s.season_number}>
                                {/* Season header */}
                                <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-neutral-200 pb-1.5 dark:border-neutral-800">
                                  <span className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                                    {s.name}
                                  </span>
                                  {libraryEpisodes?.in_library &&
                                  onDisk != null ? (
                                    <span
                                      className={cn(
                                        "inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
                                        complete
                                          ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                          : "text-neutral-500 dark:text-neutral-400",
                                      )}
                                      title={t(
                                        "medias.detail.seasonOnDiskTitle",
                                      )}
                                    >
                                      {total != null
                                        ? t("medias.detail.seasonOnDiskRatio", {
                                            onDisk,
                                            total,
                                          })
                                        : t("medias.detail.seasonOnDiskCount", {
                                            count: onDisk,
                                          })}
                                      {complete && (
                                        <Check
                                          size={11}
                                          className="shrink-0"
                                          aria-hidden
                                        />
                                      )}
                                    </span>
                                  ) : !libraryEpisodes?.in_library &&
                                    s.episode_count != null ? (
                                    <span className="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">
                                      {t("medias.detail.seasonEpisodes", {
                                        count: s.episode_count,
                                      })}
                                    </span>
                                  ) : null}
                                </div>

                                {/* Episode rows */}
                                {hasEpisodeData && (
                                  <div className="flex flex-col">
                                    {seasonEps.map((ep) => (
                                      <div
                                        key={ep.episode_number}
                                        className={cn(
                                          "grid grid-cols-[2rem_minmax(0,1fr)_1rem] items-center gap-x-2 rounded px-1 py-1 text-[12px] transition-colors",
                                          "text-neutral-700 dark:text-neutral-300",
                                        )}
                                      >
                                        <span className="shrink-0 tabular-nums text-right font-mono text-[11px] text-neutral-400 dark:text-neutral-600">
                                          {`E${String(ep.episode_number).padStart(2, "0")}`}
                                        </span>
                                        <span className="min-w-0 truncate leading-snug">
                                          {`Episode ${ep.episode_number}`}
                                        </span>
                                        <Check
                                          size={11}
                                          className="shrink-0 text-emerald-500 dark:text-emerald-400"
                                          aria-hidden
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* ── Similar tab ──────────────────────────────────────────── */}
              {validTab === "similar" && (
                <div className="min-h-[300px] pb-6 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
                  <SimilarMediasPanel
                    isActive={isOpen && validTab === "similar"}
                    tmdbId={item.tmdb_id}
                    mediaType={item.media_type}
                    onAdded={onAdded}
                  />
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
