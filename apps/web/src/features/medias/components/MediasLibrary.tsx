import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaAutoSearch, useMedias, type MediaItem } from '@hously/shared';
import { EmptyState } from '../../../components/EmptyState';
import { MediaPosterCard } from '../../../components/MediaPosterCard';
import { ArrowDownAZ, ArrowUpZA, ExternalLink, Search, Sparkles, Trash2, User } from 'lucide-react';

import { toast } from 'sonner';
import { InteractiveSearchDialog } from './InteractiveSearchDialog';
import { SimilarMediasDialog } from './SimilarMediasDialog';
import { DeleteMediaDialog } from './DeleteMediaDialog';

type MediaFilter = 'all' | 'movie' | 'series';
type SortKey = 'added_at' | 'title' | 'year' | 'service' | 'status' | 'downloaded' | 'monitored';
type SortDir = 'asc' | 'desc';

const getAddedTime = (item: MediaItem): number => {
  if (!item.added_at) return 0;
  const parsed = Date.parse(item.added_at);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function MediasLibrary() {
  const { t } = useTranslation('common');
  const { data, isLoading, refetch } = useMedias();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('added_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [interactiveItem, setInteractiveItem] = useState<MediaItem | null>(null);
  const [similarItem, setSimilarItem] = useState<MediaItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MediaItem | null>(null);

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

  const movieCount = items.filter(i => i.media_type === 'movie').length;
  const seriesCount = items.filter(i => i.media_type === 'series').length;
  const downloadedCount = items.filter(i => i.downloaded).length;

  if (isNotConfigured) {
    return (
      <EmptyState
        icon="🎞️"
        title={t('medias.notConfiguredTitle')}
        description={t('medias.notConfiguredDescription')}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('medias.searchPlaceholder')}
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
            />
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5">
            {(['all', 'movie', 'series'] as const).map(type => {
              const active = filter === type;
              const count = type === 'all' ? items.length : items.filter(i => i.media_type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {type === 'all' ? t('medias.filterAll') : type === 'movie' ? t('medias.filterMovies') : t('medias.filterSeries')}
                  <span className={`rounded-full px-1 text-[10px] font-semibold ${active ? 'text-white/70' : 'text-neutral-400 dark:text-neutral-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 ml-auto">
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
            <button
              type="button"
              onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
            >
              {sortDir === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!isLoading && items.length > 0 && (
          <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-4">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{movieCount}</span> {t('medias.filterMovies').toLowerCase()}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{seriesCount}</span> {t('medias.filterSeries').toLowerCase()}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{downloadedCount}</span> {t('medias.downloaded').toLowerCase()}
            </span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">{t('common.loading')}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex items-center justify-center">
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              {search || filter !== 'all' ? t('medias.noResults') : t('medias.empty')}
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {pagedItems.map(item => (
                <MediaGridCard
                  key={item.id}
                  item={item}
                  onOpenInteractive={() => setInteractiveItem(item)}
                  onFindSimilar={item.tmdb_id ? () => setSimilarItem(item) : undefined}
                  onDelete={() => setDeleteItem(item)}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
                {t('medias.pagination.showing', { start: showingStart, end: showingEnd, total: filtered.length })}
              </p>

              <div className="flex items-center gap-1.5">
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  {[24, 50, 100].map(size => (
                    <option key={size} value={size}>{size} / {t('medias.pagination.perPage')}</option>
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

      <SimilarMediasDialog
        isOpen={Boolean(similarItem)}
        tmdbId={similarItem?.tmdb_id ?? null}
        mediaType={similarItem ? (similarItem.media_type === 'movie' ? 'movie' : 'tv') : null}
        title={similarItem?.title ?? ''}
        onClose={() => setSimilarItem(null)}
        onAdded={refetch}
      />

      <DeleteMediaDialog
        isOpen={Boolean(deleteItem)}
        media={deleteItem}
        onClose={() => setDeleteItem(null)}
      />
    </div>
  );
}

function MediaGridCard({
  item,
  onOpenInteractive,
  onFindSimilar,
  onDelete,
}: {
  item: MediaItem;
  onOpenInteractive: () => void;
  onFindSimilar?: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('common');
  const autoSearchMutation = useMediaAutoSearch();

  const runAutoSearch = async () => {
    if (autoSearchMutation.isPending) return;
    try {
      await autoSearchMutation.mutateAsync({ service: item.service, source_id: item.source_id });
      toast.success(t('medias.autoSearch.success', { service: item.service === 'radarr' ? 'Radarr' : 'Sonarr' }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('medias.autoSearch.failed'));
    }
  };

  const status = item.downloaded ? 'downloaded' : item.downloading ? 'downloading' : 'missing';
  const statusLabel = item.downloaded
    ? t('medias.downloaded')
    : item.downloading
      ? t('medias.downloading')
      : t('medias.missing');

  return (
    <MediaPosterCard
      posterUrl={item.poster_url}
      title={item.title}
      fallbackEmoji="🎬"
      status={status}
      statusLabel={statusLabel}
      accentRingClassName="focus:ring-indigo-400/70"
      className="w-full"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9.5px] text-white/55 tabular-nums">{item.year ?? '—'}</span>
        {item.media_type === 'series' && item.season_count !== null && (
          <span className="text-[9.5px] text-white/45">
            {t('medias.seriesMeta', { seasons: item.season_count, episodes: item.episode_count ?? 0 })}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void runAutoSearch()}
          disabled={autoSearchMutation.isPending}
          title={autoSearchMutation.isPending ? t('medias.autoSearch.running') : t('medias.autoSearch.button')}
          className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-white/70 transition-colors duration-200 hover:bg-white/20 hover:text-white disabled:opacity-40"
        >
          <Search size={10} className={autoSearchMutation.isPending ? 'animate-spin' : ''} />
        </button>

        {item.arr_url && (
          <a
            href={item.arr_url}
            target="_blank"
            rel="noreferrer"
            title={t('medias.viewInArr')}
            className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-white/70 transition-colors duration-200 hover:bg-white/20 hover:text-white"
          >
            <ExternalLink size={10} />
          </a>
        )}

        <button
          type="button"
          onClick={onOpenInteractive}
          title={t('medias.interactive.button')}
          className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-white/70 transition-colors duration-200 hover:bg-white/20 hover:text-white"
        >
          <User size={10} />
        </button>

        {onFindSimilar && (
          <button
            type="button"
            onClick={onFindSimilar}
            title={t('medias.similar.button')}
            className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-white/70 transition-colors duration-200 hover:bg-white/20 hover:text-white"
          >
            <Sparkles size={10} />
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          title={t('medias.delete.button')}
          className="inline-flex items-center justify-center h-5.5 w-5.5 rounded-full bg-white/10 text-red-400/70 transition-colors duration-200 hover:bg-red-500/20 hover:text-red-300 ml-auto"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </MediaPosterCard>
  );
}
