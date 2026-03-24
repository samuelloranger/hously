import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import { C411_ENDPOINTS } from '../endpoints';
import type {
  C411DraftsResponse,
  C411DraftDetail,
  C411DraftPayload,
  C411PublishResponse,
  C411ReleasesResponse,
  C411LocalReleaseDetail,
  C411SyncResponse,
  C411GenerateBBCodeResponse,
  C411CategoryListItem,
  C411CategoryOption,
  C411PrepareReleaseRequest,
  C411PrepareReleaseResponse,
  MediaInfoResponse,
} from '../types';

export function useC411FrenchTitle(tmdbId: number | null, type: string, options?: { enabled?: boolean }) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.tmdbTitle(tmdbId),
    queryFn: () => fetcher<{ title: string }>(`${C411_ENDPOINTS.TMDB_TITLE}?tmdbId=${tmdbId}&type=${encodeURIComponent(type)}`),
    enabled: (options?.enabled ?? true) && tmdbId !== null,
    staleTime: Infinity,
  });
}

export function useMediaHistory(
  params: { service: 'radarr' | 'sonarr'; sourceId: number | null; seasonNumber?: number | null },
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.history(params.service, params.sourceId, params.seasonNumber ?? null),
    queryFn: () => {
      const search = new URLSearchParams({
        service: params.service,
        sourceId: String(params.sourceId),
      });
      if (params.seasonNumber != null) {
        search.set('seasonNumber', String(params.seasonNumber));
      }
      return fetcher<any>(`${C411_ENDPOINTS.HISTORY}?${search.toString()}`);
    },
    enabled:
      (options?.enabled ?? false) &&
      params.sourceId !== null,
  });
}

export function useC411ReprocessReleaseGroup() {
  const fetcher = useFetcher();
  return useMutation({
    mutationFn: (payload: { service: 'radarr' | 'sonarr'; sourceId: number; seasonNumber?: number | null; historyEventId?: number }) =>
      fetcher<{ success: boolean; message?: string }>(C411_ENDPOINTS.REPROCESS, { method: 'POST', body: payload }),
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

export function useC411PublishDraft() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<C411PublishResponse>(C411_ENDPOINTS.PUBLISH_DRAFT(id), { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.drafts() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
    },
  });
}

export function useC411DeleteDraft() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher(C411_ENDPOINTS.DRAFT(id), { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.drafts() });
    },
  });
}

export function useC411Releases() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.releases(),
    queryFn: () => fetcher<C411ReleasesResponse>(C411_ENDPOINTS.RELEASES),
    staleTime: 0,
    refetchOnMount: 'always',
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

export function useC411PublishRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<C411PublishResponse>(C411_ENDPOINTS.PUBLISH_RELEASE(id), { method: 'POST' }),
    onSuccess: (_data, id) => {
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.release(id) });
    },
  });
}

export function useC411DeleteRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher(C411_ENDPOINTS.RELEASE(id), { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
      queryClient.removeQueries({ queryKey: queryKeys.c411.release(id) });
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
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.release(id) });
    },
  });
}

export function useC411MediaInfo(
  params: { service: 'radarr' | 'sonarr'; sourceId: number | null; seasonNumber?: number | null },
  options?: { enabled?: boolean },
) {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.c411.mediaInfo(params.service, params.sourceId, params.seasonNumber ?? null),
    queryFn: () => {
      const search = new URLSearchParams({
        service: params.service,
        sourceId: String(params.sourceId),
      });
      if (params.seasonNumber != null) {
        search.set('seasonNumber', String(params.seasonNumber));
      }
      return fetcher<MediaInfoResponse>(`${C411_ENDPOINTS.MEDIA_INFO}?${search.toString()}`);
    },
    enabled:
      (options?.enabled ?? false) &&
      params.sourceId !== null,
  });
}

export function useC411PrepareRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: C411PrepareReleaseRequest) =>
      fetcher<C411PrepareReleaseResponse>(C411_ENDPOINTS.PREPARE_RELEASE, { method: 'POST', body: payload }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
    },
  });
}

export function useC411RefreshRelease() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      fetcher<{ success: boolean }>(C411_ENDPOINTS.REFRESH_RELEASE(id), { method: 'POST' }),
    onSuccess: (_data, id) => {
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
      queryClient.invalidateQueries({ queryKey: queryKeys.c411.release(id) });
    },
  });
}

export function useC411Sync() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => fetcher<C411SyncResponse>(C411_ENDPOINTS.SYNC, { method: 'POST' }),
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: queryKeys.c411.releases() });
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

/**
 * SSE stream that watches for releases leaving the "preparing" state.
 * When the set of preparing IDs shrinks, the releases query is invalidated
 * so the UI refreshes automatically.
 *
 * The stream connects when `enabled` is true and disconnects on cleanup,
 * so closing and reopening the dialog reconnects automatically.
 */
export function useC411ReleasePrepareStream(options: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const previousIdsRef = useRef<Set<number> | null>(null);
  const [prepareSteps, setPrepareSteps] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!options.enabled) {
      previousIdsRef.current = null;
      setPrepareSteps({});
      return;
    }

    if (typeof EventSource === 'undefined') return;

    const source = new (EventSource as any)(C411_ENDPOINTS.RELEASES_STREAM, { withCredentials: true });

    source.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data) as { preparing_ids: number[]; prepare_steps?: Record<number, string> };
        const currentIds = new Set(data.preparing_ids);
        const prevIds = previousIdsRef.current;

        if (prevIds !== null) {
          const finished = [...prevIds].some((id) => !currentIds.has(id));
          if (finished) {
            queryClient.invalidateQueries({ queryKey: queryKeys.c411.releases() });
          }
        }

        previousIdsRef.current = currentIds;
        if (data.prepare_steps) setPrepareSteps(data.prepare_steps);
      } catch {
        // ignore parse errors
      }
    };

    source.onerror = () => {
      previousIdsRef.current = null;
    };

    return () => {
      source.close();
      previousIdsRef.current = null;
    };
  }, [options.enabled, queryClient]);

  return { prepareSteps };
}
