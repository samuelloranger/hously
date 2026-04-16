import { Fragment, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from "@headlessui/react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
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
  down: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  maintenance:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  up: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
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
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
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
        <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
          {monitor.name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
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
        <span className="text-[11px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
          {monitors.length}
        </span>
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
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

  const PORTAL_ID = "hously-dialog-root";
  if (typeof document === "undefined") return null;
  const portalRoot =
    document.getElementById(PORTAL_ID) ??
    (() => {
      const el = document.createElement("div");
      el.id = PORTAL_ID;
      document.body.appendChild(el);
      return el;
    })();

  return createPortal(
    <Transition appear show={open} as={Fragment}>
      <Dialog
        open={open}
        as="div"
        className="fixed inset-0 z-[var(--z-modal)]"
        onClose={() => onOpenChange(false)}
      >
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto overscroll-contain pointer-events-none">
          <div className="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95 translate-y-2"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-2"
            >
              <DialogPanel className="pointer-events-auto w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
                <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("dashboard.uptimekuma.viewAll")}
                    </DialogTitle>
                    {updatedAgo && (
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                        {t("dashboard.uptimekuma.updatedAgo", {
                          relative: updatedAgo,
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label={t("common.close")}
                    className="p-1 rounded-full text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-4 pb-4">
                  {query.isLoading && !query.data ? (
                    <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      …
                    </div>
                  ) : !query.data || query.data.monitors.length === 0 ? (
                    <div className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
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
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>,
    portalRoot,
  );
}
