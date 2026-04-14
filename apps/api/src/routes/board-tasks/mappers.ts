import { BoardTaskStatus, BoardTaskPriority } from "@prisma/client";

export const STATUS_VALUES = [
  "backlog",
  "on_hold",
  "todo",
  "in_progress",
  "done",
] as const;
export type StatusApi = (typeof STATUS_VALUES)[number];

export const PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;
export type PriorityApi = (typeof PRIORITY_VALUES)[number];

export const API_TO_PRISMA_STATUS: Record<StatusApi, BoardTaskStatus> = {
  backlog: BoardTaskStatus.BACKLOG,
  on_hold: BoardTaskStatus.ON_HOLD,
  todo: BoardTaskStatus.TODO,
  in_progress: BoardTaskStatus.IN_PROGRESS,
  done: BoardTaskStatus.DONE,
};

export const PRISMA_TO_API_STATUS: Record<BoardTaskStatus, StatusApi> = {
  [BoardTaskStatus.BACKLOG]: "backlog",
  [BoardTaskStatus.ON_HOLD]: "on_hold",
  [BoardTaskStatus.TODO]: "todo",
  [BoardTaskStatus.IN_PROGRESS]: "in_progress",
  [BoardTaskStatus.DONE]: "done",
};

export const API_TO_PRISMA_PRIORITY: Record<PriorityApi, BoardTaskPriority> = {
  low: BoardTaskPriority.LOW,
  medium: BoardTaskPriority.MEDIUM,
  high: BoardTaskPriority.HIGH,
  urgent: BoardTaskPriority.URGENT,
};

export const PRISMA_TO_API_PRIORITY: Record<BoardTaskPriority, PriorityApi> = {
  [BoardTaskPriority.LOW]: "low",
  [BoardTaskPriority.MEDIUM]: "medium",
  [BoardTaskPriority.HIGH]: "high",
  [BoardTaskPriority.URGENT]: "urgent",
};
