import { Archive, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BoardTask } from "@hously/shared/types";
import { cn } from "@/lib/utils";
import { PRIORITY_DOT, STATUS_STYLE } from "@/pages/board/_utils/taskStatus";

interface ArchiveViewProps {
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
  onRestore: (id: number) => void;
  restoringId: number | null;
}

export function ArchiveView({
  tasks,
  onTaskClick,
  onRestore,
  restoringId,
}: ArchiveViewProps) {
  const { t } = useTranslation("common");

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <Archive className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          {t("board.archiveEmpty")}
        </p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {t("board.archiveEmptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-700/60 dark:bg-neutral-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200/80 dark:border-neutral-700/60">
            <th className="w-6 py-2.5 pl-4 pr-2 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500" />
            <th className="w-24 px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {t("board.columnId")}
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {t("board.columnTitle")}
            </th>
            <th className="hidden px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 sm:table-cell">
              {t("board.columnStatus")}
            </th>
            <th className="w-24 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {t("board.columnRestore")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="group transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
            >
              {/* Priority dot */}
              <td className="pl-4 pr-2">
                <span
                  className={cn(
                    "block h-2 w-2 rounded-full",
                    PRIORITY_DOT[task.priority],
                  )}
                  title={task.priority}
                />
              </td>

              {/* Slug */}
              <td className="px-3 py-3">
                <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                  {task.slug}
                </span>
              </td>

              {/* Title */}
              <td className="px-3 py-3">
                <button
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className="line-clamp-1 text-left text-[13px] font-medium text-neutral-700 transition-colors hover:text-indigo-600 dark:text-neutral-200 dark:hover:text-indigo-400"
                >
                  {task.title}
                </button>
                {task.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {task.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-px text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      >
                        {tag.color && (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </td>

              {/* Status */}
              <td className="hidden px-3 py-3 sm:table-cell">
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                    STATUS_STYLE[task.status] ??
                      "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {t(`board.status.${task.status}`)}
                </span>
              </td>

              {/* Restore */}
              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestore(task.id);
                  }}
                  disabled={restoringId === task.id}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                  title={t("board.restoreTask")}
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("board.restore")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
