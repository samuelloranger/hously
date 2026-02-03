import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mealPlansApi } from "../api";
import type { UpdateMealPlanRequest } from "../../../types";

export function useUpdateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mealPlanId,
      data,
    }: {
      mealPlanId: number;
      data: UpdateMealPlanRequest;
    }) => mealPlansApi.updateMealPlan(mealPlanId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
  });
}
