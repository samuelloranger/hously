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
    TORRENTS: '/api/dashboard/qbittorrent/torrents',
    ADD_MAGNET: '/api/dashboard/qbittorrent/torrents/add-magnet',
    ADD_FILE: '/api/dashboard/qbittorrent/torrents/add-file',
    PROPERTIES: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/properties`,
    TRACKERS: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/trackers`,
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
