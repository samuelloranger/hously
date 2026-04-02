export const BOARD_TASKS_ENDPOINTS = {
  LIST: '/api/board-tasks',
  CREATE: '/api/board-tasks',
  UPDATE: (id: number) => `/api/board-tasks/${id}`,
  DELETE: (id: number) => `/api/board-tasks/${id}`,
  SYNC: '/api/board-tasks/sync',
  ACTIVITY: (id: number) => `/api/board-tasks/${id}/activity`,
  COMMENT: (id: number) => `/api/board-tasks/${id}/comments`,
  ADD_DEPENDENCY: (id: number) => `/api/board-tasks/${id}/dependencies`,
  REMOVE_DEPENDENCY: (id: number, depId: number) => `/api/board-tasks/${id}/dependencies/${depId}`,
  TIME_LOGS: (id: number) => `/api/board-tasks/${id}/time-logs`,
} as const;
