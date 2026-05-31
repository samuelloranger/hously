export const CUSTOM_FORMATS_ENDPOINTS = {
  LIST: "/api/custom-formats",
  CREATE: "/api/custom-formats",
  GET: (id: number) => `/api/custom-formats/${id}`,
  UPDATE: (id: number) => `/api/custom-formats/${id}`,
  DELETE: (id: number) => `/api/custom-formats/${id}`,
} as const;
