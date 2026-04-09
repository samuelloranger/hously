import { Archive, RotateCcw } from "lucide-react";
import type { BoardTask, BoardTaskPriorityApi, BoardTaskStatusApi } from "@hously/shared/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Partial<Record<BoardTaskStatusApi, string>> = {
  backlog: "Backlog",
  on_hold: "On Hold",
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const STATUS_STYLE: Partial<Record<BoardTaskStatusApi, string>> = {
  on_hold: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  todo: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  done: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  backlog: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

interface ArchiveViewProps {
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
  onRestore: (id: number) => void;
  isRestoring: boolean;
}

export function ArchiveView({ tasks, onTaskClick, onRestore, isRestoring }: ArchiveViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <Archive className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Archive is empty
        </p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Archived tasks will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200/80 bg-white dark:border-neutral-700/60 dark:bg-neutral-900 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200/80 dark:border-neutral-700/60">
            <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 w-6" />
            <th className="py-2.5 px-3 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 w-24">
              ID
            </th>
            <th className="py-2.5 px-3 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              Title
            </th>
            <th className="py-2.5 px-3 text-left text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 hidden sm:table-cell">
              Status
            </th>
            <th className="py-2.5 px-3 text-right text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500 w-24">
              Restore
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {tasks.map((task) => (
            <tr
              key={task.id}
              className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors"
            >
              {/* Priority dot */}
              <td className="pl-4 pr-2">
                <span
                  className={cn("block h-2 w-2 rounded-full", PRIORITY_DOT[task.priority])}
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
                  className="text-left text-[13px] font-medium text-neutral-700 hover:text-indigo-600 dark:text-neutral-200 dark:hover:text-indigo-400 line-clamp-1 transition-colors"
                >
                  {task.title}
                </button>
                {task.tags.length > 0 && (
                  <div className="mt-1 flex gap-1">
                    {task.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      >
                        {tag.color && (
                          <span
                            className="h-1.5 w-1.5 rounded-full shrink-0"
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
              <td className="px-3 py-3 hidden sm:table-cell">
                <span
                  className={cn(
                    "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                    STATUS_STYLE[task.status] ?? "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {STATUS_LABEL[task.status] ?? task.status}
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
                  disabled={isRestoring}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-neutral-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400 transition-colors disabled:opacity-40"
                  title="Restore task"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
