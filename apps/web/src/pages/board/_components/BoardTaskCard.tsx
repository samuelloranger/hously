import { useSortable } from "@dnd-kit/react/sortable";
import { useTranslation } from "react-i18next";
import type {
  BoardTask,
  BoardTaskPriorityApi,
  BoardTaskStatusApi,
} from "@hously/shared/types";
import { cn } from "@/lib/utils";
import { AlertCircle, Clock, Lock } from "lucide-react";
import { formatMinutes } from "@/pages/board/_utils/time";

interface BoardTaskCardProps {
  task: BoardTask;
  columnId: BoardTaskStatusApi;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCardClick: (
    task: BoardTask,
    e: React.MouseEvent | React.KeyboardEvent,
  ) => void;
}

const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

export function BoardTaskCard({
  task,
  columnId,
  index,
  isSelected,
  onToggleSelect,
  onCardClick,
}: BoardTaskCardProps) {
  const { t } = useTranslation("common");
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: "item",
    accept: "item",
  });

  const today = new Date(new Date().toDateString());
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate ? dueDate < today : false;
  const isDueToday = dueDate ? dueDate.getTime() === today.getTime() : false;
  const isDueSoon =
    dueDate && !isOverdue && !isDueToday
      ? (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 3
      : false;

  const dueDateLabel = dueDate
    ? isOverdue
      ? `Overdue · ${dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : isDueToday
        ? "Due today"
        : dueDate.toLocaleDateString(undefined, {
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
    <div
      ref={(node: HTMLDivElement | null) => {
        (ref as React.RefCallback<HTMLDivElement>)(node);
        (handleRef as React.RefCallback<HTMLDivElement>)(node);
      }}
      style={{
        opacity: isDragging ? 0.75 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      onClick={(e) => onCardClick(task, e)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCardClick(task, e);
      }}
      className={cn(
        "group cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing dark:bg-neutral-800",
        isSelected
          ? "border-primary-400 ring-1 ring-primary-300/80 dark:border-primary-500 dark:ring-primary-600/50"
          : "border-neutral-200/90 dark:border-neutral-600/60 dark:hover:border-neutral-500/60",
      )}
    >
      {/* Top row: checkbox + slug + priority dot */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600"
            aria-label={t("board.bulk.selectTask")}
          />
          <span className="truncate font-mono text-[10px] font-semibold text-neutral-400 dark:text-neutral-500">
            {task.slug}
          </span>
        </div>
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            PRIORITY_DOT[task.priority],
          )}
          title={task.priority}
        />
      </div>

      {/* Title */}
      <p className="text-sm font-medium leading-snug text-neutral-900 dark:text-white">
        {task.title}
      </p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
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
          {task.tags.length > 3 && (
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-400 dark:bg-neutral-700 dark:text-neutral-500">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Blocked indicator */}
      {task.blocked_by.some((d) => !d.is_resolved) && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-orange-500 dark:text-orange-400">
          <Lock className="h-3 w-3" />
          Blocked
        </div>
      )}

      {/* Time progress */}
      {task.estimated_minutes != null && (
        <div className="mt-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">
              {formatMinutes(task.logged_minutes)} /{" "}
              {formatMinutes(task.estimated_minutes)}
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700">
            <div
              className={`h-full rounded-full transition-all ${
                task.logged_minutes >= task.estimated_minutes
                  ? "bg-red-500"
                  : task.logged_minutes >= task.estimated_minutes * 0.8
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{
                width: `${Math.min(100, (task.logged_minutes / task.estimated_minutes) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom row: due date + assignee */}
      {(dueDateLabel || initials) && (
        <div className="mt-2.5 flex items-center gap-2">
          {dueDateLabel && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px] font-medium",
                isOverdue
                  ? "text-red-500 dark:text-red-400"
                  : isDueToday
                    ? "text-orange-500 dark:text-orange-400"
                    : isDueSoon
                      ? "text-amber-600 dark:text-amber-400"
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
          <div className="flex-1" />
          {task.assignee_avatar ? (
            <img
              src={task.assignee_avatar}
              alt={task.assignee_name ?? ""}
              title={task.assignee_name ?? ""}
              className="h-5 w-5 rounded-full object-cover ring-1 ring-white dark:ring-neutral-800"
            />
          ) : initials ? (
            <span
              title={task.assignee_name ?? ""}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-600 ring-1 ring-white dark:bg-primary-900/40 dark:text-primary-400 dark:ring-neutral-800"
            >
              {initials}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
