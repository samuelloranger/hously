import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type DashboardBeszelSummaryResponse,
  DASHBOARD_ENDPOINTS,
  useDashboardBeszelSummary,
  useDashboardScrutinySummary,
  useDashboardAdguardSummary,
  useSetAdguardProtection,
} from '@hously/shared';
import { useEventSourceState } from '@/hooks/useEventSourceState';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronUp } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{children}</h3>;
}

function pctFmt(v: number | null | undefined) {
  return v != null ? `${v.toFixed(0)}%` : '–';
}

function mbps(kbps: number | null | undefined) {
  if (kbps == null) return '–';
  if (kbps >= 1_000_000) return `${(kbps / 1_000_000).toFixed(2)} Gbps`;
  if (kbps >= 1_000) return `${(kbps / 1_000).toFixed(1)} Mbps`;
  return `${kbps.toFixed(0)} Kbps`;
}

function gb(mib: number | null | undefined) {
  if (mib == null) return null;
  return `${(mib / 1024).toFixed(1)} GB`;
}

function StatusDot({ status }: { status: 'ok' | 'warn' | 'err' }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        status === 'ok' ? 'bg-emerald-500' : status === 'warn' ? 'bg-amber-500' : 'bg-rose-500'
      }`}
    />
  );
}

function MetricRow({
  label,
  value,
  sub,
  status = 'ok',
}: {
  label: string;
  value: string;
  sub?: string | null;
  status?: 'ok' | 'warn' | 'err';
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <StatusDot status={status} />
      <span className="w-16 shrink-0 text-xs font-medium text-zinc-600 dark:text-zinc-300">{label}</span>
      <span className="font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100">{value}</span>
      {sub && (
        <span className="ml-auto font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">{sub}</span>
      )}
    </div>
  );
}

function MiniBar({ pct, accent = 'bg-violet-500' }: { pct: number; accent?: string }) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-[3px] w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mt-0.5 mb-1">
      <div className={`h-full rounded-full transition-all duration-700 ${accent}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

// ─── Beszel section ───────────────────────────────────────────────────────────

function BeszelSection() {
  const { t } = useTranslation('common');
  const { data: fallback } = useDashboardBeszelSummary();
  const [showDisks, setShowDisks] = useState(false);
  const { data } = useEventSourceState<DashboardBeszelSummaryResponse>({
    url: DASHBOARD_ENDPOINTS.BESZEL.STREAM,
    initialData: fallback,
    onParseError: err => console.error('beszel stream', err),
  });

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const disks = [...(data.disks ?? [])].sort((a, b) => b.used_percent - a.used_percent).slice(0, 6);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
        <SectionTitle>{t('dashboard.home.systemHeading')}</SectionTitle>
      </div>

      {s.cpu_percent != null && (
        <>
          <MetricRow
            label={t('dashboard.beszel.cpu')}
            value={pctFmt(s.cpu_percent)}
            sub={s.load_1 != null ? t('dashboard.home.loadAvg', { value: s.load_1.toFixed(2) }) : undefined}
            status={s.cpu_percent > 85 ? 'warn' : 'ok'}
          />
          <MiniBar pct={s.cpu_percent} accent="bg-violet-500" />
        </>
      )}

      {s.ram_used_percent != null && (
        <>
          <MetricRow
            label={t('dashboard.beszel.ram')}
            value={pctFmt(s.ram_used_percent)}
            sub={
              s.ram_used_mib != null && s.ram_total_mib != null
                ? `${gb(s.ram_used_mib)} / ${gb(s.ram_total_mib)}`
                : undefined
            }
            status={s.ram_used_percent > 90 ? 'warn' : 'ok'}
          />
          <MiniBar pct={s.ram_used_percent} accent="bg-violet-400" />
        </>
      )}

      {(s.network_in_kbps != null || s.network_out_kbps != null) && (
        <MetricRow
          label={t('dashboard.beszel.network')}
          value={`↓ ${mbps(s.network_in_kbps)}`}
          sub={`↑ ${mbps(s.network_out_kbps)}`}
        />
      )}

      {disks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDisks(v => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors font-medium"
          >
            {showDisks ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDisks ? t('dashboard.beszel.hideDisks') : t('dashboard.home.disksCount', { count: disks.length })}
          </button>
          {showDisks && (
            <div className="mt-2 space-y-2">
              {disks.map(disk => {
                const total = disk.used_gib + disk.avail_gib + (disk.reserved_gib ?? 0);
                const safe = Math.max(0, Math.min(100, disk.used_percent));
                return (
                  <div key={disk.mount_point}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate max-w-[160px]">
                        {disk.mount_point}
                      </span>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 tabular-nums">
                        {pctFmt(safe)} · {disk.used_gib.toFixed(0)}/{total.toFixed(0)} GiB
                      </span>
                    </div>
                    <MiniBar pct={safe} accent={safe > 85 ? 'bg-rose-500' : 'bg-violet-400'} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Scrutiny section ─────────────────────────────────────────────────────────

function ScrutinySection() {
  const { t } = useTranslation('common');
  const { data } = useDashboardScrutinySummary();
  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1 h-4 rounded-full bg-rose-500 shrink-0" />
        <SectionTitle>{t('dashboard.scrutiny.title')}</SectionTitle>
      </div>
      <MetricRow
        label={t('dashboard.home.scrutinyDrivesLabel')}
        value={t('dashboard.home.scrutinyDrivesOk', { healthy: s.healthy_drives, total: s.total_drives })}
        sub={s.warning_drives > 0 ? t('dashboard.home.scrutinyWarnings', { count: s.warning_drives }) : undefined}
        status={s.warning_drives > 0 ? 'warn' : 'ok'}
      />
      {s.avg_temp_c != null && (
        <MetricRow
          label={t('dashboard.home.avgTemp')}
          value={`${s.avg_temp_c.toFixed(0)}°C`}
          sub={
            s.hottest_temp_c != null
              ? t('dashboard.home.maxTemp', { value: s.hottest_temp_c.toFixed(0) })
              : undefined
          }
          status={s.hottest_temp_c != null && s.hottest_temp_c > 55 ? 'warn' : 'ok'}
        />
      )}
    </div>
  );
}

// ─── Adguard section ──────────────────────────────────────────────────────────

function AdguardSection() {
  const { t } = useTranslation('common');
  const { data } = useDashboardAdguardSummary();
  const setProtection = useSetAdguardProtection();
  const { user } = useAuth();

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const isAdmin = Boolean(user?.is_admin);
  const protOn = data.protection_enabled;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
          <SectionTitle>{t('dashboard.home.adguardHeading')}</SectionTitle>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setProtection.mutate({ enabled: !protOn })}
            disabled={setProtection.isPending}
            className={`text-xs font-semibold rounded-full px-3 py-1 transition-colors border ${
              protOn
                ? 'border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                : 'border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30'
            } disabled:opacity-50`}
          >
            {setProtection.isPending
              ? t('dashboard.home.protectionPending')
              : protOn
                ? t('dashboard.home.protectionOn')
                : t('dashboard.home.protectionOff')}
          </button>
        )}
      </div>
      <MetricRow
        label={t('dashboard.adguard.blocked')}
        value={s.blocked_ratio != null ? `${s.blocked_ratio.toFixed(1)}%` : '–'}
        sub={t('dashboard.home.queriesOf', {
          blocked: s.blocked_queries.toLocaleString(),
          total: s.dns_queries.toLocaleString(),
        })}
        status={protOn ? 'ok' : 'warn'}
      />
      {s.avg_processing_time_ms != null && (
        <MetricRow label={t('dashboard.adguard.avgTime')} value={`${s.avg_processing_time_ms.toFixed(1)} ms`} />
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SystemPanel() {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-5">
      <BeszelSection />
      <ScrutinySection />
      <AdguardSection />
    </section>
  );
}
