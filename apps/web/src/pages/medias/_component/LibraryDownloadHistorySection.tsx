import { useState } from "react";
import { ChevronDown, Clock, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLibraryDownloads } from "@/hooks/useLibrary";
import { Badge, Card } from "./LibrarySharedUI";
import { cn } from "@/lib/utils";

interface LibraryDownloadHistorySectionProps {
  libraryId: number;
}

export function LibraryDownloadHistorySection({
  libraryId,
}: LibraryDownloadHistorySectionProps) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useLibraryDownloads(libraryId);
  const [open, setOpen] = useState(false);
  const items = data?.items ?? [];

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
        style={{ touchAction: "manipulation" }}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
          <Download size={12} className="text-neutral-400 shrink-0" />
          {t("library.management.downloads")}
          {items.length > 0 && (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-200 dark:bg-neutral-700 px-1 text-[9px] font-bold text-neutral-600 dark:text-neutral-300 tabular-nums">
              {items.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={13}
          className={cn(
            "shrink-0 text-neutral-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-neutral-100 dark:border-neutral-800 px-4 pb-4 pt-3">
          {isLoading ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("library.management.searching")}
            </p>
          ) : items.length === 0 ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t("library.management.noDownloads")}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((row) => {
                const statusColor = row.failed
                  ? "border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/10"
                  : row.completed_at
                    ? "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/10"
                    : "border-sky-200 dark:border-sky-900/60 bg-sky-50/50 dark:bg-sky-950/10";

                return (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 space-y-1.5",
                      statusColor,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className="text-[11px] font-medium text-neutral-800 dark:text-neutral-100 leading-snug min-w-0 truncate"
                        title={row.release_title}
                      >
                        {row.release_title}
                      </p>
                      {row.failed ? (
                        <Badge className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 shrink-0">
                          {t("library.download.failed")}
                        </Badge>
                      ) : row.completed_at ? (
                        <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                          {t("library.download.done")}
                        </Badge>
                      ) : (
                        <Badge className="bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 shrink-0">
                          {t("library.download.active")}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-neutral-500 dark:text-neutral-400">
                      {row.indexer && <span>{row.indexer}</span>}
                      <span className="flex items-center gap-1">
                        <Clock size={8} />
                        {new Date(row.grabbed_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    {row.post_process_error ? (
                      <p
                        className="text-[10px] text-red-600 dark:text-red-400 leading-snug"
                        title={row.post_process_error}
                      >
                        {row.post_process_error}
                      </p>
                    ) : row.post_process_destination_path ? (
                      <p
                        className="font-mono text-[9px] text-neutral-500 dark:text-neutral-400 truncate"
                        title={row.post_process_destination_path}
                      >
                        {row.post_process_destination_path}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
