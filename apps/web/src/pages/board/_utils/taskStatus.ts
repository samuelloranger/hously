import type {
  BoardTaskPriorityApi,
  BoardTaskStatusApi,
} from "@hously/shared/types";

export const STATUS_STYLE: Partial<Record<BoardTaskStatusApi, string>> = {
  on_hold: "bg-neutral-600 text-neutral-200",
  todo: "border border-primary-800 bg-primary-900/30 text-primary-300",
  in_progress: "border border-amber-800/60 bg-amber-900/30 text-amber-300",
  done: "border border-emerald-800/60 bg-emerald-900/30 text-emerald-300",
  backlog: "bg-neutral-800 text-neutral-400",
};

export const PRIORITY_DOT: Record<BoardTaskPriorityApi, string> = {
  low: "bg-neutral-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
  urgent: "bg-rose-500",
};
