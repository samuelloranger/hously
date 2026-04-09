import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LibraryFileInfo } from "@hously/shared/types";
import type { useSearchLibraryEpisode } from "@/hooks/useLibrary";
import { Badge, StatusDot } from "./LibrarySharedUI";
import { qualityBadges } from "@/utils/libraryDisplayUtils";
import { FileDetailBlock } from "./LibraryFileDetailBlock";

export interface MergedEpisodeRowProps {
  ep: {
    id: number;
    episode: number;
    title: string | null;
    status: string;
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
}

export function MergedEpisodeRow({
  ep,
  season,
  file,
  libraryId,
  t,
  onSearchEpisode,
  searchEpMut,
}: MergedEpisodeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const badges = file ? qualityBadges(file) : [];

  return (
    <div className="border-b last:border-0 border-neutral-100 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => file && setExpanded((p) => !p)}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-2 text-left transition-colors",
          file && "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
        )}
      >
        <StatusDot status={ep.status} />
        <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 w-8">
          E{String(ep.episode).padStart(2, "0")}
        </span>
        <span className="flex-1 min-w-0 truncate text-[11px] text-neutral-700 dark:text-neutral-300">
          {ep.title ?? "—"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {badges.slice(0, 2).map((b) => (
            <Badge key={b.label} className={cn(b.cls, "text-[9px] py-0")}>
              {b.label}
            </Badge>
          ))}
          {onSearchEpisode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSearchEpisode({
                  id: ep.id,
                  season,
                  episode: ep.episode,
                  title: ep.title ?? null,
                });
              }}
              title={t("library.episodeInteractiveSearchTitle")}
              className="rounded p-1 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors"
            >
              <Search size={11} />
            </button>
          )}
          {ep.status === "wanted" && ep.search_attempts < 5 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void searchEpMut
                  .mutateAsync({ mediaId: libraryId, episodeId: ep.id })
                  .then((r) => {
                    if (r.grabbed)
                      toast.success(t("library.management.grabbed"));
                    else
                      toast.error(
                        r.reason ?? t("library.management.grabFailed"),
                      );
                  })
                  .catch(() => toast.error(t("library.management.grabFailed")));
              }}
              disabled={searchEpMut.isPending}
              className="rounded-md bg-indigo-600/90 px-2 py-0.5 text-[9px] font-semibold text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {t("library.management.episodeSearch")}
            </button>
          )}
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
      </button>

      {expanded && file && (
        <div className="px-4 pb-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/20">
          <FileDetailBlock file={file} />
        </div>
      )}
    </div>
  );
}
