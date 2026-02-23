import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAddUpcomingToArr, type TmdbMediaSearchItem } from '@hously/shared';
import { Check, ExternalLink, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/dialog';

interface ExploreCardDetailDialogProps {
  item: TmdbMediaSearchItem;
  isOpen: boolean;
  onClose: () => void;
  onAdded: () => void;
}

export function ExploreCardDetailDialog({ item, isOpen, onClose, onAdded }: ExploreCardDetailDialogProps) {
  const { t } = useTranslation('common');
  const [searchOnAdd, setSearchOnAdd] = useState(true);
  const [imageError, setImageError] = useState(false);
  const addMutation = useAddUpcomingToArr();

  const handleAdd = async () => {
    if (addMutation.isPending || item.already_exists || !item.can_add) return;

    try {
      await addMutation.mutateAsync({
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        search_on_add: searchOnAdd,
      });
      toast.success(t('medias.addSuccess', { title: item.title }));
      onAdded();
    } catch {
      toast.error(t('medias.addFailed'));
    }
  };

  const tmdbUrl = `https://www.themoviedb.org/${item.media_type}/${item.tmdb_id}`;
  const serviceName = item.media_type === 'movie' ? 'Radarr' : 'Sonarr';

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={item.title}>
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Poster */}
        <div className="shrink-0 mx-auto sm:mx-0">
          {item.poster_url && !imageError ? (
            <img
              src={item.poster_url}
              alt={item.title}
              className="w-40 rounded-xl object-cover shadow-md"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-60 w-40 items-center justify-center rounded-xl bg-neutral-200 dark:bg-neutral-700 text-4xl">
              🎬
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-3 min-w-0">
          {/* Year + type badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-indigo-600/80 px-2 py-0.5 text-xs font-bold text-white uppercase">
              {item.media_type === 'movie' ? t('medias.movie') : t('medias.series')}
            </span>
            {item.release_year && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{item.release_year}</span>
            )}
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-2">
            <a
              href={tmdbUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600/10 px-3 py-1.5 text-sm font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-600/20 transition-colors"
            >
              <ExternalLink size={14} />
              {t('medias.detail.viewOnTmdb')}
            </a>
            {item.arr_url && (
              <a
                href={item.arr_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600/10 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-600/20 transition-colors"
              >
                <ExternalLink size={14} />
                {t('medias.detail.viewInArr', { service: serviceName })}
              </a>
            )}
          </div>

          {/* Action area */}
          <div className="mt-auto pt-2 border-t border-neutral-200 dark:border-neutral-700">
            {item.already_exists ? (
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <Check size={16} />
                {t('medias.detail.inLibrary')}
              </div>
            ) : item.can_add ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={searchOnAdd}
                    onChange={(e) => setSearchOnAdd(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-neutral-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  {t('medias.detail.searchOnAdd')}
                </label>
                <button
                  onClick={handleAdd}
                  disabled={addMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 transition-colors"
                >
                  {addMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {t('medias.detail.addToLibrary')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
