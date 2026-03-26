export const MEDIAS_ENDPOINTS = {
  LIST: '/api/medias',
  EXPLORE: '/api/medias/explore',
  SIMILAR: (tmdbId: number, type: 'movie' | 'tv') =>
    `/api/medias/similar/${encodeURIComponent(String(tmdbId))}?type=${encodeURIComponent(type)}`,
  PROVIDERS: (mediaType: 'movie' | 'tv', tmdbId: number, region?: string) =>
    `/api/medias/providers/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${region ? `?region=${encodeURIComponent(region)}` : ''}`,
  TMDB_SEARCH: '/api/medias/tmdb-search',
  AUTO_SEARCH: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/auto-search`,
  INTERACTIVE_SEARCH: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/interactive-search`,
  INTERACTIVE_SEARCH_DOWNLOAD: (service: 'radarr' | 'sonarr', sourceId: number) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}/interactive-search/download`,
  PROWLARR_INTERACTIVE_SEARCH: '/api/medias/prowlarr/interactive-search',
  PROWLARR_INTERACTIVE_SEARCH_DOWNLOAD: '/api/medias/prowlarr/interactive-search/download',
  DELETE: (service: 'radarr' | 'sonarr', sourceId: number, deleteFiles: boolean) =>
    `/api/medias/${encodeURIComponent(service)}/${encodeURIComponent(String(sourceId))}?deleteFiles=${deleteFiles}`,
} as const;
