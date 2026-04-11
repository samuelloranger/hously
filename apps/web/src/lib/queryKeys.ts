import type { TrackerType } from "@hously/shared/types";
export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    me: ["auth", "me"] as const,
    user: ["auth", "user"] as const,
    validateInvitation: (token: string) =>
      [...queryKeys.auth.all, "validate-invitation", token] as const,
  },

  shopping: {
    all: ["shopping"] as const,
    items: () => [...queryKeys.shopping.all, "items"] as const,
    syncStatus: () => [...queryKeys.shopping.all, "sync-status"] as const,
  },

  chores: {
    all: ["chores"] as const,
    list: () => [...queryKeys.chores.all, "list"] as const,
  },

  qbittorrent: {
    all: ["qbittorrent"] as const,
    status: () => [...queryKeys.qbittorrent.all, "status"] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    stats: () => [...queryKeys.dashboard.all, "stats"] as const,
    activities: (limit?: number) =>
      [...queryKeys.dashboard.all, "activities", limit] as const,
    activityFeed: (params?: {
      limit?: number;
      service?: string;
      type?: string;
    }) =>
      [
        ...queryKeys.dashboard.all,
        "activity-feed",
        params?.limit,
        params?.service,
        params?.type,
      ] as const,
    jellyfinLatest: (limit?: number, page?: number) =>
      [...queryKeys.dashboard.all, "jellyfin-latest", limit, page] as const,
    jellyfinLatestInfinite: (limit?: number) =>
      [...queryKeys.dashboard.all, "jellyfin-latest-infinite", limit] as const,
    trackersStats: () =>
      [...queryKeys.dashboard.all, "trackers-stats"] as const,
    trackerStats: (type: TrackerType) =>
      [...queryKeys.dashboard.all, "tracker-stats", type] as const,
    upcoming: () => [...queryKeys.dashboard.all, "upcoming"] as const,
    qbittorrentPinnedTorrent: () =>
      [...queryKeys.dashboard.all, "qbittorrent-pinned-torrent"] as const,
    qbittorrentTorrents: (params: Record<string, unknown>) =>
      [...queryKeys.dashboard.all, "qbittorrent-torrents", params] as const,
    qbittorrentCategories: () =>
      [...queryKeys.dashboard.all, "qbittorrent-categories"] as const,
    qbittorrentTags: () =>
      [...queryKeys.dashboard.all, "qbittorrent-tags"] as const,
    qbittorrentTorrentProperties: (hash: string) =>
      [
        ...queryKeys.dashboard.all,
        "qbittorrent-torrent-properties",
        hash,
      ] as const,
    qbittorrentTorrentTrackers: (hash: string) =>
      [
        ...queryKeys.dashboard.all,
        "qbittorrent-torrent-trackers",
        hash,
      ] as const,
    qbittorrentTorrentFiles: (hash: string) =>
      [...queryKeys.dashboard.all, "qbittorrent-torrent-files", hash] as const,
    qbittorrentTorrentPeers: (hash: string) =>
      [...queryKeys.dashboard.all, "qbittorrent-torrent-peers", hash] as const,
    scrutinySummary: () =>
      [...queryKeys.dashboard.all, "scrutiny-summary"] as const,
    systemSummary: () =>
      [...queryKeys.dashboard.all, "system-summary"] as const,
    adguardSummary: () =>
      [...queryKeys.dashboard.all, "adguard-summary"] as const,
    homeAssistantWidget: () =>
      [...queryKeys.dashboard.all, "home-assistant-widget"] as const,
  },

  weather: {
    all: ["weather"] as const,
    current: () => [...queryKeys.weather.all, "current"] as const,
    forecast: () => [...queryKeys.weather.all, "forecast"] as const,
  },

  users: {
    all: ["users"] as const,
    list: () => [...queryKeys.users.all, "list"] as const,
  },

  analytics: {
    all: ["analytics"] as const,
    weeklySummary: (locale?: string) =>
      [...queryKeys.analytics.all, "weekly-summary", locale ?? "en"] as const,
    personalInsights: () =>
      [...queryKeys.analytics.all, "personal-insights"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    devices: () => [...queryKeys.notifications.all, "devices"] as const,
    list: (page?: number, limit?: number, read?: boolean) =>
      [...queryKeys.notifications.all, "list", page, limit, read] as const,
    unreadCount: () =>
      [...queryKeys.notifications.all, "unread-count"] as const,
  },

  externalNotifications: {
    all: ["external-notifications"] as const,
    services: () =>
      [...queryKeys.externalNotifications.all, "services"] as const,
    logs: () => [...queryKeys.externalNotifications.all, "logs"] as const,
  },

  plugins: {
    all: ["plugins"] as const,
    tracker: (type: TrackerType) => [...queryKeys.plugins.all, type] as const,
    jellyfin: () => [...queryKeys.plugins.all, "jellyfin"] as const,
    radarr: () => [...queryKeys.plugins.all, "radarr"] as const,
    sonarr: () => [...queryKeys.plugins.all, "sonarr"] as const,
    prowlarr: () => [...queryKeys.plugins.all, "prowlarr"] as const,
    qbittorrent: () => [...queryKeys.plugins.all, "qbittorrent"] as const,
    scrutiny: () => [...queryKeys.plugins.all, "scrutiny"] as const,
    beszel: () => [...queryKeys.plugins.all, "beszel"] as const,
    adguard: () => [...queryKeys.plugins.all, "adguard"] as const,
    weather: () => [...queryKeys.plugins.all, "weather"] as const,
    tmdb: () => [...queryKeys.plugins.all, "tmdb"] as const,
    homeAssistant: () => [...queryKeys.plugins.all, "home-assistant"] as const,
  },

  admin: {
    all: ["admin"] as const,
    users: () => [...queryKeys.admin.all, "users"] as const,
    invitations: () => [...queryKeys.admin.all, "invitations"] as const,
    export: () => [...queryKeys.admin.all, "export"] as const,
    sessions: () => [...queryKeys.admin.all, "sessions"] as const,
    pushTokens: () => [...queryKeys.admin.all, "push-tokens"] as const,
    webPush: () => [...queryKeys.admin.all, "web-push"] as const,
    scheduledJobs: () => [...queryKeys.admin.all, "scheduled-jobs"] as const,
    testEmailTemplates: () =>
      [...queryKeys.admin.all, "test-email-templates"] as const,
  },

  calendar: {
    all: ["calendar"] as const,
    events: (year?: number, month?: number) =>
      [...queryKeys.calendar.all, "events", year, month] as const,
    icalToken: () => [...queryKeys.calendar.all, "ical-token"] as const,
  },

  customEvents: {
    all: ["custom-events"] as const,
    list: (year?: number, month?: number) =>
      [...queryKeys.customEvents.all, year, month] as const,
  },

  medias: {
    all: ["medias"] as const,
    explore: () => [...queryKeys.medias.all, "explore"] as const,
    similar: (tmdbId: number, type: "movie" | "tv") =>
      [...queryKeys.medias.all, "similar", tmdbId, type] as const,
    tmdbSearch: (query: string, language?: string) =>
      [
        ...queryKeys.medias.all,
        "tmdb-search",
        query,
        language ?? "en-US",
      ] as const,
    prowlarrInteractiveSearch: (
      query: string,
      libraryMediaId?: number | null,
      season?: number | "complete" | null,
    ) =>
      [
        ...queryKeys.medias.all,
        "interactive-search",
        "prowlarr",
        query,
        libraryMediaId ?? null,
        season ?? null,
      ] as const,
    providers: (
      mediaType: "movie" | "tv",
      tmdbId: number,
      region?: string,
      language?: string,
    ) =>
      [
        ...queryKeys.medias.all,
        "providers",
        mediaType,
        tmdbId,
        region ?? "CA",
        language ?? "en-US",
      ] as const,
    streamingProviders: (
      region?: string,
      type?: "movie" | "tv",
      language?: string,
    ) =>
      [
        ...queryKeys.medias.all,
        "streaming-providers",
        region ?? "CA",
        type ?? "movie",
        language ?? "en-US",
      ] as const,
    trailer: (mediaType: "movie" | "tv", tmdbId: number, language?: string) =>
      [
        ...queryKeys.medias.all,
        "trailer",
        mediaType,
        tmdbId,
        language ?? "en-US",
      ] as const,
    genres: (type: "movie" | "tv", language?: string) =>
      [...queryKeys.medias.all, "genres", type, language ?? "en-US"] as const,
    ratings: (mediaType: "movie" | "tv", tmdbId: number, language?: string) =>
      [
        ...queryKeys.medias.all,
        "ratings",
        mediaType,
        tmdbId,
        language ?? "en-US",
      ] as const,
    credits: (mediaType: "movie" | "tv", tmdbId: number, language?: string) =>
      [
        ...queryKeys.medias.all,
        "credits",
        mediaType,
        tmdbId,
        language ?? "en-US",
      ] as const,
    tmdbDetails: (mediaType: "movie" | "tv", tmdbId: number, language?: string) =>
      [...queryKeys.medias.all, "tmdb-details", mediaType, tmdbId, language ?? "en-US"] as const,
    watchlist: () => [...queryKeys.medias.all, "watchlist"] as const,
    missingCollections: (language?: string) =>
      [
        ...queryKeys.medias.all,
        "missing-collections",
        language ?? "en-US",
      ] as const,
    modalData: (mediaType: "movie" | "tv", tmdbId: number, region?: string, language?: string) =>
      [
        ...queryKeys.medias.all,
        "modal",
        "v2",
        mediaType,
        tmdbId,
        region ?? "CA",
        language ?? "en-US",
      ] as const,
    modalDataAll: (mediaType: "movie" | "tv", tmdbId: number) =>
      [...queryKeys.medias.all, "modal", "v2", mediaType, tmdbId] as const,
    discover: (params: {
      type: "movie" | "tv";
      provider_id?: number | null;
      genre_id?: number | null;
      sort_by?: string;
      page?: number;
      language?: string;
      region?: string;
      original_language?: string | null;
    }) =>
      [
        ...queryKeys.medias.all,
        "discover",
        params.type,
        params.provider_id ?? null,
        params.genre_id ?? null,
        params.sort_by ?? "popularity.desc",
        params.page ?? 1,
        params.language ?? "en-US",
        params.region ?? "CA",
        params.original_language ?? null,
      ] as const,
  },

  habits: {
    all: ["habits"] as const,
    list: () => [...queryKeys.habits.all, "list"] as const,
    history: (id: number) => [...queryKeys.habits.all, "history", id] as const,
  },

  boardTasks: {
    all: ["board-tasks"] as const,
    list: () => [...queryKeys.boardTasks.all, "list"] as const,
    archived: () => [...queryKeys.boardTasks.all, "archived"] as const,
    activity: (id: number) =>
      [...queryKeys.boardTasks.all, "activity", id] as const,
    timeLogs: (id: number) =>
      [...queryKeys.boardTasks.all, "time-logs", id] as const,
  },

  boardTags: {
    all: ["board-tags"] as const,
    list: () => [...queryKeys.boardTags.all, "list"] as const,
  },

  search: {
    all: ["search"] as const,
    quick: (query: string) =>
      [...queryKeys.search.all, "quick", query] as const,
  },

  library: {
    all: ["library"] as const,
    list: (filters?: { type?: string; status?: string; q?: string }) =>
      [...queryKeys.library.all, "list", filters] as const,
    episodes: (id: number) =>
      [...queryKeys.library.all, "episodes", id] as const,
    downloads: (id: number) =>
      [...queryKeys.library.all, "downloads", id] as const,
    postProcessingSettings: () =>
      [...queryKeys.library.all, "post-processing-settings"] as const,
  },

  qualityProfiles: {
    all: ["quality-profiles"] as const,
    list: () => [...queryKeys.qualityProfiles.all, "list"] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
