export const MEAL_PLAN_ENDPOINTS = {
  LIST: '/api/meal-plans',
  CREATE: '/api/meal-plans',
  UPDATE: (id: number) => `/api/meal-plans/${id}`,
  DELETE: (id: number) => `/api/meal-plans/${id}`,
  ADD_TO_SHOPPING: (id: number) => `/api/meal-plans/${id}/add-to-shopping`,
} as const;
