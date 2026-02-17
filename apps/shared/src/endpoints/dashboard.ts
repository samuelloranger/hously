export const DASHBOARD_ENDPOINTS = {
  STATS: '/api/dashboard/stats',
  ACTIVITIES: '/api/dashboard/activities',
  JELLYFIN: {
    LATEST: '/api/dashboard/jellyfin/latest',
    IMAGE: '/api/dashboard/jellyfin/image',
  },
  UPCOMING: {
    LIST: '/api/dashboard/upcoming',
    ADD: '/api/dashboard/upcoming/add',
    STATUS: '/api/dashboard/upcoming/status',
  },
  QBITTORRENT: {
    STATUS: '/api/dashboard/qbittorrent/status',
    STREAM: '/api/dashboard/qbittorrent/stream',
  },
  SCRUTINY: {
    SUMMARY: '/api/dashboard/scrutiny/summary',
  },
  NETDATA: {
    SUMMARY: '/api/dashboard/netdata/summary',
    STREAM: '/api/dashboard/netdata/stream',
  },
  WEATHER: '/api/dashboard/weather',
} as const;
