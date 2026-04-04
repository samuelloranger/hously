export const CALENDAR_ENDPOINTS = {
  EVENTS: "/api/calendar",
  CUSTOM_EVENTS: {
    LIST: "/api/custom-events",
    CREATE: "/api/custom-events",
    UPDATE: (id: number) => `/api/custom-events/${id}`,
    DELETE: (id: number) => `/api/custom-events/${id}`,
  },
  ICAL_TOKEN: "/api/calendar/ical-token",
} as const;
