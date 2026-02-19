import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import {
  useAddUpcomingToArr,
  useMediaAutoSearch,
  useTmdbMediaSearch,
  type TmdbMediaSearchItem,
} from '@hously/shared';

interface TmdbMediaSearchPanelProps {
  onAdded?: () => void;
}

export function TmdbMediaSearchPanel({ onAdded }: TmdbMediaSearchPanelProps) {
  const { t } = useTranslation('common');
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const trimmedInput = input.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(trimmedInput);
    }, 350);
    return () => clearTimeout(timeout);
  }, [trimmedInput]);

  const searchEnabled = debounced.length >= 2;
  const searchQuery = useTmdbMediaSearch(debounced, { enabled: searchEnabled });
  const addMutation = useAddUpcomingToArr();
  const autoSearchMutation = useMediaAutoSearch();

  const results = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data?.items]);

  const addItem = async (item: TmdbMediaSearchItem) => {
    if (item.already_exists || !item.can_add || addMutation.isPending) return;

    try {
      const result = await addMutation.mutateAsync({
        media_type: item.media_type,
        tmdb_id: item.tmdb_id,
        search_on_add: true,
      });

      if (result.already_exists) {
        toast.info(t('medias.tmdb.alreadyExists', { service: result.service === 'radarr' ? 'Radarr' : 'Sonarr' }));
        return;
      }

      toast.success(t('medias.tmdb.added', { service: result.service === 'radarr' ? 'Radarr' : 'Sonarr' }));
      setInput('');
      setDebounced('');
      onAdded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.tmdb.addFailed');
      toast.error(message);
    }
  };

  const triggerAutoSearch = async (item: TmdbMediaSearchItem) => {
    if (!item.already_exists || !item.can_add || autoSearchMutation.isPending) return;

    try {
      await autoSearchMutation.mutateAsync({
        service: item.service,
        source_id: item.source_id ?? 0,
      });
      toast.success(
        t('medias.autoSearch.success', { service: item.service === 'radarr' ? 'Radarr' : 'Sonarr' })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.autoSearch.failed');
      toast.error(message);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800">
        <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('medias.tmdb.title')}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{t('medias.tmdb.subtitle')}</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('medias.tmdb.placeholder')}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 dark:focus:border-indigo-500 transition"
          />
        </div>

        {searchEnabled ? (
          searchQuery.isLoading ? (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.tmdb.searching')}</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-neutral-500 dark:text-neutral-400">{t('medias.tmdb.noResults')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {results.map(item => {
                const addDisabled = item.already_exists || !item.can_add || addMutation.isPending;
                const canView = item.already_exists && Boolean(item.arr_url);
                const canAutoSearch = item.already_exists && item.can_add && typeof item.source_id === 'number';
                return (
                  <div
                    key={item.id}
                    className="text-left rounded-xl border p-2.5 flex gap-2.5 transition-colors border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  >
                    <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden bg-neutral-200 dark:bg-neutral-700">
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white line-clamp-2">{item.title}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {item.release_year ?? t('medias.unknownYear')}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          {item.service === 'radarr' ? 'Radarr' : 'Sonarr'}
                        </span>
                        {item.already_exists ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                            {t('medias.tmdb.inLibrary')}
                          </span>
                        ) : !item.can_add ? (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            {t('medias.tmdb.notConfigured')}
                          </span>
                        ) : (
                          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                            {addMutation.isPending ? t('medias.tmdb.adding') : t('medias.tmdb.add')}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {!item.already_exists ? (
                          <button
                            type="button"
                            onClick={() => {
                              void addItem(item);
                            }}
                            disabled={addDisabled}
                            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
                          >
                            {addMutation.isPending ? t('medias.tmdb.adding') : t('medias.tmdb.add')}
                          </button>
                        ) : null}

                        {canAutoSearch ? (
                          <button
                            type="button"
                            onClick={() => {
                              void triggerAutoSearch(item);
                            }}
                            disabled={autoSearchMutation.isPending}
                            className="rounded-md border border-neutral-300 dark:border-neutral-600 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-60"
                          >
                            {autoSearchMutation.isPending
                              ? t('medias.autoSearch.running')
                              : t('medias.autoSearch.button')}
                          </button>
                        ) : null}

                        {canView ? (
                          <a
                            href={item.arr_url || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md border border-neutral-300 dark:border-neutral-600 px-2.5 py-1 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            {t('medias.viewInArr')}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{t('medias.tmdb.hint')}</div>
        )}
      </div>
    </section>
  );
}
