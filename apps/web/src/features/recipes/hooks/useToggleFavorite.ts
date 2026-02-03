import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recipeId: number) => recipesApi.toggleFavorite(recipeId),
    onSuccess: (_data, recipeId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.recipes.detail(recipeId),
      });
    },
  });
}
