import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";

export const useDeleteHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher(HABIT_ENDPOINTS.DELETE(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
