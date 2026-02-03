import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { shoppingApi } from "../api";

export function useShoppingItems() {
  return useQuery({
    queryKey: queryKeys.shopping.items(),
    queryFn: shoppingApi.getShoppingItems,
  });
}
