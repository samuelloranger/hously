import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_ENDPOINTS,
  QBITTORRENT_STATE_FILTERS,
  QBITTORRENT_TORRENTS_PAGE_SIZE,
  buildQbittorrentTorrentsStreamUrl,
  countQbittorrentTorrentsByState,
  filterAndSortQbittorrentTorrents,
  formatSpeed,
  getUniqueQbittorrentCategories,
  getUniqueQbittorrentTags,
  queryKeys,
  usePinnedQbittorrentTorrent,
  useSetPinnedQbittorrentTorrent,
  useJsonEventSource,
  useDashboardQbittorrentTorrents,
  type DashboardQbittorrentTorrentsResponse,
  type QbittorrentSortDir,
  type QbittorrentSortKey,
  type QbittorrentStateFilter,
} from '@hously/shared';
import { PageLayout } from '@/components/PageLayout';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  Search,
  TrendingDown,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  X,
  List,
  LayoutGrid,
  Columns3,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddTorrentPanel } from './AddTorrentPanel';
import { TorrentRow } from './TorrentRow';
import { TorrentGridCard } from './TorrentGridCard';
import { TorrentKanbanView } from './TorrentKanbanView';
import { TorrentFilterSheet } from './TorrentFilterSheet';
import { useQueryClient } from '@tanstack/react-query';
import { useUrlState } from '@/hooks/useUrlState';
import type { TorrentsSearchParams } from '@/router';
import { TorrentFilterPopover } from './TorrentFilterPopover';
import { usePersistentState } from '@/hooks/usePersistentState';

const TORRENTS_URL_STATE_DEFAULTS = {
  search: '',
  state: 'all' as QbittorrentStateFilter,
  categories: [] as string[],
  tags: [] as string[],
  sortBy: 'added_on' as QbittorrentSortKey,
  sortDir: 'desc' as QbittorrentSortDir,
  page: 1,
};

const TORRENTS_SEARCH_DEBOUNCE_MS = 300;
const TORRENT_SORT_OPTIONS: { key: QbittorrentSortKey; label: React.ReactNode }[] = [
  { key: 'added_on', label: 'Date' },
  { key: 'download_speed', label: <ArrowDownToLine size={11} /> },
  { key: 'upload_speed', label: <ArrowUpFromLine size={11} /> },
  { key: 'ratio', label: 'Ratio' },
  { key: 'size', label: 'Size' },
  { key: 'name', label: 'Name' },
];

export function TorrentsPage() {
  const { t } = useTranslation('common');

  const queryClient = useQueryClient();
  const { data: pinnedTorrentData } = usePinnedQbittorrentTorrent();
  const setPinnedTorrent = useSetPinnedQbittorrentTorrent();
  const searchParams = useSearch({ from: '/torrents' }) as TorrentsSearchParams;
  const { state: urlState, setState: setUrlState } = useUrlState(
    '/torrents',
    searchParams,
    TORRENTS_URL_STATE_DEFAULTS
  );

  const [sseConnected, setSseConnected] = useState(false);
  const [searchInput, setSearchInput] = useState(urlState.search);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [viewMode, setViewMode] = usePersistentState<'list' | 'grid' | 'kanban'>('torrents-view-mode', 'list');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const search = urlState.search;
  const stateFilter = urlState.state;
  const selectedCategories = urlState.categories;
  const selectedTags = urlState.tags;
  const sortBy = urlState.sortBy;
  const sortDir = urlState.sortDir;

  const page = urlState.page ?? 1;
  const offset = (page - 1) * QBITTORRENT_TORRENTS_PAGE_SIZE;
  const listQueryParams = useMemo(
    () => ({
      offset,
      limit: QBITTORRENT_TORRENTS_PAGE_SIZE,
      sort: sortBy,
      reverse: sortDir === 'desc',
    }),
    [offset, sortBy, sortDir]
  );

  const { data, isLoading } = useDashboardQbittorrentTorrents(listQueryParams);

  const torrents = data?.torrents ?? [];

  const filtered = useMemo(
    () =>
      filterAndSortQbittorrentTorrents(torrents, {
        search,
        stateFilter,
        selectedCategories,
        selectedTags,
        sortBy,
        sortDir,
      }),
    [search, sortBy, sortDir, stateFilter, selectedCategories, selectedTags, torrents]
  );

  const torrentMeta = useMemo(() => {
    const counts = countQbittorrentTorrentsByState(torrents);
    let totalDown = 0;
    let totalUp = 0;

    for (const torrent of torrents) {
      totalDown += torrent.download_speed;
      totalUp += torrent.upload_speed;
    }

    return {
      availableCategories: getUniqueQbittorrentCategories(torrents),
      availableTags: getUniqueQbittorrentTags(torrents),
      counts,
      totalDown,
      totalUp,
    };
  }, [torrents]);

  const totalCount = data?.total_count ?? 0;
  const pageSize = data?.limit ?? QBITTORRENT_TORRENTS_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const displayDownloadSpeed =
    data?.connected && typeof data?.download_speed === 'number' ? data.download_speed : torrentMeta.totalDown;
  const displayUploadSpeed =
    data?.connected && typeof data?.upload_speed === 'number' ? data.upload_speed : torrentMeta.totalUp;

  const handleSort = (key: QbittorrentSortKey) => {
    if (sortBy === key) {
      setUrlState({ sortDir: sortDir === 'asc' ? 'desc' : 'asc', page: 1 });
      return;
    }

    setUrlState({ sortBy: key, sortDir: 'desc', page: 1 });
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    setUrlState({
      categories: checked ? [...selectedCategories, category] : selectedCategories.filter(value => value !== category),
    });
  };

  const handleTagToggle = (tag: string, checked: boolean) => {
    setUrlState({
      tags: checked ? [...selectedTags, tag] : selectedTags.filter(value => value !== tag),
    });
  };

  useEffect(() => {
    setSearchInput(urlState.search);
  }, [urlState.search]);

  useEffect(() => {
    if (searchInput === urlState.search) return undefined;

    const timeout = window.setTimeout(() => {
      setUrlState({ search: searchInput });
    }, TORRENTS_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput, setUrlState, urlState.search]);

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

      if (event.key === 'Escape' && document.activeElement === searchInputRef.current && searchInput) {
        setSearchInput('');
        setUrlState({ search: '' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchInput, setUrlState]);

  const torrentsStreamUrl = useMemo(
    () =>
      data?.enabled ? buildQbittorrentTorrentsStreamUrl(DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS_STREAM, offset) : null,
    [data?.enabled, offset]
  );

  useJsonEventSource<DashboardQbittorrentTorrentsResponse>({
    enabled: Boolean(data?.enabled),
    url: torrentsStreamUrl,
    logLabel: 'qBittorrent torrents stream',
    onOpen: () => setSseConnected(true),
    onError: () => setSseConnected(false),
    onReset: () => setSseConnected(false),
    onMessage: parsed => {
      queryClient.setQueryData(queryKeys.dashboard.qbittorrentTorrents(listQueryParams), parsed);
    },
  });

  const isDisabled = data?.enabled === false;
  const isDisconnected = data?.connected === false;
  const pinnedHash = pinnedTorrentData?.pinned_hash ?? null;
  const hasActiveFilters =
    search.length > 0 || stateFilter !== 'all' || selectedCategories.length > 0 || selectedTags.length > 0;

  const handleTogglePin = (hash: string, nextPinned: boolean) => {
    setPinnedTorrent.mutate({ hash: nextPinned ? hash : null });
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🧲"
        iconColor="text-blue-600"
        title={t('torrents.title', 'Torrents')}
        subtitle={t('torrents.subtitle', 'Manage qBittorrent downloads')}
      />

      {isDisabled ? (
        <EmptyState
          icon="🧲"
          title={t('dashboard.qbittorrent.notConnectedTitle')}
          description={t('dashboard.qbittorrent.notConnectedDescription')}
        />
      ) : isDisconnected ? (
        <EmptyState
          icon="🧲"
          title={t('dashboard.qbittorrent.disconnected')}
          description={data.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
        />
      ) : (
        <div className="space-y-4">
          {/* Speed strip */}
          {(totalCount > 0 || torrents.length > 0) && (
            <div className="flex flex-wrap items-center gap-3 px-1">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                <TrendingDown size={12} />
                {formatSpeed(displayDownloadSpeed)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <TrendingUp size={12} />
                {formatSpeed(displayUploadSpeed)}
              </span>
              <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {data?.enabled && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                      sseConnected
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    )}
                  >
                    <span
                      className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        sseConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                      )}
                    />
                    {sseConnected
                      ? t('dashboard.qbittorrent.live', 'Live')
                      : t('dashboard.qbittorrent.reconnecting', 'Reconnecting…')}
                  </span>
                )}
                <span className="text-xs text-neutral-400 tabular-nums">
                  {totalCount.toLocaleString()} {t('dashboard.qbittorrent.torrents', 'torrents')}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setUrlState({ page: Math.max(1, page - 1) })}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-600',
                      'text-neutral-600 dark:text-neutral-300',
                      'disabled:opacity-40 disabled:pointer-events-none',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                    aria-label={t('torrents.prevPage', 'Previous page')}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="min-w-[4.5rem] text-center text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setUrlState({ page: Math.min(totalPages, page + 1) })}
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 dark:border-neutral-600',
                      'text-neutral-600 dark:text-neutral-300',
                      'disabled:opacity-40 disabled:pointer-events-none',
                      'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                    aria-label={t('torrents.nextPage', 'Next page')}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </span>
            </div>
          )}

          <AddTorrentPanel />

          {/* List card */}
          <div
            className={cn(
              'rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900',
              viewMode !== 'kanban' && 'overflow-hidden'
            )}
          >
            {/* Row 1: Search (full-width on mobile) + controls */}
            <div className="px-3 pt-3 pb-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Search — always full width on mobile */}
              <div className="relative w-full sm:flex-1 sm:min-w-0">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={t('dashboard.qbittorrent.searchPlaceholder', 'Search torrents...')}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-8 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-all"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setUrlState({ search: '' });
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    aria-label={t('torrents.clearSearch', 'Clear search')}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>

              {/* Controls row — below search on mobile, inline on desktop */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Mobile: Filters button (opens bottom sheet) */}
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(true)}
                  className={cn(
                    'sm:hidden relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                    hasActiveFilters
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400'
                      : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  )}
                >
                  <SlidersHorizontal size={13} />
                  {t('torrents.filters', 'Filters')}
                  {hasActiveFilters && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold">
                      {(stateFilter !== 'all' ? 1 : 0) + selectedCategories.length + selectedTags.length}
                    </span>
                  )}
                </button>

                {/* View mode toggle */}
                <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 p-0.5 gap-0.5">
                  {(
                    [
                      { mode: 'list', icon: <List size={13} />, title: t('torrents.listView', 'List') },
                      { mode: 'grid', icon: <LayoutGrid size={13} />, title: t('torrents.gridView', 'Grid') },
                      { mode: 'kanban', icon: <Columns3 size={13} />, title: t('torrents.kanbanView', 'Board') },
                    ] as const
                  ).map(({ mode, icon, title }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      title={title}
                      className={cn(
                        'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150',
                        viewMode === mode
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      )}
                    >
                      {icon}
                    </button>
                  ))}
                </div>

                {/* Desktop: Category/tag filter popovers */}
                {torrentMeta.availableCategories.length > 0 && (
                  <div className="hidden sm:block">
                    <TorrentFilterPopover
                      label={t('dashboard.qbittorrent.categories', 'Categories')}
                      selectedCount={selectedCategories.length}
                      options={torrentMeta.availableCategories}
                      selectedValues={selectedCategories}
                      onToggle={handleCategoryToggle}
                    />
                  </div>
                )}
                {torrentMeta.availableTags.length > 0 && (
                  <div className="hidden sm:block">
                    <TorrentFilterPopover
                      label={t('dashboard.qbittorrent.tags', 'Tags')}
                      selectedCount={selectedTags.length}
                      options={torrentMeta.availableTags}
                      selectedValues={selectedTags}
                      onToggle={handleTagToggle}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: State filter chips — horizontal scroll (desktop only) */}
            <div className="hidden sm:block border-t border-neutral-100 dark:border-neutral-800">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1.5 px-3 py-2.5 w-max min-w-full">
                  {QBITTORRENT_STATE_FILTERS.map(filter => {
                    const count = filter.id === 'all' ? torrents.length : (torrentMeta.counts[filter.id] ?? 0);
                    if (filter.id !== 'all' && count === 0 && stateFilter !== filter.id) return null;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setUrlState({ state: filter.id })}
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                          stateFilter === filter.id
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        )}
                      >
                        {t(filter.labelKey)}
                        <span
                          className={cn(
                            'rounded-full px-1.5 py-px text-[10px] font-bold min-w-[20px] text-center',
                            stateFilter === filter.id
                              ? 'bg-white/20 text-white'
                              : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400'
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => setUrlState({ search: '', state: 'all', categories: [], tags: [] })}
                      className="ml-auto shrink-0 text-xs text-neutral-400 dark:text-neutral-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors pl-2"
                    >
                      {t('torrents.clearFilters', 'Clear filters')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Sort chips — horizontal scroll (desktop only) */}
            <div className="hidden sm:block border-t border-neutral-100 dark:border-neutral-800">
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex items-center gap-1.5 px-3 py-2.5 w-max min-w-full">
                  {TORRENT_SORT_OPTIONS.map(({ key, label }) => {
                    const active = sortBy === key;
                    const titles: Partial<Record<QbittorrentSortKey, string>> = {
                      download_speed: t('torrents.sortDownloadSpeed', 'Sort by download speed'),
                      upload_speed: t('torrents.sortUploadSpeed', 'Sort by upload speed'),
                    };
                    const resolvedLabel =
                      typeof label === 'string'
                        ? key === 'added_on'
                          ? t('torrents.sortAdded', label)
                          : key === 'ratio'
                            ? t('torrents.sortRatio', label)
                            : key === 'size'
                              ? t('torrents.sortSize', label)
                              : key === 'name'
                                ? t('torrents.sortName', label)
                                : label
                        : label;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSort(key)}
                        title={titles[key]}
                        className={cn(
                          'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
                          active
                            ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                        )}
                      >
                        {resolvedLabel}
                        {active &&
                          (sortDir === 'asc' ? (
                            <ArrowUp size={10} className="shrink-0" />
                          ) : (
                            <ArrowDown size={10} className="shrink-0" />
                          ))}
                      </button>
                    );
                  })}
                  <span className="ml-auto shrink-0 pl-3 text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums">
                    {t('torrents.results', { count: filtered.length, total: totalCount })}
                  </span>
                </div>
              </div>
            </div>

            {/* Content — switches between list/compact/grid/kanban */}
            {isLoading ? (
              /* Skeleton — adapts to current view mode */
              viewMode === 'grid' ? (
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-neutral-200 dark:border-neutral-700/60 overflow-hidden animate-pulse"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className="h-1 bg-neutral-200 dark:bg-neutral-700" />
                      <div className="p-3 space-y-2">
                        <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5" />
                        <div className="h-3 bg-neutral-100 dark:bg-neutral-800 rounded w-1/2" />
                        <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full mt-3" />
                        <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewMode === 'kanban' ? (
                <div className="p-3 flex gap-3 overflow-x-auto">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-64 flex-shrink-0 rounded-2xl border border-neutral-200 dark:border-neutral-700/60 overflow-hidden animate-pulse"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="h-9 bg-neutral-100 dark:bg-neutral-800" />
                      <div className="p-2 space-y-2">
                        {Array.from({ length: 3 }).map((_, j) => (
                          <div
                            key={j}
                            className="rounded-xl border border-neutral-200 dark:border-neutral-700/60 p-2.5 space-y-1.5"
                          >
                            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-4/5" />
                            <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="px-4 sm:px-5 py-4" style={{ animationDelay: `${i * 40}ms` }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-1 w-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 animate-pulse shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex justify-between gap-4">
                            <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse flex-1 max-w-[60%]" />
                            <div className="h-3.5 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse w-16 shrink-0" />
                          </div>
                          <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse w-24" />
                          <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full animate-pulse" />
                          <div className="h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse w-40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3">
                <span className="text-3xl opacity-20 select-none">🧲</span>
                <p className="text-sm text-neutral-400 dark:text-neutral-500">
                  {search || stateFilter !== 'all'
                    ? t('torrents.noResults')
                    : (data?.error ?? t('dashboard.qbittorrent.emptyTitle'))}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filtered.map(torrent => (
                  <TorrentGridCard
                    key={torrent.id}
                    torrent={torrent}
                    isPinned={pinnedHash === torrent.id}
                    isPinPending={setPinnedTorrent.isPending}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            ) : viewMode === 'kanban' ? (
              <div className="p-3">
                <TorrentKanbanView torrents={filtered} />
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {filtered.map(torrent => (
                  <TorrentRow
                    key={torrent.id}
                    torrent={torrent}
                    isPinned={pinnedHash === torrent.id}
                    isPinPending={setPinnedTorrent.isPending}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <TorrentFilterSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        stateFilter={stateFilter}
        onStateChange={state => setUrlState({ state })}
        counts={torrentMeta.counts}
        torrentsTotal={totalCount}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={handleSort}
        availableCategories={torrentMeta.availableCategories}
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
        availableTags={torrentMeta.availableTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        hasActiveFilters={hasActiveFilters}
        onClearAll={() => setUrlState({ search: '', state: 'all', categories: [], tags: [], page: 1 })}
      />
    </PageLayout>
  );
}
