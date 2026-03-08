import { useTranslation } from 'react-i18next';
import { useDashboardAdguardSummary } from '@hously/shared';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

const formatPercent = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value.toFixed(1)}%`;
};

const formatProcessingTime = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value.toFixed(1)} ms`;
};

export function AdguardOverviewCard() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useDashboardAdguardSummary();
  const prefetchRoute = usePrefetchRoute();

  const showNotConnected = !isLoading && (!data || !data.enabled || !data.connected);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-sky-300/60 dark:border-sky-200/40 bg-gradient-to-br from-[#d7f1ff] via-[#a9dfff] to-[#c9f4df] dark:from-sky-800 dark:via-cyan-800 dark:to-emerald-800 p-4 shadow-xl"
      onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
      onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-sky-950/70 dark:text-sky-200/90">
            {t('dashboard.adguard.kicker')}
          </p>
          <h3 className="text-base md:text-lg font-bold text-sky-950 dark:text-sky-50">
            {t('dashboard.adguard.title')}
          </h3>
          <p className="text-[10px] text-sky-900/70 dark:text-sky-100/90 mt-1">{t('dashboard.adguard.subtitle')}</p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-[11px] font-medium text-sky-950 dark:text-sky-100">
          {showNotConnected
            ? t('dashboard.adguard.disconnected')
            : data?.protection_enabled
              ? t('dashboard.adguard.protectionOn')
              : t('dashboard.adguard.protectionOff')}
        </span>
      </div>

      {showNotConnected ? (
        <div className="mt-5 rounded-2xl border border-sky-500/40 dark:border-sky-300/40 bg-sky-100/55 dark:bg-sky-100/15 p-4 text-sky-950 dark:text-sky-100">
          <p className="font-medium">{t('dashboard.adguard.notConnectedTitle')}</p>
          <p className="text-xs text-sky-950/80 dark:text-sky-100/90 mt-1">
            {t('dashboard.adguard.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-sky-950/75 dark:text-sky-200/80">{t('dashboard.adguard.queries')}</p>
              <p className="text-xs font-semibold text-sky-950 dark:text-white">
                {data?.summary.dns_queries.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-sky-950/75 dark:text-sky-200/80">{t('dashboard.adguard.blocked')}</p>
              <p className="text-xs font-semibold text-sky-950 dark:text-white">
                {data?.summary.blocked_queries.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-sky-950/75 dark:text-sky-200/80">{t('dashboard.adguard.blockRate')}</p>
              <p className="text-xs font-semibold text-sky-950 dark:text-white">
                {formatPercent(data?.summary.blocked_ratio ?? null)}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-sky-950/75 dark:text-sky-200/80">{t('dashboard.adguard.avgTime')}</p>
              <p className="text-xs font-semibold text-sky-950 dark:text-white">
                {formatProcessingTime(data?.summary.avg_processing_time_ms ?? null)}
              </p>
            </div>
          </div>

          {data?.error && <p className="mt-4 text-[11px] text-sky-950/85 dark:text-sky-100/90">{data.error}</p>}
        </>
      )}
    </section>
  );
}
