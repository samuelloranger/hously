export const SHOPPING_ENDPOINTS = {
  LIST: "/api/shopping",
  CREATE: "/api/shopping",
  TOGGLE: (id: number) => `/api/shopping/${id}/toggle`,
  UPDATE: (id: number) => `/api/shopping/${id}`,
  DELETE: (id: number) => `/api/shopping/${id}`,
  DELETE_BULK: "/api/shopping/delete-bulk",
  CLEAR_COMPLETED: "/api/shopping/clear-completed",
  REORDER: "/api/shopping/reorder",
} as const;
