import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { BOARD_TAGS_ENDPOINTS } from "@hously/shared/endpoints";
import type {
  BoardTagsResponse,
  CreateBoardTagRequest,
  UpdateBoardTagRequest,
  DeleteBoardTagRequest,
} from "@hously/shared/types";
export function useBoardTags() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.boardTags.list(),
    queryFn: () => fetcher<BoardTagsResponse>(BOARD_TAGS_ENDPOINTS.LIST),
  });
}

export function useCreateBoardTag() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBoardTagRequest) =>
      fetcher(BOARD_TAGS_ENDPOINTS.CREATE, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTags.all });
    },
  });
}

export function useUpdateBoardTag() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateBoardTagRequest }) =>
      fetcher(BOARD_TAGS_ENDPOINTS.UPDATE(id), { method: "PATCH", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}

export function useDeleteBoardTag() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: DeleteBoardTagRequest }) =>
      fetcher(BOARD_TAGS_ENDPOINTS.DELETE(id), {
        method: "DELETE",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTags.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.boardTasks.all });
    },
  });
}
