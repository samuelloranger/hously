import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TooltipContentProps } from "recharts";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

import { useDashboardSystemSummary } from "@/pages/_component/useDashboardSystem";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { DashboardBeszelSummaryResponse } from "@hously/shared/types";
import { useEventSourceState } from "@/lib/realtime/useEventSourceState";
import { StatusDot, MiniBar, pctFmt, mbps, gb } from "./shared";

const SYS_RING_SIZE = 60;

type SysSample = { cpu: number; ram: number };

function SysTooltip({
  active,
  payload,
}: TooltipContentProps<
  number | string | ReadonlyArray<number | string>,
  number | string
>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 shadow-sm text-[11px] space-y-0.5">
      {payload.map((p, i) => (
        <p
          key={i}
          className="font-semibold tabular-nums"
          style={{ color: String(p.color) }}
        >
          {p.name}: {Number(p.value).toFixed(0)}%
        </p>
      ))}
    </div>
  );
}

function TrendChart({
  data,
  dataKey,
  color,
  gradientId,
}: {
  data: SysSample[];
  dataKey: keyof SysSample;
  color: string;
  gradientId: string;
}) {
  if (data.length < 3) return null;
  return (
    <div className="h-8 w-full mt-0.5 mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={SysTooltip}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={dataKey === "cpu" ? "CPU" : "RAM"}
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function VitalCell({
  label,
  percent,
  sub,
  status,
  accent,
  history,
  dataKey,
  color,
  gradientId,
}: {
  label: string;
  percent: number;
  sub?: string | null;
  status: "ok" | "warn" | "err";
  accent: string;
  history: SysSample[];
  dataKey: keyof SysSample;
  color: string;
  gradientId: string;
}) {
  return (
    <div className="rounded-lg bg-surface-inset/60 ring-1 ring-border/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400">
          {label}
        </span>
        <StatusDot status={status} />
      </div>
      <div className="mt-1.5 font-display text-[1.75rem] font-semibold leading-none tabular-nums text-neutral-50">
        {pctFmt(percent)}
      </div>
      {sub ? (
        <div className="mt-1 truncate text-[10px] tabular-nums text-neutral-500">
          {sub}
        </div>
      ) : null}
      <MiniBar pct={percent} accent={accent} />
      <TrendChart
        data={history}
        dataKey={dataKey}
        color={color}
        gradientId={gradientId}
      />
    </div>
  );
}

export function BeszelSection() {
  const { t } = useTranslation("common");
  const { data: fallback } = useDashboardSystemSummary();
  const [showDisks, setShowDisks] = useState(false);
  const { data } = useEventSourceState<DashboardBeszelSummaryResponse>({
    url: DASHBOARD_ENDPOINTS.SYSTEM.STREAM,
    initialData: fallback,
    onParseError: (err) => console.error("beszel stream", err),
  });

  const ringRef = useRef<SysSample[]>([]);
  const [sysHistory, setSysHistory] = useState<SysSample[]>([]);

  useEffect(() => {
    if (!data?.summary) return;
    const s = data.summary;
    if (s.cpu_percent == null && s.ram_used_percent == null) return;
    const next = [
      ...ringRef.current.slice(-(SYS_RING_SIZE - 1)),
      { cpu: s.cpu_percent ?? 0, ram: s.ram_used_percent ?? 0 },
    ];
    ringRef.current = next;
    setSysHistory(next);
  }, [data]);

  if (!data?.enabled || !data?.connected) return null;
  const s = data.summary;
  const disks = [...(data.disks ?? [])]
    .sort((a, b) => b.used_percent - a.used_percent)
    .slice(0, 6);

  const hasCpu = s.cpu_percent != null;
  const hasRam = s.ram_used_percent != null;

  return (
    <div className="px-4 py-4 border-t border-neutral-800 first:border-t-0">
      {(hasCpu || hasRam) && (
        <div className="grid grid-cols-2 gap-2">
          {hasCpu && (
            <VitalCell
              label={t("dashboard.beszel.cpu")}
              percent={s.cpu_percent!}
              sub={
                s.load_1 != null
                  ? t("dashboard.home.loadAvg", { value: s.load_1.toFixed(2) })
                  : undefined
              }
              status={s.cpu_percent! > 85 ? "warn" : "ok"}
              accent="bg-primary-500"
              history={sysHistory}
              dataKey="cpu"
              color="#df8753"
              gradientId="cpuGradient"
            />
          )}
          {hasRam && (
            <VitalCell
              label={t("dashboard.beszel.ram")}
              percent={s.ram_used_percent!}
              sub={
                s.ram_used_mib != null && s.ram_total_mib != null
                  ? `${gb(s.ram_used_mib)} / ${gb(s.ram_total_mib)}`
                  : undefined
              }
              status={s.ram_used_percent! > 90 ? "warn" : "ok"}
              accent="bg-primary-400"
              history={sysHistory}
              dataKey="ram"
              color="#e8a06a"
              gradientId="ramGradient"
            />
          )}
        </div>
      )}

      {hasCpu && s.cpu_name && (
        <p className="mt-2 truncate text-[10px] text-neutral-500">
          {s.cpu_name}
        </p>
      )}

      {(s.network_in_kbps != null || s.network_out_kbps != null) && (
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
          <span className="font-medium text-neutral-400">
            {t("dashboard.beszel.network")}
          </span>
          <span className="font-mono tabular-nums text-neutral-200">
            ↓ {mbps(s.network_in_kbps)} · ↑ {mbps(s.network_out_kbps)}
          </span>
        </div>
      )}

      {disks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDisks((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-neutral-400 hover:text-primary-400 transition-colors font-medium"
          >
            {showDisks ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showDisks
              ? t("dashboard.beszel.hideDisks")
              : t("dashboard.home.disksCount", { count: disks.length })}
          </button>
          {showDisks && (
            <div className="mt-2 space-y-2">
              {disks.map((disk) => {
                const total =
                  disk.used_gib + disk.avail_gib + (disk.reserved_gib ?? 0);
                const safe = Math.max(0, Math.min(100, disk.used_percent));
                return (
                  <div key={disk.mount_point}>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-neutral-300 truncate max-w-[160px]">
                          {disk.mount_point}
                        </span>
                        {disk.model && (
                          <span className="text-[10px] text-neutral-500 truncate max-w-[160px]">
                            {disk.model}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-neutral-300 tabular-nums shrink-0 ml-2">
                        {pctFmt(safe)} · {disk.used_gib.toFixed(0)}/
                        {total.toFixed(0)} GiB
                      </span>
                    </div>
                    <MiniBar
                      pct={safe}
                      accent={safe > 85 ? "bg-rose-400" : "bg-primary-400"}
                    />
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
