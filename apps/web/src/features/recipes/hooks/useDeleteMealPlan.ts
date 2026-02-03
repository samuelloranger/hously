import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mealPlansApi } from "../api";

export function useDeleteMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealPlanId: number) => mealPlansApi.deleteMealPlan(mealPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
  });
}
