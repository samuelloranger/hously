import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardScrutinySummary } from '@hously/shared';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../../components/ui/collapsible';
import { usePrefetchRoute } from '../../../hooks/usePrefetchRoute';

const formatBytes = (bytes: number | null): string => {
  if (bytes == null || bytes <= 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`;
};

const formatTemp = (value: number | null): string => (value == null ? '--' : `${Math.round(value)}C`);

const formatHours = (value: number | null): string => (value == null ? '--' : `${value.toLocaleString()}h`);

const getStatusLabel = (status: number | null, t: (key: string) => string): string => {
  if (status == null) return t('dashboard.scrutiny.statusUnknown');
  if (status === 0) return t('dashboard.scrutiny.statusHealthy');
  return t('dashboard.scrutiny.statusWarning');
};

export function ScrutinyHealthCard() {
  const { t } = useTranslation('common');
  const { data, isLoading } = useDashboardScrutinySummary();
  const prefetchRoute = usePrefetchRoute();
  const [showDrives, setShowDrives] = useState(false);

  const topDrives = useMemo(() => (data?.drives ?? []).slice(0, 5), [data?.drives]);
  const showNotConnected = !isLoading && (!data || !data.enabled || !data.connected);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-rose-300/60 dark:border-rose-200/40 bg-gradient-to-br from-[#f9d2dd] via-[#f6b6c8] to-[#ffe0cd] dark:from-rose-700 dark:via-rose-700 dark:to-orange-700 p-4 shadow-xl"
      onMouseEnter={() => prefetchRoute('/settings', { tab: 'plugins' })}
      onTouchStart={() => prefetchRoute('/settings', { tab: 'plugins' })}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-rose-950/70 dark:text-rose-200/90">
            {t('dashboard.scrutiny.kicker')}
          </p>
          <h3 className="text-lg md:text-xl font-bold text-rose-950 dark:text-rose-50">
            {t('dashboard.scrutiny.title')}
          </h3>
          <p className="text-[11px] text-rose-900/70 dark:text-rose-100/90 mt-1">{t('dashboard.scrutiny.subtitle')}</p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-xs font-medium text-rose-950 dark:text-rose-100">
          {showNotConnected ? t('dashboard.scrutiny.disconnected') : t('dashboard.scrutiny.connected')}
        </span>
      </div>

      {showNotConnected ? (
        <div className="mt-5 rounded-2xl border border-rose-500/40 dark:border-rose-300/40 bg-rose-100/55 dark:bg-rose-100/15 p-4 text-rose-950 dark:text-rose-100">
          <p className="font-medium">{t('dashboard.scrutiny.notConnectedTitle')}</p>
          <p className="text-sm text-rose-950/80 dark:text-rose-100/90 mt-1">
            {t('dashboard.scrutiny.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-rose-950/75 dark:text-rose-200/80">{t('dashboard.scrutiny.totalDrives')}</p>
              <p className="text-sm font-semibold text-rose-950 dark:text-white">{data?.summary.total_drives ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-rose-950/75 dark:text-rose-200/80">{t('dashboard.scrutiny.healthyDrives')}</p>
              <p className="text-sm font-semibold text-rose-950 dark:text-white">{data?.summary.healthy_drives ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-rose-950/75 dark:text-rose-200/80">{t('dashboard.scrutiny.warningDrives')}</p>
              <p className="text-sm font-semibold text-rose-950 dark:text-white">{data?.summary.warning_drives ?? 0}</p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-xs text-rose-950/75 dark:text-rose-200/80">{t('dashboard.scrutiny.hottestTemp')}</p>
              <p className="text-sm font-semibold text-rose-950 dark:text-white">
                {formatTemp(data?.summary.hottest_temp_c ?? null)}
              </p>
            </div>
          </div>

          {topDrives.length > 0 ? (
            <Collapsible open={showDrives} onOpenChange={setShowDrives} className="mt-5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-rose-950/20 dark:border-rose-200/40 bg-black/10 dark:bg-black/20 px-3 py-1.5 text-xs font-medium text-rose-950 dark:text-rose-100 hover:bg-black/20 dark:hover:bg-black/30"
                >
                  {showDrives ? t('dashboard.scrutiny.hideDrives') : t('dashboard.scrutiny.showDrives')}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {topDrives.map(drive => (
                  <div key={drive.id} className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-rose-950 dark:text-white">
                        {drive.model_name || t('dashboard.scrutiny.unknownDrive')}
                      </p>
                      <p className="text-xs text-rose-900 dark:text-rose-100/90">
                        {getStatusLabel(drive.device_status, t)}
                      </p>
                    </div>
                    <div className="mt-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-rose-900/90 dark:text-rose-100/90">
                      <span>{t('dashboard.scrutiny.tempLabel', { value: formatTemp(drive.temperature_c) })}</span>
                      <span>{t('dashboard.scrutiny.hoursLabel', { value: formatHours(drive.power_on_hours) })}</span>
                      <span>{t('dashboard.scrutiny.capacityLabel', { value: formatBytes(drive.capacity_bytes) })}</span>
                      <span className="truncate text-right">{drive.serial_number || '--'}</span>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="mt-5 rounded-2xl border border-rose-500/40 dark:border-rose-300/40 bg-rose-100/55 dark:bg-rose-100/15 p-4 text-sm text-rose-950 dark:text-rose-100">
              {t('dashboard.scrutiny.emptyTitle')}
            </div>
          )}

          {data?.error && <p className="mt-4 text-xs text-rose-950/85 dark:text-rose-100/90">{data.error}</p>}
        </>
      )}
    </section>
  );
}
