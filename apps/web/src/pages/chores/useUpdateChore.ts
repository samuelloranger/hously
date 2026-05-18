import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ApiResult, UpdateChoreRequest } from "@hously/shared/types";

export function useUpdateChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      choreId,
      data,
    }: {
      choreId: number;
      data: UpdateChoreRequest;
    }) =>
      fetcher<ApiResult<{ message: string }>>(
        CHORES_ENDPOINTS.UPDATE(choreId),
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    },
  });
}
