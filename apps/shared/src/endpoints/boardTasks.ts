export const BOARD_TASKS_ENDPOINTS = {
  LIST: '/api/board-tasks',
  CREATE: '/api/board-tasks',
  UPDATE: (id: number) => `/api/board-tasks/${id}`,
  DELETE: (id: number) => `/api/board-tasks/${id}`,
  SYNC: '/api/board-tasks/sync',
} as const;
