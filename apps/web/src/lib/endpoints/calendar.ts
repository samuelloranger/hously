export const CALENDAR_ENDPOINTS = {
  EVENTS: "/api/calendar",
  AVAILABLE_COUNTRIES: "/api/calendar/available-countries",
  HOLIDAY_SUBDIVISIONS: (countryCode: string) =>
    `/api/calendar/holiday-subdivisions/${encodeURIComponent(countryCode)}`,
  CUSTOM_EVENTS: {
    LIST: "/api/custom-events",
    CREATE: "/api/custom-events",
    UPDATE: (id: number) => `/api/custom-events/${id}`,
    DELETE: (id: number) => `/api/custom-events/${id}`,
  },
  ICAL_TOKEN: "/api/calendar/ical-token",
} as const;
