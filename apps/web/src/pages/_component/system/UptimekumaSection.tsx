import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, ChevronRight } from "lucide-react";
import type {
  UptimekumaMonitor,
  UptimekumaMonitorStatus,
  UptimekumaSummary,
} from "@hously/shared/types";
import { useUptimekumaMonitors } from "@/pages/_component/useUptimekumaMonitors";
import { UptimeKumaMonitorsModal } from "@/pages/_component/UptimeKumaMonitorsModal";
import { SectionTitle } from "./shared";

const MAX_INLINE_ROWS = 5;

type OverallStatus = "healthy" | "pending" | "degraded";

function deriveOverallStatus(summary: UptimekumaSummary): OverallStatus {
  if (summary.down > 0) return "degraded";
  if (summary.pending > 0) return "pending";
  return "healthy";
}

function MonitorStatusDot({
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
      ? "bg-rose-950/40 text-rose-300"
      : status === "pending"
        ? "bg-amber-950/40 text-amber-300"
        : "bg-emerald-950/40 text-emerald-300";
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
      <MonitorStatusDot
        status={monitor.status}
        pulse={monitor.status === "down"}
      />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-100">
        {monitor.name}
      </span>
      {monitor.type && (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide text-neutral-500">
          {monitor.type}
        </span>
      )}
    </div>
  );
}

export function UptimekumaSection() {
  const { t } = useTranslation("common");
  const query = useUptimekumaMonitors();
  const [modalOpen, setModalOpen] = useState(false);

  if (query.isLoading || !query.data) return null;
  if (query.isError) {
    const message =
      query.error instanceof Error ? query.error.message : String(query.error);
    if (/400|not enabled|not configured/i.test(message)) return null;
    return null;
  }

  const { summary, monitors } = query.data;
  if (summary.total === 0) return null;

  const overallStatus = deriveOverallStatus(summary);
  const accentColor =
    overallStatus === "degraded"
      ? "bg-rose-500"
      : overallStatus === "pending"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const unhealthy = monitors.filter(
    (m) => m.status === "down" || m.status === "pending",
  );
  const visible = unhealthy.slice(0, MAX_INLINE_ROWS);
  const overflow = unhealthy.length - visible.length;

  return (
    <>
      <UptimeKumaMonitorsModal open={modalOpen} onOpenChange={setModalOpen} />
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className={`w-1 h-4 rounded-full shrink-0 ${accentColor}`} />
            <Activity
              className="w-4 h-4 shrink-0 text-neutral-400"
              strokeWidth={2}
            />
            <SectionTitle>{t("dashboard.uptimekuma.title")}</SectionTitle>
          </div>
          <SummaryPill status={overallStatus} summary={summary} />
        </div>

        {unhealthy.length > 0 ? (
          <div className="divide-y divide-neutral-800/60">
            {visible.map((m) => (
              <MonitorRow key={m.id} monitor={m} />
            ))}
            {overflow > 0 && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="w-full flex items-center gap-2.5 py-1.5 text-left text-xs font-medium text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-neutral-600 shrink-0" />
                {t("dashboard.uptimekuma.plusMore", { count: overflow })}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MonitorStatusDot status="up" />
            <span className="text-xs text-neutral-300">
              {t("dashboard.uptimekuma.allHealthy")}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-2 flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100 transition-colors font-medium"
        >
          <ChevronRight size={12} />
          {t("dashboard.uptimekuma.viewAll")}
        </button>
      </div>
    </>
  );
}
