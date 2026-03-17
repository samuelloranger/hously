import React, { useMemo, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function TorrentsPage() {
  const { t } = useTranslation('common');

  const queryClient = useQueryClient();
  const { data, isLoading } = useDashboardQbittorrentTorrents();

  const [sseConnected, setSseConnected] = useState(false);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<QbittorrentStateFilter>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<QbittorrentSortKey>('added_on');
  const [sortDir, setSortDir] = useState<QbittorrentSortDir>('desc');

  const torrents = data?.torrents ?? [];

  const availableCategories = useMemo(() => getUniqueQbittorrentCategories(torrents), [torrents]);

  const availableTags = useMemo(() => getUniqueQbittorrentTags(torrents), [torrents]);

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

  const counts = useMemo(() => countQbittorrentTorrentsByState(torrents), [torrents]);

  const handleSort = (key: QbittorrentSortKey) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

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
  const totalDown = torrents.reduce((sum, t) => sum + t.download_speed, 0);
  const totalUp = torrents.reduce((sum, t) => sum + t.upload_speed, 0);

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
                {formatSpeed(totalDown)}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400 tabular-nums">
                <TrendingUp size={12} />
                {formatSpeed(totalUp)}
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
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('dashboard.qbittorrent.searchPlaceholder', 'Search torrents...')}
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 pl-8 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 dark:focus:border-sky-500 transition"
                />
              </div>

              {/* Multi-select filter pickers */}
              {(availableCategories.length > 0 || availableTags.length > 0) && (
                <div className="flex gap-2 items-center flex-wrap">
                  {availableCategories.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                          <span className="text-neutral-500">Categories</span>
                          {selectedCategories.length > 0 && (
                            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-1.5 rounded text-[10px]">
                              {selectedCategories.length}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-1">
                          {availableCategories.map(cat => (
                            <label
                              key={cat}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedCategories.includes(cat)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedCategories(p => [...p, cat]);
                                  else setSelectedCategories(p => p.filter(c => c !== cat));
                                }}
                                className="rounded border-neutral-300 dark:border-neutral-600 focus:ring-sky-500 text-sky-500 bg-transparent h-3.5 w-3.5"
                              />
                              <span className="text-[12px] text-neutral-700 dark:text-neutral-300 truncate leading-none">
                                {cat}
                              </span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                  {availableTags.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                          <span className="text-neutral-500">Tags</span>
                          {selectedTags.length > 0 && (
                            <span className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-1.5 rounded text-[10px]">
                              {selectedTags.length}
                            </span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-1">
                          {availableTags.map(tag => (
                            <label
                              key={tag}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTags.includes(tag)}
                                onChange={e => {
                                  if (e.target.checked) setSelectedTags(p => [...p, tag]);
                                  else setSelectedTags(p => p.filter(t => t !== tag));
                                }}
                                className="rounded border-neutral-300 dark:border-neutral-600 focus:ring-sky-500 text-sky-500 bg-transparent h-3.5 w-3.5"
                              />
                              <span className="text-[12px] text-neutral-700 dark:text-neutral-300 truncate leading-none">
                                {tag}
                              </span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}

              {/* State filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {QBITTORRENT_STATE_FILTERS.map(filter => {
                  const count = filter.id === 'all' ? torrents.length : (counts[filter.id] ?? 0);
                  if (filter.id !== 'all' && count === 0 && stateFilter !== filter.id) return null;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setStateFilter(filter.id)}
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
                {(
                  [
                    { key: 'added_on', label: t('torrents.sortAdded', 'Date') },
                    { key: 'download_speed', label: <ArrowDownToLine size={11} /> },
                    { key: 'upload_speed', label: <ArrowUpFromLine size={11} /> },
                    { key: 'ratio', label: t('torrents.sortRatio', 'Ratio') },
                    { key: 'size', label: t('torrents.sortSize', 'Size') },
                    { key: 'name', label: t('torrents.sortName', 'Name') },
                  ] as { key: QbittorrentSortKey; label: React.ReactNode }[]
                ).map(({ key, label }) => {
                  const active = sortBy === key;
                  const titles: Partial<Record<QbittorrentSortKey, string>> = {
                    download_speed: t('torrents.sortDownloadSpeed', 'Sort by download speed'),
                    upload_speed: t('torrents.sortUploadSpeed', 'Sort by upload speed'),
                  };
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
                      {label}
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
                filtered.map(torrent => <TorrentRow key={torrent.id} torrent={torrent} />)
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
