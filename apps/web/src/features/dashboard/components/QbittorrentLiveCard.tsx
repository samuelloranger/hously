import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  useDashboardQbittorrentStatus,
} from '@hously/shared';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

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
  const prefetchRoute = usePrefetchRoute();
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
      onMouseEnter={() => prefetchRoute('/torrents')}
      onTouchStart={() => prefetchRoute('/torrents')}
      className="block rounded-3xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
    >
      <section className="relative border border-orange-300/60 dark:border-orange-500/30 bg-gradient-to-br from-[#fde8d8] via-[#fbc8a0] to-[#f4845a] dark:from-[#431407] dark:via-[#7c2d12] dark:to-[#c2410c] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-orange-950/70 dark:text-orange-200/90">
              {t('dashboard.qbittorrent.kicker')}
            </p>
            <h3 className="text-xl md:text-2xl font-bold text-orange-950 dark:text-orange-50">
              {t('dashboard.qbittorrent.title')}
            </h3>
            <p className="text-xs text-orange-900/70 dark:text-orange-100/90 mt-1">
              {t('dashboard.qbittorrent.subtitle')}
            </p>
            <p className="text-xs text-orange-900/70 dark:text-orange-100/80 mt-2">
              {t('dashboard.qbittorrent.openTorrents', 'Open Torrents')}
            </p>
          </div>
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-orange-950 dark:text-orange-100">
            {statusLabel}
          </span>
        </div>

        {shouldShowEmpty ? (
          <div className="mt-5 rounded-2xl border border-orange-500/40 dark:border-orange-400/40 bg-orange-100/55 dark:bg-orange-100/10 p-4 text-orange-950 dark:text-orange-100">
            <p className="font-medium">{t('dashboard.qbittorrent.notConnectedTitle')}</p>
            <p className="text-sm text-orange-950/80 dark:text-orange-100/90 mt-1">
              {t('dashboard.qbittorrent.notConnectedDescription')}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-orange-950/75 dark:text-orange-200/80">
                  {t('dashboard.qbittorrent.active')}
                </p>
                <p className="text-base font-semibold text-orange-950 dark:text-white">
                  {data?.summary.downloading_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-orange-950/75 dark:text-orange-200/80">
                  {t('dashboard.qbittorrent.stalled')}
                </p>
                <p className="text-base font-semibold text-orange-950 dark:text-white">
                  {data?.summary.stalled_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-orange-950/75 dark:text-orange-200/80">
                  {t('dashboard.qbittorrent.downloadSpeed')}
                </p>
                <p className="text-base font-semibold text-orange-950 dark:text-white">
                  {formatSpeed(data?.summary.download_speed ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-xs text-orange-950/75 dark:text-orange-200/80">
                  {t('dashboard.qbittorrent.uploadSpeed')}
                </p>
                <p className="text-base font-semibold text-orange-950 dark:text-white">
                  {formatSpeed(data?.summary.upload_speed ?? 0)}
                </p>
              </div>
            </div>

            {data?.error && <p className="mt-4 text-xs text-orange-950/85 dark:text-orange-100/90">{data.error}</p>}
          </>
        )}
      </section>
    </Link>
  );
}
