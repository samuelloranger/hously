import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ApiResult, ChoresResponse } from "@hously/shared/types";

export function useToggleChore() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ choreId, emotion }: { choreId: number; emotion?: string }) =>
      fetcher<ApiResult<{ completed: boolean }>>(
        CHORES_ENDPOINTS.TOGGLE(choreId),
        {
          method: "POST",
          body: { emotion },
        },
      ),
    onMutate: async ({ choreId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chores.list() });
      const previousChores = queryClient.getQueryData<ChoresResponse>(
        queryKeys.chores.list(),
      );

      if (previousChores) {
        queryClient.setQueryData<ChoresResponse>(queryKeys.chores.list(), {
          ...previousChores,
          chores: previousChores.chores.map((chore) =>
            chore.id === choreId
              ? { ...chore, completed: !chore.completed }
              : chore,
          ),
        });
      }

      return { previousChores };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousChores) {
        queryClient.setQueryData(
          queryKeys.chores.list(),
          context.previousChores,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}
