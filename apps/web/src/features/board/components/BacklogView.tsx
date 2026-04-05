import { AlertCircle, Clock, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { BoardTask, BoardTaskPriorityApi, BoardTaskStatusApi } from "@hously/shared/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Partial<Record<BoardTaskStatusApi, string>> = {
  on_hold:
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  todo: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
  done: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
};

interface BacklogViewProps {
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
}

const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

const PRIORITY_LABEL: Record<BoardTaskPriorityApi, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export function BacklogView({ tasks, onTaskClick }: BacklogViewProps) {
  const { t } = useTranslation("common");
  const today = new Date(new Date().toDateString());

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <Inbox className="h-6 w-6 text-neutral-400 dark:text-neutral-500" />
        </div>
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
          Backlog is empty
        </p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          Add tasks to the backlog to plan future work
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-200/40 dark:border-neutral-700/60 dark:bg-neutral-700/30">
      {tasks.map((task) => {
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const isOverdue = dueDate ? dueDate < today : false;
        const isDueToday = dueDate
          ? dueDate.getTime() === today.getTime()
          : false;

        const dueDateLabel = dueDate
          ? dueDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : null;

        const initials = task.assignee_name
          ? task.assignee_name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)
          : null;

        return (
          <button
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="group flex w-full items-center gap-3 bg-white px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800/80"
          >
            {/* Priority dot */}
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                PRIORITY_DOT[task.priority],
              )}
              title={PRIORITY_LABEL[task.priority]}
            />

            {/* Slug */}
            <span className="hidden w-20 shrink-0 font-mono text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 sm:block">
              {task.slug}
            </span>

            {/* Title */}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 dark:text-white">
              {task.title}
            </span>

            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="hidden items-center gap-1 lg:flex">
                {task.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag.id}
                    className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
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
                {task.tags.length > 2 && (
                  <span className="text-[10px] text-neutral-400">
                    +{task.tags.length - 2}
                  </span>
                )}
              </div>
            )}

            {/* Status badge — hidden for backlog items */}
            {task.status !== "backlog" &&
              STATUS_STYLE[task.status as BoardTaskStatusApi] && (
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium sm:block",
                    STATUS_STYLE[task.status as BoardTaskStatusApi],
                  )}
                >
                  {t(`board.status.${task.status}`, {
                    defaultValue: task.status,
                  })}
                </span>
              )}

            {/* Due date */}
            {dueDateLabel && (
              <span
                className={cn(
                  "hidden shrink-0 items-center gap-1 text-[11px] font-medium sm:flex",
                  isOverdue
                    ? "text-red-500 dark:text-red-400"
                    : isDueToday
                      ? "text-orange-500 dark:text-orange-400"
                      : "text-neutral-400 dark:text-neutral-500",
                )}
              >
                {isOverdue ? (
                  <AlertCircle className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {dueDateLabel}
              </span>
            )}

            {/* Assignee avatar */}
            {task.assignee_avatar ? (
              <img
                src={task.assignee_avatar}
                alt={task.assignee_name ?? ""}
                title={task.assignee_name ?? ""}
                className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white dark:ring-neutral-800"
              />
            ) : initials ? (
              <span
                title={task.assignee_name ?? ""}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
              >
                {initials}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
