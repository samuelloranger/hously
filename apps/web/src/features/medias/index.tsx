import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedias, type MediaItem } from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ArrowDownAZ, ArrowUpZA, Search } from 'lucide-react';
import { TmdbMediaSearchPanel } from './components/TmdbMediaSearchPanel';

type MediaFilter = 'all' | 'movie' | 'series';
type SortKey = 'added_at' | 'title' | 'year' | 'service' | 'status' | 'downloaded' | 'monitored';
type SortDir = 'asc' | 'desc';

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
  const [sortBy, setSortBy] = useState<SortKey>('added_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
        let cmp = 0;
        if (sortBy === 'added_at') cmp = getAddedTime(a) - getAddedTime(b);
        else if (sortBy === 'title') cmp = a.title.localeCompare(b.title);
        else if (sortBy === 'year') cmp = (a.year ?? 0) - (b.year ?? 0);
        else if (sortBy === 'service') cmp = a.service.localeCompare(b.service);
        else if (sortBy === 'status') cmp = (a.status ?? '').localeCompare(b.status ?? '');
        else if (sortBy === 'downloaded') cmp = Number(a.downloaded) - Number(b.downloaded);
        else if (sortBy === 'monitored') cmp = Number(a.monitored) - Number(b.monitored);

        if (cmp === 0) return a.title.localeCompare(b.title);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [items, filter, search, sortBy, sortDir]);

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
        <EmptyState
          icon="🎞️"
          title={t('medias.notConfiguredTitle')}
          description={t('medias.notConfiguredDescription')}
        />
      ) : (
        <div className="space-y-4">
          <TmdbMediaSearchPanel onAdded={refetch} />

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
                      {type === 'all'
                        ? t('medias.filterAll')
                        : type === 'movie'
                          ? t('medias.filterMovies')
                          : t('medias.filterSeries')}
                      <span className={active ? 'text-indigo-100' : 'text-neutral-400 dark:text-neutral-500'}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-neutral-500 dark:text-neutral-400">{t('medias.sortLabel')}</label>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortKey)}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
                >
                  <option value="added_at">{t('medias.sortOptions.addedAt')}</option>
                  <option value="title">{t('medias.sortOptions.title')}</option>
                  <option value="year">{t('medias.sortOptions.year')}</option>
                  <option value="service">{t('medias.sortOptions.service')}</option>
                  <option value="status">{t('medias.sortOptions.status')}</option>
                  <option value="downloaded">{t('medias.sortOptions.downloaded')}</option>
                  <option value="monitored">{t('medias.sortOptions.monitored')}</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
                >
                  {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
                  <span>{sortDir === 'asc' ? t('medias.asc') : t('medias.desc')}</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                {search || filter !== 'all' ? t('medias.noResults') : t('medias.empty')}
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filtered.map(item => (
                    <MediaGridCard key={item.id} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function MediaGridCard({ item }: { item: MediaItem }) {
  const { t } = useTranslation('common');
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(item.poster_url) && !imageError;

  return (
    <article className="group overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-700/70 bg-white dark:bg-neutral-900 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative aspect-[2/3] bg-neutral-100 dark:bg-neutral-800">
        {showImage ? (
          <img
            src={item.poster_url || ''}
            alt={item.title}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-4xl">🎬</div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

        <div className="absolute left-2 top-2 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {item.service === 'radarr' ? 'Radarr' : 'Sonarr'}
        </div>

        <div className="absolute right-2 top-2 inline-flex items-center rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {item.media_type === 'movie' ? t('medias.filterMovies') : t('medias.filterSeries')}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 drop-shadow-sm">{item.title}</h3>
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-white/85">
            <span>{item.year ? String(item.year) : t('medias.unknownYear')}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                item.downloaded ? 'bg-emerald-500/85 text-white' : 'bg-amber-500/85 text-white'
              }`}
            >
              {item.downloaded ? t('medias.downloaded') : t('medias.missing')}
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              item.monitored
                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            {item.monitored ? t('medias.monitored') : t('medias.unmonitored')}
          </span>
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {item.media_type === 'series' && item.episode_count !== null
            ? t('medias.seriesMeta', {
                episodes: item.episode_count,
                seasons: item.season_count ?? 0,
              })
            : item.status || t('medias.unknownStatus')}
        </p>
      </div>
    </article>
  );
}
