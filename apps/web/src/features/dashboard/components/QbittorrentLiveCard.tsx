import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  useDashboardQbittorrentStatus,
} from '@hously/shared';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import { QbittorrentManagerDialog } from './QbittorrentManagerDialog';

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
};

const formatSpeed = (bytesPerSecond: number): string => `${formatBytes(bytesPerSecond)}/s`;

const formatEta = (etaSeconds: number | null): string => {
  if (etaSeconds == null || etaSeconds < 0) return '--';
  const hours = Math.floor(etaSeconds / 3600);
  const minutes = Math.floor((etaSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const DOWNLOADING_STATES = new Set(['downloading', 'forceddl', 'metadl', 'queueddl', 'checkingdl']);

const formatTorrentState = (state: string, t: (key: string) => string): string => {
  const normalized = state.trim().toLowerCase();
  const keyByState: Record<string, string> = {
    error: 'error',
    missingfiles: 'missingFiles',
    uploading: 'uploading',
    stalledup: 'stalledUp',
    pausedup: 'pausedUp',
    queuedup: 'queuedUp',
    forcedup: 'forcedUp',
    checkingup: 'checkingUp',
    queueddl: 'queuedDl',
    forceddl: 'forcedDl',
    downloading: 'downloading',
    metadl: 'metaDl',
    stalleddl: 'stalledDl',
    pauseddl: 'pausedDl',
    checkingdl: 'checkingDl',
    checkingresume: 'checkingResumeData',
    moving: 'moving',
    unknown: 'unknown',
  };

  const translationKey = keyByState[normalized];
  if (translationKey) {
    return t(`dashboard.qbittorrent.states.${translationKey}`);
  }
  return state;
};

export function QbittorrentLiveCard() {
  const { t } = useTranslation('common');
  const { data: fallbackData, isLoading } = useDashboardQbittorrentStatus();
  const [liveData, setLiveData] = useState<DashboardQbittorrentStatusResponse | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [showTorrents, setShowTorrents] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    setLiveData(fallbackData ?? null);
  }, [fallbackData]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const source = new EventSource(DASHBOARD_ENDPOINTS.QBITTORRENT.STREAM, { withCredentials: true });
    source.onopen = () => setStreamConnected(true);
    source.onmessage = event => {
      try {
        const parsed = JSON.parse(event.data) as DashboardQbittorrentStatusResponse;
        setLiveData(parsed);
      } catch (error) {
        console.error('Failed to parse qBittorrent stream payload', error);
      }
    };
    source.onerror = () => {
      setStreamConnected(false);
    };

    return () => {
      source.close();
      setStreamConnected(false);
    };
  }, []);

  const data = liveData;
  const torrents = data?.torrents ?? [];
  const shouldShowEmpty = !isLoading && (!data || !data.enabled);
  const statusLabel = useMemo(() => {
    if (!data?.enabled) return t('dashboard.qbittorrent.notConnectedTitle');
    if (!data.connected) return t('dashboard.qbittorrent.disconnected');
    return streamConnected ? t('dashboard.qbittorrent.live') : t('dashboard.qbittorrent.polling');
  }, [data?.enabled, data?.connected, streamConnected, t]);

  return (
    <section className="h-full relative overflow-hidden rounded-3xl border border-sky-300/60 dark:border-sky-200/30 bg-gradient-to-br from-[#c2e8fc] via-[#b1c4f9] to-[#a7a2d6] dark:from-sky-700 dark:via-blue-700 dark:to-indigo-700 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-sky-950/70 dark:text-sky-200/90">
            {t('dashboard.qbittorrent.kicker')}
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-sky-950 dark:text-sky-50">
            {t('dashboard.qbittorrent.title')}
          </h3>
          <p className="text-sm text-sky-900/70 dark:text-sky-100/90 mt-1">{t('dashboard.qbittorrent.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.enabled ? (
            <button
              type="button"
              onClick={() => setManagerOpen(true)}
              disabled={!data.connected}
              className="rounded-full border border-sky-950/20 dark:border-sky-200/40 bg-black/10 dark:bg-black/20 px-3 py-1 text-xs font-medium text-sky-950 dark:text-sky-100 hover:bg-black/20 dark:hover:bg-black/30 disabled:opacity-60"
            >
              {t('dashboard.qbittorrent.manage', 'Manage')}
            </button>
          ) : null}
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-sky-950 dark:text-sky-100">
            {statusLabel}
          </span>
        </div>
      </div>

      {shouldShowEmpty ? (
        <div className="mt-5 rounded-2xl border border-sky-500/40 dark:border-sky-300/40 bg-sky-100/55 dark:bg-sky-100/15 p-4 text-sky-950 dark:text-sky-100">
          <p className="font-medium">{t('dashboard.qbittorrent.notConnectedTitle')}</p>
          <p className="text-sm text-sky-950/80 dark:text-sky-100/90 mt-1">
            {t('dashboard.qbittorrent.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.active')}</p>
              <p className="text-xl font-semibold text-sky-950 dark:text-white">
                {data?.summary.downloading_count ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.stalled')}</p>
              <p className="text-xl font-semibold text-sky-950 dark:text-white">{data?.summary.stalled_count ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.downloadSpeed')}</p>
              <p className="text-xl font-semibold text-sky-950 dark:text-white">
                {formatSpeed(data?.summary.download_speed ?? 0)}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.uploadSpeed')}</p>
              <p className="text-xl font-semibold text-sky-950 dark:text-white">
                {formatSpeed(data?.summary.upload_speed ?? 0)}
              </p>
            </div>
          </div>

          <Collapsible open={showTorrents} onOpenChange={setShowTorrents} className="mt-5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center rounded-full border border-sky-950/20 dark:border-sky-200/40 bg-black/10 dark:bg-black/20 px-3 py-1.5 text-xs font-medium text-sky-950 dark:text-sky-100 hover:bg-black/20 dark:hover:bg-black/30"
              >
                {showTorrents ? t('dashboard.qbittorrent.hideTorrents') : t('dashboard.qbittorrent.showTorrents')}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {torrents.length > 0 ? (
                torrents.map(torrent => (
                  <div key={torrent.id} className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-sky-950 dark:text-white">{torrent.name}</p>
                      <p className="text-xs text-sky-900 dark:text-sky-100 whitespace-nowrap">
                        {Math.round(torrent.progress * 100)}%
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-sky-950/20 dark:bg-sky-100/30">
                      <div
                        className="h-full rounded-full bg-sky-900 dark:bg-sky-200"
                        style={{ width: `${Math.min(100, Math.max(0, torrent.progress * 100))}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-sky-950/85 dark:text-sky-100/90">
                      <span>{formatSpeed(torrent.download_speed)}</span>
                      <span>
                        {formatTorrentState(torrent.state, t)}
                        {DOWNLOADING_STATES.has(torrent.state.toLowerCase())
                          ? ` • ${formatEta(torrent.eta_seconds)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl bg-black/10 dark:bg-black/20 p-4 text-sm text-sky-950 dark:text-sky-100">
                  {t('dashboard.qbittorrent.emptyTitle')}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {data?.error && <p className="mt-4 text-xs text-sky-950/85 dark:text-sky-100/90">{data.error}</p>}
        </>
      )}

      <QbittorrentManagerDialog isOpen={managerOpen} onClose={() => setManagerOpen(false)} />
    </section>
  );
}
