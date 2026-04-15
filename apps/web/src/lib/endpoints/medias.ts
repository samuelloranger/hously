export const MEDIAS_ENDPOINTS = {
  EXPLORE: "/api/medias/explore",
  SIMILAR: (tmdbId: number, type: "movie" | "tv") =>
    `/api/medias/similar/${encodeURIComponent(String(tmdbId))}?type=${encodeURIComponent(type)}`,
  PROVIDERS: (
    mediaType: "movie" | "tv",
    tmdbId: number,
    region?: string,
    language?: string,
  ) => {
    const p = new URLSearchParams();
    if (region) p.set("region", region);
    if (language) p.set("language", language);
    const qs = p.toString();
    return `/api/medias/providers/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${qs ? `?${qs}` : ""}`;
  },
  TMDB_SEARCH: (q: string, language?: string) => {
    const p = new URLSearchParams({ q });
    if (language) p.set("language", language);
    return `/api/medias/tmdb-search?${p.toString()}`;
  },
  INTERACTIVE_SEARCH: "/api/medias/interactive-search",
  INTERACTIVE_SEARCH_DOWNLOAD: "/api/medias/interactive-search/download",
  INDEXERS: "/api/medias/indexers",
  STREAMING_PROVIDERS: (
    region?: string,
    type?: "movie" | "tv",
    language?: string,
  ) => {
    const p = new URLSearchParams({
      region: region ?? "CA",
      type: type ?? "movie",
    });
    if (language) p.set("language", language);
    return `/api/medias/streaming-providers?${p.toString()}`;
  },
  TRAILER: (mediaType: "movie" | "tv", tmdbId: number, language?: string) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : "";
    return `/api/medias/trailer/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${qs}`;
  },
  GENRES: (type: "movie" | "tv", language?: string) => {
    const p = new URLSearchParams({ type });
    if (language) p.set("language", language);
    return `/api/medias/genres?${p.toString()}`;
  },
  RATINGS: (mediaType: "movie" | "tv", tmdbId: number, language?: string) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : "";
    return `/api/medias/ratings/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${qs}`;
  },
  CREDITS: (mediaType: "movie" | "tv", tmdbId: number, language?: string) => {
    const qs = language ? `?language=${encodeURIComponent(language)}` : "";
    return `/api/medias/credits/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${qs}`;
  },
  TMDB_DETAILS: (
    mediaType: "movie" | "tv",
    tmdbId: number,
    language?: string,
  ) =>
    `/api/medias/tmdb-details/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${language ? `?language=${encodeURIComponent(language)}` : ""}`,
  WATCHLIST: "/api/medias/watchlist",
  WATCHLIST_REMOVE: (tmdbId: number, type: "movie" | "tv") =>
    `/api/medias/watchlist/${encodeURIComponent(String(tmdbId))}?type=${encodeURIComponent(type)}`,
  MISSING_COLLECTIONS: (language?: string) =>
    language
      ? `/api/medias/collections/missing?language=${encodeURIComponent(language)}`
      : "/api/medias/collections/missing",
  MODAL_DATA: (
    mediaType: "movie" | "tv",
    tmdbId: number,
    region?: string,
    language?: string,
  ) => {
    const p = new URLSearchParams();
    if (region) p.set("region", region);
    if (language) p.set("language", language);
    const qs = p.toString();
    return `/api/medias/modal/${encodeURIComponent(mediaType)}/${encodeURIComponent(String(tmdbId))}${qs ? `?${qs}` : ""}`;
  },
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
