import { useDashboardC411Stats } from "@/pages/settings/useDashboardC411Stats";
import { useDashboardLaCaleStats } from "@/pages/settings/useDashboardLaCaleStats";
import { useDashboardTorr9Stats } from "@/pages/settings/useDashboardTorr9Stats";
import { useDashboardYggRebornStats } from "@/pages/settings/useDashboardYggRebornStats";
import {
  formatRelativeTime,
  resolveDateFnsLocale,
} from "@/lib/utils/relativeTime";
import { formatGo, formatRatio } from "@hously/shared/utils";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, Radio, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";

type TrackerInfo = {
  key: string;
  label: string;
  logoUrl: string;
  enabled: boolean;
  connected: boolean;
  uploaded_go: number | null;
  downloaded_go: number | null;
  ratio: number | null;
  updated_at: string | null;
  error?: string;
};

type RatioTone = {
  text: string;
  fill: string;
  rail: string;
  glow: string;
};

/**
 * Maps a share ratio to a Cozy Dusk health palette. Semantic colors
 * (emerald/amber/rose) are intentional — the ratio's color IS the signal.
 */
function ratioTone(ratio: number | null): RatioTone {
  if (ratio == null)
    return {
      text: "text-neutral-400",
      fill: "bg-neutral-600",
      rail: "bg-neutral-700",
      glow: "",
    };
  if (ratio >= 1.5)
    return {
      text: "text-emerald-400",
      fill: "bg-emerald-400",
      rail: "bg-emerald-500",
      glow: "bg-emerald-500/20",
    };
  if (ratio >= 1.0)
    return {
      text: "text-amber-400",
      fill: "bg-amber-400",
      rail: "bg-amber-500",
      glow: "bg-amber-500/20",
    };
  return {
    text: "text-rose-400",
    fill: "bg-rose-400",
    rail: "bg-rose-500",
    glow: "bg-rose-500/20",
  };
}

function TrackerCard({
  tracker,
  locale,
}: {
  tracker: TrackerInfo;
  locale: Parameters<typeof formatRelativeTime>[1]["locale"];
}) {
  const { t } = useTranslation("common");
  const tone = ratioTone(tracker.ratio);
  const hasRatio = tracker.connected && tracker.ratio != null;
  const meterFill = hasRatio
    ? `${Math.max(Math.min((tracker.ratio! / 3.0) * 100, 100), 4)}%`
    : "0%";

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden transition-colors",
        tracker.connected
          ? "hover:bg-neutral-800/40"
          : "opacity-70 hover:opacity-100",
      )}
    >
      {/* Ledger margin: health rail */}
      <span
        aria-hidden
        className={cn(
          "w-[3px] shrink-0 self-stretch",
          tracker.connected ? tone.rail : "bg-neutral-700",
        )}
      />

      {/* Warm health glow behind the ratio */}
      {hasRatio && tone.glow ? (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -left-4 -top-6 size-24 rounded-full blur-2xl opacity-60",
            tone.glow,
          )}
        />
      ) : null}

      <div className="relative flex flex-1 flex-col gap-2.5 px-4 pt-3.5 pb-3.5 min-w-0">
        {/* Row 1: logo chip + label + sync time + status dot */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset ring-1 ring-border-strong">
              <img
                src={tracker.logoUrl}
                alt={tracker.label}
                className="size-4 rounded object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </span>
            <span className="truncate text-[10px] font-bold tracking-[0.14em] uppercase text-neutral-400">
              {tracker.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {tracker.connected && tracker.updated_at && (
              <span className="text-[9px] text-neutral-600 tabular-nums">
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
            {/* Row 2: hero ratio (Fraunces) + transfer stats */}
            <div className="flex items-end justify-between gap-4">
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "font-display text-[2rem] font-semibold leading-none tabular-nums",
                    tone.text,
                  )}
                >
                  {formatRatio(tracker.ratio)}
                </span>
                <span className="mt-1.5 text-[8px] font-bold tracking-[0.22em] uppercase text-neutral-600">
                  {t("dashboard.trackers.ratioLabel", {
                    defaultValue: "Ratio",
                  })}
                </span>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <div className="flex items-center justify-end gap-1.5">
                  <ArrowDown
                    size={10}
                    className="text-sky-400 shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-200">
                    {formatGo(tracker.downloaded_go)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <ArrowUp
                    size={10}
                    className="text-emerald-400 shrink-0"
                    strokeWidth={2.5}
                  />
                  <span className="font-mono text-[12px] font-semibold tabular-nums text-neutral-200">
                    {formatGo(tracker.uploaded_go)}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 3: refined ratio meter */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  tone.fill,
                )}
                style={{ width: meterFill }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 py-1.5">
            <WifiOff
              size={13}
              className="text-neutral-500 shrink-0"
              strokeWidth={2}
            />
            <span className="truncate text-xs italic text-neutral-400">
              {tracker.error ?? t("dashboard.home.trackerNotConnected")}
            </span>
          </div>
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
  const yggReborn = useDashboardYggRebornStats();

  const trackers: TrackerInfo[] = [
    {
      key: "c411",
      label: t("dashboard.trackers.providers.c411"),
      logoUrl: "/icons/c411.png",
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
      logoUrl: "/icons/torr9.png",
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
      logoUrl: "/icons/la-cale.png",
      enabled: Boolean(laCale.data?.enabled),
      connected: Boolean(laCale.data?.connected),
      uploaded_go: laCale.data?.uploaded_go ?? null,
      downloaded_go: laCale.data?.downloaded_go ?? null,
      ratio: laCale.data?.ratio ?? null,
      updated_at: laCale.data?.updated_at ?? null,
      error: laCale.data?.error,
    },
    {
      key: "ygg-reborn",
      label: t("dashboard.trackers.providers.ygg-reborn"),
      logoUrl: "/icons/ygg-reborn.png",
      enabled: Boolean(yggReborn.data?.enabled),
      connected: Boolean(yggReborn.data?.connected),
      uploaded_go: yggReborn.data?.uploaded_go ?? null,
      downloaded_go: yggReborn.data?.downloaded_go ?? null,
      ratio: yggReborn.data?.ratio ?? null,
      updated_at: yggReborn.data?.updated_at ?? null,
      error: yggReborn.data?.error,
    },
  ];

  const enabledTrackers = trackers.filter((tr) => tr.enabled);
  if (enabledTrackers.length === 0) return null;

  const connectedCount = enabledTrackers.filter((tr) => tr.connected).length;

  return (
    <WidgetShell>
      <WidgetHeader
        icon={Radio}
        title={t("dashboard.home.privateTrackersTitle")}
        right={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                connectedCount > 0 ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
            <span className="text-[11px] font-medium text-neutral-400">
              {connectedCount > 0
                ? t("dashboard.trackers.onlineCount", {
                    connected: connectedCount,
                    total: enabledTrackers.length,
                  })
                : t("dashboard.trackers.offline")}
            </span>
          </div>
        }
      />

      <div className="divide-y divide-neutral-800">
        {enabledTrackers.map((tracker) => (
          <TrackerCard key={tracker.key} tracker={tracker} locale={locale} />
        ))}
      </div>
    </WidgetShell>
  );
}
