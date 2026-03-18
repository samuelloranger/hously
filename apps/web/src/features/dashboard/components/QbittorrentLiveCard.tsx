import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  formatSpeed,
  useDashboardQbittorrentStatus,
} from '@hously/shared';
import { usePrefetchRoute } from '@/hooks/usePrefetchRoute';

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
      <section className="relative border border-emerald-300/60 dark:border-emerald-500/30 bg-gradient-to-br from-[#d1fae5] via-[#6ee7b7] to-[#059669] dark:from-[#022c22] dark:via-[#064e3b] dark:to-[#047857] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-emerald-950/70 dark:text-emerald-200/90">
              {t('dashboard.qbittorrent.kicker')}
            </p>
            <h3 className="text-base md:text-lg font-bold text-emerald-950 dark:text-emerald-50">
              {t('dashboard.qbittorrent.title')}
            </h3>
            <p className="text-[10px] text-emerald-900/70 dark:text-emerald-100/90 mt-1">
              {t('dashboard.qbittorrent.subtitle')}
            </p>
            <p className="text-[11px] text-emerald-900/70 dark:text-emerald-100/80 mt-2">
              {t('dashboard.qbittorrent.openTorrents', 'Open Torrents')}
            </p>
          </div>
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-[11px] font-medium text-emerald-950 dark:text-emerald-100">
            {statusLabel}
          </span>
        </div>

        {shouldShowEmpty ? (
          <div className="mt-5 rounded-2xl border border-emerald-500/40 dark:border-emerald-400/40 bg-emerald-100/55 dark:bg-emerald-100/10 p-4 text-emerald-950 dark:text-emerald-100">
            <p className="font-medium">{t('dashboard.qbittorrent.notConnectedTitle')}</p>
            <p className="text-xs text-emerald-950/80 dark:text-emerald-100/90 mt-1">
              {t('dashboard.qbittorrent.notConnectedDescription')}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                  {t('dashboard.qbittorrent.active')}
                </p>
                <p className="text-xs font-semibold text-emerald-950 dark:text-white">
                  {data?.summary.downloading_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                  {t('dashboard.qbittorrent.stalled')}
                </p>
                <p className="text-xs font-semibold text-emerald-950 dark:text-white">
                  {data?.summary.stalled_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                  {t('dashboard.qbittorrent.downloadSpeed')}
                </p>
                <p className="text-xs font-semibold text-emerald-950 dark:text-white">
                  {formatSpeed(data?.summary.download_speed ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                  {t('dashboard.qbittorrent.uploadSpeed')}
                </p>
                <p className="text-xs font-semibold text-emerald-950 dark:text-white">
                  {formatSpeed(data?.summary.upload_speed ?? 0)}
                </p>
              </div>
            </div>

            {data?.error && <p className="mt-4 text-[11px] text-emerald-950/85 dark:text-emerald-100/90">{data.error}</p>}
          </>
        )}
      </section>
    </Link>
  );
}
