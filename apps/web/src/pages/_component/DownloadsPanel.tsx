import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Pin, PinOff, ArrowDown, ArrowUp, Clock } from "lucide-react";
import {
  usePinnedQbittorrentTorrent,
  useSetPinnedQbittorrentTorrent,
} from "@/pages/torrents/useDashboardQbittorrent";
import { useQbittorrentStatus } from "@/pages/torrents/useQbittorrentStatus";
import { DASHBOARD_ENDPOINTS } from "@/lib/endpoints";
import type { DashboardQbittorrentStatusResponse } from "@hously/shared/types";
import { formatSpeed, formatBytes } from "@/lib/utils/format";
import {
  formatQbittorrentEta,
  getQbittorrentProgressBarGradient,
} from "@hously/shared/utils";
import { useEventSourceState } from "@/lib/realtime/useEventSourceState";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-400">
      {children}
    </span>
  );
}

function BarTrack({ pct, stateClass }: { pct: number; stateClass: string }) {
  return (
    <div className="h-[3px] w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${stateClass}`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

export function DownloadsPanel() {
  const { t } = useTranslation("common");
  const { data: fallbackData, isLoading } = useQbittorrentStatus();
  const { data, streamConnected } =
    useEventSourceState<DashboardQbittorrentStatusResponse>({
      url: DASHBOARD_ENDPOINTS.QBITTORRENT.STREAM,
      initialData: fallbackData,
      treatInitialDataAsConnected: Boolean(fallbackData?.connected),
      onParseError: (err) => console.error("qbt stream parse error", err),
    });
  const pinnedQuery = usePinnedQbittorrentTorrent({ refetchInterval: 5_000 });
  const setPinned = useSetPinnedQbittorrentTorrent();

  const torrent = pinnedQuery.data?.torrent ?? null;
  const enabled = data?.enabled;
  const connected = data?.connected;
  const summary = data?.summary;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-4 rounded-full bg-sky-500 shrink-0" />
          <SectionTitle>{t("dashboard.home.downloadsTitle")}</SectionTitle>
        </div>
        {enabled && connected && (
          <span
            className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 ${
              streamConnected
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {streamConnected
              ? t("dashboard.home.liveBadge")
              : t("dashboard.qbittorrent.polling")}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Not connected */}
        {!enabled && !isLoading && (
          <p className="py-2 text-sm text-zinc-500 dark:text-zinc-400 text-center">
            {t("dashboard.home.qbittorrentNotConfigured")}
          </p>
        )}

        {/* Speed + summary stats */}
        {enabled && (
          <div>
            <Kicker>{t("dashboard.home.transfer")}</Kicker>
            <div className="mt-2 flex items-center gap-6">
              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-sky-600 dark:text-sky-400">
                <ArrowDown size={13} />
                {formatSpeed(summary?.download_speed ?? 0)}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                <ArrowUp size={13} />
                {formatSpeed(summary?.upload_speed ?? 0)}
              </div>
            </div>
            {summary && (
              <div className="mt-2 flex flex-wrap gap-3">
                {summary.downloading_count > 0 && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 font-mono font-semibold tabular-nums">
                    {t("dashboard.home.countDownloading", {
                      count: summary.downloading_count,
                    })}
                  </span>
                )}
                {summary.seeding_count > 0 && (
                  <span className="text-xs text-zinc-600 dark:text-zinc-300 font-mono font-semibold tabular-nums">
                    {t("dashboard.home.countSeeding", {
                      count: summary.seeding_count,
                    })}
                  </span>
                )}
                {summary.stalled_count > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono font-semibold tabular-nums">
                    {t("dashboard.home.countStalled", {
                      count: summary.stalled_count,
                    })}
                  </span>
                )}
                {summary.paused_count > 0 && (
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono font-semibold tabular-nums">
                    {t("dashboard.home.countPaused", {
                      count: summary.paused_count,
                    })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pinned torrent */}
        {torrent && (
          <div>
            <Kicker>{t("dashboard.home.pinnedKicker")}</Kicker>
            <div className="mt-2">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Pin size={12} className="shrink-0 text-amber-500" />
                  <Link
                    to="/torrents/$hash"
                    params={{ hash: torrent.id }}
                    className="text-sm font-medium text-zinc-700 dark:text-zinc-200 truncate hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
                  >
                    {torrent.name}
                  </Link>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                    {Math.round(torrent.progress * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPinned.mutate({ hash: null })}
                    disabled={setPinned.isPending}
                    className="text-zinc-400 hover:text-rose-400 transition-colors disabled:opacity-40"
                    title={t("dashboard.home.unpinTorrent")}
                  >
                    <PinOff size={12} />
                  </button>
                </div>
              </div>
              <BarTrack
                pct={Math.round(torrent.progress * 100)}
                stateClass={getQbittorrentProgressBarGradient(torrent.state)}
              />
              <div className="flex items-center gap-4 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  <Clock size={10} />
                  {formatQbittorrentEta(torrent.eta_seconds)}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatBytes(torrent.size_bytes)}
                </span>
                <span className="flex items-center gap-1 text-xs font-mono text-sky-600 dark:text-sky-400 tabular-nums">
                  <ArrowDown size={10} />
                  {formatSpeed(torrent.download_speed)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer link */}
      {enabled && (
        <Link
          to="/torrents"
          className="block px-4 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 text-center"
        >
          {t("dashboard.home.openTorrentsLink")}
        </Link>
      )}
    </section>
  );
}
