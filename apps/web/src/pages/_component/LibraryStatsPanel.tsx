import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Film, ChevronRight } from "lucide-react";
import type { TooltipContentProps } from "recharts";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
} from "recharts";

import { useLibraryStats } from "@/features/medias/hooks/useLibraryStats";
import { formatBytes } from "@/lib/utils/format";

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100 shrink-0">
        {value}
      </span>
    </div>
  );
}

function LibraryChartTooltip({
  active,
  payload,
}: TooltipContentProps<
  number | string | ReadonlyArray<number | string>,
  number | string
>) {
  if (!active || !payload?.length) return null;
  const label = (payload[0]?.payload?.name ?? payload[0]?.name) as
    | string
    | undefined;
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 shadow-sm text-[11px]">
      {label && (
        <p className="text-zinc-500 dark:text-zinc-400 mb-0.5">{label}</p>
      )}
      {payload.map((p, i) => (
        <p
          key={i}
          className="font-semibold tabular-nums"
          style={{ color: String(p.color ?? p.fill) }}
        >
          {p.name ? `${p.name}: ` : ""}
          {p.value}
        </p>
      ))}
    </div>
  );
}

function MediaTypePie({ movies, shows }: { movies: number; shows: number }) {
  const { t } = useTranslation("common");
  const total = movies + shows;
  if (total === 0) return null;

  const data = [
    {
      name: t("dashboard.libraryStats.movies"),
      value: movies,
      color: "#8b5cf6",
    },
    { name: t("dashboard.libraryStats.shows"), value: shows, color: "#a78bfa" },
  ];

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400 mb-2">
        {t("dashboard.libraryStats.mediaTypeSplit")}
      </p>
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius="50%"
                outerRadius="85%"
                strokeWidth={0}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip content={LibraryChartTooltip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                {d.name}
              </span>
              <span className="ml-auto font-mono text-xs font-semibold tabular-nums text-zinc-800 dark:text-zinc-100 pl-1">
                {d.value.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-0.5 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Total
            </span>
            <span className="ml-auto font-mono text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-200 pl-1">
              {total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResolutionStorageChart({
  data,
}: {
  data: { resolution: string; size_bytes: number }[];
}) {
  const { t } = useTranslation("common");
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.resolution === "unknown" ? "?" : d.resolution,
    gb: parseFloat((d.size_bytes / 1e9).toFixed(1)),
  }));

  const RESOLUTION_COLORS: Record<string, string> = {
    "4k": "#8b5cf6",
    "1080p": "#a78bfa",
    "720p": "#c4b5fd",
    "480p": "#ddd6fe",
    "?": "#71717a",
  };

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400 mb-2">
        {t("dashboard.libraryStats.storageByQuality")}
      </p>
      <div className="h-16 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 0, right: 0, left: -28, bottom: 0 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={LibraryChartTooltip}
              cursor={{ fill: "rgba(139,92,246,0.08)" }}
            />
            <Bar
              dataKey="gb"
              name="GB"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            >
              {chartData.map((d, i) => (
                <Cell key={i} fill={RESOLUTION_COLORS[d.name] ?? "#8b5cf6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LibraryStatsPanel() {
  const { t } = useTranslation("common");
  const { data, isLoading, isError } = useLibraryStats();
  const stats = data?.stats;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-4 rounded-full bg-violet-500 shrink-0" />
          <Film
            className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            strokeWidth={2}
          />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {t("dashboard.libraryStats.title")}
          </h3>
        </div>
        <Link
          to="/library"
          className="flex items-center gap-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
        >
          {t("dashboard.libraryStats.openLibrary")}
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className="px-4 py-1">
        {isLoading && (
          <div className="space-y-2 py-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-5 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="py-6 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {t("dashboard.libraryStats.loadError")}
            </p>
          </div>
        )}

        {!isLoading && !isError && stats && (
          <>
            <KpiRow
              label={t("dashboard.libraryStats.downloaded")}
              value={String(stats.downloaded)}
            />
            <KpiRow
              label={t("dashboard.libraryStats.wanted")}
              value={String(stats.wanted)}
            />
            <KpiRow
              label={t("dashboard.libraryStats.returningSeries")}
              value={String(stats.returning_series)}
            />
            <KpiRow
              label={t("dashboard.libraryStats.storageUsed")}
              value={formatBytes(stats.storage_used_bytes)}
            />
          </>
        )}
      </div>

      {!isLoading && !isError && stats && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <MediaTypePie movies={stats.total_movies} shows={stats.total_shows} />
          {stats.storage_by_resolution.length > 0 && (
            <ResolutionStorageChart data={stats.storage_by_resolution} />
          )}
        </div>
      )}
    </section>
  );
}
