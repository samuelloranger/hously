export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: ['auth', 'me'] as const,
    user: ['auth', 'user'] as const,
  },

  shopping: {
    all: ['shopping'] as const,
    items: () => [...queryKeys.shopping.all, 'items'] as const,
    syncStatus: () => [...queryKeys.shopping.all, 'sync-status'] as const,
  },

  chores: {
    all: ['chores'] as const,
    list: () => [...queryKeys.chores.all, 'list'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    activities: (limit?: number) => [...queryKeys.dashboard.all, 'activities', limit] as const,
    jellyfinLatest: (limit?: number, page?: number) =>
      [...queryKeys.dashboard.all, 'jellyfin-latest', limit, page] as const,
    jellyfinLatestInfinite: (limit?: number) =>
      [...queryKeys.dashboard.all, 'jellyfin-latest-infinite', limit] as const,
    yggStats: () => [...queryKeys.dashboard.all, 'ygg-stats'] as const,
    upcoming: () => [...queryKeys.dashboard.all, 'upcoming'] as const,
    qbittorrentStatus: () => [...queryKeys.dashboard.all, 'qbittorrent-status'] as const,
    qbittorrentTorrents: (params: Record<string, unknown>) => [...queryKeys.dashboard.all, 'qbittorrent-torrents', params] as const,
    qbittorrentCategories: () => [...queryKeys.dashboard.all, 'qbittorrent-categories'] as const,
    qbittorrentTags: () => [...queryKeys.dashboard.all, 'qbittorrent-tags'] as const,
    qbittorrentTorrentProperties: (hash: string) =>
      [...queryKeys.dashboard.all, 'qbittorrent-torrent-properties', hash] as const,
    qbittorrentTorrentTrackers: (hash: string) =>
      [...queryKeys.dashboard.all, 'qbittorrent-torrent-trackers', hash] as const,
    qbittorrentTorrentFiles: (hash: string) => [...queryKeys.dashboard.all, 'qbittorrent-torrent-files', hash] as const,
    qbittorrentTorrentPeers: (hash: string) => [...queryKeys.dashboard.all, 'qbittorrent-torrent-peers', hash] as const,
    scrutinySummary: () => [...queryKeys.dashboard.all, 'scrutiny-summary'] as const,
    netdataSummary: () => [...queryKeys.dashboard.all, 'netdata-summary'] as const,
  },

  weather: {
    all: ['weather'] as const,
    current: () => [...queryKeys.weather.all, 'current'] as const,
  },

  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
  },

  analytics: {
    all: ['analytics'] as const,
    weeklySummary: (locale?: string) => [...queryKeys.analytics.all, 'weekly-summary', locale ?? 'en'] as const,
    personalInsights: () => [...queryKeys.analytics.all, 'personal-insights'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    devices: () => [...queryKeys.notifications.all, 'devices'] as const,
    list: (page?: number, limit?: number, read?: boolean) =>
      [...queryKeys.notifications.all, 'list', page, limit, read] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },

  externalNotifications: {
    all: ['external-notifications'] as const,
    services: () => [...queryKeys.externalNotifications.all, 'services'] as const,
    logs: () => [...queryKeys.externalNotifications.all, 'logs'] as const,
  },

  plugins: {
    all: ['plugins'] as const,
    jellyfin: () => [...queryKeys.plugins.all, 'jellyfin'] as const,
    radarr: () => [...queryKeys.plugins.all, 'radarr'] as const,
    sonarr: () => [...queryKeys.plugins.all, 'sonarr'] as const,
    qbittorrent: () => [...queryKeys.plugins.all, 'qbittorrent'] as const,
    scrutiny: () => [...queryKeys.plugins.all, 'scrutiny'] as const,
    netdata: () => [...queryKeys.plugins.all, 'netdata'] as const,
    weather: () => [...queryKeys.plugins.all, 'weather'] as const,
    ygg: () => [...queryKeys.plugins.all, 'ygg'] as const,
  },

  admin: {
    all: ['admin'] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    export: () => [...queryKeys.admin.all, 'export'] as const,
  },

  calendar: {
    all: ['calendar'] as const,
    events: (year?: number, month?: number) => [...queryKeys.calendar.all, 'events', year, month] as const,
  },

  customEvents: {
    all: ['custom-events'] as const,
    list: (year?: number, month?: number) => [...queryKeys.customEvents.all, year, month] as const,
  },

  recipes: {
    all: ['recipes'] as const,
    lists: () => [...queryKeys.recipes.all, 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.recipes.lists(), filters] as const,
    details: () => [...queryKeys.recipes.all, 'detail'] as const,
    detail: (id: number) => [...queryKeys.recipes.details(), id] as const,
  },

  mealPlans: {
    all: ['meal-plans'] as const,
    lists: () => [...queryKeys.mealPlans.all, 'list'] as const,
    list: (start_date?: string, end_date?: string) => [...queryKeys.mealPlans.lists(), start_date, end_date] as const,
    detail: (id: number) => [...queryKeys.mealPlans.all, 'detail', id] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
