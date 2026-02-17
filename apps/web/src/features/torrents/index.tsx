import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAddQbittorrentMagnet,
  useAddQbittorrentTorrentFile,
  useDashboardQbittorrentTorrents,
  useQbittorrentTorrentTrackers,
  type QbittorrentTorrentListItem,
} from '@hously/shared';
import { PageLayout } from '../../components/PageLayout';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/EmptyState';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function TorrentsPage() {
  const { t } = useTranslation('common');

  const torrentsQuery = useDashboardQbittorrentTorrents({ sort: 'added_on', reverse: true, limit: 250 });
  const addMagnetMutation = useAddQbittorrentMagnet();
  const addFileMutation = useAddQbittorrentTorrentFile();

  const [magnet, setMagnet] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTorrent, setSelectedTorrent] = useState<QbittorrentTorrentListItem | null>(null);

  const trackersQuery = useQbittorrentTorrentTrackers(selectedTorrent?.id ?? null);

  const torrents = torrentsQuery.data?.torrents ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return torrents;
    return torrents.filter(row => row.name.toLowerCase().includes(q));
  }, [search, torrents]);

  const canInteract = !addMagnetMutation.isPending && !addFileMutation.isPending;
  const isDisabled = torrentsQuery.data?.enabled === false;
  const isDisconnected = torrentsQuery.data?.connected === false;

  const handleAddMagnet = () => {
    const value = magnet.trim();
    if (!value) return;
    addMagnetMutation.mutate(
      { magnet: value },
      {
        onSuccess: () => {
          setMagnet('');
          void torrentsQuery.refetch();
        },
      }
    );
  };

  const handleAddFile = (file: File | null) => {
    if (!file) return;
    addFileMutation.mutate(file, {
      onSuccess: () => {
        void torrentsQuery.refetch();
      },
    });
  };

  return (
    <PageLayout>
      <PageHeader
        icon="🧲"
        iconColor="text-blue-600"
        title={t('torrents.title', 'Torrents')}
        subtitle={t('torrents.subtitle', 'Manage qBittorrent downloads')}
        onRefresh={() => void torrentsQuery.refetch()}
        isRefreshing={torrentsQuery.isFetching}
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
          description={torrentsQuery.data?.error ?? t('torrents.disconnectedDescription', 'qBittorrent is unreachable.')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {t('dashboard.qbittorrent.addMagnet', 'Add by magnet')}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      value={magnet}
                      onChange={e => setMagnet(e.target.value)}
                      placeholder={t('dashboard.qbittorrent.magnetPlaceholder', 'magnet:?xt=urn:btih:...')}
                      className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                      disabled={!canInteract}
                    />
                    <Button onClick={handleAddMagnet} disabled={!canInteract || magnet.trim().length === 0} size="sm">
                      {t('dashboard.qbittorrent.add', 'Add')}
                    </Button>
                  </div>
                  {addMagnetMutation.error ? (
                    <p className="mt-1 text-xs text-rose-600">
                      {String((addMagnetMutation.error as any)?.message ?? addMagnetMutation.error)}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-200">
                    {t('dashboard.qbittorrent.addTorrentFile', 'Add .torrent')}
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="file"
                      accept=".torrent,application/x-bittorrent"
                      onChange={e => handleAddFile(e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-neutral-700 dark:text-neutral-200 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 dark:file:bg-neutral-700/50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-neutral-800 dark:file:text-neutral-100"
                      disabled={!canInteract}
                    />
                  </div>
                  {addFileMutation.error ? (
                    <p className="mt-1 text-xs text-rose-600">
                      {String((addFileMutation.error as any)?.message ?? addFileMutation.error)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-neutral-100 dark:border-neutral-700/50 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    {t('dashboard.qbittorrent.torrents', 'Torrents')}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {filtered.length.toLocaleString()} / {torrents.length.toLocaleString()}
                  </p>
                </div>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t('dashboard.qbittorrent.searchPlaceholder', 'Search torrents...')}
                  className="w-full max-w-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="max-h-[60dvh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/50">
                {torrentsQuery.isLoading ? (
                  <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</div>
                ) : filtered.length > 0 ? (
                  filtered.map(torrent => (
                    <button
                      key={torrent.id}
                      type="button"
                      onClick={() => setSelectedTorrent(torrent)}
                      className={`w-full text-left px-5 py-4 hover:bg-neutral-50 dark:hover:bg-white/[0.04] ${
                        selectedTorrent?.id === torrent.id ? 'bg-neutral-50 dark:bg-white/[0.04]' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{torrent.name}</p>
                          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                            {torrent.category ?? '--'} • {Math.round(torrent.progress * 100)}% • ↓ {formatSpeed(torrent.download_speed)} • ↑{' '}
                            {formatSpeed(torrent.upload_speed)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                          {formatBytes(torrent.size_bytes)}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-5 text-sm text-neutral-500 dark:text-neutral-400">
                    {torrentsQuery.data?.error ?? t('dashboard.qbittorrent.emptyTitle', 'No torrents')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.22em] text-neutral-500 dark:text-neutral-400">
                    {t('dashboard.qbittorrent.trackers', 'Trackers')}
                  </p>
                  {selectedTorrent ? (
                    <>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {selectedTorrent.name}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">#{selectedTorrent.id}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                      {t('torrents.selectTorrent', 'Select a torrent to view trackers.')}
                    </p>
                  )}
                </div>
                {selectedTorrent ? (
                  <Button variant="secondary" size="sm" onClick={() => setSelectedTorrent(null)}>
                    {t('dashboard.qbittorrent.backToList', 'Back')}
                  </Button>
                ) : null}
              </div>

              {selectedTorrent ? (
                <div className="mt-4">
                  {trackersQuery.isLoading ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading', 'Loading...')}</p>
                  ) : trackersQuery.data?.trackers?.length ? (
                    <div className="space-y-2">
                      {trackersQuery.data.trackers.map(tracker => (
                        <div
                          key={tracker.url}
                          className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
                        >
                          <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 break-all">{tracker.url}</p>
                          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                            {tracker.message ? tracker.message : '--'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {trackersQuery.data?.error ?? t('dashboard.qbittorrent.noTrackers', 'No trackers found.')}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

