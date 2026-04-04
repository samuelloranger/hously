export const BOARD_TAGS_ENDPOINTS = {
  LIST: "/api/board-tags",
  CREATE: "/api/board-tags",
  UPDATE: (id: number) => `/api/board-tags/${id}`,
  DELETE: (id: number) => `/api/board-tags/${id}`,
} as const;
