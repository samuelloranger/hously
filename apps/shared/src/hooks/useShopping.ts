import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFetcher } from './context';
import { queryKeys, SHOPPING_ENDPOINTS } from '../index';
import type {
  ShoppingItemsResponse,
  CreateShoppingItemRequest,
  UpdateShoppingItemRequest,
  ReorderShoppingItemsRequest,
  ApiResult,
} from '../types';

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
    onSuccess: () => {
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
    onSuccess: () => {
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
    onSuccess: () => {
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
    onSuccess: () => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shopping.all });
    },
  });
}
