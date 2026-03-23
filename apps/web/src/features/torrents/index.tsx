import React, { useEffect, useMemo, useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_ENDPOINTS,
  QBITTORRENT_STATE_FILTERS,
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
import { Search, TrendingDown, TrendingUp, ArrowUp, ArrowDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { AddTorrentPanel } from './AddTorrentPanel';
import { TorrentRow } from './TorrentRow';
import { useQueryClient } from '@tanstack/react-query';
import { useUrlState } from '@/hooks/useUrlState';
import type { TorrentsSearchParams } from '@/router';
import { TorrentFilterPopover } from './TorrentFilterPopover';

const TORRENTS_URL_STATE_DEFAULTS = {
  search: '',
  state: 'all' as QbittorrentStateFilter,
  categories: [] as string[],
  tags: [] as string[],
  sortBy: 'added_on' as QbittorrentSortKey,
  sortDir: 'desc' as QbittorrentSortDir,
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
  const { data, isLoading } = useDashboardQbittorrentTorrents();
  const { data: pinnedTorrentData } = usePinnedQbittorrentTorrent();
  const setPinnedTorrent = useSetPinnedQbittorrentTorrent();
  const searchParams = useSearch({ from: '/torrents' }) as TorrentsSearchParams;
  const { state: urlState, setState: setUrlState } = useUrlState('/torrents', searchParams, TORRENTS_URL_STATE_DEFAULTS);

  const [sseConnected, setSseConnected] = useState(false);
  const [searchInput, setSearchInput] = useState(urlState.search);

  const search = urlState.search;
  const stateFilter = urlState.state;
  const selectedCategories = urlState.categories;
  const selectedTags = urlState.tags;
  const sortBy = urlState.sortBy;
  const sortDir = urlState.sortDir;

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

  const handleSort = (key: QbittorrentSortKey) => {
    if (sortBy === key) {
      setUrlState({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' });
      return;
    }

    setUrlState({ sortBy: key, sortDir: 'desc' });
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

  useJsonEventSource<DashboardQbittorrentTorrentsResponse>({
    enabled: Boolean(data?.enabled),
    url: data?.enabled ? DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS_STREAM : null,
    logLabel: 'qBittorrent torrents stream',
    onOpen: () => setSseConnected(true),
    onError: () => setSseConnected(false),
    onReset: () => setSseConnected(false),
    onMessage: parsed => {
      queryClient.setQueryData(queryKeys.dashboard.qbittorrentTorrents({}), parsed);
    },
  });

  const isDisabled = data?.enabled === false;
  const isDisconnected = data?.connected === false;
  const pinnedHash = pinnedTorrentData?.pinned_hash ?? null;

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
          {torrents.length > 0 && (
            <div className="flex items-center gap-4 px-1">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                <TrendingDown size={12} />
                {formatSpeed(torrentMeta.totalDown)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                <TrendingUp size={12} />
                {formatSpeed(torrentMeta.totalUp)}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {data?.enabled && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sseConnected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}
                    />
                    {sseConnected
                      ? t('dashboard.qbittorrent.live', 'Live')
                      : t('dashboard.qbittorrent.reconnecting', 'Reconnecting…')}
                  </span>
                )}
                <span className="text-xs text-neutral-400 dark:text-neutral-400 tabular-nums">
                  {torrents.length.toLocaleString()} {t('dashboard.qbittorrent.torrents', 'torrents')}
                </span>
              </span>
            </div>
          )}

          <AddTorrentPanel />

          {/* List card */}
          <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
            {/* Search + filters + sort */}
            <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder={t('dashboard.qbittorrent.searchPlaceholder', 'Search torrents...')}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 dark:focus:border-sky-500 transition"
                />
              </div>

              {/* Multi-select filter pickers */}
              {(torrentMeta.availableCategories.length > 0 || torrentMeta.availableTags.length > 0) && (
                <div className="flex gap-2 items-center flex-wrap">
                  <TorrentFilterPopover
                    label={t('dashboard.qbittorrent.categories', 'Categories')}
                    selectedCount={selectedCategories.length}
                    options={torrentMeta.availableCategories}
                    selectedValues={selectedCategories}
                    onToggle={handleCategoryToggle}
                  />
                  <TorrentFilterPopover
                    label={t('dashboard.qbittorrent.tags', 'Tags')}
                    selectedCount={selectedTags.length}
                    options={torrentMeta.availableTags}
                    selectedValues={selectedTags}
                    onToggle={handleTagToggle}
                  />
                </div>
              )}

              {/* State filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {QBITTORRENT_STATE_FILTERS.map(filter => {
                  const count = filter.id === 'all' ? torrents.length : (torrentMeta.counts[filter.id] ?? 0);
                  if (filter.id !== 'all' && count === 0 && stateFilter !== filter.id) return null;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setUrlState({ state: filter.id })}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        stateFilter === filter.id
                          ? 'bg-sky-500 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
                    >
                      {t(filter.labelKey)}
                      <span
                        className={`tabular-nums ${stateFilter === filter.id ? 'text-sky-100' : 'text-neutral-400 dark:text-neutral-500'}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                <span className="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-400 mr-1">Sort:</span>
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
                      onClick={() => handleSort(key)}
                      title={titles[key]}
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 min-h-[26px] rounded-full text-xs font-medium transition-colors ${
                        active
                          ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                      }`}
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
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {isLoading ? (
                <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                  {t('common.loading', 'Loading...')}
                </div>
              ) : filtered.length > 0 ? (
                filtered.map(torrent => (
                  <TorrentRow
                    key={torrent.id}
                    torrent={torrent}
                    isPinned={pinnedHash === torrent.id}
                    isPinPending={setPinnedTorrent.isPending}
                    onTogglePin={handleTogglePin}
                  />
                ))
              ) : (
                <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                  {search || stateFilter !== 'all'
                    ? t('torrents.noResults')
                    : (data?.error ?? t('dashboard.qbittorrent.emptyTitle'))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
