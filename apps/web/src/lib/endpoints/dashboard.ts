import { DOWNLOADS_ENDPOINTS } from "./downloads";

export const DASHBOARD_ENDPOINTS = {
  ACTIVITIES: "/api/dashboard/activities",
  ACTIVITIES_FEED: "/api/dashboard/activities/feed",
  JELLYFIN: {
    LATEST: "/api/dashboard/jellyfin/latest",
    IMAGE: "/api/dashboard/jellyfin/image",
    RANDOM: "/api/dashboard/jellyfin/random",
  },
  QUICK_LINKS: "/api/dashboard/quick-links",
  FAVICON: "/api/dashboard/favicon",
  C411: {
    STATS: "/api/dashboard/c411/stats",
  },
  TORR9: {
    STATS: "/api/dashboard/torr9/stats",
  },
  LA_CALE: {
    STATS: "/api/dashboard/la-cale/stats",
  },
  YGG_REBORN: {
    STATS: "/api/dashboard/ygg-reborn/stats",
  },
  TRACKERS: {
    STATS: "/api/dashboard/trackers/stats",
  },
  UPCOMING: {
    LIST: "/api/dashboard/upcoming",
    REFRESH: "/api/dashboard/upcoming/refresh",
    ADD: "/api/dashboard/upcoming/add",
    STATUS: "/api/dashboard/upcoming/status",
  },
  DOWNLOADS: DOWNLOADS_ENDPOINTS,
  SCRUTINY: {
    SUMMARY: "/api/dashboard/scrutiny/summary",
  },
  SYSTEM: {
    SUMMARY: "/api/dashboard/system/summary",
    STREAM: "/api/dashboard/system/stream",
  },
  ADGUARD: {
    SUMMARY: "/api/dashboard/adguard/summary",
  },
  DOCKER: {
    SUMMARY: "/api/dashboard/docker/summary",
  },
  WEATHER: "/api/dashboard/weather",
  WEATHER_FORECAST: "/api/dashboard/weather/forecast",
  HOME_ASSISTANT: {
    WIDGET: "/api/home-assistant/widget",
    CONTROL: "/api/home-assistant/control",
  },
  MINECRAFT: "/api/dashboard/minecraft",
} as const;
