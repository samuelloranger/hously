import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAddToLibrary } from "@/features/medias/hooks/useAddToLibrary";
import { useAddToWatchlist } from "@/features/medias/hooks/useAddToWatchlist";
import { useMediaModalData } from "@/features/medias/hooks/useMediaModalData";
import { useRemoveFromWatchlist } from "@/features/medias/hooks/useRemoveFromWatchlist";
import { type TmdbMediaSearchItem } from "@hously/shared/types";
import { Check, Info, Sparkles, UserCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/dialog";
import { cn } from "@/lib/utils";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { MediaDetailInfoSections } from "@/pages/medias/_component/MediaDetailInfoSections";
import { SimilarMediasPanel } from "@/pages/medias/_component/SimilarMediasPanel";
import { ExploreCardHero } from "./ExploreCardHero";
import { ExploreCardActions } from "./ExploreCardActions";

export type TabKey = "info" | "similar";

interface ExploreCardDetailDialogProps {
  item: TmdbMediaSearchItem;
  isOpen: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function ExploreCardDetailDialog({
  item,
  isOpen,
  onClose,
  onAdded,
}: ExploreCardDetailDialogProps) {
  const { t, i18n } = useTranslation("common");
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [imageError, setImageError] = useState(false);

  const addMutation = useAddToLibrary();
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();

  const itemKey = `${item.tmdb_id}:${item.media_type}`;

  const { data: modalData, isPending: modalDataPending } = useMediaModalData(
    item.media_type,
    item.tmdb_id,
    { enabled: isOpen },
    i18n.language,
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
      onAdded?.();
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
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <ExploreCardHero
          item={item}
          detailsData={detailsData}
          ratingsData={ratingsData}
          creditsData={creditsData}
          heroBackdropUrl={heroBackdropUrl}
          heroBackdropLoaded={heroBackdropLoaded}
          heroVisualReady={heroVisualReady}
          posterLoaded={posterLoaded}
          imageError={imageError}
          runtimeStr={runtimeStr}
          collection={collection}
          voteAverage={voteAverage}
          onBackdropLoaded={setLoadedBackdropUrl}
          onPosterLoaded={() => setLoadedPosterKey(itemKey)}
          onImageError={() => setImageError(true)}
        />

        {/* ── Scrollable body (actions, tabs, panels) ───────────────── */}
        <div className="ios-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pb-4">
          {modalDataPending && !modalData ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16"
              aria-busy="true"
              aria-label={t("common.loading")}
            >
              <div className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600 dark:border-neutral-600 dark:border-t-primary-400" />
            </div>
          ) : (
            <div
              className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out motion-reduce:animate-none"
              key={
                modalData ? `detail-${item.tmdb_id}` : `item-${item.tmdb_id}`
              }
            >
              {/* ── Actions bar (above tabs) ──────────────────────────────── */}
              <ExploreCardActions
                item={item}
                isInWatchlist={isInWatchlist}
                isAddPending={addMutation.isPending}
                isWatchlistPending={
                  addToWatchlist.isPending || removeFromWatchlist.isPending
                }
                trailerData={trailerData}
                tmdbUrl={tmdbUrl}
                onAdd={handleAdd}
                onWatchlistToggle={handleWatchlistToggle}
                onClose={onClose}
              />

              {/* ── Tab pills ─────────────────────────────────────────────── */}
              {tabs.length > 1 && (
                <SegmentedTabs
                  items={tabs.map((tab) => ({
                    id: tab.key,
                    label: tab.label,
                    icon: tab.icon,
                  }))}
                  value={validTab}
                  onChange={setActiveTab}
                />
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
                              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                                <UserCircle className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
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
