import type {
  BoardTaskPriorityApi,
  BoardTaskStatusApi,
} from "@hously/shared/types";

export const STATUS_STYLE: Partial<Record<BoardTaskStatusApi, string>> = {
  on_hold:
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  todo: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:
    "bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400",
  done: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  backlog:
    "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

export const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};
