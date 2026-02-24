import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddUpcomingToArr, type TmdbMediaSearchItem } from '@hously/shared';
import { Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ExploreCardDetailDialog } from './ExploreCardDetailDialog';
import { MediaPosterCard } from '../../../components/MediaPosterCard';

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

  const actions = (
    <>
      {item.already_exists ? (
        <div className="rounded-full bg-emerald-500 p-2 text-white shadow-lg">
          <Check size={20} />
        </div>
      ) : item.can_add ? (
        <div
          role="button"
          tabIndex={0}
          onClick={handleAdd}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAdd(e as unknown as React.MouseEvent);
          }}
          className={`rounded-full bg-indigo-600 p-2 text-white shadow-lg transition-transform hover:scale-110 active:scale-95 ${isAdding ? 'opacity-50' : ''}`}
        >
          {isAdding ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Plus size={20} />
          )}
        </div>
      ) : null}

      {item.arr_url && (
        <a
          href={item.arr_url}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md shadow-lg transition-transform hover:scale-110 active:scale-95"
        >
          <ExternalLink size={20} />
        </a>
      )}
    </>
  );

  return (
    <>
      <MediaPosterCard
        posterUrl={item.poster_url}
        title={item.title}
        onClick={() => setDetailOpen(true)}
        actionsLayout="center-overlay"
        actionsSlot={actions}
        accentRingClassName="focus:ring-indigo-400/70"
        className="w-full"
      >
        <p className="text-[12px] font-semibold text-white truncate">{item.title}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/90">
            {typeLabel}
          </span>
          {item.release_year && <span className="text-[9px] text-white/80">{item.release_year}</span>}
        </div>
      </MediaPosterCard>

      <ExploreCardDetailDialog
        item={item}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAdded={onAdded}
      />
    </>
  );
}
