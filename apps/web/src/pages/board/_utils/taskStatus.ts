import type {
  BoardTaskPriorityApi,
  BoardTaskStatusApi,
} from "@hously/shared/types";

export const STATUS_STYLE: Partial<Record<BoardTaskStatusApi, string>> = {
  on_hold:
    "bg-neutral-800 text-neutral-400",
  todo: "bg-blue-900/30 text-blue-400",
  in_progress:
    "bg-primary-900/30 text-primary-400",
  done: "bg-emerald-900/30 text-emerald-400",
  backlog:
    "bg-neutral-800 text-neutral-400",
};

export const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-sky-400",
  medium: "bg-amber-400",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};
