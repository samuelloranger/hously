import { useTranslation } from 'react-i18next';
import { useDashboardAdguardSummary, useSetAdguardProtection } from '@hously/shared';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

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
  const setAdguardProtection = useSetAdguardProtection();
  const { user } = useAuth();
  const prefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });

  const showNotConnected = !isLoading && (!data || !data.enabled || !data.connected);
  const canToggleProtection = Boolean(user?.is_admin) && !showNotConnected && data;
  const toggleError = setAdguardProtection.error instanceof Error ? setAdguardProtection.error.message : null;

  const handleToggleProtection = () => {
    if (!data || setAdguardProtection.isPending) return;
    setAdguardProtection.mutate({ enabled: !data.protection_enabled });
  };

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-orange-300/60 dark:border-orange-200/40 bg-gradient-to-br from-[#fff0d6] via-[#fcd097] to-[#f59e0b] dark:from-orange-950/70 dark:via-orange-900/60 dark:to-amber-900/60 p-4 shadow-xl"
      {...prefetchIntent}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-orange-950/70 dark:text-orange-200/90">
            {t('dashboard.adguard.kicker')}
          </p>
          <h3 className="text-base md:text-lg font-bold text-orange-950 dark:text-orange-50">
            {t('dashboard.adguard.title')}
          </h3>
          <p className="text-[10px] text-orange-900/70 dark:text-orange-100/90 mt-1">{t('dashboard.adguard.subtitle')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-[11px] font-medium text-orange-950 dark:text-orange-100">
            {showNotConnected
              ? t('dashboard.adguard.disconnected')
              : data?.protection_enabled
                ? t('dashboard.adguard.protectionOn')
                : t('dashboard.adguard.protectionOff')}
          </span>
          {canToggleProtection ? (
            <Button
              type="button"
              size="sm"
              variant={data?.protection_enabled ? 'outline' : 'default'}
              className="h-8 rounded-full border-white/40 bg-white/70 px-3 text-xs text-orange-950 hover:bg-white dark:border-orange-200/40 dark:bg-orange-950/25 dark:text-orange-50 dark:hover:bg-orange-950/40"
              onClick={handleToggleProtection}
              disabled={setAdguardProtection.isPending}
            >
              {setAdguardProtection.isPending
                ? t('dashboard.adguard.updating')
                : data?.protection_enabled
                  ? t('dashboard.adguard.turnOff')
                  : t('dashboard.adguard.turnOn')}
            </Button>
          ) : null}
        </div>
      </div>

      {showNotConnected ? (
        <div className="mt-5 rounded-2xl border border-orange-500/40 dark:border-orange-300/40 bg-orange-100/55 dark:bg-orange-100/15 p-4 text-orange-950 dark:text-orange-100">
          <p className="font-medium">{t('dashboard.adguard.notConnectedTitle')}</p>
          <p className="text-xs text-orange-950/80 dark:text-orange-100/90 mt-1">
            {t('dashboard.adguard.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-orange-950/75 dark:text-orange-200/80">{t('dashboard.adguard.queries')}</p>
              <p className="text-xs font-semibold text-orange-950 dark:text-white">
                {data?.summary.dns_queries.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-orange-950/75 dark:text-orange-200/80">{t('dashboard.adguard.blocked')}</p>
              <p className="text-xs font-semibold text-orange-950 dark:text-white">
                {data?.summary.blocked_queries.toLocaleString() ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-orange-950/75 dark:text-orange-200/80">{t('dashboard.adguard.blockRate')}</p>
              <p className="text-xs font-semibold text-orange-950 dark:text-white">
                {formatPercent(data?.summary.blocked_ratio ?? null)}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-orange-950/75 dark:text-orange-200/80">{t('dashboard.adguard.avgTime')}</p>
              <p className="text-xs font-semibold text-orange-950 dark:text-white">
                {formatProcessingTime(data?.summary.avg_processing_time_ms ?? null)}
              </p>
            </div>
          </div>

          {(toggleError || data?.error) && (
            <p className="mt-4 text-[11px] text-orange-950/85 dark:text-orange-100/90">{toggleError || data?.error}</p>
          )}
        </>
      )}
    </section>
  );
}
