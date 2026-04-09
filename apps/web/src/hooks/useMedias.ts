import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { MEDIAS_ENDPOINTS } from "@hously/shared/endpoints";
import type {
  DiscoverMediasParams,
  DiscoverMediasResponse,
  MediaInteractiveDownloadResponse,
  MediaInteractiveSearchResponse,
  MediaModalDataResponse,
  MissingCollectionsResponse,
  SimilarMediasResponse,
  TmdbGenresResponse,
  TmdbMediaSearchResponse,
  AiMediaSuggestionsResponse,
  AiMediaSuggestionsConfigResponse,
  TmdbStreamingProvidersResponse,
  WatchlistResponse,
} from "@hously/shared/types";

export function useAiMediaSuggestions() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (body: {
      prompt?: string;
      media_type: "movie" | "tv" | "both";
      language?: string;
    }) =>
      fetcher<AiMediaSuggestionsResponse>(MEDIAS_ENDPOINTS.AI_SUGGESTIONS, {
        method: "POST",
        body,
      }),
  });
}

export function useAiMediaSuggestionsConfig() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.aiSuggestionsConfig(),
    queryFn: () =>
      fetcher<AiMediaSuggestionsConfigResponse>(
        MEDIAS_ENDPOINTS.AI_SUGGESTIONS_CONFIG,
      ),
  });
}

export function useSimilarMedias(
  tmdbId: number | null,
  type: "movie" | "tv" | null,
  language?: string,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  const lang = language || "en-US";
  const isEnabled =
    (options?.enabled ?? true) && tmdbId !== null && type !== null;

  return useQuery({
    queryKey: [...queryKeys.medias.similar(tmdbId ?? 0, type ?? "movie"), lang],
    queryFn: () =>
      fetcher<SimilarMediasResponse>(
        `${MEDIAS_ENDPOINTS.SIMILAR(tmdbId!, type!)}&language=${encodeURIComponent(lang)}`,
      ),
    enabled: isEnabled,
  });
}

export function useTmdbMediaSearch(
  query: string,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.medias.tmdbSearch(trimmed),
    queryFn: () =>
      fetcher<TmdbMediaSearchResponse>(
        `${MEDIAS_ENDPOINTS.TMDB_SEARCH}?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: (options?.enabled ?? true) && trimmed.length >= 2,
  });
}

export function useProwlarrInteractiveSearch(
  query: string,
  options?: {
    enabled?: boolean;
    library_media_id?: number | null;
    /** When set to a number, triggers tvsearch for that season. "complete" triggers full-series search. */
    season?: number | "complete" | null;
    /** TMDB ID — used for tier-1 structured tvsearch */
    tmdb_id?: number | null;
  },
) {
  const fetcher = useFetcher();
  const trimmed = query.trim();
  const libId = options?.library_media_id;
  const season = options?.season ?? null;
  const tmdbId = options?.tmdb_id ?? null;
  const isSeasonSearch = typeof season === "number";
  const isCompleteSearch = season === "complete";

  return useQuery({
    queryKey: queryKeys.medias.prowlarrInteractiveSearch(
      trimmed,
      libId,
      season,
    ),
    queryFn: () =>
      fetcher<MediaInteractiveSearchResponse>(
        MEDIAS_ENDPOINTS.PROWLARR_INTERACTIVE_SEARCH,
        {
          params: {
            q: trimmed,
            ...(libId != null && libId > 0 ? { library_media_id: libId } : {}),
            ...(isSeasonSearch ? { season } : {}),
            ...(isCompleteSearch ? { complete: "true" } : {}),
            ...((isSeasonSearch || isCompleteSearch) && tmdbId != null
              ? { tmdb_id: tmdbId }
              : {}),
          },
        },
      ),
    enabled:
      (options?.enabled ?? true) &&
      (isSeasonSearch || isCompleteSearch
        ? trimmed.length >= 1
        : trimmed.length >= 2),
  });
}

export function useProwlarrInteractiveDownload() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (params: { token: string }) =>
      fetcher<MediaInteractiveDownloadResponse>(
        MEDIAS_ENDPOINTS.PROWLARR_INTERACTIVE_SEARCH_DOWNLOAD,
        {
          method: "POST",
          body: {
            token: params.token,
          },
        },
      ),
  });
}

export function useStreamingProviders(region?: string, type?: "movie" | "tv") {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.medias.streamingProviders(region, type),
    queryFn: () =>
      fetcher<TmdbStreamingProvidersResponse>(
        MEDIAS_ENDPOINTS.STREAMING_PROVIDERS(region, type),
      ),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useMediaGenres(type: "movie" | "tv") {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.genres(type),
    queryFn: () => fetcher<TmdbGenresResponse>(MEDIAS_ENDPOINTS.GENRES(type)),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useDiscoverMedias(params: DiscoverMediasParams) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.discover(params),
    queryFn: () =>
      fetcher<DiscoverMediasResponse>(MEDIAS_ENDPOINTS.DISCOVER(params)),
  });
}

export function useMediaModalData(
  mediaType: "movie" | "tv" | null,
  tmdbId: number | null,
  region?: string,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  const isEnabled =
    (options?.enabled ?? true) &&
    mediaType !== null &&
    tmdbId !== null &&
    tmdbId > 0;
  return useQuery({
    queryKey: queryKeys.medias.modalData(
      mediaType ?? "movie",
      tmdbId ?? 0,
      region,
    ),
    queryFn: () =>
      fetcher<MediaModalDataResponse>(
        MEDIAS_ENDPOINTS.MODAL_DATA(mediaType!, tmdbId!, region),
      ),
    enabled: isEnabled,
    staleTime: 60 * 1000, // 1 min — watchlist status is user-specific
  });
}

export function useWatchlist(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.medias.watchlist(),
    queryFn: () => fetcher<WatchlistResponse>(MEDIAS_ENDPOINTS.WATCHLIST),
    enabled: options?.enabled ?? true,
  });
}

export function useAddToWatchlist() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      tmdb_id: number;
      media_type: "movie" | "tv";
      title: string;
      poster_url?: string | null;
      overview?: string | null;
      release_year?: number | null;
      vote_average?: number | null;
      /** YYYY-MM-DD (movies); enables day-before release reminder */
      release_date?: string | null;
    }) =>
      fetcher<{ id: number; added: boolean }>(MEDIAS_ENDPOINTS.WATCHLIST, {
        method: "POST",
        body: data,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.watchlist() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.medias.modalData(
          variables.media_type,
          variables.tmdb_id,
        ),
      });
    },
  });
}

export function useRemoveFromWatchlist() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tmdb_id,
      media_type,
    }: {
      tmdb_id: number;
      media_type: "movie" | "tv";
    }) =>
      fetcher<{ success: boolean }>(
        MEDIAS_ENDPOINTS.WATCHLIST_REMOVE(tmdb_id, media_type),
        {
          method: "DELETE",
        },
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.watchlist() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.medias.modalData(
          variables.media_type,
          variables.tmdb_id,
        ),
      });
    },
  });
}

export function useMissingCollections(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.medias.missingCollections(),
    queryFn: () =>
      fetcher<MissingCollectionsResponse>(MEDIAS_ENDPOINTS.MISSING_COLLECTIONS),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
