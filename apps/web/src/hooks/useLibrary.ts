import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { LIBRARY_ENDPOINTS } from "@hously/shared/endpoints";
import type { UpdateLibraryQualityProfileRequest } from "@hously/shared/types";
import type {
  AddToLibraryResponse,
  LibraryDownloadsResponse,
  LibraryEpisodesResponse,
  LibraryFilesResponse,
  LibraryListResponse,
  LibraryMedia,
  LibraryScanResponse,
  LibrarySearchResponse,
  MediaPostProcessingSettingsResponse,
  MigrateLibraryRequest,
  MigrateLibraryEnqueueResponse,
  MigrateJobStatus,
  UpdateMediaPostProcessingSettingsRequest,
} from "@hously/shared/types";

export function useLibrary(
  filters?: { type?: string; status?: string; q?: string },
  options?: { staleTime?: number; gcTime?: number },
) {
  const fetcher = useFetcher();

  const params = new URLSearchParams();
  if (filters?.type) params.set("type", filters.type);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.q) params.set("q", filters.q);
  const qs = params.toString();

  return useQuery({
    queryKey: queryKeys.library.list(filters),
    queryFn: () =>
      fetcher<LibraryListResponse>(
        `${LIBRARY_ENDPOINTS.LIST}${qs ? `?${qs}` : ""}`,
      ),
    ...options,
  });
}

export function useAddToLibrary() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { tmdb_id: number; type: "movie" | "show" }) =>
      fetcher<AddToLibraryResponse>(LIBRARY_ENDPOINTS.ADD, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useRemoveFromLibrary() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      deleteFiles,
    }: {
      id: number;
      deleteFiles?: boolean;
    }) => {
      const url = deleteFiles
        ? `${LIBRARY_ENDPOINTS.REMOVE(id)}?delete_files=true`
        : LIBRARY_ENDPOINTS.REMOVE(id);
      return fetcher<{ success: boolean }>(url, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useUpdateLibraryStatus() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: number;
      status: LibraryMedia["status"];
    }) =>
      fetcher<{ item: LibraryMedia }>(LIBRARY_ENDPOINTS.UPDATE_STATUS(id), {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useLibraryEpisodes(id: number | null) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.library.episodes(id ?? 0),
    queryFn: () =>
      fetcher<LibraryEpisodesResponse>(LIBRARY_ENDPOINTS.EPISODES(id!)),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useLibraryFiles(id: number | null) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: [...queryKeys.library.all, "files", id],
    queryFn: () => fetcher<LibraryFilesResponse>(LIBRARY_ENDPOINTS.FILES(id!)),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useLibraryDownloads(id: number | null) {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.library.downloads(id ?? 0),
    queryFn: () =>
      fetcher<LibraryDownloadsResponse>(LIBRARY_ENDPOINTS.DOWNLOADS(id!)),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

/** Interactive Prowlarr grab routed through Hously (DownloadHistory + qB category). */
export function useLibraryGrabRelease(libraryMediaId: number | null) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: {
      download_url: string;
      release_title: string;
      indexer?: string | null;
      quality_parsed?: unknown;
      size_bytes?: number | null;
      episode_id?: number | null;
    }) => {
      if (libraryMediaId == null || libraryMediaId <= 0) {
        throw new Error("Library context required");
      }
      return fetcher<LibrarySearchResponse>(
        LIBRARY_ENDPOINTS.GRAB(libraryMediaId),
        {
          method: "POST",
          body: {
            download_url: body.download_url,
            release_title: body.release_title,
            ...(body.indexer != null && body.indexer !== ""
              ? { indexer: body.indexer }
              : {}),
            ...(body.quality_parsed !== undefined
              ? { quality_parsed: body.quality_parsed }
              : {}),
            ...(body.size_bytes != null ? { size_bytes: body.size_bytes } : {}),
            ...(body.episode_id != null ? { episode_id: body.episode_id } : {}),
          },
        },
      );
    },
    onSuccess: () => {
      const id = libraryMediaId;
      if (id == null || id <= 0) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.downloads(id),
      });
    },
  });
}

export function useSearchLibraryMovie() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, search_query }: { id: number; search_query?: string }) =>
      fetcher<LibrarySearchResponse>(LIBRARY_ENDPOINTS.SEARCH(id), {
        method: "POST",
        body:
          search_query !== undefined && search_query !== ""
            ? { search_query }
            : {},
      }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.downloads(vars.id),
      });
    },
  });
}

export function useSearchLibraryEpisode() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mediaId,
      episodeId,
      search_query,
    }: {
      mediaId: number;
      episodeId: number;
      search_query?: string;
    }) =>
      fetcher<LibrarySearchResponse>(
        LIBRARY_ENDPOINTS.SEARCH_EPISODE(mediaId, episodeId),
        {
          method: "POST",
          body:
            search_query !== undefined && search_query !== ""
              ? { search_query }
              : {},
        },
      ),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.episodes(vars.mediaId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.downloads(vars.mediaId),
      });
    },
  });
}

export function useUpdateLibraryQualityProfile() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: UpdateLibraryQualityProfileRequest;
    }) =>
      fetcher<{ item: LibraryMedia }>(
        LIBRARY_ENDPOINTS.UPDATE_QUALITY_PROFILE(id),
        { method: "PATCH", body },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useRescanLibraryItem(id: number) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // First, trigger refresh-status to re-queue any missed post-processing / import
      await fetcher<{ item: LibraryMedia; detail: string }>(
        LIBRARY_ENDPOINTS.REFRESH_STATUS(id),
        { method: "POST" },
      );
      // Then rescan MediaInfo for all known files
      return fetcher<{ rescanned: number; failed: number }>(
        LIBRARY_ENDPOINTS.RESCAN(id),
        { method: "POST" },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.downloads(id),
      });
    },
  });
}

export function useDeleteLibraryFile(libraryId: number) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileId,
      deleteFile,
    }: {
      fileId: number;
      deleteFile: boolean;
    }) =>
      fetcher<{ success: boolean }>(
        `${LIBRARY_ENDPOINTS.DELETE_FILE(fileId)}${deleteFile ? "?delete_file=true" : ""}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.library.all, "files", libraryId],
      });
    },
  });
}

export function useRefreshLibraryStatus(id: number) {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<{ item: LibraryMedia; detail: string }>(
        LIBRARY_ENDPOINTS.REFRESH_STATUS(id),
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.downloads(id),
      });
    },
  });
}

export function useStartMigration() {
  const fetcher = useFetcher();

  return useMutation({
    mutationFn: (body: MigrateLibraryRequest) =>
      fetcher<MigrateLibraryEnqueueResponse>(LIBRARY_ENDPOINTS.MIGRATE, {
        method: "POST",
        body,
      }),
  });
}

const MIGRATE_STATUS_DEFAULT: MigrateJobStatus = {
  job_id: null,
  state: "unknown",
  progress: null,
  result: null,
  error: null,
  started_at: null,
  finished_at: null,
};

export function useMediaPostProcessingSettings() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.library.postProcessingSettings(),
    queryFn: () =>
      fetcher<MediaPostProcessingSettingsResponse>(
        LIBRARY_ENDPOINTS.POST_PROCESSING_SETTINGS,
      ),
  });
}

export function useUpdateMediaPostProcessingSettings() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateMediaPostProcessingSettingsRequest) =>
      fetcher<MediaPostProcessingSettingsResponse>(
        LIBRARY_ENDPOINTS.POST_PROCESSING_SETTINGS,
        { method: "PATCH", body },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.library.postProcessingSettings(),
      });
    },
  });
}

export function useLibraryScan() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { path: string; type: "movie" | "show" }) =>
      fetcher<LibraryScanResponse>(LIBRARY_ENDPOINTS.SCAN, {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.library.all });
    },
  });
}

export function useMigrateStatus() {
  const [status, setStatus] = useState<MigrateJobStatus>(
    MIGRATE_STATUS_DEFAULT,
  );
  const sourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (sourceRef.current) {
      sourceRef.current.close();
    }
    const es = new EventSource(LIBRARY_ENDPOINTS.MIGRATE_STATUS, {
      withCredentials: true,
    });
    sourceRef.current = es;

    es.onmessage = (e) => {
      try {
        setStatus(JSON.parse(e.data) as MigrateJobStatus);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // SSE will auto-reconnect; no action needed
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      sourceRef.current?.close();
    };
  }, [connect]);

  return status;
}
