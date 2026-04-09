export interface BoardTag {
  id: number;
  name: string;
  color: string | null;
}

export interface BoardTagWithCount extends BoardTag {
  task_count: number;
  created_at: string;
}

export interface BoardTagsResponse {
  tags: BoardTagWithCount[];
}

export interface CreateBoardTagRequest {
  name: string;
  color?: string | null;
}

export interface UpdateBoardTagRequest {
  name?: string;
  color?: string | null;
}

export interface DeleteBoardTagRequest {
  merge_into_id?: number;
}

export const BOARD_TASK_STATUSES = [
  "backlog",
  "on_hold",
  "todo",
  "in_progress",
  "done",
] as const;
export const BOARD_KANBAN_STATUSES = [
  "on_hold",
  "todo",
  "in_progress",
  "done",
] as const;
export type BoardTaskStatusApi = (typeof BOARD_TASK_STATUSES)[number];
export type BoardKanbanStatusApi = (typeof BOARD_KANBAN_STATUSES)[number];

export const BOARD_TASK_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type BoardTaskPriorityApi = (typeof BOARD_TASK_PRIORITIES)[number];

export interface TaskDependencyRef {
  id: number;
  task_id: number;
  slug: string;
  title: string;
  is_resolved?: boolean;
}

export interface BoardTask {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: BoardTaskStatusApi;
  position: number;
  priority: BoardTaskPriorityApi;
  start_date: string | null;
  due_date: string | null;
  assignee_id: number | null;
  assignee_name: string | null;
  assignee_avatar: string | null;
  tags: BoardTag[];
  estimated_minutes: number | null;
  logged_minutes: number;
  archived: boolean;
  created_by: number;
  created_at: string | null;
  updated_at: string | null;
  created_by_username?: string;
  blocks: TaskDependencyRef[];
  blocked_by: TaskDependencyRef[];
}

export interface BoardTasksResponse {
  tasks: BoardTask[];
}

export interface CreateBoardTaskRequest {
  title: string;
  description?: string;
  status?: BoardTaskStatusApi;
  priority?: BoardTaskPriorityApi;
  start_date?: string | null;
  due_date?: string | null;
  assignee_id?: number | null;
  tag_ids?: number[];
}

export interface UpdateBoardTaskRequest {
  title?: string;
  description?: string | null;
  status?: BoardTaskStatusApi;
  priority?: BoardTaskPriorityApi;
  start_date?: string | null;
  due_date?: string | null;
  assignee_id?: number | null;
  tag_ids?: number[];
  estimated_minutes?: number | null;
  archived?: boolean;
}

export interface BoardTimeLog {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_avatar: string | null;
  minutes: number;
  note: string | null;
  logged_at: string;
}

export interface BoardTimeLogsResponse {
  time_logs: BoardTimeLog[];
}

export interface CreateTimeLogRequest {
  minutes: number;
  note?: string;
}

export type BoardTaskActivityType =
  | "created"
  | "comment"
  | "status_change"
  | "priority_change"
  | "assignee_change"
  | "archived"
  | "unarchived";

export interface BoardTaskActivity {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_avatar: string | null;
  type: BoardTaskActivityType;
  body: string | null;
  metadata: { from?: string; to?: string } | null;
  created_at: string;
}

export interface BoardTaskActivityResponse {
  activities: BoardTaskActivity[];
}

export const BACKLOG_SORT_OPTIONS = [
  "position",
  "priority",
  "due_date",
  "created_at",
  "assignee",
] as const;
export type BacklogSortOption = (typeof BACKLOG_SORT_OPTIONS)[number];

export interface SyncBoardTasksRequest {
  tasks: Array<{ id: number; status: BoardTaskStatusApi; position: number }>;
}
