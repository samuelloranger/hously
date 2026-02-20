import { useTranslation } from 'react-i18next';
import {
  useDashboardC411Stats,
  useDashboardG3miniStats,
  useDashboardLaCaleStats,
  useDashboardTorr9Stats,
  useDashboardYggStats,
} from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';
import { formatGo, formatRatio } from '@hously/shared/utils/ygg';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

type TrackerCardData = {
  key: 'ygg' | 'c411' | 'torr9' | 'g3mini' | 'la-cale';
  label: string;
  enabled: boolean;
  connected: boolean;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  updated_at: string | null;
  error?: string;
};

export function TrackerStatsCard() {
  const { t, i18n } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);
  const prefetchRoute = usePrefetchRoute();

  const ygg = useDashboardYggStats();
  const c411 = useDashboardC411Stats();
  const torr9 = useDashboardTorr9Stats();
  const g3mini = useDashboardG3miniStats();
  const laCale = useDashboardLaCaleStats();

  const isLoading = ygg.isLoading || c411.isLoading || torr9.isLoading || g3mini.isLoading || laCale.isLoading;

  const trackers: TrackerCardData[] = [
    {
      key: 'ygg',
      label: t('dashboard.trackers.providers.ygg'),
      enabled: Boolean(ygg.data?.enabled),
      connected: Boolean(ygg.data?.connected),
      uploaded_go: ygg.data?.uploaded_go ?? null,
      downloaded_go: ygg.data?.downloaded_go ?? null,
      ratio: ygg.data?.ratio ?? null,
      updated_at: ygg.data?.updated_at ?? null,
      error: ygg.data?.error,
    },
    {
      key: 'c411',
      label: t('dashboard.trackers.providers.c411'),
      enabled: Boolean(c411.data?.enabled),
      connected: Boolean(c411.data?.connected),
      uploaded_go: c411.data?.uploaded_go ?? null,
      downloaded_go: c411.data?.downloaded_go ?? null,
      ratio: c411.data?.ratio ?? null,
      updated_at: c411.data?.updated_at ?? null,
      error: c411.data?.error,
    },
    {
      key: 'torr9',
      label: t('dashboard.trackers.providers.torr9'),
      enabled: Boolean(torr9.data?.enabled),
      connected: Boolean(torr9.data?.connected),
      uploaded_go: torr9.data?.uploaded_go ?? null,
      downloaded_go: torr9.data?.downloaded_go ?? null,
      ratio: torr9.data?.ratio ?? null,
      updated_at: torr9.data?.updated_at ?? null,
      error: torr9.data?.error,
    },
    {
      key: 'g3mini',
      label: t('dashboard.trackers.providers.g3mini'),
      enabled: Boolean(g3mini.data?.enabled),
      connected: Boolean(g3mini.data?.connected),
      uploaded_go: g3mini.data?.uploaded_go ?? null,
      downloaded_go: g3mini.data?.downloaded_go ?? null,
      ratio: g3mini.data?.ratio ?? null,
      updated_at: g3mini.data?.updated_at ?? null,
      error: g3mini.data?.error,
    },
    {
      key: 'la-cale',
      label: t('dashboard.trackers.providers.la-cale'),
      enabled: Boolean(laCale.data?.enabled),
      connected: Boolean(laCale.data?.connected),
      uploaded_go: laCale.data?.uploaded_go ?? null,
      downloaded_go: laCale.data?.downloaded_go ?? null,
      ratio: laCale.data?.ratio ?? null,
      updated_at: laCale.data?.updated_at ?? null,
      error: laCale.data?.error,
    },
  ];

  const connectedCount = trackers.filter(item => item.enabled && item.connected).length;
  const anyConnected = connectedCount > 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-emerald-300/60 dark:border-emerald-200/30 bg-gradient-to-br from-[#c9f7da] via-[#74d2a1] to-[#b7f3ee] dark:from-emerald-900/70 dark:via-emerald-900/60 dark:to-teal-900/60 p-6 shadow-xl"
      onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
      onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-950/70 dark:text-emerald-200/90">
            {t('dashboard.trackers.kicker')}
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-emerald-950 dark:text-emerald-50">
            {t('dashboard.trackers.title')}
          </h3>
          <p className="text-sm text-emerald-900/70 dark:text-emerald-100/90 mt-1">
            {t('dashboard.trackers.subtitle')}
          </p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-emerald-950 dark:text-emerald-100">
          {anyConnected
            ? t('dashboard.trackers.connected', { count: connectedCount, total: trackers.length })
            : t('dashboard.trackers.disconnected')}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading
          ? trackers.map(item => (
              <article key={item.key} className="rounded-xl bg-black/10 dark:bg-black/20 p-3 animate-pulse">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="h-4 w-16 rounded bg-black/20 dark:bg-black/30" />
                  <div className="h-3 w-12 rounded bg-black/20 dark:bg-black/30" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-8 rounded bg-black/20 dark:bg-black/30" />
                  <div className="h-8 rounded bg-black/20 dark:bg-black/30" />
                  <div className="h-8 rounded bg-black/20 dark:bg-black/30" />
                </div>
              </article>
            ))
          : trackers.map(item => {
              const updatedLabel = item.connected ? formatRelativeTime(item.updated_at, { locale }) : null;
              const showUnavailable = !item.enabled || !item.connected;

              return (
                <article key={item.key} className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-emerald-950 dark:text-white">{item.label}</p>
                    <span className="text-[11px] text-emerald-950/80 dark:text-emerald-100/90">
                      {showUnavailable ? t('dashboard.trackers.disconnected') : t('dashboard.trackers.connectedSimple')}
                    </span>
                  </div>

                  {showUnavailable ? (
                    <p className="text-xs text-emerald-950/85 dark:text-emerald-100/90">
                      {item.error || t('dashboard.trackers.notConnectedDescription')}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.uploaded')}
                        </p>
                        <p className="text-sm font-semibold text-emerald-950 dark:text-white">
                          {formatGo(item.uploaded_go)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.downloaded')}
                        </p>
                        <p className="text-sm font-semibold text-emerald-950 dark:text-white">
                          {formatGo(item.downloaded_go)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.ratio')}
                        </p>
                        <p className="text-sm font-semibold text-emerald-950 dark:text-white">
                          {formatRatio(item.ratio)}
                        </p>
                      </div>
                    </div>
                  )}

                  {updatedLabel ? (
                    <p className="text-[11px] text-emerald-950/80 dark:text-emerald-100/90 mt-2">
                      {t('dashboard.trackers.updated', { value: updatedLabel })}
                    </p>
                  ) : null}
                </article>
              );
            })}
      </div>
    </section>
  );
}
