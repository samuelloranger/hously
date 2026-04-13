import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { MediaPosterCard } from "@/components/MediaPosterCard";
import { cn } from "@/lib/utils";
import type { LibraryMedia } from "@hously/shared/types";
import { usePrefetchLibraryItem } from "@/features/medias/hooks/usePrefetchLibraryItem";

const STATUS_STYLES: Record<
  LibraryMedia["status"],
  { labelKey: string; className: string }
> = {
  wanted: {
    labelKey: "medias.library.itemStatus.wanted",
    className:
      "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300",
  },
  downloading: {
    labelKey: "medias.library.itemStatus.downloading",
    className: "bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300",
  },
  downloaded: {
    labelKey: "medias.library.itemStatus.downloaded",
    className:
      "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  },
  skipped: {
    labelKey: "medias.library.itemStatus.skipped",
    className:
      "bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400",
  },
};

type CardStatus = "downloaded" | "downloading" | "missing";

function toCardStatus(status: LibraryMedia["status"]): CardStatus {
  if (status === "downloaded") return "downloaded";
  if (status === "downloading") return "downloading";
  return "missing";
}

interface LibraryItemCardProps {
  item: LibraryMedia;
  onMovieSearch?: (id: number) => void;
  movieSearchPending?: boolean;
}

export function LibraryItemCard({
  item,
  onMovieSearch,
  movieSearchPending,
}: LibraryItemCardProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const prefetchLibraryItem = usePrefetchLibraryItem();
  const statusInfo = STATUS_STYLES[item.status] ?? STATUS_STYLES.wanted;
  const statusLabel = t(statusInfo.labelKey);
  const digitalLabel =
    item.type === "movie" && item.digital_release_date
      ? new Date(item.digital_release_date).toLocaleDateString(undefined, {
          dateStyle: "medium",
        })
      : null;

  return (
    <div
      className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden cursor-pointer group"
      onClick={() =>
        navigate({
          to: "/library/$libraryId",
          params: { libraryId: String(item.id) },
        })
      }
      onMouseEnter={() => prefetchLibraryItem(item)}
      onTouchStart={() => prefetchLibraryItem(item)}
    >
      <MediaPosterCard
        posterUrl={item.poster_url}
        title={item.title}
        status={toCardStatus(item.status)}
        statusLabel={statusLabel}
      >
        <div className="pb-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {item.year ?? "—"}
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                statusInfo.className,
              )}
            >
              {statusLabel}
            </span>
          </div>
          {digitalLabel && (
            <p className="text-[9px] text-neutral-500 dark:text-neutral-400 leading-tight">
              {t("medias.library.digitalRelease", { date: digitalLabel })}
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
