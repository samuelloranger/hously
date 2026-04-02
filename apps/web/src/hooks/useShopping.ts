import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from '@/lib/api/context';
import { queryKeys } from '@/lib/queryKeys';
import { SHOPPING_ENDPOINTS } from '@hously/shared';
import type {
  ShoppingItem,
  ShoppingItemsResponse,
  CreateShoppingItemRequest,
  UpdateShoppingItemRequest,
  ReorderShoppingItemsRequest,
  ApiResult,
} from '@hously/shared';

export function useShoppingItems() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.shopping.items(),
    queryFn: () => fetcher<ShoppingItemsResponse>(SHOPPING_ENDPOINTS.LIST),
  });
}

export function useCreateShoppingItem() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateShoppingItemRequest) =>
      fetcher<ApiResult<{ id: number }>>(SHOPPING_ENDPOINTS.CREATE, {
        method: 'POST',
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useToggleShoppingItem() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) =>
      fetcher<ApiResult<{ completed: boolean }>>(SHOPPING_ENDPOINTS.TOGGLE(itemId), {
        method: 'POST',
      }),
    onMutate: async itemId => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });
      const previousItems = queryClient.getQueryData<ShoppingItemsResponse>(queryKeys.shopping.items());

      if (previousItems) {
        queryClient.setQueryData<ShoppingItemsResponse>(queryKeys.shopping.items(), {
          ...previousItems,
          items: previousItems.items.map(item => (item.id === itemId ? { ...item, completed: !item.completed } : item)),
        });
      }

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.shopping.items(), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useUpdateShoppingItem() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      itemId,
      data,
      itemName,
      notes,
    }:
      | { itemId: number; data: UpdateShoppingItemRequest; itemName?: never; notes?: never }
      | { itemId: number; data?: never; itemName: string; notes?: never }
      | { itemId: number; data?: never; itemName?: never; notes: string | null }) => {
      const body = data ?? {};
      if (itemName !== undefined) body.item_name = itemName;
      if (notes !== undefined) body.notes = notes;
      return fetcher<ApiResult<{ message: string }>>(SHOPPING_ENDPOINTS.UPDATE(itemId), {
        method: 'PUT',
        body,
      });
    },
    onMutate: async ({ itemId, itemName, notes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });
      const previousItems = queryClient.getQueryData<ShoppingItemsResponse>(queryKeys.shopping.items());

      if (previousItems) {
        queryClient.setQueryData<ShoppingItemsResponse>(queryKeys.shopping.items(), {
          ...previousItems,
          items: previousItems.items.map(item =>
            item.id === itemId
              ? {
                  ...item,
                  ...(itemName !== undefined ? { item_name: itemName } : {}),
                  ...(notes !== undefined ? { notes } : {}),
                }
              : item
          ),
        });
      }

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.shopping.items(), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
    },
  });
}

export function useDeleteShoppingItem() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: number) =>
      fetcher<ApiResult<{ message: string }>>(SHOPPING_ENDPOINTS.DELETE(itemId), {
        method: 'DELETE',
      }),
    onMutate: async itemId => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });
      const previousItems = queryClient.getQueryData<ShoppingItemsResponse>(queryKeys.shopping.items());

      if (previousItems) {
        queryClient.setQueryData<ShoppingItemsResponse>(queryKeys.shopping.items(), {
          ...previousItems,
          items: previousItems.items.filter(item => item.id !== itemId),
        });
      }

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.shopping.items(), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useDeleteShoppingItems() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: number[]) =>
      fetcher<ApiResult<{ message: string; count: number }>>(SHOPPING_ENDPOINTS.DELETE_BULK, {
        method: 'POST',
        body: { item_ids: itemIds },
      }),
    onMutate: async itemIds => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });
      const previousItems = queryClient.getQueryData<ShoppingItemsResponse>(queryKeys.shopping.items());

      if (previousItems) {
        const idsToDelete = new Set(itemIds);
        queryClient.setQueryData<ShoppingItemsResponse>(queryKeys.shopping.items(), {
          ...previousItems,
          items: previousItems.items.filter(item => !idsToDelete.has(item.id)),
        });
      }

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.shopping.items(), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useClearAllCompletedShoppingItems() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetcher<ApiResult<{ message: string; count: number }>>(SHOPPING_ENDPOINTS.CLEAR_COMPLETED, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

export function useReorderShoppingItems() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderShoppingItemsRequest | number[]) => {
      const body = Array.isArray(data) ? { item_ids: data } : data;
      return fetcher<ApiResult<{ message: string }>>(SHOPPING_ENDPOINTS.REORDER, {
        method: 'POST',
        body,
      });
    },
    onMutate: async data => {
      const itemIds = Array.isArray(data) ? data : data.item_ids;
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.items() });
      const previousItems = queryClient.getQueryData<ShoppingItemsResponse>(queryKeys.shopping.items());

      if (previousItems) {
        const itemsMap = new Map(previousItems.items.map(i => [i.id, i]));
        const reorderedItems = itemIds
          .map(id => itemsMap.get(id))
          .filter((i): i is ShoppingItem => !!i)
          .map((i, index) => ({ ...i, position: index }));

        const reorderedIds = new Set(itemIds);
        const otherItems = previousItems.items.filter(i => !reorderedIds.has(i.id));

        queryClient.setQueryData<ShoppingItemsResponse>(queryKeys.shopping.items(), {
          ...previousItems,
          items: [...reorderedItems, ...otherItems],
        });
      }

      return { previousItems };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKeys.shopping.items(), context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
    },
  });
}
