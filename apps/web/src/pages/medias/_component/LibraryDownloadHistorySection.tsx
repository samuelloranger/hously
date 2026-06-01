import { useState } from "react";
import { ChevronDown, Clock, Download, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isRemovableDownloadHistoryEntry } from "@hously/shared";
import { useLibraryDownloads } from "@/features/medias/hooks/useLibraryDownloads";
import { useDeleteLibraryDownloadEntry } from "@/features/medias/hooks/useDeleteLibraryDownloadEntry";
import { useClearLibraryFailedDownloads } from "@/features/medias/hooks/useClearLibraryFailedDownloads";
import { Badge, Card } from "./LibrarySharedUI";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/confirm";

interface LibraryDownloadHistorySectionProps {
  libraryId: number;
}

export function LibraryDownloadHistorySection({
  libraryId,
}: LibraryDownloadHistorySectionProps) {
  const { t } = useTranslation("common");
  const { data, isLoading } = useLibraryDownloads(libraryId);
  const deleteEntry = useDeleteLibraryDownloadEntry(libraryId);
  const clearFailed = useClearLibraryFailedDownloads(libraryId);
  const [open, setOpen] = useState(false);
  const { confirm } = useConfirm();
  const items = data?.items ?? [];
  const hasRemovable = items.some(isRemovableDownloadHistoryEntry);
  const busyDeleting = deleteEntry.isPending || clearFailed.isPending;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-neutral-800/40"
        style={{ touchAction: "manipulation" }}
      >
        <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-neutral-300">
          <Download size={12} className="text-neutral-400 shrink-0" />
          <span className="truncate">{t("library.management.downloads")}</span>
          {items.length > 0 && (
            <span className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-neutral-700 px-1 text-[9px] font-bold text-neutral-300 tabular-nums">
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
        <div className="border-t border-neutral-800 px-4 pb-4 pt-3">
          {hasRemovable && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                disabled={busyDeleting}
                onClick={() => {
                  confirm({
                    variant: "destructive",
                    description: t(
                      "library.management.clearFailedDownloadsConfirm",
                    ),
                    confirmLabel: t("library.management.clearFailedDownloads"),
                    onConfirm: () => {
                      clearFailed.mutate();
                    },
                  });
                }}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-rose-400 hover:bg-rose-950/40 disabled:opacity-50"
              >
                {t("library.management.clearFailedDownloads")}
              </button>
            </div>
          )}
          {isLoading ? (
            <p className="text-xs text-neutral-400">
              {t("library.management.searching")}
            </p>
          ) : items.length === 0 ? (
            <p className="text-xs text-neutral-400">
              {t("library.management.noDownloads")}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((row) => {
                const statusColor = row.failed
                  ? "border-red-900/60 bg-red-950/10"
                  : row.completed_at
                    ? "border-emerald-900/60 bg-emerald-950/10"
                    : "border-sky-900/60 bg-sky-950/10";

                const removable = isRemovableDownloadHistoryEntry(row);

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
                        className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-100 leading-snug min-w-0"
                        title={row.release_title}
                      >
                        {row.ai_picked && (
                          <span title={t("library.download.aiPick")}>
                            <Sparkles
                              size={12}
                              strokeWidth={2}
                              className="shrink-0 text-violet-400"
                              aria-hidden
                            />
                          </span>
                        )}
                        <span className="truncate">{row.release_title}</span>
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {removable && (
                          <button
                            type="button"
                            disabled={busyDeleting}
                            title={t(
                              "library.management.removeDownloadHistoryTitle",
                            )}
                            aria-label={t(
                              "library.management.removeDownloadHistoryTitle",
                            )}
                            onClick={() => deleteEntry.mutate(row.id)}
                            className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-rose-400 disabled:opacity-40"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        )}
                        {row.failed ? (
                          <Badge className="bg-red-900/40 text-red-400 shrink-0">
                            {t("library.download.failed")}
                          </Badge>
                        ) : row.completed_at ? (
                          <Badge className="bg-emerald-900/40 text-emerald-400 shrink-0">
                            {t("library.download.done")}
                          </Badge>
                        ) : (
                          <Badge className="bg-sky-900/40 text-sky-400 shrink-0">
                            {t("library.download.active")}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-neutral-400">
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
                        className="text-[10px] text-red-400 leading-snug"
                        title={row.post_process_error}
                      >
                        {row.post_process_error}
                      </p>
                    ) : row.post_process_destination_path ? (
                      <p
                        className="font-mono text-[9px] text-neutral-400 truncate"
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
