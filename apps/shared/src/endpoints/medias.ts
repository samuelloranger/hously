export const MEDIAS_ENDPOINTS = {
  LIST: '/api/medias',
  EXPLORE: '/api/medias/explore',
  TMDB_SEARCH: '/api/medias/tmdb-search',
  AUTO_SEARCH: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/auto-search`,
  INTERACTIVE_SEARCH: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/interactive-search`,
  INTERACTIVE_SEARCH_DOWNLOAD: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/interactive-search/download`,
} as const;
