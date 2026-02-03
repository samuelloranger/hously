import { useQuery} from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { recipesApi } from "../api";

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes.list(),
    queryFn: recipesApi.getRecipes,
  });
}
