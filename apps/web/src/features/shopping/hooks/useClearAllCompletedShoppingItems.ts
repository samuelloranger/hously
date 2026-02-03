import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";

export function useClearAllCompletedShoppingItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => shoppingApi.clearAllCompleted(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
