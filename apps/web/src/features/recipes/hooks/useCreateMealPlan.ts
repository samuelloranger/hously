import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mealPlansApi } from "../api";
import type { CreateMealPlanRequest } from "../../../types";

export function useCreateMealPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMealPlanRequest) =>
      mealPlansApi.createMealPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
  });
}
