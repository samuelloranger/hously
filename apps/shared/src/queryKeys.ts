import type { TrackerType } from './types';

export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: ['auth', 'me'] as const,
    user: ['auth', 'user'] as const,
    validateInvitation: (token: string) => [...queryKeys.auth.all, 'validate-invitation', token] as const,
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
    activityFeed: (params?: { limit?: number; service?: string; type?: string }) =>
      [...queryKeys.dashboard.all, 'activity-feed', params?.limit, params?.service, params?.type] as const,
    jellyfinLatest: (limit?: number, page?: number) =>
      [...queryKeys.dashboard.all, 'jellyfin-latest', limit, page] as const,
    jellyfinLatestInfinite: (limit?: number) =>
      [...queryKeys.dashboard.all, 'jellyfin-latest-infinite', limit] as const,
    trackersStats: () => [...queryKeys.dashboard.all, 'trackers-stats'] as const,
    trackerStats: (type: TrackerType) => [...queryKeys.dashboard.all, 'tracker-stats', type] as const,
    upcoming: () => [...queryKeys.dashboard.all, 'upcoming'] as const,
    qbittorrentStatus: () => [...queryKeys.dashboard.all, 'qbittorrent-status'] as const,
    qbittorrentPinnedTorrent: () => [...queryKeys.dashboard.all, 'qbittorrent-pinned-torrent'] as const,
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
    adguardSummary: () => [...queryKeys.dashboard.all, 'adguard-summary'] as const,
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
    tracker: (type: TrackerType) => [...queryKeys.plugins.all, type] as const,
    jellyfin: () => [...queryKeys.plugins.all, 'jellyfin'] as const,
    radarr: () => [...queryKeys.plugins.all, 'radarr'] as const,
    sonarr: () => [...queryKeys.plugins.all, 'sonarr'] as const,
    prowlarr: () => [...queryKeys.plugins.all, 'prowlarr'] as const,
    qbittorrent: () => [...queryKeys.plugins.all, 'qbittorrent'] as const,
    scrutiny: () => [...queryKeys.plugins.all, 'scrutiny'] as const,
    netdata: () => [...queryKeys.plugins.all, 'netdata'] as const,
    adguard: () => [...queryKeys.plugins.all, 'adguard'] as const,
    weather: () => [...queryKeys.plugins.all, 'weather'] as const,
    tmdb: () => [...queryKeys.plugins.all, 'tmdb'] as const,
    clockify: () => [...queryKeys.plugins.all, 'clockify'] as const,
  },

  admin: {
    all: ['admin'] as const,
    users: () => [...queryKeys.admin.all, 'users'] as const,
    invitations: () => [...queryKeys.admin.all, 'invitations'] as const,
    export: () => [...queryKeys.admin.all, 'export'] as const,
    sessions: () => [...queryKeys.admin.all, 'sessions'] as const,
    pushTokens: () => [...queryKeys.admin.all, 'push-tokens'] as const,
    webPush: () => [...queryKeys.admin.all, 'web-push'] as const,
    scheduledJobs: () => [...queryKeys.admin.all, 'scheduled-jobs'] as const,
    testEmailTemplates: () => [...queryKeys.admin.all, 'test-email-templates'] as const,
  },

  calendar: {
    all: ['calendar'] as const,
    events: (year?: number, month?: number) => [...queryKeys.calendar.all, 'events', year, month] as const,
    icalToken: () => [...queryKeys.calendar.all, 'ical-token'] as const,
  },

  customEvents: {
    all: ['custom-events'] as const,
    list: (year?: number, month?: number) => [...queryKeys.customEvents.all, year, month] as const,
  },

  c411: {
    all: ['c411'] as const,
    history: (service: string, sourceId: number | null, seasonNumber: number | null) => ['c411', 'history', service, sourceId, seasonNumber] as const,
    drafts: () => ['c411', 'drafts'] as const,
    draft: (id: number) => ['c411', 'draft', id] as const,
    releases: () => ['c411', 'releases'] as const,
    release: (id: number) => ['c411', 'release', id] as const,
    generateBBCode: (tmdbId: number) => ['c411', 'generate-bbcode', tmdbId] as const,
    categories: () => ['c411', 'categories'] as const,
    categoryOptions: (id: number) => ['c411', 'category-options', id] as const,
    tmdbTitle: (tmdbId: number | null) => ['c411', 'tmdb-title', tmdbId] as const,
    mediaInfo: (service: string, sourceId: number | null, seasonNumber: number | null) =>
      ['c411', 'media-info', service, sourceId, seasonNumber] as const,
  },

  medias: {
    all: ['medias'] as const,
    list: () => [...queryKeys.medias.all, 'list'] as const,
    explore: () => [...queryKeys.medias.all, 'explore'] as const,
    similar: (tmdbId: number, type: 'movie' | 'tv') =>
      [...queryKeys.medias.all, 'similar', tmdbId, type] as const,
    tmdbSearch: (query: string) => [...queryKeys.medias.all, 'tmdb-search', query] as const,
    interactiveSearch: (service: 'radarr' | 'sonarr', sourceId: number) =>
      [...queryKeys.medias.all, 'interactive-search', service, sourceId] as const,
    prowlarrInteractiveSearch: (query: string) =>
      [...queryKeys.medias.all, 'interactive-search', 'prowlarr', query] as const,
    providers: (mediaType: 'movie' | 'tv', tmdbId: number, region?: string) =>
      [...queryKeys.medias.all, 'providers', mediaType, tmdbId, region ?? 'CA'] as const,
    conversionPreview: (service: 'radarr' | 'sonarr', sourceId: number, codec: string, height: number | null, toneMap: boolean, audioTracks: number[] | null) =>
      [...queryKeys.medias.all, 'conversion-preview', service, sourceId, codec, height, toneMap, audioTracks] as const,
    conversions: (service: 'radarr' | 'sonarr', sourceId: number) =>
      [...queryKeys.medias.all, 'conversions', service, sourceId] as const,
    activeConversions: () => [...queryKeys.medias.all, 'active-conversions'] as const,
    conversion: (id: number) => [...queryKeys.medias.all, 'conversion', id] as const,
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
  habits: {
    all: ['habits'] as const,
    list: () => [...queryKeys.habits.all, 'list'] as const,
    history: (id: number) => [...queryKeys.habits.all, 'history', id] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
