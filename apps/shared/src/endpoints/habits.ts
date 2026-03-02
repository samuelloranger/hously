export const HABIT_ENDPOINTS = {
  LIST: '/api/habits',
  CREATE: '/api/habits',
  UPDATE: (id: number) => `/api/habits/${id}`,
  DELETE: (id: number) => `/api/habits/${id}`,
  COMPLETE: (id: number) => `/api/habits/${id}/complete`,
  UNCOMPLETE: (id: number) => `/api/habits/${id}/complete`,
  HISTORY: (id: number) => `/api/habits/${id}/history`,
} as const;