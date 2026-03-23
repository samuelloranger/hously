import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DASHBOARD_ENDPOINTS, type DashboardNetdataSummaryResponse, useDashboardNetdataSummary } from '@hously/shared';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useEventSourceState } from '@/hooks/useEventSourceState';
import { usePrefetchIntent } from '@/hooks/usePrefetchIntent';

const formatPercent = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '--';
  return `${value.toFixed(1)}%`;
};

const formatLoad = (value: number | null): string => {
  if (value == null || Number.isNaN(value)) return '--';
  return value.toFixed(2);
};

const formatRam = (usedMib: number | null, totalMib: number | null): string => {
  if (usedMib == null || totalMib == null) return '--';
  const usedGib = usedMib / 1024;
  const totalGib = totalMib / 1024;
  return `${usedGib.toFixed(1)} / ${totalGib.toFixed(1)} GiB`;
};

const formatNetwork = (valueKbps: number | null): string => {
  if (valueKbps == null || Number.isNaN(valueKbps)) return '--';
  if (valueKbps >= 1000 * 1000) return `${(valueKbps / (1000 * 1000)).toFixed(2)} Gbps`;
  if (valueKbps >= 1000) return `${(valueKbps / 1000).toFixed(1)} Mbps`;
  return `${valueKbps.toFixed(0)} Kbps`;
};

export function NetdataOverviewCard() {
  const { t } = useTranslation('common');
  const { data: fallbackData, isLoading } = useDashboardNetdataSummary();
  const prefetchIntent = usePrefetchIntent('/settings', { tab: 'plugins' });
  const [showDisks, setShowDisks] = useState(false);
  const { data, streamConnected } = useEventSourceState<DashboardNetdataSummaryResponse>({
    url: DASHBOARD_ENDPOINTS.NETDATA.STREAM,
    initialData: fallbackData,
    onParseError: error => {
      console.error('Failed to parse Netdata stream payload', error);
    },
  });

  const showNotConnected = !isLoading && (!data || !data.enabled || !data.connected);
  const disks = useMemo(
    () => [...(data?.disks ?? [])].sort((a, b) => b.used_percent - a.used_percent).slice(0, 6),
    [data?.disks]
  );

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-indigo-300/60 dark:border-indigo-200/40 bg-gradient-to-br from-[#e0e7ff] via-[#a5b4fc] to-[#818cf8] dark:from-indigo-950/70 dark:via-indigo-900/60 dark:to-violet-900/60 p-4 shadow-xl"
      {...prefetchIntent}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] uppercase tracking-[0.22em] text-indigo-950/70 dark:text-indigo-200/90">
            {t('dashboard.netdata.kicker')}
          </p>
          <h3 className="text-base md:text-lg font-bold text-indigo-950 dark:text-indigo-50">
            {t('dashboard.netdata.title')}
          </h3>
          <p className="text-[10px] text-indigo-900/70 dark:text-indigo-100/90 mt-1">{t('dashboard.netdata.subtitle')}</p>
        </div>
        <span className="rounded-full bg-black/15 dark:bg-black/25 px-3 py-1 text-[11px] font-medium text-indigo-950 dark:text-indigo-100">
          {showNotConnected
            ? t('dashboard.netdata.disconnected')
            : streamConnected
              ? t('dashboard.netdata.live')
              : t('dashboard.netdata.polling')}
        </span>
      </div>

      {showNotConnected ? (
        <div className="mt-5 rounded-2xl border border-indigo-500/40 dark:border-indigo-300/40 bg-indigo-100/55 dark:bg-indigo-100/15 p-4 text-indigo-950 dark:text-indigo-100">
          <p className="font-medium">{t('dashboard.netdata.notConnectedTitle')}</p>
          <p className="text-xs text-indigo-950/80 dark:text-indigo-100/90 mt-1">
            {t('dashboard.netdata.notConnectedDescription')}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-indigo-950/75 dark:text-indigo-200/80">{t('dashboard.netdata.cpu')}</p>
              <p className="text-xs font-semibold text-indigo-950 dark:text-white">
                {formatPercent(data?.summary.cpu_percent ?? null)}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-indigo-950/75 dark:text-indigo-200/80">{t('dashboard.netdata.ram')}</p>
              <p className="text-xs font-semibold text-indigo-950 dark:text-white">
                {formatPercent(data?.summary.ram_used_percent ?? null)}
              </p>
              <p className="text-[10px] text-indigo-950/85 dark:text-indigo-100/90">
                {formatRam(data?.summary.ram_used_mib ?? null, data?.summary.ram_total_mib ?? null)}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-indigo-950/75 dark:text-indigo-200/80">{t('dashboard.netdata.load')}</p>
              <p className="text-xs font-semibold text-indigo-950 dark:text-white">
                {`${formatLoad(data?.summary.load_1 ?? null)} / ${formatLoad(data?.summary.load_5 ?? null)} / ${formatLoad(data?.summary.load_15 ?? null)}`}
              </p>
            </div>
            <div className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
              <p className="text-[11px] text-indigo-950/75 dark:text-indigo-200/80">{t('dashboard.netdata.network')}</p>
              <p className="text-xs font-semibold text-indigo-950 dark:text-white">
                ↓ {formatNetwork(data?.summary.network_in_kbps ?? null)}
              </p>
              <p className="text-[10px] text-indigo-950/85 dark:text-indigo-100/90">
                ↑ {formatNetwork(data?.summary.network_out_kbps ?? null)}
              </p>
            </div>
          </div>

          {disks.length > 0 ? (
            <Collapsible open={showDisks} onOpenChange={setShowDisks} className="mt-5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center rounded-full border border-indigo-950/20 dark:border-indigo-200/40 bg-black/10 dark:bg-black/20 px-3 py-1.5 text-[11px] font-medium text-indigo-950 dark:text-indigo-100 hover:bg-black/20 dark:hover:bg-black/30"
                >
                  {showDisks ? t('dashboard.netdata.hideDisks') : t('dashboard.netdata.showDisks')}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {disks.map(disk => {
                  const total = disk.used_gib + disk.avail_gib + disk.reserved_gib;
                  const safePercent = Math.max(0, Math.min(100, disk.used_percent));
                  return (
                    <div key={disk.mount_point} className="rounded-xl bg-black/10 dark:bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-medium text-indigo-950 dark:text-white">
                          {disk.mount_point}
                        </p>
                        <p className="text-[11px] text-indigo-900 dark:text-indigo-100">{formatPercent(safePercent)}</p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-indigo-950/20 dark:bg-indigo-100/30">
                        <div
                          className="h-full rounded-full bg-indigo-900 dark:bg-indigo-200"
                          style={{ width: `${safePercent}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-indigo-950/85 dark:text-indigo-100/90">
                        {t('dashboard.netdata.diskUsedLabel', {
                          used: disk.used_gib.toFixed(1),
                          total: total.toFixed(1),
                        })}
                      </p>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="mt-5 rounded-2xl border border-indigo-500/40 dark:border-indigo-300/40 bg-indigo-100/55 dark:bg-indigo-100/15 p-4 text-xs text-indigo-950 dark:text-indigo-100">
              {t('dashboard.netdata.emptyTitle')}
            </div>
          )}

          {data?.error && <p className="mt-4 text-[11px] text-indigo-950/85 dark:text-indigo-100/90">{data.error}</p>}
        </>
      )}
    </section>
  );
}
