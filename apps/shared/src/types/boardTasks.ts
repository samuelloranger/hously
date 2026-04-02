export const BOARD_TASK_STATUSES = ['backlog', 'on_hold', 'todo', 'in_progress', 'done'] as const;
export const BOARD_KANBAN_STATUSES = ['on_hold', 'todo', 'in_progress', 'done'] as const;
export type BoardTaskStatusApi = (typeof BOARD_TASK_STATUSES)[number];
export type BoardKanbanStatusApi = (typeof BOARD_KANBAN_STATUSES)[number];

export const BOARD_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type BoardTaskPriorityApi = (typeof BOARD_TASK_PRIORITIES)[number];

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
  tags: string[];
  created_by: number;
  created_at: string | null;
  updated_at: string | null;
  created_by_username?: string;
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
  tags?: string[];
}

export interface UpdateBoardTaskRequest {
  title?: string;
  description?: string | null;
  status?: BoardTaskStatusApi;
  priority?: BoardTaskPriorityApi;
  start_date?: string | null;
  due_date?: string | null;
  assignee_id?: number | null;
  tags?: string[];
}

export interface SyncBoardTasksRequest {
  tasks: Array<{ id: number; status: BoardTaskStatusApi; position: number }>;
}
