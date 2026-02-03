import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";

export function useRecipe(recipeId: number) {
  return useQuery({
    queryKey: queryKeys.recipes.detail(recipeId),
    queryFn: () => recipesApi.getRecipe(recipeId),
    enabled: !!recipeId,
  });
}
