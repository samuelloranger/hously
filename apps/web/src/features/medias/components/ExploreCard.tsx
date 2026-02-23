import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddUpcomingToArr, type TmdbMediaSearchItem } from '@hously/shared';
import { Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function ExploreCard({ item, onAdded }: { item: TmdbMediaSearchItem; onAdded: () => void }) {
  const { t } = useTranslation('common');
  const [imageError, setImageError] = useState(false);
  const addUpcomingMutation = useAddUpcomingToArr();

  const handleAdd = async () => {
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

  return (
    <div className="group/card relative space-y-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 shadow-sm transition-all duration-300 group-hover/card:shadow-md group-hover/card:-translate-y-1">
        {item.poster_url && !imageError ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="h-full w-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🎬</div>
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 flex items-center justify-center gap-2">
          {item.already_exists ? (
            <div className="rounded-full bg-emerald-500 p-2 text-white shadow-lg">
              <Check size={20} />
            </div>
          ) : item.can_add ? (
            <button
              onClick={handleAdd}
              disabled={isAdding}
              className="rounded-full bg-indigo-600 p-2 text-white shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            >
              {isAdding ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus size={20} />
              )}
            </button>
          ) : null}

          {item.arr_url && (
            <a
              href={item.arr_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/20 p-2 text-white backdrop-blur-md shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <ExternalLink size={20} />
            </a>
          )}
        </div>

        {item.release_year && (
          <div className="absolute top-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            {item.release_year}
          </div>
        )}

        <div className="absolute top-2 left-2 rounded-md bg-indigo-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm uppercase">
          {item.media_type === 'movie' ? t('medias.movie') : t('medias.series')}
        </div>
      </div>

      <div className="px-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover/card:text-indigo-600 dark:group-hover/card:text-indigo-400 transition-colors">
          {item.title}
        </h3>
      </div>
    </div>
  );
}
