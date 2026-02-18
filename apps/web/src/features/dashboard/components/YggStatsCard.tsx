import { useTranslation } from 'react-i18next';
import { useDashboardYggStats } from '@hously/shared';
import { formatRelativeTime, resolveDateFnsLocale } from '@hously/shared/utils/relativeTime';

const formatGo = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--';
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} Go`;
};

const formatRatio = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--';
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return value.toFixed(digits);
};

export function YggStatsCard() {
  const { t, i18n } = useTranslation('common');
  const { data, isLoading } = useDashboardYggStats();
  const locale = resolveDateFnsLocale(i18n.language);

  const showNotConnected = !isLoading && (!data || !data.enabled || !data.connected);
  const updatedLabel = !showNotConnected ? formatRelativeTime(data?.updated_at ?? null, { locale }) : null;

  return (
    <section className="h-full relative overflow-hidden rounded-3xl border border-emerald-300/60 dark:border-emerald-200/30 bg-gradient-to-br from-[#c9f7da] via-[#74d2a1] to-[#b7f3ee] dark:from-emerald-900/70 dark:via-emerald-900/60 dark:to-teal-900/60 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-950/70 dark:text-emerald-200/90">
            {t('dashboard.ygg.kicker')}
          </p>
          <h3 className="text-2xl md:text-3xl font-bold text-emerald-950 dark:text-emerald-50">
            {t('dashboard.ygg.title')}
          </h3>
          <p className="text-sm text-emerald-900/70 dark:text-emerald-100/90 mt-1">{t('dashboard.ygg.subtitle')}</p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-emerald-950 dark:text-emerald-100">
          {showNotConnected ? t('dashboard.ygg.disconnected') : t('dashboard.ygg.connected')}
        </span>
      </div>

      {showNotConnected ? (
        <div className="mt-5 rounded-2xl border border-emerald-500/35 dark:border-emerald-200/35 bg-emerald-100/55 dark:bg-emerald-100/10 p-4 text-emerald-950 dark:text-emerald-100">
          <p className="font-medium">{t('dashboard.ygg.notConnectedTitle')}</p>
          <p className="text-sm text-emerald-950/80 dark:text-emerald-100/90 mt-1">
            {t('dashboard.ygg.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-emerald-950/75 dark:text-emerald-200/80">{t('dashboard.ygg.uploaded')}</p>
              <p className="text-xl font-semibold text-emerald-950 dark:text-white">{formatGo(data?.uploaded_go)}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-emerald-950/75 dark:text-emerald-200/80">{t('dashboard.ygg.downloaded')}</p>
              <p className="text-xl font-semibold text-emerald-950 dark:text-white">{formatGo(data?.downloaded_go)}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-emerald-950/75 dark:text-emerald-200/80">{t('dashboard.ygg.ratio')}</p>
              <p className="text-xl font-semibold text-emerald-950 dark:text-white">{formatRatio(data?.ratio)}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            {updatedLabel ? (
              <p className="text-xs text-emerald-950/80 dark:text-emerald-100/90">
                {t('dashboard.ygg.updated', { value: updatedLabel })}
              </p>
            ) : (
              <span />
            )}
            {data?.error && <p className="text-xs text-emerald-950/85 dark:text-emerald-100/90">{data.error}</p>}
          </div>
        </>
      )}
    </section>
  );
}
