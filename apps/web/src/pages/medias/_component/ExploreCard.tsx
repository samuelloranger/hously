import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAddUpcomingToLibrary } from "@/hooks/dashboard/useDashboard";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { MEDIAS_ENDPOINTS } from "@/lib/endpoints";
import type {
  MediaModalDataResponse,
  TmdbMediaSearchItem,
} from "@hously/shared/types";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { ExploreCardDetailDialog } from "@/pages/medias/_component/ExploreCardDetailDialog";

export function ExploreCard({
  item,
  onAdded,
}: {
  item: TmdbMediaSearchItem;
  onAdded: () => void;
}) {
  const { t, i18n } = useTranslation("common");
  const [detailOpen, setDetailOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const addUpcomingMutation = useAddUpcomingToLibrary();
  const queryClient = useQueryClient();
  const fetcher = useFetcher();

  const prefetchModal = useCallback(() => {
    const lang = i18n.language;
    queryClient.prefetchQuery({
      queryKey: queryKeys.medias.modalData(
        item.media_type,
        item.tmdb_id,
        undefined,
        lang,
      ),
      queryFn: () =>
        fetcher<MediaModalDataResponse>(
          MEDIAS_ENDPOINTS.MODAL_DATA(
            item.media_type,
            item.tmdb_id,
            undefined,
            lang,
          ),
        ),
      staleTime: 60 * 1000,
    });
  }, [queryClient, fetcher, item.media_type, item.tmdb_id, i18n.language]);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (addUpcomingMutation.isPending || item.already_exists || !item.can_add)
      return;
    try {
      await addUpcomingMutation.mutateAsync({
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        search_on_add: false,
      });
      toast.success(t("medias.addSuccess", { title: item.title }));
      onAdded();
    } catch {
      toast.error(t("medias.addFailed"));
    }
  };

  const isAdding = addUpcomingMutation.isPending;
  const showImage = Boolean(item.poster_url) && !imgError;
  const score = item.vote_average ? Math.round(item.vote_average * 10) : null;
  const scoreColor =
    score === null
      ? ""
      : score >= 70
        ? "text-emerald-400"
        : score >= 50
          ? "text-amber-400"
          : "text-rose-400";

  return (
    <>
      {/* Outer div — needed to allow a nested <button> for the add action */}
      <div
        className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-neutral-950 ring-1 ring-white/[0.06]"
        onMouseEnter={prefetchModal}
      >
        {/* Clickable overlay for opening the detail dialog */}
        <div
          role="button"
          tabIndex={0}
          aria-label={item.title}
          onClick={() => setDetailOpen(true)}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && setDetailOpen(true)
          }
          className="absolute inset-0 z-10 cursor-pointer focus:outline-none"
        />

        {/* Poster image */}
        {showImage ? (
          <img
            src={item.poster_url!}
            alt=""
            loading="lazy"
            aria-hidden
            onError={() => setImgError(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl text-white/10">
            🎞️
          </div>
        )}

        {/* Permanent gradient — deep at the bottom for legibility */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Top-right status badge — always visible */}
        {item.already_exists && (
          <div className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-black/30">
            <Check size={9} strokeWidth={3} className="text-white" />
          </div>
        )}

        {/* Add button — fades in on hover, z-above the click overlay */}
        {!item.already_exists && item.can_add && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={isAdding}
            aria-label={`Add ${item.title}`}
            className="absolute top-2 right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 opacity-0 ring-1 ring-black/30 transition-opacity duration-200 group-hover:opacity-100 hover:bg-indigo-400 disabled:opacity-40"
          >
            {isAdding ? (
              <div className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
            ) : (
              <Plus size={9} strokeWidth={3} className="text-white" />
            )}
          </button>
        )}

        {/* Bottom info strip */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-2.5 pb-2.5 pt-6 translate-y-[5px] transition-transform duration-300 ease-out group-hover:translate-y-0">
          {/* Title — always shown */}
          <p className="text-[10.5px] font-semibold leading-tight text-white line-clamp-2">
            {item.title}
          </p>

          {/* Meta row — fades in on hover */}
          <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity duration-250 group-hover:opacity-100">
            {item.release_year && (
              <span className="text-[9px] tabular-nums text-white/45">
                {item.release_year}
              </span>
            )}
            {score !== null && (
              <>
                <span className="text-[8px] text-white/20">·</span>
                <span
                  className={`text-[9px] font-semibold tabular-nums ${scoreColor}`}
                >
                  {score}%
                </span>
              </>
            )}
            <span className="ml-auto text-[8px] font-medium uppercase tracking-widest text-white/25">
              {item.media_type === "movie" ? "Film" : "TV"}
            </span>
          </div>
        </div>
      </div>

      <ExploreCardDetailDialog
        item={item}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAdded={onAdded}
      />
    </>
  );
}
