import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";
import type { UpdateRecipeRequest } from "../../../types";

export function useUpdateRecipe(recipeId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateRecipeRequest) =>
      recipesApi.updateRecipe(recipeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recipes.detail(recipeId),
      });
    },
  });
}
