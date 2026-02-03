import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";
import type { CreateShoppingItemRequest } from "../../../types";

export function useCreateShoppingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateShoppingItemRequest) =>
      shoppingApi.createShoppingItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}
