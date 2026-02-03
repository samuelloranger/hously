import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mealPlansApi } from "../api";

export function useAddToShopping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (mealPlanId: number) => mealPlansApi.addToShopping(mealPlanId),
    onSuccess: () => {
      // Invalidate shopping list to show new items
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
    },
  });
}
