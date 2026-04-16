import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryFileInfo } from "@hously/shared/types";
import type {
  useRetrySkippedMedia,
  useSearchLibraryEpisode,
  useToggleEpisodeMonitored,
} from "@/features/medias/hooks/useLibrary";
import { Badge, StatusDot } from "./LibrarySharedUI";
import { qualityBadges } from "@/utils/libraryDisplayUtils";
import { FileDetailBlock } from "./LibraryFileDetailBlock";

export interface MergedEpisodeRowProps {
  ep: {
    id: number;
    episode: number;
    title: string | null;
    air_date: string | null;
    status: string;
    monitored: boolean;
    search_attempts: number;
  };
  season: number;
  file: LibraryFileInfo | null;
  libraryId: number;
  t: ReturnType<typeof useTranslation>["t"];
  onSearchEpisode?: (ep: {
    id: number;
    season: number;
    episode: number;
    title: string | null;
  }) => void;
  searchEpMut: ReturnType<typeof useSearchLibraryEpisode>;
  retryEpMut: ReturnType<typeof useRetrySkippedMedia>;
  toggleMonitoredMut: ReturnType<typeof useToggleEpisodeMonitored>;
}

function formatAirDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

const statusBorderColor: Record<string, string> = {
  downloaded: "border-l-emerald-500/60 dark:border-l-emerald-500/40",
  downloading: "border-l-sky-400/60 dark:border-l-sky-400/40",
  skipped: "border-l-amber-400/50 dark:border-l-amber-400/30",
  wanted: "border-l-neutral-300/60 dark:border-l-neutral-600/40",
};

export function MergedEpisodeRow({
  ep,
  season,
  file,
  libraryId,
  t,
  onSearchEpisode,
  searchEpMut,
  retryEpMut,
  toggleMonitoredMut,
}: MergedEpisodeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const badges = file ? qualityBadges(file) : [];
  const isFuture = ep.air_date != null && new Date(ep.air_date) > new Date();

  const handleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSearchEpisode) return;
    onSearchEpisode({
      id: ep.id,
      season,
      episode: ep.episode,
      title: ep.title ?? null,
    });
  };

  const handleAutoSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    void searchEpMut
      .mutateAsync({ mediaId: libraryId, episodeId: ep.id })
      .then((r) => {
        if (r.grabbed) toast.success(t("library.management.grabbed"));
        else toast.error(r.reason ?? t("library.management.grabFailed"));
      })
      .catch(() => toast.error(t("library.management.grabFailed")));
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    void retryEpMut
      .mutateAsync({ mediaId: libraryId, episodeId: ep.id })
      .then(() => toast.success(t("library.management.retrySearchQueued")))
      .catch(() => toast.error(t("library.management.grabFailed")));
  };

  const handleToggleMonitored = (e: React.MouseEvent) => {
    e.stopPropagation();
    void toggleMonitoredMut
      .mutateAsync({
        mediaId: libraryId,
        episodeId: ep.id,
        monitored: !ep.monitored,
      })
      .catch(() => toast.error(t("library.management.grabFailed")));
  };

  return (
    <div
      className={cn(
        "border-b last:border-b-0 border-neutral-100 dark:border-neutral-800",
        "border-l-2",
        statusBorderColor[ep.status] ?? statusBorderColor.wanted,
      )}
    >
      <button
        type="button"
        onClick={() => file && setExpanded((p) => !p)}
        className={cn(
          "w-full text-left transition-colors",
          "px-3 pr-2 py-2.5 mobile-max:px-4 mobile-max:py-2",
          file &&
            "cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
          !file && "cursor-default",
          !ep.monitored && "opacity-50",
        )}
      >
        {/* ── Mobile layout (< 945px): stacked rows ── */}
        <div className="flex flex-col gap-1.5 mobile-max:hidden">
          {/* Row 1: status + episode number + title + air date */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex w-3.5 shrink-0 justify-center">
              <StatusDot status={ep.status} />
            </span>
            <span className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
              E{String(ep.episode).padStart(2, "0")}
            </span>
            <span className="text-xs text-neutral-700 dark:text-neutral-300 min-w-0 truncate">
              {ep.title ?? "—"}
            </span>
            {isFuture && ep.air_date && (
              <span className="ml-auto shrink-0 text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
                {formatAirDate(ep.air_date)}
              </span>
            )}
          </div>

          {/* Row 2: badges + actions */}
          <div className="flex items-center gap-1.5 pl-6">
            {badges.slice(0, 2).map((b) => (
              <Badge key={b.label} className={cn(b.cls, "text-[10px]")}>
                {b.label}
              </Badge>
            ))}

            <div className="ml-auto -mr-2 flex items-center">
              {onSearchEpisode && (
                <button
                  type="button"
                  onClick={handleSearch}
                  title={t("library.episodeInteractiveSearchTitle")}
                  className="rounded-md p-2.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
                >
                  <Search size={14} />
                </button>
              )}
              {ep.status === "wanted" && (
                <button
                  type="button"
                  onClick={handleAutoSearch}
                  disabled={searchEpMut.isPending}
                  title={t("library.management.episodeSearch")}
                  className="rounded-md p-2.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 disabled:opacity-50 transition-colors"
                >
                  <Download size={14} />
                </button>
              )}
              {ep.status === "skipped" && (
                <button
                  type="button"
                  title={t("library.management.retrySearchTitle")}
                  onClick={handleRetry}
                  disabled={retryEpMut.isPending}
                  className="rounded-md p-2.5 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={14} />
                </button>
              )}
              <button
                type="button"
                title={
                  ep.monitored
                    ? t("library.management.unmonitor")
                    : t("library.management.monitor")
                }
                onClick={handleToggleMonitored}
                disabled={toggleMonitoredMut.isPending}
                className="rounded-md p-2.5 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 disabled:opacity-50 transition-colors"
              >
                {ep.monitored ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              {file && (
                <span className="p-1.5 text-neutral-300 dark:text-neutral-600">
                  {expanded ? (
                    <ChevronDown size={12} />
                  ) : (
                    <ChevronRight size={12} />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop layout (≥ 945px): single row ── */}
        <div className="hidden mobile-max:flex items-center gap-2 min-w-0">
          <StatusDot status={ep.status} />
          <span className="font-mono text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500 shrink-0 w-8">
            E{String(ep.episode).padStart(2, "0")}
          </span>
          <span className="text-[11px] text-neutral-700 dark:text-neutral-300 min-w-0 flex-1 truncate">
            {ep.title ?? "—"}
          </span>

          {isFuture && ep.air_date && (
            <span className="shrink-0 text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
              {formatAirDate(ep.air_date)}
            </span>
          )}

          {badges.slice(0, 2).map((b) => (
            <Badge key={b.label} className={cn(b.cls, "text-[9px] py-0")}>
              {b.label}
            </Badge>
          ))}

          <div className="shrink-0 flex items-center gap-0.5">
            {onSearchEpisode && (
              <button
                type="button"
                onClick={handleSearch}
                title={t("library.episodeInteractiveSearchTitle")}
                className="rounded p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                <Search size={11} />
              </button>
            )}
            {ep.status === "wanted" && (
              <button
                type="button"
                onClick={handleAutoSearch}
                disabled={searchEpMut.isPending}
                className="rounded-md bg-indigo-600/90 px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
              >
                {t("library.management.episodeSearch")}
              </button>
            )}
            {ep.status === "skipped" && (
              <button
                type="button"
                title={t("library.management.retrySearchTitle")}
                onClick={handleRetry}
                disabled={retryEpMut.isPending}
                className="rounded p-1 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={11} />
              </button>
            )}
            <button
              type="button"
              title={
                ep.monitored
                  ? t("library.management.unmonitor")
                  : t("library.management.monitor")
              }
              onClick={handleToggleMonitored}
              disabled={toggleMonitoredMut.isPending}
              className="rounded p-1 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 disabled:opacity-50 transition-colors"
            >
              {ep.monitored ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            {file && (
              <span className="rounded p-1 text-neutral-300 dark:text-neutral-600">
                {expanded ? (
                  <ChevronDown size={10} />
                ) : (
                  <ChevronRight size={10} />
                )}
              </span>
            )}
          </div>
        </div>
      </button>

      {expanded && file && (
        <div className="px-3 pb-3 pt-2 mobile-max:px-4 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20">
          <FileDetailBlock file={file} />
        </div>
      )}
    </div>
  );
}
