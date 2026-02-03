import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";

export function useToggleShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) => shoppingApi.toggleShoppingItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
