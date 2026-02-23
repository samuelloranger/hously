import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExploreMedias, type TmdbMediaSearchItem, useAddUpcomingToArr } from '@hously/shared';
import { Plus, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function MediasExplore() {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch } = useExploreMedias();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-neutral-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-10 pb-10">
      <ExploreSection title={t('medias.explore.trending')} items={data.trending} onAdded={refetch} />
      <ExploreSection title={t('medias.explore.popularMovies')} items={data.popular_movies} onAdded={refetch} />
      <ExploreSection title={t('medias.explore.popularShows')} items={data.popular_shows} onAdded={refetch} />
      <ExploreSection title={t('medias.explore.upcomingMovies')} items={data.upcoming_movies} onAdded={refetch} />
    </div>
  );
}

function ExploreSection({ title, items, onAdded }: { title: string; items: TmdbMediaSearchItem[]; onAdded: () => void }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
      </div>

      <div className="relative group">
        <div 
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map(item => (
            <div key={item.id} className="flex-none w-40 sm:w-48 snap-start">
              <ExploreCard item={item} onAdded={onAdded} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExploreCard({ item, onAdded }: { item: TmdbMediaSearchItem; onAdded: () => void }) {
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
    } catch (error) {
      toast.error(t('medias.addFailed'));
    }
  };

  const isAdding = addUpcomingMutation.isPending;

  return (
    <div className="group relative space-y-2">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-1">
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

        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center gap-2">
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
          {item.media_type === 'movie' ? t('medias.filterMovies').slice(0, -1) : t('medias.filterSeries').slice(0, -1)}
        </div>
      </div>

      <div className="px-1">
        <h3 className="line-clamp-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {item.title}
        </h3>
      </div>
    </div>
  );
}
