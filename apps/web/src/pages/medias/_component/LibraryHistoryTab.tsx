import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Film,
  Tv,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  useGlobalDownloadHistory,
  useDownloadHistoryStats,
} from "@/features/medias/hooks/useLibrary";
import {
  SegmentedTabs,
  type SegmentedTabItem,
} from "@/components/ui/segmented-tabs";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeShort(isoString: string): string {
  const diff = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── Stats section ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}

function IndexerBar({
  name,
  count,
  max,
}: {
  name: string;
  count: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="text-xs text-neutral-600 dark:text-neutral-300 w-28 truncate shrink-0">
        {name}
      </span>
      <div className="flex-1 h-[5px] rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-sky-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono tabular-nums text-neutral-500 dark:text-neutral-400 w-8 text-right shrink-0">
        {count}
      </span>
    </div>
  );
}

function DaySparkline({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((d) => (
        <div
          key={d.date}
          className="flex-1 rounded-sm bg-sky-400 dark:bg-sky-500 transition-all duration-300 min-h-[2px]"
          style={{
            height: `${Math.max(4, Math.round((d.count / max) * 32))}px`,
          }}
          title={`${d.date}: ${d.count}`}
        />
      ))}
    </div>
  );
}

function StatsSection() {
  const { t } = useTranslation("common");
  const { data, isLoading } = useDownloadHistoryStats();
  const stats = data?.stats;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const maxIndexerCount = stats.top_indexers[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={t("medias.history.statTotal")}
          value={stats.total_grabs}
          color="text-neutral-800 dark:text-neutral-100"
        />
        <StatCard
          label={t("medias.history.statSuccessRate")}
          value={stats.success_rate !== null ? `${stats.success_rate}%` : "—"}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t("medias.history.statFailed")}
          value={stats.failed_grabs}
          color={
            stats.failed_grabs > 0
              ? "text-rose-600 dark:text-rose-400"
              : "text-neutral-800 dark:text-neutral-100"
          }
        />
        <StatCard
          label={t("medias.history.statActive")}
          value={stats.active_grabs}
          color="text-sky-600 dark:text-sky-400"
        />
      </div>

      {/* Top indexers + sparkline */}
      {(stats.top_indexers.length > 0 || stats.grabs_by_day.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.top_indexers.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <TrendingUp size={10} />
                {t("medias.history.topIndexers")}
              </p>
              <div className="space-y-1.5">
                {stats.top_indexers.map((idx) => (
                  <IndexerBar
                    key={idx.name}
                    name={idx.name}
                    count={idx.count}
                    max={maxIndexerCount}
                  />
                ))}
              </div>
            </div>
          )}
          {stats.grabs_by_day.length > 0 && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Activity size={10} />
                {t("medias.history.last14Days")}
              </p>
              <DaySparkline data={stats.grabs_by_day} />
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {stats.grabs_by_day.reduce((s, d) => s + d.count, 0)}{" "}
                {t("medias.history.grabsInPeriod")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History row ───────────────────────────────────────────────────────────────

type StatusFilter = "all" | "completed" | "failed" | "active";
type DaysFilter = 0 | 7 | 30 | 90;

function HistoryRow({
  item,
}: {
  item: {
    id: number;
    release_title: string;
    indexer: string | null;
    grabbed_at: string;
    completed_at: string | null;
    failed: boolean;
    fail_reason: string | null;
    post_process_error?: string | null;
    media_id: number | null;
    media_title: string | null;
    media_type: "movie" | "show" | null;
  };
}) {
  const { t } = useTranslation("common");

  const statusEl = item.failed ? (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
      <XCircle size={9} />
      {t("library.download.failed")}
    </span>
  ) : item.completed_at ? (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
      <CheckCircle2 size={9} />
      {t("library.download.done")}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/30 rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
      <Clock size={9} />
      {t("library.download.active")}
    </span>
  );

  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
      {/* Media info */}
      <div className="min-w-0 flex-1 space-y-0.5">
        {item.media_title && (
          <div className="flex items-center gap-1.5">
            {item.media_type === "movie" ? (
              <Film size={10} className="text-neutral-400 shrink-0" />
            ) : (
              <Tv size={10} className="text-neutral-400 shrink-0" />
            )}
            {item.media_id ? (
              <Link
                to="/library/$libraryId"
                params={{ libraryId: String(item.media_id) }}
                className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
              >
                {item.media_title}
              </Link>
            ) : (
              <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                {item.media_title}
              </span>
            )}
          </div>
        )}
        <p
          className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate font-mono"
          title={item.release_title}
        >
          {item.release_title}
        </p>
        {(item.fail_reason || item.post_process_error) && (
          <p className="text-[10px] text-rose-600 dark:text-rose-400 truncate">
            {item.fail_reason ?? item.post_process_error}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {statusEl}
        <div className="flex items-center gap-2 text-[10px] text-neutral-400 dark:text-neutral-500">
          {item.indexer && <span>{item.indexer}</span>}
          <span className="font-mono">
            {formatRelativeShort(item.grabbed_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

export function LibraryHistoryTab() {
  const { t } = useTranslation("common");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [days, setDays] = useState<DaysFilter>(30);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGlobalDownloadHistory({
    page,
    status: status !== "all" ? status : undefined,
    days: days > 0 ? days : undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.has_more ?? false;
  const limit = data?.limit ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const statusTabs: SegmentedTabItem<StatusFilter>[] = [
    { id: "all", label: t("medias.history.statusAll") },
    {
      id: "completed",
      label: t("medias.history.statusCompleted"),
      icon: CheckCircle2,
    },
    { id: "failed", label: t("medias.history.statusFailed"), icon: XCircle },
    { id: "active", label: t("medias.history.statusActive"), icon: Clock },
  ];

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };
  const handleDaysChange = (d: number) => {
    setDays(d as DaysFilter);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <StatsSection />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <SegmentedTabs<StatusFilter>
            ariaLabel={t("medias.history.statusAll")}
            items={statusTabs}
            value={status}
            onChange={handleStatusChange}
          />
        </div>
        <select
          value={days}
          onChange={(e) => handleDaysChange(Number(e.target.value))}
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition shrink-0"
        >
          <option value={7}>{t("medias.history.days7")}</option>
          <option value={30}>{t("medias.history.days30")}</option>
          <option value={90}>{t("medias.history.days90")}</option>
          <option value={0}>{t("medias.history.daysAll")}</option>
        </select>
      </div>

      {/* List */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                  <div className="h-2.5 w-56 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
                </div>
                <div className="h-5 w-14 rounded-full bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {t("medias.history.empty")}
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {items.map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("medias.history.paginationRange", {
              start: (page - 1) * limit + 1,
              end: Math.min(page * limit, total),
              total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs text-neutral-600 dark:text-neutral-400 min-w-[60px] text-center">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="rounded-lg p-1.5 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
