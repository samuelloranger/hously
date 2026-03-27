import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardQbittorrentStatusResponse,
  DASHBOARD_ENDPOINTS,
  formatSpeed,
  useQbittorrentStatus,
} from '@hously/shared';
import { useEventSourceState } from '@/hooks/useEventSourceState';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

export function QbittorrentLiveCard() {
  const { t } = useTranslation('common');
  const { data: fallbackData, isLoading } = useQbittorrentStatus();
  const prefetchIntent = usePrefetchIntent('/torrents');
  const { data, streamConnected } = useEventSourceState<DashboardQbittorrentStatusResponse>({
    url: DASHBOARD_ENDPOINTS.QBITTORRENT.STREAM,
    initialData: fallbackData,
    treatInitialDataAsConnected: Boolean(fallbackData?.connected),
    onParseError: error => {
      console.error('Failed to parse qBittorrent stream payload', error);
    },
  });
  const shouldShowEmpty = !isLoading && (!data || !data.enabled);
  const statusLabel = useMemo(() => {
    if (!data?.enabled) return t('dashboard.qbittorrent.notConnectedTitle');
    if (!data.connected) return t('dashboard.qbittorrent.disconnected');
    return streamConnected ? t('dashboard.qbittorrent.live') : t('dashboard.qbittorrent.polling');
  }, [data?.enabled, data?.connected, streamConnected, t]);

  return (
    <Link
      to="/torrents"
      {...prefetchIntent}
      className="block rounded-3xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
    >
      <section className="relative border border-teal-300/60 dark:border-teal-500/30 bg-gradient-to-br from-[#ccfbf1] via-[#5eead4] to-[#0d9488] dark:from-[#042f2e] dark:via-[#0f4e4b] dark:to-[#115e59] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] uppercase tracking-[0.22em] text-teal-950/70 dark:text-teal-200/90">
              {t('dashboard.qbittorrent.kicker')}
            </p>
            <h3 className="text-base md:text-lg font-bold text-teal-950 dark:text-teal-50">
              {t('dashboard.qbittorrent.title')}
            </h3>
            <p className="text-[10px] text-teal-900/70 dark:text-teal-100/90 mt-1">
              {t('dashboard.qbittorrent.subtitle')}
            </p>
            <p className="text-[11px] text-teal-900/70 dark:text-teal-100/80 mt-2">
              {t('dashboard.qbittorrent.openTorrents', 'Open Torrents')}
            </p>
          </div>
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-[11px] font-medium text-teal-950 dark:text-teal-100">
            {statusLabel}
          </span>
        </div>

        {shouldShowEmpty ? (
          <div className="mt-5 rounded-2xl border border-teal-500/40 dark:border-teal-400/40 bg-teal-100/55 dark:bg-teal-100/10 p-4 text-teal-950 dark:text-teal-100">
            <p className="font-medium">{t('dashboard.qbittorrent.notConnectedTitle')}</p>
            <p className="text-xs text-teal-950/80 dark:text-teal-100/90 mt-1">
              {t('dashboard.qbittorrent.notConnectedDescription')}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-teal-950/75 dark:text-teal-200/80">
                  {t('dashboard.qbittorrent.active')}
                </p>
                <p className="text-xs font-semibold text-teal-950 dark:text-white">
                  {data?.summary.downloading_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-teal-950/75 dark:text-teal-200/80">
                  {t('dashboard.qbittorrent.stalled')}
                </p>
                <p className="text-xs font-semibold text-teal-950 dark:text-white">
                  {data?.summary.stalled_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-teal-950/75 dark:text-teal-200/80">
                  {t('dashboard.qbittorrent.downloadSpeed')}
                </p>
                <p className="text-xs font-semibold text-teal-950 dark:text-white">
                  {formatSpeed(data?.summary.download_speed ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                <p className="text-[11px] text-teal-950/75 dark:text-teal-200/80">
                  {t('dashboard.qbittorrent.uploadSpeed')}
                </p>
                <p className="text-xs font-semibold text-teal-950 dark:text-white">
                  {formatSpeed(data?.summary.upload_speed ?? 0)}
                </p>
              </div>
            </div>

            {data?.error && <p className="mt-4 text-[11px] text-teal-950/85 dark:text-teal-100/90">{data.error}</p>}
          </>
        )}
      </section>
    </Link>
  );
}
