import { useTranslation } from "react-i18next";
import type { LibraryMedia, MediaItem } from "@hously/shared/types";
import { InteractiveSearchPanel } from "./InteractiveSearchPanel";

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

export type EpisodeSearchCtx = {
  id: number;
  season: number;
  episode: number;
  title: string | null;
};

type Props = {
  item: LibraryMedia;
  episodeSearchCtx: EpisodeSearchCtx | null;
  seasonSearchCtx: number | null;
  onClearEpisodeCtx: () => void;
  onClearSeasonCtx: () => void;
  /** From TMDB details — original-language title (movies + TV) */
  tmdbOriginalTitle: string | null;
  /** When true, grabs are marked as upgrades */
  isUpgradeMode?: boolean;
  onClearUpgradeMode?: () => void;
};

export function LibraryItemSearchTab({
  item,
  episodeSearchCtx,
  seasonSearchCtx,
  onClearEpisodeCtx,
  onClearSeasonCtx,
  tmdbOriginalTitle,
  isUpgradeMode = false,
  onClearUpgradeMode,
}: Props) {
  const mediaItem = libraryToMediaItem(item);
  const { t } = useTranslation("common");

  const seasonSuffix =
    !episodeSearchCtx && seasonSearchCtx !== null
      ? ` S${String(seasonSearchCtx).padStart(2, "0")}`
      : "";

  const epSuffix = episodeSearchCtx
    ? ` S${String(episodeSearchCtx.season).padStart(2, "0")}E${String(episodeSearchCtx.episode).padStart(2, "0")}`
    : "";

  const ctxSuffix = epSuffix || seasonSuffix;

  const localizedQuery = `${item.title}${ctxSuffix}`;

  const orig = tmdbOriginalTitle?.trim() || null;
  const searchQueryOriginal =
    orig && orig.toLowerCase() !== item.title.trim().toLowerCase()
      ? `${orig}${ctxSuffix}`
      : null;

  return (
    <>
      {episodeSearchCtx && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/30 px-3 py-2">
          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
            {t("medias.detail.searchingEpisode", "Searching for")} S
            {String(episodeSearchCtx.season).padStart(2, "0")}E
            {String(episodeSearchCtx.episode).padStart(2, "0")}
            {episodeSearchCtx.title ? ` — ${episodeSearchCtx.title}` : ""}
          </span>
          <button
            type="button"
            onClick={onClearEpisodeCtx}
            className="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {t("common.clear", "Clear")}
          </button>
        </div>
      )}
      {seasonSearchCtx !== null && !episodeSearchCtx && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-3 py-2">
          <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
            {t("medias.detail.searchingSeasonPack", "Searching season pack")} S
            {String(seasonSearchCtx).padStart(2, "0")}
          </span>
          <button
            type="button"
            onClick={onClearSeasonCtx}
            className="text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300"
          >
            {t("common.clear", "Clear")}
          </button>
        </div>
      )}
      {isUpgradeMode && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {t(
              "medias.detail.upgradeMode",
              "Upgrade mode — grab will replace the existing file",
            )}
          </span>
          <button
            type="button"
            onClick={onClearUpgradeMode}
            className="text-xs text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
          >
            {t("common.clear", "Clear")}
          </button>
        </div>
      )}
      <InteractiveSearchPanel
        isActive
        media={mediaItem}
        libraryMediaId={item.id}
        defaultSearchQuery={localizedQuery}
        searchQueryOriginal={searchQueryOriginal}
        episodeId={episodeSearchCtx?.id ?? null}
        defaultSeason={seasonSearchCtx}
        isUpgradeMode={isUpgradeMode}
      />
    </>
  );
}
