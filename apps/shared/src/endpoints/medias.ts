export const MEDIAS_ENDPOINTS = {
  EXPLORE: "/api/medias/explore",
  AI_SUGGESTIONS: "/api/medias/ai/suggestions",
  AI_SUGGESTIONS_CONFIG: "/api/medias/ai/suggestions/config",
  SIMILAR: (tmdbId: number, type: "movie" | "tv") =>
    `/api/medias/similar/${encodeURIComponent(String(tmdbId))}?type=${encodeURIComponent(type)}`,
  PROVIDERS: (mediaType: "movie" | "tv", tmdbId: number, region?: string) =>
    `/api/medias/providers/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${region ? `?region=${encodeURIComponent(region)}` : ""}`,
  TMDB_SEARCH: "/api/medias/tmdb-search",
  PROWLARR_INTERACTIVE_SEARCH: "/api/medias/prowlarr/interactive-search",
  PROWLARR_INTERACTIVE_SEARCH_DOWNLOAD:
    "/api/medias/prowlarr/interactive-search/download",
  STREAMING_PROVIDERS: (region?: string, type?: "movie" | "tv") =>
    `/api/medias/streaming-providers?region=${encodeURIComponent(region ?? "CA")}&type=${encodeURIComponent(type ?? "movie")}`,
  TRAILER: (mediaType: "movie" | "tv", tmdbId: number) =>
    `/api/medias/trailer/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}`,
  GENRES: (type: "movie" | "tv") =>
    `/api/medias/genres?type=${encodeURIComponent(type)}`,
  RATINGS: (mediaType: "movie" | "tv", tmdbId: number) =>
    `/api/medias/ratings/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}`,
  CREDITS: (mediaType: "movie" | "tv", tmdbId: number) =>
    `/api/medias/credits/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}`,
  TMDB_DETAILS: (mediaType: "movie" | "tv", tmdbId: number) =>
    `/api/medias/tmdb-details/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}`,
  WATCHLIST: "/api/medias/watchlist",
  WATCHLIST_REMOVE: (tmdbId: number, type: "movie" | "tv") =>
    `/api/medias/watchlist/${encodeURIComponent(String(tmdbId))}?type=${encodeURIComponent(type)}`,
  MISSING_COLLECTIONS: "/api/medias/collections/missing",
  MODAL_DATA: (mediaType: "movie" | "tv", tmdbId: number, region?: string) =>
    `/api/medias/modal/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${region ? `?region=${encodeURIComponent(region)}` : ""}`,
  DISCOVER: (params: {
    type: "movie" | "tv";
    provider_id?: number | null;
    genre_id?: number | null;
    sort_by?: string;
    page?: number;
    language?: string;
    region?: string;
    original_language?: string | null;
  }) => {
    const p = new URLSearchParams();
    p.set("type", params.type);
    if (params.provider_id) p.set("provider_id", String(params.provider_id));
    if (params.genre_id) p.set("genre_id", String(params.genre_id));
    if (params.sort_by) p.set("sort_by", params.sort_by);
    if (params.page) p.set("page", String(params.page));
    if (params.language) p.set("language", params.language);
    if (params.region) p.set("region", params.region);
    if (params.original_language)
      p.set("original_language", params.original_language);
    return `/api/medias/discover?${p.toString()}`;
  },
} as const;
