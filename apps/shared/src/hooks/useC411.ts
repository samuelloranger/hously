import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { C411_ENDPOINTS } from '../endpoints';
import type {
  C411SearchResponse,
  C411ReleaseStatusResponse,
  C411DraftsResponse,
  C411DraftDetail,
  C411DraftPayload,
  C411ReleasesResponse,
  C411LocalReleaseDetail,
  C411SyncResponse,
  C411GenerateBBCodeResponse,
  C411CategoryListItem,
  C411CategoryOption,
} from '../types';

export function useC411Search(query: string, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.c411.search(trimmed),
    queryFn: () => fetcher<C411SearchResponse>(`${C411_ENDPOINTS.SEARCH}?q=${encodeURIComponent(trimmed)}`),
    enabled: (options?.enabled ?? true) && trimmed.length >= 2,
  });
}

export function useC411ReleaseStatus(
  tmdbId: number | null,
  title: string,
  year: number,
  imdbId: string,
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.releaseStatus(tmdbId ?? 0),
    queryFn: () =>
      fetcher<C411ReleaseStatusResponse>(
        `${C411_ENDPOINTS.RELEASE_STATUS}?tmdbId=${tmdbId}&title=${encodeURIComponent(title)}&year=${year}&imdbId=${encodeURIComponent(imdbId)}`,
      ),
    enabled: (options?.enabled ?? true) && tmdbId !== null,
  });
}

export function useC411Drafts(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.drafts(),
    queryFn: () => fetcher<C411DraftsResponse>(C411_ENDPOINTS.DRAFTS),
    enabled: options?.enabled ?? true,
  });
}

export function useC411Draft(id: number | null, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.draft(id ?? 0),
    queryFn: () => fetcher<C411DraftDetail>(C411_ENDPOINTS.DRAFT(id!)),
    enabled: (options?.enabled ?? true) && id !== null,
  });
}

export function useC411CreateDraft() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: C411DraftPayload) =>
      fetcher<C411DraftDetail>(C411_ENDPOINTS.DRAFTS, { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.drafts() });
    },
  });
}

export function useC411UpdateDraft() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: C411DraftPayload }) =>
      fetcher<C411DraftDetail>(C411_ENDPOINTS.DRAFT(id), { method: 'PATCH', body: payload }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.drafts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.draft(id) });
    },
  });
}

export function useC411Releases() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.releases(),
    queryFn: () => fetcher<C411ReleasesResponse>(C411_ENDPOINTS.RELEASES),
  });
}

export function useC411Release(id: number | null, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.release(id ?? 0),
    queryFn: () => fetcher<C411LocalReleaseDetail>(C411_ENDPOINTS.RELEASE(id!)),
    enabled: (options?.enabled ?? true) && id !== null,
  });
}

export function useC411DeleteRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher(C411_ENDPOINTS.RELEASE(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
    },
  });
}

export function useC411UpdateRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Record<string, any> }) =>
      fetcher(C411_ENDPOINTS.RELEASE(id), { method: 'PATCH', body: payload }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.release(id) });
    },
  });
}

export function useC411PrepareRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (radarrSourceId: number) =>
      fetcher(C411_ENDPOINTS.PREPARE_RELEASE, { method: 'POST', body: { radarrSourceId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
    },
  });
}

export function useC411Sync() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetcher<C411SyncResponse>(C411_ENDPOINTS.SYNC, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
    },
  });
}

export function useC411GenerateBBCode(tmdbId: number | null, type: string, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.generateBBCode(tmdbId ?? 0),
    queryFn: () =>
      fetcher<C411GenerateBBCodeResponse>(
        `${C411_ENDPOINTS.GENERATE_BBCODE}?tmdbId=${tmdbId}&type=${encodeURIComponent(type)}`,
      ),
    enabled: (options?.enabled ?? false) && tmdbId !== null,
  });
}

export function useC411Categories(options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.categories(),
    queryFn: () => fetcher<C411CategoryListItem[]>(C411_ENDPOINTS.CATEGORIES),
    staleTime: 60 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useC411CategoryOptions(categoryId: number | null, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.categoryOptions(categoryId ?? 0),
    queryFn: () => fetcher<C411CategoryOption[]>(C411_ENDPOINTS.CATEGORY_OPTIONS(categoryId!)),
    staleTime: 60 * 60 * 1000,
    enabled: (options?.enabled ?? true) && categoryId !== null,
  });
}
