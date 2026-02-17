import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  useDashboardQbittorrentStatus,
} from '@hously/shared';

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
};

const formatSpeed = (bytesPerSecond: number): string => `${formatBytes(bytesPerSecond)}/s`;

export function QbittorrentLiveCard() {
  const { t } = useTranslation('common');
  const { data: fallbackData, isLoading } = useDashboardQbittorrentStatus();
  const [liveData, setLiveData] = useState<DashboardQbittorrentStatusResponse | null>(null);
  const [streamConnected, setStreamConnected] = useState(false);

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
  const shouldShowEmpty = !isLoading && (!data || !data.enabled);
  const statusLabel = useMemo(() => {
    if (!data?.enabled) return t('dashboard.qbittorrent.notConnectedTitle');
    if (!data.connected) return t('dashboard.qbittorrent.disconnected');
    return streamConnected ? t('dashboard.qbittorrent.live') : t('dashboard.qbittorrent.polling');
  }, [data?.enabled, data?.connected, streamConnected, t]);

  return (
    <Link
      to="/torrents"
      className="block h-full rounded-3xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
    >
      <section className="h-full relative border border-sky-300/60 dark:border-sky-200/30 bg-gradient-to-br from-[#c2e8fc] via-[#b1c4f9] to-[#a7a2d6] dark:from-sky-700 dark:via-blue-700 dark:to-indigo-700 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-sky-950/70 dark:text-sky-200/90">
              {t('dashboard.qbittorrent.kicker')}
            </p>
            <h3 className="text-2xl md:text-3xl font-bold text-sky-950 dark:text-sky-50">
              {t('dashboard.qbittorrent.title')}
            </h3>
            <p className="text-sm text-sky-900/70 dark:text-sky-100/90 mt-1">{t('dashboard.qbittorrent.subtitle')}</p>
            <p className="text-xs text-sky-900/70 dark:text-sky-100/80 mt-2">
              {t('dashboard.qbittorrent.openTorrents', 'Open Torrents')}
            </p>
          </div>
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-sky-950 dark:text-sky-100">
            {statusLabel}
          </span>
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
                <p className="text-xl font-semibold text-sky-950 dark:text-white">{data?.summary.downloading_count ?? 0}</p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.stalled')}</p>
                <p className="text-xl font-semibold text-sky-950 dark:text-white">{data?.summary.stalled_count ?? 0}</p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.downloadSpeed')}</p>
                <p className="text-xl font-semibold text-sky-950 dark:text-white">{formatSpeed(data?.summary.download_speed ?? 0)}</p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-sky-950/75 dark:text-sky-200/80">{t('dashboard.qbittorrent.uploadSpeed')}</p>
                <p className="text-xl font-semibold text-sky-950 dark:text-white">{formatSpeed(data?.summary.upload_speed ?? 0)}</p>
              </div>
            </div>

            {data?.error && <p className="mt-4 text-xs text-sky-950/85 dark:text-sky-100/90">{data.error}</p>}
          </>
        )}
      </section>
    </Link>
  );
}
