import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedias, type MediaItem } from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { Search } from 'lucide-react';

type MediaFilter = 'all' | 'movie' | 'series';

const getAddedTime = (item: MediaItem): number => {
  if (!item.added_at) return 0;
  const parsed = Date.parse(item.added_at);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function MediasPage() {
  const { t } = useTranslation('common');
  const { data, isLoading, isFetching, refetch } = useMedias();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');

  const items = data?.items ?? [];
  const isNotConfigured = data && !data.radarr_enabled && !data.sonarr_enabled;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items
      .filter(item => (filter === 'all' ? true : item.media_type === filter))
      .filter(item => {
        if (!needle) return true;
        return item.title.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const byDate = getAddedTime(b) - getAddedTime(a);
        if (byDate !== 0) return byDate;
        return a.title.localeCompare(b.title);
      });
  }, [items, filter, search]);

  return (
    <PageLayout>
      <PageHeader
        icon="🎞️"
        iconColor="text-indigo-600"
        title={t('medias.title')}
        subtitle={t('medias.subtitle')}
        onRefresh={refetch}
        isRefreshing={isFetching}
      />

      {isNotConfigured ? (
        <EmptyState icon="🎞️" title={t('medias.notConfiguredTitle')} description={t('medias.notConfiguredDescription')} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('medias.searchPlaceholder')}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 dark:focus:border-indigo-500 transition"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {(['all', 'movie', 'series'] as const).map(type => {
                  const active = filter === type;
                  const count = type === 'all' ? items.length : items.filter(item => item.media_type === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {type === 'all' ? t('medias.filterAll') : type === 'movie' ? t('medias.filterMovies') : t('medias.filterSeries')}
                      <span className={active ? 'text-indigo-100' : 'text-neutral-400 dark:text-neutral-500'}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {search || filter !== 'all' ? t('medias.noResults') : t('medias.empty')}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {filtered.map(item => (
                  <div key={item.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white">{item.title}</p>
                      {item.year ? <span className="text-xs text-neutral-500 dark:text-neutral-400">({item.year})</span> : null}
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                        {item.media_type === 'movie' ? t('medias.filterMovies') : t('medias.filterSeries')}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                        {item.service === 'radarr' ? 'Radarr' : 'Sonarr'}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.monitored
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {item.monitored ? t('medias.monitored') : t('medias.unmonitored')}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.downloaded
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {item.downloaded ? t('medias.downloaded') : t('medias.missing')}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {item.media_type === 'series' && item.episode_count !== null
                        ? t('medias.seriesMeta', {
                            episodes: item.episode_count,
                            seasons: item.season_count ?? 0,
                          })
                        : item.status || t('medias.unknownStatus')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}
