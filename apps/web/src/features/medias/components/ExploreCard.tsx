import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddUpcomingToArr, type TmdbMediaSearchItem } from '@hously/shared';
import { Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ExploreCardDetailDialog } from './ExploreCardDetailDialog';

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
        search_on_add: true,
      });
      toast.success(t('medias.addSuccess', { title: item.title }));
      onAdded();
    } catch {
      toast.error(t('medias.addFailed'));
    }
  };

  const isAdding = addUpcomingMutation.isPending;
  const typeLabel = item.media_type === 'movie' ? t('medias.movie') : t('medias.series');

  const backgroundStyle = item.poster_url
    ? { backgroundImage: `url(${item.poster_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="group relative aspect-[2/3] w-full text-left overflow-hidden rounded-2xl border border-white/15 bg-neutral-950/30 p-1 shadow-sm shadow-black/30 transition-all hover:-translate-y-0.5 hover:border-white/25 hover:shadow-black/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/70 cursor-pointer"
        style={backgroundStyle}
        aria-label={item.title}
      >
        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5 opacity-90 transition-opacity duration-300 group-hover:opacity-75" />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

        {/* Fallback emoji when no poster */}
        {!item.poster_url && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl text-white/80">
            🎬
          </div>
        )}

        {/* Accessible hidden image */}
        {item.poster_url && (
          <img src={item.poster_url} alt={item.title} className="sr-only" loading="lazy" />
        )}

        {/* Hover action buttons */}
        <div className="absolute inset-0 z-20 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center gap-2">
          {item.already_exists ? (
            <div className="rounded-full bg-emerald-500 p-2 text-white shadow-lg">
              <Check size={20} />
            </div>
          ) : item.can_add ? (
            <div
              role="button"
              tabIndex={0}
              onClick={handleAdd}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(e as unknown as React.MouseEvent); }}
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
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <ExternalLink size={20} />
            </a>
          )}
        </div>

        {/* Glass panel — matches MovieCard */}
        <div className="relative z-10 flex h-full flex-col justify-end">
          <div className="min-w-0 rounded-xl bg-black/35 p-2 backdrop-blur-md ring-1 ring-inset ring-white/10">
            <p className="text-[12px] font-semibold text-white truncate">{item.title}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/90">
                {typeLabel}
              </span>
              {item.release_year && (
                <span className="text-[9px] text-white/80">{item.release_year}</span>
              )}
            </div>
          </div>
        </div>
      </button>

      <ExploreCardDetailDialog
        item={item}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAdded={onAdded}
      />
    </>
  );
}
