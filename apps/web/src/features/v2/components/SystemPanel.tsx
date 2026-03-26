import { useState } from 'react';
import {
  type DashboardNetdataSummaryResponse,
  DASHBOARD_ENDPOINTS,
  useDashboardNetdataSummary,
  useDashboardScrutinySummary,
  useDashboardAdguardSummary,
  useSetAdguardProtection,
} from '@hously/shared';
import { useEventSourceState } from '@/hooks/useEventSourceState';
import { useAuth } from '@/hooks/useAuth';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
      {children}
    </span>
  );
}

function pct(v: number | null | undefined) {
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
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
        status === 'ok' ? 'bg-emerald-500' : status === 'warn' ? 'bg-amber-500' : 'bg-rose-500'
      }`}
    />
  );
}

function MetricRow({
  label,
  value,
  sub,
  accent,
  status = 'ok',
}: {
  label: string;
  value: string;
  sub?: string | null;
  accent?: string;
  status?: 'ok' | 'warn' | 'err';
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-zinc-50 dark:border-zinc-800/60 last:border-0">
      <StatusDot status={status} />
      <span className="w-16 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className={`font-mono text-xs font-semibold tabular-nums ${accent ?? 'text-zinc-900 dark:text-zinc-100'}`}>
        {value}
      </span>
      {sub && (
        <span className="ml-auto font-mono text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
          {sub}
        </span>
      )}
    </div>
  );
}

function MiniBar({ pct: value, accent = 'bg-violet-500' }: { pct: number; accent?: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="h-[3px] w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mt-0.5">
      <div className={`h-full rounded-full transition-all duration-700 ${accent}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

// ─── Netdata section ──────────────────────────────────────────────────────────

function NetdataSection() {
  const { data: fallback } = useDashboardNetdataSummary();
  const [showDisks, setShowDisks] = useState(false);
  const { data } = useEventSourceState<DashboardNetdataSummaryResponse>({
    url: DASHBOARD_ENDPOINTS.NETDATA.STREAM,
    initialData: fallback,
    onParseError: err => console.error('netdata stream', err),
  });

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;

  const disks = [...(data.disks ?? [])].sort((a, b) => b.used_percent - a.used_percent).slice(0, 6);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-3 rounded-full bg-violet-500 shrink-0" />
        <Label>System</Label>
      </div>

      {s.cpu_percent != null && (
        <>
          <MetricRow
            label="CPU"
            value={pct(s.cpu_percent)}
            sub={s.load_1 != null ? `load ${s.load_1.toFixed(2)}` : undefined}
            status={s.cpu_percent > 85 ? 'warn' : 'ok'}
          />
          <MiniBar pct={s.cpu_percent} accent="bg-violet-500" />
        </>
      )}

      {s.ram_used_percent != null && (
        <>
          <MetricRow
            label="RAM"
            value={pct(s.ram_used_percent)}
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
          label="Network"
          value={`↓ ${mbps(s.network_in_kbps)}`}
          sub={`↑ ${mbps(s.network_out_kbps)}`}
        />
      )}

      {/* Disks toggle */}
      {disks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDisks(v => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-violet-500 transition-colors"
          >
            {showDisks ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {showDisks ? 'Hide disks' : `${disks.length} disks`}
          </button>
          {showDisks && (
            <div className="mt-2 space-y-2">
              {disks.map(disk => {
                const total = disk.used_gib + disk.avail_gib + (disk.reserved_gib ?? 0);
                const safe = Math.max(0, Math.min(100, disk.used_percent));
                return (
                  <div key={disk.mount_point}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[160px]">
                        {disk.mount_point}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600 dark:text-zinc-300 tabular-nums">
                        {pct(safe)} · {disk.used_gib.toFixed(0)}/{total.toFixed(0)} GiB
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
  const { data } = useDashboardScrutinySummary();
  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const status = s.warning_drives > 0 ? 'warn' : 'ok';

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-3 rounded-full bg-rose-500 shrink-0" />
        <Label>Drive Health</Label>
      </div>
      <MetricRow
        label="Drives"
        value={`${s.healthy_drives}/${s.total_drives} OK`}
        sub={s.warning_drives > 0 ? `${s.warning_drives} warnings` : undefined}
        status={status}
      />
      {s.avg_temp_c != null && (
        <MetricRow
          label="Avg temp"
          value={`${s.avg_temp_c.toFixed(0)}°C`}
          sub={s.hottest_temp_c != null ? `max ${s.hottest_temp_c.toFixed(0)}°C` : undefined}
          status={s.hottest_temp_c != null && s.hottest_temp_c > 55 ? 'warn' : 'ok'}
        />
      )}
    </div>
  );
}

// ─── Adguard section ──────────────────────────────────────────────────────────

function AdguardSection() {
  const { data } = useDashboardAdguardSummary();
  const setProtection = useSetAdguardProtection();
  const { user } = useAuth();

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const isAdmin = Boolean(user?.is_admin);
  const protOn = data.protection_enabled;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-3 rounded-full bg-amber-500 shrink-0" />
          <Label>DNS / Adguard</Label>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setProtection.mutate({ enabled: !protOn })}
            disabled={setProtection.isPending}
            className={`text-[10px] font-semibold rounded-full px-2.5 py-1 transition-colors border ${
              protOn
                ? 'border-emerald-200 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                : 'border-rose-200 dark:border-rose-700 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30'
            } disabled:opacity-50`}
          >
            {setProtection.isPending ? '…' : protOn ? 'Protected' : 'Disabled'}
          </button>
        )}
      </div>
      <MetricRow
        label="Blocked"
        value={s.blocked_ratio != null ? `${(s.blocked_ratio * 100).toFixed(1)}%` : '–'}
        sub={`${s.blocked_queries.toLocaleString()} of ${s.dns_queries.toLocaleString()}`}
        status={protOn ? 'ok' : 'warn'}
      />
      {s.avg_processing_time_ms != null && (
        <MetricRow
          label="Avg latency"
          value={`${s.avg_processing_time_ms.toFixed(1)} ms`}
        />
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SystemPanel() {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-5">
      <NetdataSection />
      <ScrutinySection />
      <AdguardSection />
    </section>
  );
}
