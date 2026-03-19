import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearch } from '@tanstack/react-router';
import {
  useMediaAutoSearch,
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
import { ArrowDownAZ, ArrowUpZA, ExternalLink, RefreshCw, Search, Sparkles, Trash2, User, Upload, EllipsisVertical, Zap } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

import { toast } from 'sonner';
import { useModalSearchParams } from '@/hooks/useModalSearchParams';
import { InteractiveSearchDialog } from './InteractiveSearchDialog';
import { SimilarMediasDialog } from './SimilarMediasDialog';
import { DeleteMediaDialog } from './DeleteMediaDialog';
import { C411Dialog } from './c411/C411Dialog';
import { ConvertMediaDialog } from './ConvertMediaDialog';
import { ConversionStatusBar } from './ConversionStatusBar';
import type { LibrarySearchParams } from '@/router';
import type { TabKey } from './c411/C411Dialog';

export function MediasLibrary() {
  const { t } = useTranslation('common');
  const { data: libraryData, isLoading, refetch } = useMedias();
  const { data: activeConversionsData } = useActiveMediaConversions({ enabled: true });
  
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('added_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const interactiveItem = useMemo(
    () => searchParams.modal === 'interactive' ? items.find(i => `${i.service}:${i.source_id}` === searchParams.mediaId) ?? null : null,
    [items, searchParams.modal, searchParams.mediaId]
  );
  const similarItem = useMemo(
    () => searchParams.modal === 'similar' ? items.find(i => `${i.service}:${i.source_id}` === searchParams.mediaId) ?? null : null,
    [items, searchParams.modal, searchParams.mediaId]
  );
  const deleteItem = useMemo(
    () => searchParams.modal === 'delete' ? items.find(i => `${i.service}:${i.source_id}` === searchParams.mediaId) ?? null : null,
    [items, searchParams.modal, searchParams.mediaId]
  );
  const convertItem = useMemo(
    () => searchParams.modal === 'convert' ? items.find(i => `${i.service}:${i.source_id}` === searchParams.mediaId) ?? null : null,
    [items, searchParams.modal, searchParams.mediaId]
  );

  const c411Enabled = libraryData?.c411_enabled ?? false;
  const c411TmdbIds = useMemo(
    () => new Set(libraryData?.c411_tmdb_ids ?? []),
    [libraryData?.c411_tmdb_ids],
  );
  const c411Item = useMemo(
    () => items.find((i) => i.tmdb_id === searchParams.c411) ?? null,
    [items, searchParams.c411],
  );
  const isNotConfigured = libraryData && !libraryData.radarr_enabled && !libraryData.sonarr_enabled;

  const filtered = useMemo(() => {
    return filterAndSortMediaItems(items, {
      filter,
      search,
      sortBy,
      sortDir,
    });
  }, [items, filter, search, sortBy, sortDir]);

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

  if (isNotConfigured) {
    return (
      <EmptyState icon="🎞️" title={t('medias.notConfiguredTitle')} description={t('medias.notConfiguredDescription')} />
    );
  }

  return (
    <div className="space-y-3">
      <ConversionStatusBar />

      {/* Toolbar */}
      <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
        <div className="px-4 py-3 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-40">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
            />
            <input
              value={search}
              onChange={e => setParams({ search: e.target.value || undefined, page: undefined })}
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
                  {type === 'all'
                    ? t('medias.filterAll')
                    : type === 'movie'
                      ? t('medias.filterMovies')
                      : t('medias.filterSeries')}
                  <span
                    className={`rounded-full px-1 text-[10px] font-semibold ${active ? 'text-white/70' : 'text-neutral-400 dark:text-neutral-500'}`}
                  >
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
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{movieCount}</span>{' '}
              {t('medias.filterMovies').toLowerCase()}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{seriesCount}</span>{' '}
              {t('medias.filterSeries').toLowerCase()}
            </span>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{downloadedCount}</span>{' '}
              {t('medias.downloaded').toLowerCase()}
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
                  id={`media-${item.service}:${item.source_id}`}
                  item={item}
                  isOnC411={c411Enabled && item.tmdb_id !== null && c411TmdbIds.has(item.tmdb_id)}
                  releaseTags={item.release_tags ?? undefined}
                  onOpenInteractive={() => setParams({ modal: 'interactive', mediaId: `${item.service}:${item.source_id}` })}
                  onFindSimilar={item.tmdb_id ? () => setParams({ modal: 'similar', mediaId: `${item.service}:${item.source_id}` }) : undefined}
                  onConvert={item.service === 'radarr' && item.media_type === 'movie' && item.downloaded ? () => setParams({ modal: 'convert', mediaId: `${item.service}:${item.source_id}` }) : undefined}
                  onOpenC411={c411Enabled && item.source_id && item.tmdb_id ? () => setParams({ c411: item.tmdb_id! }) : undefined}
                  onDelete={() => setParams({ modal: 'delete', mediaId: `${item.service}:${item.source_id}` })}
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
                  onChange={e => { const v = Number(e.target.value); setParams({ pageSize: v !== 50 ? v : undefined, page: undefined }); }}
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
                    onClick={() => { const p = Math.max(1, page - 1); setParams({ page: p > 1 ? p : undefined }); }}
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
                    onClick={() => setParams({ page: Math.min(totalPages, page + 1) })}
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
        onClose={() => resetParams(['modal', 'mediaId'])}
      />

      <SimilarMediasDialog
        isOpen={Boolean(similarItem)}
        tmdbId={similarItem?.tmdb_id ?? null}
        mediaType={similarItem ? (similarItem.media_type === 'movie' ? 'movie' : 'tv') : null}
        title={similarItem?.title ?? ''}
        onClose={() => resetParams(['modal', 'mediaId'])}
        onAdded={refetch}
      />

      <DeleteMediaDialog isOpen={Boolean(deleteItem)} media={deleteItem} onClose={() => resetParams(['modal', 'mediaId'])} />

      <ConvertMediaDialog
        isOpen={Boolean(convertItem)}
        media={convertItem}
        onClose={() => resetParams(['modal', 'mediaId'])}
      />

      <C411Dialog
        isOpen={Boolean(c411Item)}
        media={c411Item}
        onClose={() => resetParams(['c411', 'c411Tab', 'c411Release'])}
        activeTab={(searchParams.c411Tab as TabKey) || 'search'}
        onTabChange={(tab) => setParams({ c411Tab: tab, c411Release: undefined })}
        editingReleaseId={searchParams.c411Release ?? null}
        onEditingReleaseChange={(id) => setParams({ c411Release: id ?? undefined })}
      />
    </div>
  );
}

function C411Badge() {
  return (
    <img src="/icons/c411.png" alt="C411" className="h-4 drop-shadow-md" />
  );
}

function CardDropdownMenu({
  item,
  onOpenInteractive,
  onFindSimilar,
  onConvert,
  onOpenC411,
  onDelete,
}: {
  item: MediaItem;
  onOpenInteractive: () => void;
  onFindSimilar?: () => void;
  onConvert?: () => void;
  onOpenC411?: () => void;
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

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/70 transition-colors duration-150 hover:bg-black/70 hover:text-white"
        >
          <EllipsisVertical size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="min-w-[160px] rounded-lg bg-neutral-900/95 backdrop-blur-xl border border-white/10 shadow-xl z-[var(--z-popover)] animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          <DropdownMenu.Item
            onSelect={() => void runAutoSearch()}
            disabled={autoSearchMutation.isPending}
            className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none rounded-t-lg disabled:opacity-40"
          >
            <Search size={12} className={autoSearchMutation.isPending ? 'animate-spin' : ''} />
            {t('medias.autoSearch.button')}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={onOpenInteractive}
            className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none"
          >
            <User size={12} />
            {t('medias.interactive.button')}
          </DropdownMenu.Item>

          {onConvert && (
            <DropdownMenu.Item
              onSelect={onConvert}
              className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none"
            >
              <RefreshCw size={12} />
              {t('medias.convert.button')}
            </DropdownMenu.Item>
          )}

          {onFindSimilar && (
            <DropdownMenu.Item
              onSelect={onFindSimilar}
              className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none"
            >
              <Sparkles size={12} />
              {t('medias.similar.button')}
            </DropdownMenu.Item>
          )}

          {onOpenC411 && (
            <DropdownMenu.Item
              onSelect={onOpenC411}
              className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none"
            >
              <Upload size={12} />
              C411
            </DropdownMenu.Item>
          )}

          {item.arr_url && (
            <DropdownMenu.Item asChild>
              <a
                href={item.arr_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 hover:text-white cursor-pointer outline-none"
              >
                <ExternalLink size={12} />
                {t('medias.viewInArr')}
              </a>
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="h-px bg-white/10 my-1" />

          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer outline-none rounded-b-lg"
          >
            <Trash2 size={12} />
            {t('medias.delete.button')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MediaGridCard({
  item,
  isOnC411,
  id,
  releaseTags,
  onOpenInteractive,
  onFindSimilar,
  onConvert,
  onOpenC411,
  onDelete,
}: {
  item: MediaItem;
  isOnC411: boolean;
  id?: string;
  releaseTags?: string[];
  onOpenInteractive: () => void;
  onFindSimilar?: () => void;
  onConvert?: () => void;
  onOpenC411?: () => void;
  onDelete: () => void;
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
      topLeftBadge={
        <div className="flex flex-col gap-1">
          {isOnC411 && <C411Badge />}
          {isConverting && (
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 shadow-lg text-white">
              <Zap size={12} className={cn(conversion.status === 'running' && "animate-pulse")} />
            </div>
          )}
        </div>
      }
      hoverTags={releaseTags}
      topRightContent={
        <CardDropdownMenu
          item={item}
          onOpenInteractive={onOpenInteractive}
          onFindSimilar={onFindSimilar}
          onConvert={onConvert}
          onOpenC411={onOpenC411}
          onDelete={onDelete}
        />
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
