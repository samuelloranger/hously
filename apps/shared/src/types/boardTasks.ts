export const BOARD_TASK_STATUSES = ['on_hold', 'todo', 'in_progress', 'done'] as const;
export type BoardTaskStatusApi = (typeof BOARD_TASK_STATUSES)[number];

export interface BoardTask {
  id: number;
  title: string;
  description: string | null;
  status: BoardTaskStatusApi;
  position: number;
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
}

export interface UpdateBoardTaskRequest {
  title?: string;
  description?: string | null;
  status?: BoardTaskStatusApi;
}

export interface SyncBoardTasksRequest {
  tasks: Array<{ id: number; status: BoardTaskStatusApi; position: number }>;
}
