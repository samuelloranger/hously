import { useTranslation } from "react-i18next";
import type { DashboardQbittorrentTorrentPeersResponse } from "@hously/shared/types";
import { formatSpeed } from "@hously/shared/utils";
interface TorrentPeersTabProps {
  peersSnapshot: DashboardQbittorrentTorrentPeersResponse | null;
}

export function TorrentPeersTab({ peersSnapshot }: TorrentPeersTabProps) {
  const { t } = useTranslation("common");

  return (
    <div className="rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 overflow-hidden">
      {peersSnapshot?.connected === false ? (
        <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
          {peersSnapshot.error ??
            t(
              "torrents.disconnectedDescription",
              "qBittorrent is unreachable.",
            )}
        </div>
      ) : peersSnapshot?.peers?.length ? (
        <div className="max-h-[60dvh] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-700/50">
          {peersSnapshot.peers.slice(0, 150).map((peer) => (
            <div key={peer.id} className="px-5 py-3.5 flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {peer.ip ?? peer.id}
                  {peer.port != null ? `:${peer.port}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-400 truncate">
                  {peer.client ?? "--"}
                  {peer.country_code ? ` · ${peer.country_code}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-3 justify-end">
                  <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400 tabular-nums">
                    ↓{" "}
                    {peer.download_speed != null
                      ? formatSpeed(peer.download_speed)
                      : "--"}
                  </span>
                  <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                    ↑{" "}
                    {peer.upload_speed != null
                      ? formatSpeed(peer.upload_speed)
                      : "--"}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-[11px] text-neutral-400 dark:text-neutral-400 tabular-nums">
                  {peer.progress != null
                    ? `${Math.round(peer.progress * 100)}%`
                    : "--"}
                  {peer.relevance != null
                    ? ` · ${peer.relevance.toFixed(2)}`
                    : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-6 text-sm text-neutral-500 dark:text-neutral-400">
          {t("torrents.noPeers", "No peers")}
        </div>
      )}
    </div>
  );
}
