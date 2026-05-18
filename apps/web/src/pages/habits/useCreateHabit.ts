import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type { CreateHabitRequest } from "@hously/shared/types";

export const useCreateHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHabitRequest) =>
      fetcher(HABIT_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
