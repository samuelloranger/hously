export const LIBRARY_ENDPOINTS = {
  LIST: "/api/library",
  ADD: "/api/library",
  POST_PROCESSING_SETTINGS: "/api/library/post-processing/settings",
  SCAN: "/api/library/scan",
  REMOVE: (id: number) => `/api/library/${id}`,
  UPDATE_STATUS: (id: number) => `/api/library/${id}/status`,
  UPDATE_QUALITY_PROFILE: (id: number) => `/api/library/${id}/quality-profile`,
  EPISODES: (id: number) => `/api/library/${id}/episodes`,
  DOWNLOADS: (id: number) => `/api/library/${id}/downloads`,
  SEARCH: (id: number) => `/api/library/${id}/search`,
  GRAB: (id: number) => `/api/library/${id}/grab`,
  SEARCH_EPISODE: (mediaId: number, episodeId: number) =>
    `/api/library/${mediaId}/episodes/${episodeId}/search`,
  UPDATE_EPISODE_STATUS: (mediaId: number, episodeId: number) =>
    `/api/library/${mediaId}/episodes/${episodeId}/status`,
  RETRY_SKIPPED_SEASON: (mediaId: number, season: number) =>
    `/api/library/${mediaId}/seasons/${season}/retry-skipped`,
  SEARCH_SEASON: (mediaId: number, season: number) =>
    `/api/library/${mediaId}/seasons/${season}/search`,
  UPDATE_MONITORED: (id: number) => `/api/library/${id}/monitored`,
  UPDATE_EPISODE_MONITORED: (mediaId: number, episodeId: number) =>
    `/api/library/${mediaId}/episodes/${episodeId}/monitored`,
  UPDATE_SEASON_MONITORED: (mediaId: number, season: number) =>
    `/api/library/${mediaId}/seasons/${season}/monitored`,
  FILES: (id: number) => `/api/library/${id}/files`,
  RESCAN: (id: number) => `/api/library/${id}/rescan`,
  DELETE_FILE: (fileId: number) => `/api/library/files/${fileId}`,
  DELETE_EPISODE: (mediaId: number, episodeId: number) =>
    `/api/library/${mediaId}/episodes/${episodeId}`,
  MIGRATE: "/api/library/migrate",
  MIGRATE_STATUS: "/api/library/migrate/status",
  LANGUAGE_TAGS: "/api/library/language-tags",
  REINDEX_LANGUAGES: "/api/library/reindex-languages",
  REINDEX_LANGUAGES_STATUS: "/api/library/reindex-languages/status",
  FILE_REMUX: (fileId: number) => `/api/library/files/${fileId}/remux`,
  FILE_REMUX_STATUS: (fileId: number) =>
    `/api/library/files/${fileId}/remux/status`,
} as const;
