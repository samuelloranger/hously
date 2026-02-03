import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";
import type { CreateRecipeRequest } from "../../../types";

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRecipeRequest) => recipesApi.createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.all });
    },
  });
}
