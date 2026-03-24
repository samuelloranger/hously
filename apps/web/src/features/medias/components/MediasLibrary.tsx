import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearch } from '@tanstack/react-router';
import {
  useMedias,
  useActiveMediaConversions,
  filterAndSortMediaItems,
  type MediaItem,
  type MediaFilter,
  type MediaSortKey as SortKey,
  type MediaSortDir as SortDir,
} from '@hously/shared';
import { EmptyState } from '@/components/EmptyState';
import { MediaPosterCard } from '@/components/MediaPosterCard';
import {
  ArrowDownAZ,
  ArrowUpZA,
  Search,
  Zap,
  X,
  LayoutGrid,
  Grid3X3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import { MediaInfoDialog } from './c411/MediaInfoDialog';
import { ConversionStatusBar } from './ConversionStatusBar';
import type { LibrarySearchParams } from '@/router';
import type { TabKey } from './c411/MediaInfoDialog';
import { usePersistentState } from '@/hooks/usePersistentState';

function mediaKey(item: MediaItem) {
  return `${item.service}:${item.source_id}`;
}

type MediaScopeFilter = 'all' | 'radarr' | 'sonarr' | 'downloaded' | 'missing' | 'converting';
type MediaDensity = 'comfortable' | 'compact';

export function MediasLibrary() {
  const { t } = useTranslation('common');
  const { data: libraryData, isLoading, refetch } = useMedias();
  const { data: activeConversionsData } = useActiveMediaConversions({ enabled: true });

  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('added_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scopeFilter, setScopeFilter] = useState<MediaScopeFilter>('all');
  const [density, setDensity] = usePersistentState<MediaDensity>('media-library-density', 'comfortable');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useSearch({ from: '/library' }) as LibrarySearchParams;
  const { setParams, resetParams } = useModalSearchParams('/library', searchParams);

  const search = searchParams.search ?? '';
  const page = searchParams.page ?? 1;
  const pageSize = searchParams.pageSize ?? 50;

  const items = useMemo(() => {
    const baseItems = libraryData?.items ?? [];
    const activeJobs = activeConversionsData?.jobs ?? [];

    if (activeJobs.length === 0) return baseItems;

    return baseItems.map(item => {
      const job = activeJobs.find(j => j.service === item.service && j.source_id === item.source_id);
      if (job) {
        return { ...item, latest_conversion: job };
      }
      return item;
    });
  }, [libraryData?.items, activeConversionsData?.jobs]);

  const c411Enabled = libraryData?.c411_enabled ?? false;
  const c411TmdbIds = useMemo(() => new Set(libraryData?.c411_tmdb_ids ?? []), [libraryData?.c411_tmdb_ids]);

  const currentMediaItem = useMemo(
    () => items.find(i => mediaKey(i) === searchParams.current_media_id) ?? null,
    [items, searchParams.current_media_id]
  );

  const isNotConfigured = libraryData && !libraryData.radarr_enabled && !libraryData.sonarr_enabled;

  const filtered = useMemo(() => {
    const scopedItems = items.filter(item => {
      if (scopeFilter === 'all') return true;
      if (scopeFilter === 'radarr' || scopeFilter === 'sonarr') return item.service === scopeFilter;
      if (scopeFilter === 'downloaded') return item.downloaded;
      if (scopeFilter === 'missing') return !item.downloaded && !item.downloading;
      if (scopeFilter === 'converting') {
        return Boolean(item.latest_conversion && ['queued', 'running'].includes(item.latest_conversion.status));
      }
      return true;
    });

    return filterAndSortMediaItems(scopedItems, {
      filter,
      search,
      sortBy,
      sortDir,
    });
  }, [items, filter, scopeFilter, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setParams({ page: totalPages > 1 ? totalPages : undefined });
    }
  }, [page, totalPages, setParams]);

  const pageStartIndex = (page - 1) * pageSize;
  const pageEndIndex = pageStartIndex + pageSize;
  const pagedItems = filtered.slice(pageStartIndex, pageEndIndex);
  const showingStart = filtered.length === 0 ? 0 : pageStartIndex + 1;
  const showingEnd = filtered.length === 0 ? 0 : Math.min(pageEndIndex, filtered.length);

  const movieCount = items.filter(i => i.media_type === 'movie').length;
  const seriesCount = items.filter(i => i.media_type === 'series').length;
  const downloadedCount = items.filter(i => i.downloaded).length;
  const convertingCount = items.filter(i => i.latest_conversion && ['queued', 'running'].includes(i.latest_conversion.status)).length;
  const missingCount = items.filter(i => !i.downloaded && !i.downloading).length;
  const hasActiveFilters = Boolean(search || filter !== 'all' || scopeFilter !== 'all');

  const openMedia = (item: MediaItem, tab?: TabKey) => {
    setParams({
      current_media_id: mediaKey(item),
      current_media_tab: tab ?? (item.downloaded ? 'info' : 'search'),
    });
  };

  // Handle scrolling to media from search params
  useEffect(() => {
    if (searchParams.scrollToMedia && !isLoading && items.length > 0) {
      const element = document.getElementById(`media-${searchParams.scrollToMedia}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-4', 'ring-indigo-500/50', 'ring-offset-4', 'dark:ring-offset-neutral-900');

        const timeout = setTimeout(() => {
          element.classList.remove('ring-4', 'ring-indigo-500/50', 'ring-offset-4', 'dark:ring-offset-neutral-900');
          // Clear the param after scrolling
          setParams({ scrollToMedia: undefined });
        }, 3000);

        return () => clearTimeout(timeout);
      }
    }
    return undefined;
  }, [searchParams.scrollToMedia, isLoading, items.length, setParams]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;

      if (!isTypingField && event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current && search) {
        setParams({ search: undefined, page: undefined });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [search, setParams]);

  if (isNotConfigured) {
    return (
      <EmptyState icon="🎞️" title={t('medias.notConfiguredTitle')} description={t('medias.notConfiguredDescription')} />
    );
  }

  const typeFilters = [
    { value: 'all' as const, label: t('medias.filterAll'), count: items.length },
    { value: 'movie' as const, label: t('medias.filterMovies'), count: movieCount },
    { value: 'series' as const, label: t('medias.filterSeries'), count: seriesCount },
  ];

  const scopeFilters = [
    { value: 'all' as const, label: t('medias.scopeAll', 'Everything'), count: items.length },
    { value: 'radarr' as const, label: 'Radarr', count: items.filter(i => i.service === 'radarr').length },
    { value: 'sonarr' as const, label: 'Sonarr', count: items.filter(i => i.service === 'sonarr').length },
    { value: 'downloaded' as const, label: t('medias.downloaded'), count: downloadedCount },
    { value: 'missing' as const, label: t('medias.missing'), count: missingCount },
    { value: 'converting' as const, label: t('medias.scopeConverting', 'Converting'), count: convertingCount },
  ];

  return (
    <div className="space-y-3">
      <ConversionStatusBar />

      {/* Toolbar */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">

        {/* Row 1: Search + controls */}
        <div className="px-3 pt-3 pb-2.5 flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={e => setParams({ search: e.target.value || undefined, page: undefined })}
              placeholder={t('medias.searchPlaceholder')}
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-8 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setParams({ search: undefined, page: undefined })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                aria-label={t('medias.clearSearch', 'Clear search')}
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Density toggle */}
          <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 p-0.5 gap-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              title={t('medias.comfortableView', 'Comfortable')}
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
                density === 'comfortable'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              title={t('medias.compactView', 'Compact')}
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
                density === 'compact'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              )}
            >
              <Grid3X3 size={13} />
            </button>
          </div>

          {/* Sort select */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="hidden sm:block rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors shrink-0"
          >
            <option value="added_at">{t('medias.sortOptions.addedAt')}</option>
            <option value="title">{t('medias.sortOptions.title')}</option>
            <option value="year">{t('medias.sortOptions.year')}</option>
            <option value="service">{t('medias.sortOptions.service')}</option>
            <option value="status">{t('medias.sortOptions.status')}</option>
            <option value="downloaded">{t('medias.sortOptions.downloaded')}</option>
            <option value="monitored">{t('medias.sortOptions.monitored')}</option>
          </select>

          {/* Sort direction */}
          <button
            type="button"
            onClick={() => setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all shrink-0"
            title={sortDir === 'asc' ? t('medias.sortDirectionAsc') : t('medias.sortDirectionDesc')}
          >
            {sortDir === 'asc' ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
          </button>
        </div>

        {/* Mobile sort row */}
        <div className="sm:hidden px-3 pb-2.5">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortKey)}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-2 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
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

        {/* Row 2: Type filter pills — horizontal scroll */}
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 px-3 py-2.5 w-max min-w-full">
              {typeFilters.map(({ value, label, count }) => {
                const active = filter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                    )}
                  >
                    {label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-px text-[10px] font-bold min-w-[20px] text-center',
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Stats — desktop only, right-aligned */}
              {!isLoading && items.length > 0 && (
                <div className="hidden sm:flex items-center gap-3 ml-auto pl-3 text-[11px] text-neutral-400 dark:text-neutral-500 shrink-0">
                  <span>
                    <span className="font-semibold text-emerald-500 dark:text-emerald-400">{downloadedCount}</span>{' '}
                    {t('medias.downloaded').toLowerCase()}
                  </span>
                  <span className="text-neutral-200 dark:text-neutral-700">·</span>
                  <span>{t('medias.results', { count: filtered.length, total: items.length })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Scope filter pills — horizontal scroll */}
        <div className="border-t border-neutral-100 dark:border-neutral-800">
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-1.5 px-3 py-2.5 w-max min-w-full">
              {scopeFilters.map(({ value, label, count }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScopeFilter(value)}
                  className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                    scopeFilter === value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[10px] font-bold min-w-[20px] text-center',
                      scopeFilter === value
                        ? 'bg-white/20 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setScopeFilter('all');
                    setParams({ search: undefined, page: undefined });
                  }}
                  className="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors pl-2"
                >
                  {t('medias.clearFilters', 'Clear filters')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
        {isLoading ? (
          <div className="p-3 sm:p-4">
            <div
              className={cn(
                'grid gap-2 sm:gap-3',
                density === 'compact'
                  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              )}
            >
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
                  style={{ animationDelay: `${i * 30}ms` }}
                />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl opacity-20 select-none">🎬</span>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">
              {search || filter !== 'all' ? t('medias.noResults') : t('medias.empty')}
            </p>
          </div>
        ) : (
          <div className="p-3 sm:p-4">
            <div
              className={cn(
                'grid gap-2 sm:gap-3',
                density === 'compact'
                  ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              )}
            >
              {pagedItems.map(item => (
                <MediaGridCard
                  key={item.id}
                  id={`media-${mediaKey(item)}`}
                  item={item}
                  isOnC411={c411Enabled && item.tmdb_id !== null && c411TmdbIds.has(item.tmdb_id)}
                  onOpen={(tab?: TabKey) => openMedia(item, tab)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800 pt-4">
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  {t('medias.pagination.showing', { start: showingStart, end: showingEnd, total: filtered.length })}
                </p>

                <div className="flex items-center gap-1.5">
                  <select
                    value={pageSize}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setParams({ pageSize: v !== 50 ? v : undefined, page: undefined });
                    }}
                    className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-colors"
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
                      onClick={() => {
                        const p = Math.max(1, page - 1);
                        setParams({ page: p > 1 ? p : undefined });
                      }}
                      disabled={page <= 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label={t('medias.pagination.previous')}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2.5 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setParams({ page: Math.min(totalPages, page + 1) })}
                      disabled={page >= totalPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label={t('medias.pagination.next')}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <MediaInfoDialog
        isOpen={Boolean(currentMediaItem)}
        media={currentMediaItem}
        c411Enabled={c411Enabled}
        onClose={() => resetParams(['current_media_id', 'current_media_tab', 'current_media_release'])}
        activeTab={(searchParams.current_media_tab as TabKey) || (currentMediaItem?.downloaded ? 'info' : 'search')}
        onTabChange={tab => setParams({ current_media_tab: tab, current_media_release: undefined })}
        editingReleaseId={searchParams.current_media_release ?? null}
        onEditingReleaseChange={id => setParams({ current_media_release: id ?? undefined })}
        onRefetchLibrary={refetch}
      />
    </div>
  );
}

function C411Badge() {
  return <img src="/icons/c411.png" alt="C411" className="h-4 drop-shadow-md" />;
}

function MediaGridCard({
  item,
  isOnC411,
  id,
  onOpen,
}: {
  item: MediaItem;
  isOnC411: boolean;
  id?: string;
  onOpen: (tab?: TabKey) => void;
}) {
  const { t } = useTranslation('common');

  const conversion = item.latest_conversion;
  const isConverting = conversion && (conversion.status === 'running' || conversion.status === 'queued');

  const status = isConverting
    ? 'downloading'
    : item.downloaded
      ? 'downloaded'
      : item.downloading
        ? 'downloading'
        : 'missing';

  const statusLabel = isConverting
    ? conversion.status === 'running'
      ? `${t('medias.convert.status.running')} (${Math.round(conversion.progress)}%)`
      : t('medias.convert.status.queued')
    : item.downloaded
      ? t('medias.downloaded')
      : item.downloading
        ? t('medias.downloading')
        : t('medias.missing');

  return (
    <MediaPosterCard
      posterUrl={item.poster_url}
      title={item.title}
      id={id}
      fallbackEmoji="🎬"
      status={status}
      statusLabel={statusLabel}
      accentRingClassName="focus:ring-indigo-400/70"
      className="w-full"
      onClick={() => onOpen()}
      topLeftBadge={
        <div className="flex flex-col gap-1">
          {isOnC411 && <C411Badge />}
          {isConverting && (
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 shadow-lg text-white">
              <Zap size={12} className={cn(conversion.status === 'running' && 'animate-pulse')} />
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <span className="text-[9.5px] text-white/55 tabular-nums">{item.year ?? '—'}</span>
          {item.media_type === 'series' && item.season_count !== null && (
            <span className="text-[9.5px] text-white/45">
              {t('medias.seriesMeta', { seasons: item.season_count, episodes: item.episode_count ?? 0 })}
            </span>
          )}
        </div>

        {isConverting && conversion.status === 'running' && (
          <div className="space-y-1">
            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(5, conversion.progress)}%` }}
              />
            </div>
            <div className="flex justify-between text-[8px] font-bold text-white/40 uppercase tracking-tighter italic">
              <span>{Math.round(conversion.progress)}%</span>
              {conversion.speed && <span>{conversion.speed}</span>}
            </div>
          </div>
        )}
      </div>
    </MediaPosterCard>
  );
}
