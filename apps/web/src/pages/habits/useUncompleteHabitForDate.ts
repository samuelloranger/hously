import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type { HabitStatusResponse } from "@hously/shared/types";

export const useUncompleteHabitForDate = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      fetcher<HabitStatusResponse>(
        `${HABIT_ENDPOINTS.UNCOMPLETE(id)}?date=${date}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
