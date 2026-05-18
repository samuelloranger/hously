import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ApiResult, Chore, ChoresResponse } from "@hously/shared/types";

export function useReorderChores() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreIds: number[]) =>
      fetcher<ApiResult<{ message: string }>>(CHORES_ENDPOINTS.REORDER, {
        method: "POST",
        body: { chore_ids: choreIds },
      }),
    onMutate: async (choreIds) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chores.list() });
      const previousChores = queryClient.getQueryData<ChoresResponse>(
        queryKeys.chores.list(),
      );

      if (previousChores) {
        const choresMap = new Map(previousChores.chores.map((c) => [c.id, c]));
        const reorderedChores = choreIds
          .map((id) => choresMap.get(id))
          .filter((c): c is Chore => !!c)
          .map((c, index) => ({ ...c, position: index }));

        const reorderedIds = new Set(choreIds);
        const otherChores = previousChores.chores.filter(
          (c) => !reorderedIds.has(c.id),
        );

        queryClient.setQueryData<ChoresResponse>(queryKeys.chores.list(), {
          ...previousChores,
          chores: [...reorderedChores, ...otherChores],
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
    },
  });
}
