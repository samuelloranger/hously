export const RECIPES_ENDPOINTS = {
  LIST: "/api/recipes",
  DETAIL: (id: number) => `/api/recipes/${id}`,
  CREATE: "/api/recipes",
  UPDATE: (id: number) => `/api/recipes/${id}`,
  DELETE: (id: number) => `/api/recipes/${id}`,
  TOGGLE_FAVORITE: (id: number) => `/api/recipes/${id}/toggle-favorite`,
  UPLOAD_IMAGE: "/api/recipes/upload-image",
  IMAGE: (path: string) => `/api/recipes/image/${path}`,
} as const;
