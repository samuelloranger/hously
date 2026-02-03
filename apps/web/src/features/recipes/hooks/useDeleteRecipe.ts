import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: number) => recipesApi.deleteRecipe(recipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.mealPlans.all });
    },
  });
}
