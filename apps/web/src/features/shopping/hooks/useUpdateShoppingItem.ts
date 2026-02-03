import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";

export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      itemName,
      notes,
    }: {
      itemId: number;
      itemName?: string;
      notes?: string | null;
    }) =>
      shoppingApi.updateShoppingItem(itemId, { item_name: itemName, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
