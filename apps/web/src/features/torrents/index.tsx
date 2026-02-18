import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DASHBOARD_ENDPOINTS,
  queryKeys,
  useDashboardQbittorrentTorrents,
  type DashboardQbittorrentTorrentsResponse,
} from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { Search, TrendingDown, TrendingUp, ArrowUp, ArrowDown, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { AddTorrentPanel } from './AddTorrentPanel';
import { TorrentRow } from './TorrentRow';
import { STATE_FILTERS, getStateFilter, formatSpeed, type StateFilter, type SortKey, type SortDir } from './utils';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export function TorrentsPage() {
  const { t } = useTranslation('common');

  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useDashboardQbittorrentTorrents();

  const sseRef = useRef<EventSource | null>(null);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('added_on');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const torrents = data?.torrents ?? [];

  const filtered = useMemo(() => {
    let result = torrents;
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(row => row.name.toLowerCase().includes(q));
    if (stateFilter !== 'all') result = result.filter(row => getStateFilter(row.state) === stateFilter);

    return [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'ratio') cmp = (a.ratio ?? -1) - (b.ratio ?? -1);
      else if (sortBy === 'added_on') cmp = (a.added_on ?? '').localeCompare(b.added_on ?? '');
      else if (sortBy === 'size') cmp = a.size_bytes - b.size_bytes;
      else if (sortBy === 'download_speed') cmp = a.download_speed - b.download_speed;
      else if (sortBy === 'upload_speed') cmp = a.upload_speed - b.upload_speed;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [search, stateFilter, torrents, sortBy, sortDir]);

  const counts = useMemo(() => {
    const map: Partial<Record<StateFilter, number>> = {};
    for (const t of torrents) {
      const f = getStateFilter(t.state);
      map[f] = (map[f] ?? 0) + 1;
    }
    return map;
  }, [torrents]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  useEffect(() => {
    if (!data?.enabled) return;

    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }

    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.TORRENTS_STREAM, { withCredentials: true });
    sseRef.current = source;

    source.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data) as DashboardQbittorrentTorrentsResponse;
        queryClient.setQueryData(queryKeys.dashboard.qbittorrentTorrents({}), parsed);
      } catch (error) {
        console.error('Failed to parse qBittorrent torrents stream payload', error);
      }
    };

    return () => {
      source.close();
      if (sseRef.current === source) sseRef.current = null;
    };
  }, [data?.enabled]);

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
        actions={
          <>
            <Button onClick={() => refetch()}>Refetch</Button>
          </>
        }
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
              <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
                {torrents.length.toLocaleString()} {t('dashboard.qbittorrent.torrents', 'torrents')}
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

              {/* State filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {STATE_FILTERS.map(filter => {
                  const count = filter.id === 'all' ? torrents.length : (counts[filter.id] ?? 0);
                  if (filter.id !== 'all' && count === 0) return null;
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
                <span className="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500 mr-1">Sort:</span>
                {(
                  [
                    { key: 'added_on', label: t('torrents.sortAdded', 'Date') },
                    { key: 'download_speed', label: <ArrowDownToLine size={11} /> },
                    { key: 'upload_speed', label: <ArrowUpFromLine size={11} /> },
                    { key: 'ratio', label: t('torrents.sortRatio', 'Ratio') },
                    { key: 'size', label: t('torrents.sortSize', 'Size') },
                    { key: 'name', label: t('torrents.sortName', 'Name') },
                  ] as { key: SortKey; label: React.ReactNode }[]
                ).map(({ key, label }) => {
                  const active = sortBy === key;
                  const titles: Partial<Record<SortKey, string>> = {
                    download_speed: t('torrents.sortDownloadSpeed', 'Sort by download speed'),
                    upload_speed: t('torrents.sortUploadSpeed', 'Sort by upload speed'),
                  };
                  return (
                    <button
                      key={key}
                      onClick={() => handleSort(key)}
                      title={titles[key]}
                      className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
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
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
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
