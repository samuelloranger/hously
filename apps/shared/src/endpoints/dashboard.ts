export const DASHBOARD_ENDPOINTS = {
  STATS: '/api/dashboard/stats',
  ACTIVITIES: '/api/dashboard/activities',
  ACTIVITIES_FEED: '/api/dashboard/activities/feed',
  JELLYFIN: {
    LATEST: '/api/dashboard/jellyfin/latest',
    IMAGE: '/api/dashboard/jellyfin/image',
  },
  C411: {
    STATS: '/api/dashboard/c411/stats',
  },
  TORR9: {
    STATS: '/api/dashboard/torr9/stats',
  },
  LA_CALE: {
    STATS: '/api/dashboard/la-cale/stats',
  },
  TRACKERS: {
    STATS: '/api/dashboard/trackers/stats',
  },
  UPCOMING: {
    LIST: '/api/dashboard/upcoming',
    ADD: '/api/dashboard/upcoming/add',
    STATUS: '/api/dashboard/upcoming/status',
  },
  QBITTORRENT: {
    STATUS: '/api/dashboard/qbittorrent/status',
    STREAM: '/api/dashboard/qbittorrent/stream',
    PINNED: '/api/dashboard/qbittorrent/pinned',
    TORRENTS: '/api/dashboard/qbittorrent/torrents',
    TORRENTS_STREAM: '/api/dashboard/qbittorrent/torrents/stream',
    OPTIONS: '/api/dashboard/qbittorrent/options',
    CATEGORIES: '/api/dashboard/qbittorrent/categories',
    TAGS: '/api/dashboard/qbittorrent/tags',
    ADD_MAGNET: '/api/dashboard/qbittorrent/torrents/add-magnet',
    ADD_FILE: '/api/dashboard/qbittorrent/torrents/add-file',
    TORRENT_STREAM: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/stream`,
    PROPERTIES: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/properties`,
    TRACKERS: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/trackers`,
    FILES: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/files`,
    PEERS: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/peers`,
    PEERS_STREAM: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/peers/stream`,
    RENAME: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/rename`,
    RENAME_FILE: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/rename-file`,
    SET_CATEGORY: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/set-category`,
    SET_TAGS: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/set-tags`,
    PAUSE: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/pause`,
    RESUME: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/resume`,
    REANNOUNCE: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/reannounce`,
    DELETE: (hash: string) => `/api/dashboard/qbittorrent/torrents/${encodeURIComponent(hash)}/delete`,
  },
  SCRUTINY: {
    SUMMARY: '/api/dashboard/scrutiny/summary',
  },
  NETDATA: {
    SUMMARY: '/api/dashboard/netdata/summary',
    STREAM: '/api/dashboard/netdata/stream',
  },
  ADGUARD: {
    SUMMARY: '/api/dashboard/adguard/summary',
  },
  WEATHER: '/api/dashboard/weather',
} as const;
