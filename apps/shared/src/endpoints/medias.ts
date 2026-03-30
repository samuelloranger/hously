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
  STREAMING_PROVIDERS: (region?: string, type?: 'movie' | 'tv') =>
    `/api/medias/streaming-providers?region=${encodeURIComponent(region ?? 'CA')}&type=${encodeURIComponent(type ?? 'movie')}`,
  TRAILER: (mediaType: 'movie' | 'tv', tmdbId: number) =>
    `/api/medias/trailer/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}`,
  GENRES: (type: 'movie' | 'tv') => `/api/medias/genres?type=${encodeURIComponent(type)}`,
  DISCOVER: (params: {
    type: 'movie' | 'tv';
    provider_id?: number | null;
    genre_id?: number | null;
    sort_by?: string;
    page?: number;
    language?: string;
    region?: string;
    original_language?: string | null;
  }) => {
    const p = new URLSearchParams();
    p.set('type', params.type);
    if (params.provider_id) p.set('provider_id', String(params.provider_id));
    if (params.genre_id) p.set('genre_id', String(params.genre_id));
    if (params.sort_by) p.set('sort_by', params.sort_by);
    if (params.page) p.set('page', String(params.page));
    if (params.language) p.set('language', params.language);
    if (params.region) p.set('region', params.region);
    if (params.original_language) p.set('original_language', params.original_language);
    return `/api/medias/discover?${p.toString()}`;
  },
} as const;
