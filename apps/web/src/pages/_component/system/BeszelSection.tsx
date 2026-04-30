import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Server } from "lucide-react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

import { useDashboardSystemSummary } from "@/pages/_component/useDashboardSystem";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { DashboardBeszelSummaryResponse } from "@hously/shared/types";
import { useEventSourceState } from "@/lib/realtime/useEventSourceState";
import { SectionTitle, MetricRow, MiniBar, pctFmt, mbps, gb } from "./shared";

const SYS_RING_SIZE = 60;

type SysSample = { cpu: number; ram: number };

type SysPayloadEntry = {
  name?: string | number;
  value?: number;
  color?: string;
};

function SysTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<SysPayloadEntry>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 shadow-sm text-[11px] space-y-0.5">
      {payload.map((p: SysPayloadEntry, i: number) => (
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

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
        <Server
          className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
          strokeWidth={2}
        />
        <SectionTitle>{t("dashboard.home.systemHeading")}</SectionTitle>
      </div>

      {s.cpu_percent != null && (
        <>
          <MetricRow
            label={t("dashboard.beszel.cpu")}
            value={pctFmt(s.cpu_percent)}
            sub={
              s.load_1 != null
                ? t("dashboard.home.loadAvg", { value: s.load_1.toFixed(2) })
                : undefined
            }
            status={s.cpu_percent > 85 ? "warn" : "ok"}
          />
          <MiniBar pct={s.cpu_percent} accent="bg-violet-500" />
          <TrendChart
            data={sysHistory}
            dataKey="cpu"
            color="#8b5cf6"
            gradientId="cpuGradient"
          />
          {s.cpu_name && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate -mt-0.5 mb-1">
              {s.cpu_name}
            </p>
          )}
        </>
      )}

      {s.ram_used_percent != null && (
        <>
          <MetricRow
            label={t("dashboard.beszel.ram")}
            value={pctFmt(s.ram_used_percent)}
            sub={
              s.ram_used_mib != null && s.ram_total_mib != null
                ? `${gb(s.ram_used_mib)} / ${gb(s.ram_total_mib)}`
                : undefined
            }
            status={s.ram_used_percent > 90 ? "warn" : "ok"}
          />
          <MiniBar pct={s.ram_used_percent} accent="bg-violet-400" />
          <TrendChart
            data={sysHistory}
            dataKey="ram"
            color="#a78bfa"
            gradientId="ramGradient"
          />
        </>
      )}

      {(s.network_in_kbps != null || s.network_out_kbps != null) && (
        <MetricRow
          label={t("dashboard.beszel.network")}
          value={`↓ ${mbps(s.network_in_kbps)}`}
          sub={`↑ ${mbps(s.network_out_kbps)}`}
        />
      )}

      {disks.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowDisks((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 hover:text-violet-500 dark:hover:text-violet-400 transition-colors font-medium"
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
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate max-w-[160px]">
                          {disk.mount_point}
                        </span>
                        {disk.model && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[160px]">
                            {disk.model}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs text-zinc-600 dark:text-zinc-300 tabular-nums shrink-0 ml-2">
                        {pctFmt(safe)} · {disk.used_gib.toFixed(0)}/
                        {total.toFixed(0)} GiB
                      </span>
                    </div>
                    <MiniBar
                      pct={safe}
                      accent={safe > 85 ? "bg-rose-500" : "bg-violet-400"}
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
