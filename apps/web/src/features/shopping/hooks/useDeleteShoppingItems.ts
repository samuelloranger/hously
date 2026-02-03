import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";

export function useDeleteShoppingItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: number[]) => shoppingApi.deleteShoppingItems(itemIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
