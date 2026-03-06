import { useTranslation } from 'react-i18next';
import {
  useDashboardC411Stats,
  useDashboardLaCaleStats,
  useDashboardTorr9Stats,
} from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';
import { formatGo, formatRatio } from '@hously/shared/utils/trackers';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

type TrackerCardData = {
  key: 'c411' | 'torr9' | 'la-cale';
  label: string;
  enabled: boolean;
  connected: boolean;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  previous_uploaded_go?: number | null;
  previous_downloaded_go?: number | null;
  previous_ratio?: number | null;
  updated_at: string | null;
  error?: string;
};

export function TrackerStatsCard() {
  const { t, i18n } = useTranslation('common');
  const locale = resolveDateFnsLocale(i18n.language);
  const prefetchRoute = usePrefetchRoute();

  const c411 = useDashboardC411Stats();
  const torr9 = useDashboardTorr9Stats();
  const laCale = useDashboardLaCaleStats();

  const isLoading = c411.isLoading || torr9.isLoading || laCale.isLoading;

  const trackers: TrackerCardData[] = [
    {
      key: 'c411',
      label: t('dashboard.trackers.providers.c411'),
      enabled: Boolean(c411.data?.enabled),
      connected: Boolean(c411.data?.connected),
      uploaded_go: c411.data?.uploaded_go ?? null,
      downloaded_go: c411.data?.downloaded_go ?? null,
      ratio: c411.data?.ratio ?? null,
      previous_uploaded_go: c411.data?.previous_uploaded_go,
      previous_downloaded_go: c411.data?.previous_downloaded_go,
      previous_ratio: c411.data?.previous_ratio,
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
      previous_uploaded_go: torr9.data?.previous_uploaded_go,
      previous_downloaded_go: torr9.data?.previous_downloaded_go,
      previous_ratio: torr9.data?.previous_ratio,
      updated_at: torr9.data?.updated_at ?? null,
      error: torr9.data?.error,
    },
    {
      key: 'la-cale',
      label: t('dashboard.trackers.providers.la-cale'),
      enabled: Boolean(laCale.data?.enabled),
      connected: Boolean(laCale.data?.connected),
      uploaded_go: laCale.data?.uploaded_go ?? null,
      downloaded_go: laCale.data?.downloaded_go ?? null,
      ratio: laCale.data?.ratio ?? null,
      previous_uploaded_go: laCale.data?.previous_uploaded_go,
      previous_downloaded_go: laCale.data?.previous_downloaded_go,
      previous_ratio: laCale.data?.previous_ratio,
      updated_at: laCale.data?.updated_at ?? null,
      error: laCale.data?.error,
    },
  ];

  const connectedCount = trackers.filter(item => item.enabled && item.connected).length;
  const anyConnected = connectedCount > 0;

  const renderDelta = (current: number | null, previous: number | null | undefined, isRatio = false) => {
    if (current === null || previous === null || previous === undefined || current === previous) return null;
    const delta = current - previous;
    if (Math.abs(delta) < 0.001) return null;

    const sign = delta > 0 ? '+' : '';
    const value = isRatio ? delta.toFixed(2) : formatGo(delta);
    const colorClass = delta > 0 ? 'text-emerald-950/70 dark:text-emerald-400' : 'text-rose-950/70 dark:text-rose-400';

    return (
      <span className={`text-[10px] font-medium leading-none ${colorClass}`}>
        {sign}
        {value}
      </span>
    );
  };

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-emerald-300/60 dark:border-emerald-200/30 bg-gradient-to-br from-[#c9f7da] via-[#74d2a1] to-[#b7f3ee] dark:from-emerald-900/70 dark:via-emerald-900/60 dark:to-teal-900/60 p-4 shadow-xl"
      onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
      onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-950/70 dark:text-emerald-200/90">
            {t('dashboard.trackers.kicker')}
          </p>
          <h3 className="text-lg md:text-xl font-bold text-emerald-950 dark:text-emerald-50">
            {t('dashboard.trackers.title')}
          </h3>
          <p className="text-[11px] text-emerald-900/70 dark:text-emerald-100/90 mt-1">
            {t('dashboard.trackers.subtitle')}
          </p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-emerald-950 dark:text-emerald-100">
          {anyConnected
            ? t('dashboard.trackers.connected', { count: connectedCount, total: trackers.length })
            : t('dashboard.trackers.disconnected')}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {isLoading
          ? trackers.map(item => (
              <article key={item.key} className="rounded-lg bg-black/10 dark:bg-black/20 p-2.5 animate-pulse">
                <div className="h-3.5 w-14 rounded bg-black/20 dark:bg-black/30 mb-2" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-6 rounded bg-black/20 dark:bg-black/30" />
                  <div className="h-6 rounded bg-black/20 dark:bg-black/30" />
                  <div className="h-6 rounded bg-black/20 dark:bg-black/30" />
                </div>
              </article>
            ))
          : trackers.map(item => {
              const updatedLabel = item.connected ? formatRelativeTime(item.updated_at, { locale }) : null;
              const showUnavailable = !item.enabled || !item.connected;

              return (
                <article key={item.key} className="rounded-lg bg-black/10 dark:bg-black/20 p-2.5">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <p className="text-xs font-semibold text-emerald-950 dark:text-white truncate">{item.label}</p>
                    <span className="text-[9px] shrink-0 text-emerald-950/70 dark:text-emerald-100/80">
                      {showUnavailable ? t('dashboard.trackers.disconnected') : t('dashboard.trackers.connectedSimple')}
                    </span>
                  </div>

                  {showUnavailable ? (
                    <p className="text-[10px] leading-tight text-emerald-950/85 dark:text-emerald-100/90">
                      {item.error || t('dashboard.trackers.notConnectedDescription')}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.uploaded')}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-emerald-950 dark:text-white leading-none">{formatGo(item.uploaded_go)}</span>
                          {renderDelta(item.uploaded_go, item.previous_uploaded_go)}
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.downloaded')}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-emerald-950 dark:text-white leading-none">{formatGo(item.downloaded_go)}</span>
                          {renderDelta(item.downloaded_go, item.previous_downloaded_go)}
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <p className="text-[10px] text-emerald-950/75 dark:text-emerald-200/80">
                          {t('dashboard.trackers.ratio')}
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs font-semibold text-emerald-950 dark:text-white leading-none">{formatRatio(item.ratio)}</span>
                          {renderDelta(item.ratio, item.previous_ratio, true)}
                        </div>
                      </div>
                    </div>
                  )}

                  {updatedLabel ? (
                    <p className="text-[9px] text-emerald-950/70 dark:text-emerald-100/80 mt-1.5">
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
