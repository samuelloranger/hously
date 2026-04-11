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
  /** From TMDB details — original-language title (movies + TV) */
  tmdbOriginalTitle: string | null;
};

export function LibraryItemSearchTab({
  item,
  episodeSearchCtx,
  seasonSearchCtx,
  onClearEpisodeCtx,
  tmdbOriginalTitle,
}: Props) {
  const mediaItem = libraryToMediaItem(item);
  const { t } = useTranslation("common");

  const epSuffix = episodeSearchCtx
    ? ` S${String(episodeSearchCtx.season).padStart(2, "0")}E${String(episodeSearchCtx.episode).padStart(2, "0")}`
    : "";

  const localizedQuery = episodeSearchCtx
    ? `${item.title}${epSuffix}`
    : item.title;

  const orig = tmdbOriginalTitle?.trim() || null;
  const prowlarrQueryOriginal =
    orig && orig.toLowerCase() !== item.title.trim().toLowerCase()
      ? `${orig}${epSuffix}`
      : null;

  return (
    <>
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
            onClick={onClearEpisodeCtx}
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
        defaultProwlarrQuery={localizedQuery}
        prowlarrQueryOriginal={prowlarrQueryOriginal}
        episodeId={episodeSearchCtx?.id ?? null}
        defaultSeason={seasonSearchCtx}
      />
    </>
  );
}
