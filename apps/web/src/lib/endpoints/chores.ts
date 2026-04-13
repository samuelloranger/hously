export const CHORES_ENDPOINTS = {
  LIST: "/api/chores",
  CREATE: "/api/chores",
  TOGGLE: (id: number) => `/api/chores/${id}/toggle`,
  UPDATE: (id: number) => `/api/chores/${id}`,
  DELETE: (id: number) => `/api/chores/${id}`,
  CLEAR_COMPLETED: "/api/chores/clear-completed",
  REORDER: "/api/chores/reorder",
  UPLOAD_IMAGE: "/api/chores/upload-image",
  IMAGE: (path: string) => `/api/chores/image/${path}`,
  THUMBNAIL: (path: string) => `/api/chores/thumbnail/${path}`,
  REMOVE_RECURRENCE: (id: number) => `/api/chores/${id}/remove-recurrence`,
} as const;
