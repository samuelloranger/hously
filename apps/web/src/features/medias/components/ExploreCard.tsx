import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddUpcomingToArr, type TmdbMediaSearchItem } from '@hously/shared';
import { Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ExploreCardDetailDialog } from './ExploreCardDetailDialog';
import { MediaPosterCard } from '@/components/MediaPosterCard';

export function ExploreCard({ item, onAdded }: { item: TmdbMediaSearchItem; onAdded: () => void }) {
  const { t } = useTranslation('common');
  const [detailOpen, setDetailOpen] = useState(false);
  const addUpcomingMutation = useAddUpcomingToArr();

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (addUpcomingMutation.isPending || item.already_exists || !item.can_add) return;

    try {
      await addUpcomingMutation.mutateAsync({
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        search_on_add: false,
      });
      toast.success(t('medias.addSuccess', { title: item.title }));
      onAdded();
    } catch {
      toast.error(t('medias.addFailed'));
    }
  };

  const isAdding = addUpcomingMutation.isPending;
  const typeLabel = item.media_type === 'movie' ? t('medias.movie') : t('medias.series');

  return (
    <>
      <MediaPosterCard
        posterUrl={item.poster_url}
        title={item.title}
        onClick={() => setDetailOpen(true)}
        className="w-full"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.08] px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-white/80">
            {typeLabel}
          </span>
          {item.release_year && <span className="text-[9px] text-white/60">{item.release_year}</span>}
        </div>

        {(item.already_exists || item.can_add || item.arr_url) && (
          <div className="mt-1.5 flex items-center gap-1.5">
            {item.already_exists ? (
              <span className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-emerald-500/80 text-white">
                <Check size={10} />
              </span>
            ) : item.can_add ? (
              <button
                type="button"
                onClick={handleAdd}
                disabled={isAdding}
                className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-indigo-500/80 text-white transition-colors duration-200 hover:bg-indigo-400/90 disabled:opacity-40"
              >
                {isAdding ? (
                  <div className="h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-white border-t-transparent" />
                ) : (
                  <Plus size={10} />
                )}
              </button>
            ) : null}

            {item.arr_url && (
              <a
                href={item.arr_url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-white/70 transition-colors duration-200 hover:bg-white/20 hover:text-white"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}
      </MediaPosterCard>

      <ExploreCardDetailDialog item={item} isOpen={detailOpen} onClose={() => setDetailOpen(false)} onAdded={onAdded} />
    </>
  );
}
