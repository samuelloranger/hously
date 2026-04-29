import {
  useDashboardC411Stats,
  useDashboardLaCaleStats,
  useDashboardTorr9Stats,
} from "@/pages/settings/useIntegrations";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";
import { formatGo, formatRatio } from "@hously/shared/utils";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, Radio, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

type TrackerInfo = {
  key: string;
  label: string;
  enabled: boolean;
  connected: boolean;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  updated_at: string | null;
  error?: string;
};

function ratioTextColor(ratio: number | null) {
  if (ratio == null) return "text-zinc-400 dark:text-zinc-500";
  if (ratio >= 1.5) return "text-emerald-500 dark:text-emerald-400";
  if (ratio >= 1.0) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

function ratioStripeColor(ratio: number | null) {
  if (ratio == null) return "bg-zinc-300 dark:bg-zinc-600";
  if (ratio >= 1.5) return "bg-emerald-500";
  if (ratio >= 1.0) return "bg-amber-500";
  return "bg-rose-500";
}

function ratioBarGradient(ratio: number | null) {
  if (ratio == null) return "from-zinc-300 to-zinc-400";
  if (ratio >= 1.5) return "from-emerald-400 to-emerald-500";
  if (ratio >= 1.0) return "from-amber-400 to-amber-500";
  return "from-rose-400 to-rose-500";
}

function TrackerCard({
  tracker,
  locale,
}: {
  tracker: TrackerInfo;
  locale: Parameters<typeof formatRelativeTime>[1]["locale"];
}) {
  const { t } = useTranslation("common");
  const barFill = tracker.ratio != null
    ? `${Math.max(Math.min((tracker.ratio / 3.0) * 100, 100), 2)}%`
    : "0%";

  return (
    <div className="relative flex flex-col overflow-hidden">
      {/* Health stripe — left edge, full height */}
      <div
        className={cn(
          "absolute left-0 inset-y-0 w-[3px]",
          tracker.connected ? ratioStripeColor(tracker.ratio) : "bg-rose-500",
        )}
      />

      {/* Content */}
      <div className="flex flex-col gap-3 pl-[18px] pr-4 pt-4 pb-3">
        {/* Row 1: tracker label + sync time + status dot */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-400 dark:text-zinc-500">
            {tracker.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {tracker.connected && tracker.updated_at && (
              <span className="text-[9px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                {formatRelativeTime(tracker.updated_at, { locale })}
              </span>
            )}
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                tracker.connected
                  ? "bg-emerald-500 animate-pulse"
                  : "bg-rose-500",
              )}
            />
          </div>
        </div>

        {tracker.connected ? (
          <>
            {/* Row 2: ratio hero */}
            <div className="flex items-baseline gap-2 leading-none">
              <span
                className={cn(
                  "font-mono text-[2rem] font-bold tabular-nums leading-none",
                  ratioTextColor(tracker.ratio),
                )}
              >
                {formatRatio(tracker.ratio)}
              </span>
              <span className="text-[8px] font-bold tracking-[0.2em] uppercase text-zinc-400 dark:text-zinc-600 pb-0.5">
                ratio
              </span>
            </div>

            {/* Row 3: transfer stats */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <ArrowDown size={9} className="text-sky-400" strokeWidth={2.5} />
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    dl
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {formatGo(tracker.downloaded_go)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <ArrowUp size={9} className="text-emerald-400" strokeWidth={2.5} />
                  <span className="text-[8px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    ul
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {formatGo(tracker.uploaded_go)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <WifiOff size={13} className="text-rose-400 shrink-0" strokeWidth={2} />
            <span className="text-xs italic text-rose-400 dark:text-rose-500">
              {tracker.error ?? t("dashboard.home.trackerNotConnected")}
            </span>
          </div>
        )}
      </div>

      {/* Health bar — flush bottom, no padding */}
      <div className="h-[3px] bg-zinc-100 dark:bg-zinc-800">
        {tracker.connected && tracker.ratio != null && (
          <div
            className={cn("h-full bg-gradient-to-r", ratioBarGradient(tracker.ratio))}
            style={{ width: barFill }}
          />
        )}
      </div>
    </div>
  );
}

export function TrackersPanel() {
  const { t, i18n } = useTranslation("common");
  const locale = resolveDateFnsLocale(i18n.language);

  const c411 = useDashboardC411Stats();
  const torr9 = useDashboardTorr9Stats();
  const laCale = useDashboardLaCaleStats();

  const trackers: TrackerInfo[] = [
    {
      key: "c411",
      label: t("dashboard.trackers.providers.c411"),
      enabled: Boolean(c411.data?.enabled),
      connected: Boolean(c411.data?.connected),
      uploaded_go: c411.data?.uploaded_go ?? null,
      downloaded_go: c411.data?.downloaded_go ?? null,
      ratio: c411.data?.ratio ?? null,
      updated_at: c411.data?.updated_at ?? null,
      error: c411.data?.error,
    },
    {
      key: "torr9",
      label: t("dashboard.trackers.providers.torr9"),
      enabled: Boolean(torr9.data?.enabled),
      connected: Boolean(torr9.data?.connected),
      uploaded_go: torr9.data?.uploaded_go ?? null,
      downloaded_go: torr9.data?.downloaded_go ?? null,
      ratio: torr9.data?.ratio ?? null,
      updated_at: torr9.data?.updated_at ?? null,
      error: torr9.data?.error,
    },
    {
      key: "la-cale",
      label: t("dashboard.trackers.providers.la-cale"),
      enabled: Boolean(laCale.data?.enabled),
      connected: Boolean(laCale.data?.connected),
      uploaded_go: laCale.data?.uploaded_go ?? null,
      downloaded_go: laCale.data?.downloaded_go ?? null,
      ratio: laCale.data?.ratio ?? null,
      updated_at: laCale.data?.updated_at ?? null,
      error: laCale.data?.error,
    },
  ];

  const enabledTrackers = trackers.filter((tr) => tr.enabled);
  if (enabledTrackers.length === 0) return null;

  const connectedCount = enabledTrackers.filter((tr) => tr.connected).length;

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1 h-4 rounded-full bg-purple-500 shrink-0" />
        <Radio className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
          {t("dashboard.home.privateTrackersTitle")}
        </h3>
        <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              connectedCount > 0 ? "bg-emerald-500" : "bg-rose-500",
            )}
          />
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {connectedCount > 0
              ? t("dashboard.trackers.onlineCount", {
                  connected: connectedCount,
                  total: enabledTrackers.length,
                })
              : t("dashboard.trackers.offline")}
          </span>
        </div>
      </div>

      {/* Cards: 3-col on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-100 dark:divide-zinc-800">
        {enabledTrackers.map((tracker) => (
          <TrackerCard key={tracker.key} tracker={tracker} locale={locale} />
        ))}
      </div>
    </section>
  );
}
