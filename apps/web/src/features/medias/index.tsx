import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaAutoSearch, useMedias, type MediaItem } from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { ArrowDownAZ, ArrowUpZA, ExternalLink, Search, User } from 'lucide-react';
import { TmdbMediaSearchPanel } from './components/TmdbMediaSearchPanel';
import { toast } from 'sonner';
import { InteractiveSearchDialog } from './components/InteractiveSearchDialog';

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [interactiveItem, setInteractiveItem] = useState<MediaItem | null>(null);

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

  useEffect(() => {
    setPage(1);
  }, [search, filter, sortBy, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageStartIndex = (page - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const pagedItems = filtered.slice(pageStartIndex, pageEndIndex);
  const showingStart = filtered.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = filtered.length === 0 ? 0 : Math.min(pageEndIndex, filtered.length);

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
            {/* Filter toolbar */}
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
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

                <button
                  type="button"
                  onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
                >
                  {sortDir === 'asc' ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
                </button>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {(['all', 'movie', 'series'] as const).map(type => {
                  const active = filter === type;
                  const count = type === 'all' ? items.length : items.filter(item => item.media_type === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilter(type)}
                      className={`appearance-none shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {type === 'all'
                        ? t('medias.filterAll')
                        : type === 'movie'
                          ? t('medias.filterMovies')
                          : t('medias.filterSeries')}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active
                            ? 'bg-white/20 text-white'
                            : 'bg-neutral-200/70 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}

                <div className="ml-auto shrink-0">
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortKey)}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="added_at">{t('medias.sortOptions.addedAt')}</option>
                    <option value="title">{t('medias.sortOptions.title')}</option>
                    <option value="year">{t('medias.sortOptions.year')}</option>
                    <option value="service">{t('medias.sortOptions.service')}</option>
                    <option value="status">{t('medias.sortOptions.status')}</option>
                    <option value="downloaded">{t('medias.sortOptions.downloaded')}</option>
                    <option value="monitored">{t('medias.sortOptions.monitored')}</option>
                  </select>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">{t('common.loading')}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-5 py-10 flex items-center justify-center">
                <p className="text-sm text-neutral-400 dark:text-neutral-500">
                  {search || filter !== 'all' ? t('medias.noResults') : t('medias.empty')}
                </p>
              </div>
            ) : (
              <div className="p-4 sm:p-5">
                <MediaGrid
                  items={pagedItems}
                  onOpenInteractive={item => {
                    setInteractiveItem(item);
                  }}
                />

                {/* Pagination */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                  <p className="text-xs text-neutral-400 dark:text-neutral-500">
                    {t('medias.pagination.showing', {
                      start: showingStart,
                      end: showingEnd,
                      total: filtered.length,
                    })}
                  </p>

                  <div className="flex items-center gap-1.5">
                    <select
                      id="medias-page-size"
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                      }}
                      className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      {[24, 50, 100].map(size => (
                        <option key={size} value={size}>
                          {size} / {t('medias.pagination.perPage')}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('medias.pagination.previous')}
                      </button>

                      <span className="px-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {page} / {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {t('medias.pagination.next')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <InteractiveSearchDialog
            isOpen={Boolean(interactiveItem)}
            media={interactiveItem}
            onClose={() => setInteractiveItem(null)}
          />
        </div>
      )}
    </PageLayout>
  );
}

function MediaGrid({ items, onOpenInteractive }: { items: MediaItem[]; onOpenInteractive: (item: MediaItem) => void }) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map(item => (
        <MediaGridCard
          key={item.id}
          item={item}
          onOpenInteractive={() => {
            onOpenInteractive(item);
          }}
        />
      ))}
    </div>
  );
}

function MediaGridCard({ item, onOpenInteractive }: { item: MediaItem; onOpenInteractive: () => void }) {
  const { t } = useTranslation('common');
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(item.poster_url) && !imageError;
  const autoSearchMutation = useMediaAutoSearch();

  const runAutoSearch = async () => {
    if (autoSearchMutation.isPending) return;
    try {
      await autoSearchMutation.mutateAsync({
        service: item.service,
        source_id: item.source_id,
      });
      toast.success(t('medias.autoSearch.success', { service: item.service === 'radarr' ? 'Radarr' : 'Sonarr' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('medias.autoSearch.failed');
      toast.error(message);
    }
  };

  const statusConfig = item.downloaded
    ? { label: t('medias.downloaded'), cls: 'bg-emerald-500/90' }
    : item.downloading
      ? { label: t('medias.downloading'), cls: 'bg-sky-500/90' }
      : { label: t('medias.missing'), cls: 'bg-amber-500/90' };

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-800 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20">
      <div className="relative aspect-[2/3] overflow-hidden">
        {showImage ? (
          <img
            src={item.poster_url || ''}
            alt={item.title}
            loading="lazy"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-4xl bg-neutral-200 dark:bg-neutral-800">
            🎬
          </div>
        )}

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
          <span className="inline-flex items-center rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
            {item.service === 'radarr' ? 'Radarr' : 'Sonarr'}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${statusConfig.cls} backdrop-blur-sm`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Action buttons — visible, slightly more subtle on non-hover */}
        <div className="absolute right-2 top-10 z-10 flex flex-col gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={() => {
              void runAutoSearch();
            }}
            disabled={autoSearchMutation.isPending}
            title={autoSearchMutation.isPending ? t('medias.autoSearch.running') : t('medias.autoSearch.button')}
            aria-label={autoSearchMutation.isPending ? t('medias.autoSearch.running') : t('medias.autoSearch.button')}
            style={{ touchAction: 'manipulation' }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90 disabled:opacity-50"
          >
            <Search size={12} className={autoSearchMutation.isPending ? 'animate-spin' : ''} />
          </button>

          {item.arr_url ? (
            <a
              href={item.arr_url}
              target="_blank"
              rel="noreferrer"
              title={t('medias.viewInArr')}
              aria-label={t('medias.viewInArr')}
              className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
            >
              <ExternalLink size={12} />
            </a>
          ) : null}

          <button
            type="button"
            onClick={onOpenInteractive}
            title={t('medias.interactive.button')}
            aria-label={t('medias.interactive.button')}
            style={{ touchAction: 'manipulation' }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm transition-colors hover:bg-black/90"
          >
            <User size={12} />
          </button>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug drop-shadow-sm">{item.title}</h3>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/70">{item.year ? String(item.year) : '—'}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                item.monitored ? 'bg-emerald-500/25 text-emerald-200' : 'bg-white/10 text-white/50'
              }`}
            >
              {item.monitored ? t('medias.monitored') : t('medias.unmonitored')}
            </span>
          </div>
        </div>
      </div>

      {/* Card footer */}
      {item.media_type === 'series' && item.episode_count !== null && (
        <div className="px-3 py-2 bg-white dark:bg-neutral-900 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
            {t('medias.seriesMeta', {
              episodes: item.episode_count,
              seasons: item.season_count ?? 0,
            })}
          </p>
        </div>
      )}
    </article>
  );
}
