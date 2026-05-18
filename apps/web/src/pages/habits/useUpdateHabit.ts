import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type { UpdateHabitRequest } from "@hously/shared/types";

export const useUpdateHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateHabitRequest }) =>
      fetcher(HABIT_ENDPOINTS.UPDATE(id), {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
