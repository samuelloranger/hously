import {
  useDashboardC411Stats,
  useDashboardLaCaleStats,
  useDashboardTorr9Stats,
} from "@/hooks/usePlugins";
import { formatGo, formatRatio, formatRelativeTime, resolveDateFnsLocale } from "@hously/shared/utils";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown } from "lucide-react";
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

function ratioColor(ratio: number | null) {
  if (ratio == null) return "text-zinc-400 dark:text-zinc-500";
  if (ratio >= 1.5) return "text-emerald-500 dark:text-emerald-400";
  if (ratio >= 1.0) return "text-amber-500 dark:text-amber-400";
  return "text-rose-500 dark:text-rose-400";
}

function ratioBarColor(ratio: number | null) {
  if (ratio == null) return "from-zinc-300 to-zinc-400";
  if (ratio >= 1.5) return "from-emerald-400 to-emerald-500";
  if (ratio >= 1.0) return "from-amber-400 to-amber-500";
  return "from-rose-400 to-rose-500";
}

function RatioProgressBar({ ratio }: { ratio: number }) {
  const fill = Math.min(ratio / 3.0, 1.0);
  return (
    <div className="relative h-[3px] rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", ratioBarColor(ratio))}
        style={{ width: `${Math.max(fill * 100, 2)}%` }}
      />
    </div>
  );
}

function TrackerRow({
  tracker,
  locale,
  isLast,
}: {
  tracker: TrackerInfo;
  locale: Parameters<typeof formatRelativeTime>[1]["locale"];
  isLast: boolean;
}) {
  const { t } = useTranslation("common");

  return (
    <>
      <div className={cn("px-4 pt-3", tracker.connected ? "pb-2" : "pb-3")}>
        <div className="flex items-center gap-3">
          {/* Left: name + time/error */}
          <div className="flex flex-col gap-0.5 min-w-[64px]">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "w-[7px] h-[7px] rounded-full shrink-0",
                  !tracker.enabled
                    ? "bg-zinc-300 dark:bg-zinc-600"
                    : tracker.connected
                      ? "bg-emerald-500"
                      : "bg-rose-500",
                )}
              />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-none">
                {tracker.label}
              </span>
            </div>
            {tracker.connected && tracker.updated_at ? (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 pl-[15px]">
                {formatRelativeTime(tracker.updated_at, { locale })}
              </span>
            ) : !tracker.connected ? (
              <span className="text-[10px] italic text-rose-400 dark:text-rose-500 pl-[15px] truncate">
                {tracker.error ?? t("dashboard.home.trackerNotConnected")}
              </span>
            ) : null}
          </div>

          <div className="flex-1" />

          {tracker.connected && (
            <>
              {/* Center: transfer stats */}
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-emerald-400">
                  <ArrowUp size={10} />
                  {formatGo(tracker.uploaded_go)}
                </div>
                <div className="flex items-center gap-1 font-mono text-xs font-medium tabular-nums text-sky-400">
                  <ArrowDown size={10} />
                  {formatGo(tracker.downloaded_go)}
                </div>
              </div>

              {/* Right: ratio hero */}
              <div className="flex flex-col items-end w-14 shrink-0">
                <span
                  className={cn(
                    "font-mono text-xl font-bold tabular-nums leading-none",
                    ratioColor(tracker.ratio),
                  )}
                >
                  {formatRatio(tracker.ratio)}
                </span>
                <span className="text-[8px] font-semibold tracking-widest text-zinc-400 dark:text-zinc-500 mt-0.5">
                  RATIO
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ratio progress bar */}
      {tracker.connected && tracker.ratio != null && (
        <div className="px-4 pb-3">
          <RatioProgressBar ratio={tracker.ratio} />
        </div>
      )}

      {/* Row divider */}
      {!isLast && (
        <div className="mx-4 h-px bg-zinc-100 dark:bg-zinc-800" />
      )}
    </>
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

      {/* Rows */}
      <div>
        {enabledTrackers.map((tracker, i) => (
          <TrackerRow
            key={tracker.key}
            tracker={tracker}
            locale={locale}
            isLast={i === enabledTrackers.length - 1}
          />
        ))}
      </div>
    </section>
  );
}
