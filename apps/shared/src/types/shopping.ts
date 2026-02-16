export interface ShoppingItem {
  id: number;
  position: number;
  item_name: string;
  notes: string | null;
  completed: boolean;
  added_by: number;
  completed_by: number | null;
  created_at: string;
  completed_at: string | null;
  added_by_username?: string | null;
  completed_by_username?: string | null;
}

export interface ShoppingItemsResponse {
  items: ShoppingItem[];
}

export interface CreateShoppingItemRequest {
  item_name: string;
  notes?: string | null;
}

export interface UpdateShoppingItemRequest {
  item_name?: string;
  notes?: string | null;
}

export interface ShoppingItemResponse {
  success: boolean;
  id?: number;
  message: string;
}

export interface ToggleShoppingItemResponse {
  success: boolean;
  completed: boolean;
}

export interface ClearCompletedResponse {
  success: boolean;
  message: string;
  count: number;
}

export interface ReorderShoppingItemsRequest {
  item_ids: number[];
}

export interface DeleteBulkRequest {
  ids: number[];
}
