import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ApiResult } from "@hously/shared/types";

export function useRemoveRecurrence() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: number) =>
      fetcher<ApiResult<{ message: string }>>(
        CHORES_ENDPOINTS.REMOVE_RECURRENCE(choreId),
        {
          method: "PUT",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    },
  });
}
