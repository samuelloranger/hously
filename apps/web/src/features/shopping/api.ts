import { fetchApi } from '../../lib/api';
import type { ApiResult, ShoppingItemsResponse, CreateShoppingItemRequest } from '../../types';

// Shopping API - now using Elysia endpoints at /api/shopping
const SHOPPING_API = '/api/shopping';

export const shoppingApi = {
  async getShoppingItems(): Promise<ShoppingItemsResponse> {
    return fetchApi<ShoppingItemsResponse>(SHOPPING_API);
  },

  async createShoppingItem(data: CreateShoppingItemRequest): Promise<ApiResult<{ id: number }>> {
    return fetchApi<ApiResult<{ id: number }>>(SHOPPING_API, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async toggleShoppingItem(itemId: number): Promise<ApiResult<{ completed: boolean }>> {
    return fetchApi<ApiResult<{ completed: boolean }>>(`${SHOPPING_API}/${itemId}/toggle`, {
      method: 'POST',
    });
  },

  async updateShoppingItem(itemId: number, data: { item_name?: string; notes?: string | null }): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`${SHOPPING_API}/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteShoppingItem(itemId: number): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`${SHOPPING_API}/${itemId}`, {
      method: 'DELETE',
    });
  },

  async deleteShoppingItems(itemIds: number[]): Promise<ApiResult<{ message: string; count: number }>> {
    return fetchApi<ApiResult<{ message: string; count: number }>>(`${SHOPPING_API}/delete-bulk`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  },

  async clearAllCompleted(): Promise<ApiResult<{ message: string; count: number }>> {
    return fetchApi<ApiResult<{ message: string; count: number }>>(`${SHOPPING_API}/clear-completed`, {
      method: 'POST',
    });
  },

  async reorderItems(itemIds: number[]): Promise<ApiResult<{ message: string }>> {
    return fetchApi<ApiResult<{ message: string }>>(`${SHOPPING_API}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    });
  },
};
