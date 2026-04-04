import { QBITTORRENT_ENDPOINTS } from "./qbittorrent";

export const DASHBOARD_ENDPOINTS = {
  STATS: "/api/dashboard/stats",
  ACTIVITIES: "/api/dashboard/activities",
  ACTIVITIES_FEED: "/api/dashboard/activities/feed",
  JELLYFIN: {
    LATEST: "/api/dashboard/jellyfin/latest",
    IMAGE: "/api/dashboard/jellyfin/image",
  },
  C411: {
    STATS: "/api/dashboard/c411/stats",
  },
  TORR9: {
    STATS: "/api/dashboard/torr9/stats",
  },
  LA_CALE: {
    STATS: "/api/dashboard/la-cale/stats",
  },
  TRACKERS: {
    STATS: "/api/dashboard/trackers/stats",
  },
  UPCOMING: {
    LIST: "/api/dashboard/upcoming",
    ADD: "/api/dashboard/upcoming/add",
    STATUS: "/api/dashboard/upcoming/status",
  },
  QBITTORRENT: QBITTORRENT_ENDPOINTS,
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
  WEATHER: "/api/dashboard/weather",
  HOME_ASSISTANT: {
    WIDGET: "/api/home-assistant/widget",
    CONTROL: "/api/home-assistant/control",
  },
} as const;
