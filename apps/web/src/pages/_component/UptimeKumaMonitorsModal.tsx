import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Dialog } from "@/components/dialog";
import { useUptimekumaMonitors } from "@/pages/_component/useUptimekumaMonitors";
import type {
  UptimekumaMonitor,
  UptimekumaMonitorStatus,
} from "@hously/shared/types";

const STATUS_ORDER: UptimekumaMonitorStatus[] = [
  "down",
  "pending",
  "maintenance",
  "up",
];

const STATUS_COLORS: Record<UptimekumaMonitorStatus, string> = {
  down: "bg-rose-500",
  pending: "bg-amber-500",
  maintenance: "bg-sky-500",
  up: "bg-emerald-500",
};

const STATUS_TINT: Record<UptimekumaMonitorStatus, string> = {
  down: "bg-rose-950/40 text-rose-300",
  pending:
    "bg-amber-950/40 text-amber-300",
  maintenance: "bg-sky-950/40 text-sky-300",
  up: "bg-emerald-950/40 text-emerald-300",
};

function StatusDot({
  status,
  pulse,
}: {
  status: UptimekumaMonitorStatus;
  pulse?: boolean;
}) {
  const color = STATUS_COLORS[status];
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {pulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${color}`}
        />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`}
      />
    </span>
  );
}

function MonitorRow({ monitor }: { monitor: UptimekumaMonitor }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-1">
      <div className="pt-1.5">
        <StatusDot status={monitor.status} pulse={monitor.status === "down"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-neutral-100 truncate">
          {monitor.name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-neutral-400 font-mono">
          {monitor.type && (
            <span className="uppercase tracking-wide">{monitor.type}</span>
          )}
          {monitor.url && (
            <span className="truncate" title={monitor.url}>
              {monitor.url}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  status,
  monitors,
}: {
  status: UptimekumaMonitorStatus;
  monitors: UptimekumaMonitor[];
}) {
  const { t } = useTranslation("common");
  if (monitors.length === 0) return null;

  return (
    <section className="space-y-0">
      <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em] ${STATUS_TINT[status]}`}
        >
          {t(`dashboard.uptimekuma.sections.${status}`)}
        </span>
        <span className="text-[11px] font-mono tabular-nums text-neutral-500">
          {monitors.length}
        </span>
      </div>
      <div className="divide-y divide-neutral-800/60">
        {monitors.map((m) => (
          <MonitorRow key={m.id} monitor={m} />
        ))}
      </div>
    </section>
  );
}

export function UptimeKumaMonitorsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation("common");
  const query = useUptimekumaMonitors({ enabled: open });

  const grouped = useMemo(() => {
    const map: Record<UptimekumaMonitorStatus, UptimekumaMonitor[]> = {
      down: [],
      pending: [],
      maintenance: [],
      up: [],
    };
    if (!query.data) return map;
    for (const m of query.data.monitors) {
      map[m.status].push(m);
    }
    return map;
  }, [query.data]);

  const locale = i18n.language?.startsWith("fr") ? fr : enUS;
  const updatedAgo = query.data?.fetched_at
    ? formatDistanceToNow(new Date(query.data.fetched_at), {
        addSuffix: true,
        locale,
      })
    : null;

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={t("dashboard.uptimekuma.viewAll")}
      panelClassName="max-w-lg p-0"
      bodyScroll
    >
      <div className="flex flex-col min-h-0">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-700">
          {updatedAgo && (
            <p className="mt-0.5 text-[11px] text-neutral-400 font-mono">
              {t("dashboard.uptimekuma.updatedAgo", {
                relative: updatedAgo,
              })}
            </p>
          )}
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          {query.isLoading && !query.data ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              …
            </div>
          ) : !query.data || query.data.monitors.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              {t("dashboard.uptimekuma.empty")}
            </div>
          ) : (
            STATUS_ORDER.map((status) => (
              <Section
                key={status}
                status={status}
                monitors={grouped[status]}
              />
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}
