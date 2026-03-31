import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { MEDIAS_ENDPOINTS } from '../endpoints';
import type {
  ArrManagementDetailsResponse,
  DiscoverMediasParams,
  DiscoverMediasResponse,
  ExploreMediasResponse,
  MediaAutoSearchResponse,
  MediaDeleteResponse,
  MediaRefreshResponse,
  MediaInteractiveDownloadResponse,
  MediaInteractiveSearchResponse,
  MediaModalDataResponse,
  MediaRatingsResponse,
  MediasResponse,
  MissingCollectionsResponse,
  SimilarMediasResponse,
  TmdbCreditsResponse,
  TmdbGenresResponse,
  TmdbMediaDetailsResponse,
  TmdbMediaSearchResponse,
  AiMediaSuggestionsResponse,
  AiMediaSuggestionsConfigResponse,
  TmdbStreamingProvidersResponse,
  TmdbTrailerResponse,
  TmdbWatchProvidersResponse,
  WatchlistResponse,
} from '../types';

export function useMedias() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.list(),
    queryFn: () => fetcher<MediasResponse>(MEDIAS_ENDPOINTS.LIST),
  });
}

export function useExploreMedias(language?: string) {
  const fetcher = useFetcher();
  const lang = language || 'en-US';

  return useQuery({
    queryKey: [...queryKeys.medias.explore(), lang],
    queryFn: () => fetcher<ExploreMediasResponse>(`${MEDIAS_ENDPOINTS.EXPLORE}?language=${encodeURIComponent(lang)}`),
  });
}

export function useRefreshRecommendations(language?: string) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  const lang = language || 'en-US';

  return useMutation({
    mutationFn: () =>
      fetcher<ExploreMediasResponse>(
        `${MEDIAS_ENDPOINTS.EXPLORE}?language=${encodeURIComponent(lang)}&skipCache=true`
      ),
    onSuccess: (data) => {
      queryClient.setQueryData([...queryKeys.medias.explore(), lang], data);
    },
  });
}

export function useAiMediaSuggestions() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (body: { prompt?: string; media_type: 'movie' | 'tv' | 'both'; language?: string }) =>
      fetcher<AiMediaSuggestionsResponse>(MEDIAS_ENDPOINTS.AI_SUGGESTIONS, {
        method: 'POST',
        body,
      }),
  });
}

export function useAiMediaSuggestionsConfig() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.medias.aiSuggestionsConfig(),
    queryFn: () => fetcher<AiMediaSuggestionsConfigResponse>(MEDIAS_ENDPOINTS.AI_SUGGESTIONS_CONFIG),
  });
}

export function useSimilarMedias(
  tmdbId: number | null,
  type: 'movie' | 'tv' | null,
  language?: string,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const lang = language || 'en-US';
  const isEnabled = (options?.enabled ?? true) && tmdbId !== null && type !== null;

  return useQuery({
    queryKey: [...queryKeys.medias.similar(tmdbId ?? 0, type ?? 'movie'), lang],
    queryFn: () =>
      fetcher<SimilarMediasResponse>(
        `${MEDIAS_ENDPOINTS.SIMILAR(tmdbId!, type!)}&language=${encodeURIComponent(lang)}`
      ),
    enabled: isEnabled,
  });
}

export function useTmdbMediaSearch(query: string, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.medias.tmdbSearch(trimmed),
    queryFn: () =>
      fetcher<TmdbMediaSearchResponse>(`${MEDIAS_ENDPOINTS.TMDB_SEARCH}?q=${encodeURIComponent(trimmed)}`),
    enabled: (options?.enabled ?? true) && trimmed.length >= 2,
  });
}

export function useMediaAutoSearch() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (params: { service: 'radarr' | 'sonarr'; source_id: number }) =>
      fetcher<MediaAutoSearchResponse>(MEDIAS_ENDPOINTS.AUTO_SEARCH(params.service, params.source_id), {
        method: 'POST',
        body: {},
      }),
  });
}

export function useMediaInteractiveSearch(
  params: { service: 'radarr' | 'sonarr'; source_id: number | null },
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = Boolean(options?.enabled ?? true) && Boolean(params.source_id && params.source_id > 0);

  return useQuery({
    queryKey: queryKeys.medias.interactiveSearch(params.service, params.source_id ?? 0),
    queryFn: () =>
      fetcher<MediaInteractiveSearchResponse>(
        MEDIAS_ENDPOINTS.INTERACTIVE_SEARCH(params.service, params.source_id ?? 0)
      ),
    enabled: isEnabled,
  });
}

export function useProwlarrInteractiveSearch(query: string, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.medias.prowlarrInteractiveSearch(trimmed),
    queryFn: () =>
      fetcher<MediaInteractiveSearchResponse>(MEDIAS_ENDPOINTS.PROWLARR_INTERACTIVE_SEARCH, {
        params: { q: trimmed },
      }),
    enabled: (options?.enabled ?? true) && trimmed.length >= 2,
  });
}

export function useTmdbWatchProviders(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  region?: string,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;

  return useQuery({
    queryKey: queryKeys.medias.providers(mediaType ?? 'movie', tmdbId ?? 0, region),
    queryFn: () => fetcher<TmdbWatchProvidersResponse>(MEDIAS_ENDPOINTS.PROVIDERS(mediaType!, tmdbId!, region)),
    enabled: isEnabled,
    staleTime: 6 * 60 * 60 * 1000,
  });
}

export function useMediaInteractiveDownload() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (params: { service: 'radarr' | 'sonarr'; source_id: number; guid: string; indexer_id: number }) =>
      fetcher<MediaInteractiveDownloadResponse>(MEDIAS_ENDPOINTS.INTERACTIVE_SEARCH_DOWNLOAD(params.service, params.source_id), {
        method: 'POST',
        body: {
          guid: params.guid,
          indexer_id: params.indexer_id,
        },
      }),
  });
}

export function useProwlarrInteractiveDownload() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (params: { token: string }) =>
      fetcher<MediaInteractiveDownloadResponse>(MEDIAS_ENDPOINTS.PROWLARR_INTERACTIVE_SEARCH_DOWNLOAD, {
        method: 'POST',
        body: {
          token: params.token,
        },
      }),
  });
}

export function useStreamingProviders(region?: string, type?: 'movie' | 'tv') {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.medias.streamingProviders(region, type),
    queryFn: () => fetcher<TmdbStreamingProvidersResponse>(MEDIAS_ENDPOINTS.STREAMING_PROVIDERS(region, type)),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useTmdbTrailer(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;

  return useQuery({
    queryKey: queryKeys.medias.trailer(mediaType ?? 'movie', tmdbId ?? 0),
    queryFn: () => fetcher<TmdbTrailerResponse>(MEDIAS_ENDPOINTS.TRAILER(mediaType!, tmdbId!)),
    enabled: isEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useMediaGenres(type: 'movie' | 'tv') {
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
    queryFn: () => fetcher<DiscoverMediasResponse>(MEDIAS_ENDPOINTS.DISCOVER(params)),
  });
}

export function useMediaRatings(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;

  return useQuery({
    queryKey: queryKeys.medias.ratings(mediaType ?? 'movie', tmdbId ?? 0),
    queryFn: () => fetcher<MediaRatingsResponse>(MEDIAS_ENDPOINTS.RATINGS(mediaType!, tmdbId!)),
    enabled: isEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useTmdbCredits(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;
  return useQuery({
    queryKey: queryKeys.medias.credits(mediaType ?? 'movie', tmdbId ?? 0),
    queryFn: () => fetcher<TmdbCreditsResponse>(MEDIAS_ENDPOINTS.CREDITS(mediaType!, tmdbId!)),
    enabled: isEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useTmdbMediaDetails(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;
  return useQuery({
    queryKey: queryKeys.medias.tmdbDetails(mediaType ?? 'movie', tmdbId ?? 0),
    queryFn: () => fetcher<TmdbMediaDetailsResponse>(MEDIAS_ENDPOINTS.TMDB_DETAILS(mediaType!, tmdbId!)),
    enabled: isEnabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export function useArrManagementDetails(
  params: { service: 'radarr' | 'sonarr'; source_id: number | null },
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const enabled = (options?.enabled ?? true) && params.source_id != null && params.source_id > 0;

  return useQuery({
    queryKey: queryKeys.medias.managementInfo(params.service, params.source_id ?? 0),
    queryFn: () =>
      fetcher<ArrManagementDetailsResponse>(MEDIAS_ENDPOINTS.MANAGEMENT_INFO(params.service, params.source_id!)),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useMediaRefresh() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { service: 'radarr' | 'sonarr'; source_id: number }) =>
      fetcher<MediaRefreshResponse>(MEDIAS_ENDPOINTS.REFRESH(params.service, params.source_id), {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.all });
    },
  });
}

export function useMediaDelete() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { service: 'radarr' | 'sonarr'; source_id: number; deleteFiles: boolean }) =>
      fetcher<MediaDeleteResponse>(MEDIAS_ENDPOINTS.DELETE(params.service, params.source_id, params.deleteFiles), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.all });
    },
  });
}

export function useMediaModalData(
  mediaType: 'movie' | 'tv' | null,
  tmdbId: number | null,
  region?: string,
  options?: { enabled?: boolean }
) {
  const fetcher = useFetcher();
  const isEnabled = (options?.enabled ?? true) && mediaType !== null && tmdbId !== null && tmdbId > 0;
  return useQuery({
    queryKey: queryKeys.medias.modalData(mediaType ?? 'movie', tmdbId ?? 0, region),
    queryFn: () => fetcher<MediaModalDataResponse>(MEDIAS_ENDPOINTS.MODAL_DATA(mediaType!, tmdbId!, region)),
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
      media_type: 'movie' | 'tv';
      title: string;
      poster_url?: string | null;
      overview?: string | null;
      release_year?: number | null;
      vote_average?: number | null;
      /** YYYY-MM-DD (movies); enables day-before release reminder */
      release_date?: string | null;
    }) =>
      fetcher<{ id: number; added: boolean }>(MEDIAS_ENDPOINTS.WATCHLIST, {
        method: 'POST',
        body: data,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.watchlist() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.medias.modalData(variables.media_type, variables.tmdb_id),
      });
    },
  });
}

export function useRemoveFromWatchlist() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tmdb_id, media_type }: { tmdb_id: number; media_type: 'movie' | 'tv' }) =>
      fetcher<{ success: boolean }>(MEDIAS_ENDPOINTS.WATCHLIST_REMOVE(tmdb_id, media_type), {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.watchlist() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.medias.modalData(variables.media_type, variables.tmdb_id),
      });
    },
  });
}

export function useMissingCollections(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.medias.missingCollections(),
    queryFn: () => fetcher<MissingCollectionsResponse>(MEDIAS_ENDPOINTS.MISSING_COLLECTIONS),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
