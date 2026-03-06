import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { MEDIAS_ENDPOINTS } from '../endpoints';
import type {
  ExploreMediasResponse,
  MediaAutoSearchResponse,
  MediaDeleteResponse,
  MediaInteractiveDownloadResponse,
  MediaInteractiveSearchResponse,
  MediasResponse,
  SimilarMediasResponse,
  TmdbMediaSearchResponse,
  TmdbWatchProvidersResponse,
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

export function useMediaDelete() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { service: 'radarr' | 'sonarr'; source_id: number; deleteFiles: boolean }) =>
      fetcher<MediaDeleteResponse>(MEDIAS_ENDPOINTS.DELETE(params.service, params.source_id, params.deleteFiles), {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medias.list() });
    },
  });
}
