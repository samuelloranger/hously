import { useTranslation } from "react-i18next";
import type { LibraryMedia, MediaItem } from "@hously/shared/types";
import { InteractiveSearchPanel } from "./InteractiveSearchPanel";

export type EpisodeSearchCtx = {
  id: number;
  season: number;
  episode: number;
  title: string | null;
};

type Props = {
  item: LibraryMedia;
  mediaItem: MediaItem;
  episodeSearchCtx: EpisodeSearchCtx | null;
  seasonSearchCtx: number | null;
  onClearEpisodeCtx: () => void;
};

export function LibraryItemSearchTab({
  item,
  mediaItem,
  episodeSearchCtx,
  seasonSearchCtx,
  onClearEpisodeCtx,
}: Props) {
  const { t } = useTranslation("common");

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
        defaultProwlarrQuery={
          episodeSearchCtx
            ? `${item.title} S${String(episodeSearchCtx.season).padStart(2, "0")}E${String(episodeSearchCtx.episode).padStart(2, "0")}`
            : item.title
        }
        episodeId={episodeSearchCtx?.id ?? null}
        defaultSeason={seasonSearchCtx}
      />
    </>
  );
}
