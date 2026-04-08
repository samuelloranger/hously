import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { QbittorrentTorrentListItem } from "@hously/shared/types";
import {
  formatBytes,
  formatSpeed,
  getQbittorrentProgressBarGradient,
  getQbittorrentStatusDot,
} from "@hously/shared/utils";
import { cn } from "@/lib/utils";

type KanbanColumnId =
  | "downloading"
  | "seeding"
  | "paused"
  | "complete"
  | "error";

function getKanbanColumn(state: string): KanbanColumnId {
  const s = state.toLowerCase();
  if (
    s === "downloading" ||
    s === "stalleddl" ||
    s === "forceddl" ||
    s === "queueddl" ||
    s === "metadl" ||
    s === "moving" ||
    s === "checkingresumedata" ||
    s.includes("checking")
  )
    return "downloading";
  if (
    s === "uploading" ||
    s === "stalledup" ||
    s === "forcedup" ||
    s === "queuedup"
  )
    return "seeding";
  if (s.includes("paused") || s.includes("stopped")) return "paused";
  if (s === "completed") return "complete";
  if (s === "error" || s === "missingfiles") return "error";
  // Unknown states fall into downloading as a catch-all
  return "downloading";
}

const KANBAN_COLUMNS: {
  id: KanbanColumnId;
  titleKey: string;
  headerBg: string;
  titleColor: string;
  countColor: string;
  borderColor: string;
  dotColor: string;
  emptyBg: string;
}[] = [
  {
    id: "downloading",
    titleKey: "torrents.filterDownloading",
    headerBg: "bg-sky-50 dark:bg-sky-950/30",
    titleColor: "text-sky-700 dark:text-sky-300",
    countColor: "text-sky-500 dark:text-sky-400",
    borderColor: "border-sky-200 dark:border-sky-800/50",
    dotColor: "bg-sky-500",
    emptyBg: "bg-sky-50/50 dark:bg-sky-950/10",
  },
  {
    id: "seeding",
    titleKey: "torrents.filterSeeding",
    headerBg: "bg-emerald-50 dark:bg-emerald-950/30",
    titleColor: "text-emerald-700 dark:text-emerald-300",
    countColor: "text-emerald-500 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800/50",
    dotColor: "bg-emerald-500",
    emptyBg: "bg-emerald-50/50 dark:bg-emerald-950/10",
  },
  {
    id: "paused",
    titleKey: "torrents.filterPaused",
    headerBg: "bg-amber-50 dark:bg-amber-950/30",
    titleColor: "text-amber-700 dark:text-amber-300",
    countColor: "text-amber-500 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800/50",
    dotColor: "bg-amber-500",
    emptyBg: "bg-amber-50/50 dark:bg-amber-950/10",
  },
  {
    id: "complete",
    titleKey: "torrents.filterComplete",
    headerBg: "bg-neutral-100 dark:bg-neutral-800/50",
    titleColor: "text-neutral-600 dark:text-neutral-300",
    countColor: "text-neutral-500 dark:text-neutral-400",
    borderColor: "border-neutral-200 dark:border-neutral-700/60",
    dotColor: "bg-neutral-400",
    emptyBg: "bg-neutral-50/80 dark:bg-neutral-900/30",
  },
  {
    id: "error",
    titleKey: "torrents.filterError",
    headerBg: "bg-red-50 dark:bg-red-950/30",
    titleColor: "text-red-700 dark:text-red-300",
    countColor: "text-red-500 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800/50",
    dotColor: "bg-red-500",
    emptyBg: "bg-red-50/50 dark:bg-red-950/10",
  },
];

export function TorrentKanbanView({
  torrents,
}: {
  torrents: QbittorrentTorrentListItem[];
}) {
  const { t } = useTranslation("common");

  const columnMap = new Map<KanbanColumnId, QbittorrentTorrentListItem[]>(
    KANBAN_COLUMNS.map((col) => [col.id, []]),
  );
  for (const torrent of torrents) {
    const col = getKanbanColumn(torrent.state);
    columnMap.get(col)?.push(torrent);
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-1">
      <div
        className="flex gap-3 px-1 items-start"
        style={{ minWidth: `${KANBAN_COLUMNS.length * 17}rem` }}
      >
        {KANBAN_COLUMNS.map((col) => {
          const items = columnMap.get(col.id) ?? [];
          return (
            <div
              key={col.id}
              className={cn(
                "w-64 flex-shrink-0 rounded-2xl border overflow-hidden",
                col.borderColor,
              )}
            >
              {/* Column header — sticky within page scroll */}
              <div
                className={cn(
                  "sticky top-0 z-10 px-3 py-2.5 flex items-center justify-between border-b",
                  col.headerBg,
                  col.borderColor,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("w-2 h-2 rounded-full", col.dotColor)} />
                  <span className={cn("text-xs font-semibold", col.titleColor)}>
                    {t(col.titleKey)}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    col.countColor,
                  )}
                >
                  {items.length}
                </span>
              </div>

              {/* Cards — natural height, page scrolls */}
              <div className={cn("space-y-2 p-2", col.emptyBg)}>
                {items.length === 0 ? (
                  <p className="text-center text-[11px] text-neutral-300 dark:text-neutral-700 py-8 select-none">
                    —
                  </p>
                ) : (
                  items.map((torrent) => (
                    <KanbanCard key={torrent.id} torrent={torrent} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({ torrent }: { torrent: QbittorrentTorrentListItem }) {
  const { dot, pulse } = getQbittorrentStatusDot(torrent.state);
  const progress = Math.round(torrent.progress * 100);
  const barGradient = getQbittorrentProgressBarGradient(torrent.state);
  const isTransferring = torrent.download_speed > 0 || torrent.upload_speed > 0;

  return (
    <Link
      to="/torrents/$hash"
      params={{ hash: torrent.id }}
      className="block rounded-xl border border-neutral-200 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 p-2.5 hover:border-neutral-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-1.5">
        <span
          className={cn(
            "mt-0.5 block w-1.5 h-1.5 rounded-full shrink-0",
            dot,
            pulse && "animate-pulse",
          )}
        />
        <p className="text-[12px] font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug min-w-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {torrent.name}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            barGradient,
          )}
          style={{ width: `${Math.max(2, progress)}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 tabular-nums">
          {progress}%
        </span>
        <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 tabular-nums">
          {formatBytes(torrent.size_bytes)}
        </span>
      </div>

      {/* Speed row */}
      {isTransferring && (
        <div className="mt-1 flex items-center gap-2">
          {torrent.download_speed > 0 && (
            <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400 tabular-nums">
              ↓ {formatSpeed(torrent.download_speed)}
            </span>
          )}
          {torrent.upload_speed > 0 && (
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 tabular-nums">
              ↑ {formatSpeed(torrent.upload_speed)}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
