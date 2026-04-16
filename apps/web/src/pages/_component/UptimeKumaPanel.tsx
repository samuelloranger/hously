import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, AlertCircle, ChevronRight } from "lucide-react";
import { useUptimekumaMonitors } from "@/pages/_component/useUptimekumaMonitors";
import { UptimeKumaMonitorsModal } from "@/pages/_component/UptimeKumaMonitorsModal";
import type {
  UptimekumaMonitor,
  UptimekumaMonitorStatus,
  UptimekumaSummary,
} from "@hously/shared/types";

const MAX_INLINE_ROWS = 5;

type OverallStatus = "healthy" | "pending" | "degraded";

function deriveOverallStatus(summary: UptimekumaSummary): OverallStatus {
  if (summary.down > 0) return "degraded";
  if (summary.pending > 0) return "pending";
  return "healthy";
}

function AccentBar({ status }: { status: OverallStatus }) {
  const color =
    status === "degraded"
      ? "bg-rose-500"
      : status === "pending"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return <span className={`w-1 h-4 rounded-full shrink-0 ${color}`} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function StatusDot({
  status,
  pulse,
}: {
  status: UptimekumaMonitorStatus;
  pulse?: boolean;
}) {
  const color =
    status === "down"
      ? "bg-rose-500"
      : status === "pending"
        ? "bg-amber-500"
        : status === "maintenance"
          ? "bg-sky-500"
          : "bg-emerald-500";
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
    </span>
  );
}

function SummaryPill({
  status,
  summary,
}: {
  status: OverallStatus;
  summary: UptimekumaSummary;
}) {
  const { t } = useTranslation("common");
  const classes =
    status === "degraded"
      ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      : status === "pending"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <span
      className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${classes}`}
    >
      {t("dashboard.uptimekuma.summary", {
        up: summary.up,
        total: summary.total,
      })}
    </span>
  );
}

function MonitorRow({ monitor }: { monitor: UptimekumaMonitor }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <StatusDot status={monitor.status} pulse={monitor.status === "down"} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
        {monitor.name}
      </span>
      {monitor.type && (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {monitor.type}
        </span>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <span className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <span className="h-5 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="px-4 py-4">
        <div className="h-3 w-32 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </section>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("common");
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <AccentBar status="degraded" />
          <SectionTitle>{t("dashboard.uptimekuma.title")}</SectionTitle>
        </div>
      </div>
      <div className="flex items-center gap-2 px-4 py-3">
        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
        <span className="text-xs text-zinc-600 dark:text-zinc-300 flex-1">
          {t("dashboard.uptimekuma.errors.loadFailed")}
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ↻
        </button>
      </div>
    </section>
  );
}

export function UptimeKumaPanel() {
  const { t } = useTranslation("common");
  const query = useUptimekumaMonitors();
  const [modalOpen, setModalOpen] = useState(false);

  // 400 — plugin disabled or not configured — hide silently.
  if (query.isError) {
    const message =
      query.error instanceof Error ? query.error.message : String(query.error);
    if (/400|not enabled|not configured/i.test(message)) {
      return null;
    }
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  if (query.isLoading || !query.data) {
    return <PanelSkeleton />;
  }

  const { summary, monitors } = query.data;
  if (summary.total === 0) {
    return null;
  }
  const overallStatus = deriveOverallStatus(summary);
  const unhealthy = monitors.filter(
    (m) => m.status === "down" || m.status === "pending",
  );
  const visible = unhealthy.slice(0, MAX_INLINE_ROWS);
  const overflow = unhealthy.length - visible.length;

  return (
    <>
      <UptimeKumaMonitorsModal open={modalOpen} onOpenChange={setModalOpen} />
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <AccentBar status={overallStatus} />
            <Activity
              className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400"
              strokeWidth={2}
            />
            <SectionTitle>{t("dashboard.uptimekuma.title")}</SectionTitle>
          </div>
          <SummaryPill status={overallStatus} summary={summary} />
        </div>

        {unhealthy.length > 0 ? (
          <div className="px-4 py-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {visible.map((m) => (
              <MonitorRow key={m.id} monitor={m} />
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-2.5 py-1.5 text-left text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0" />
                {t("dashboard.uptimekuma.plusMore", { count: overflow })}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3">
            <StatusDot status="up" />
            <span className="text-xs text-zinc-600 dark:text-zinc-300">
              {t("dashboard.uptimekuma.allHealthy")}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <span>{t("dashboard.uptimekuma.viewAll")}</span>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        </button>
      </section>
    </>
  );
}
