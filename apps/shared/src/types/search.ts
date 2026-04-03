export interface QuickSearchTorrent {
  id: string;
  name: string;
  size_bytes: number;
  category: string;
  progress: number;
}

export interface QuickSearchMedia {
  id: number;
  title: string;
  service: string;
  media_type: string;
  source_id: string;
  year?: number;
}

export interface QuickSearchRecipe {
  id: number;
  name: string;
  category?: string;
  is_favorite: boolean;
}

export interface QuickSearchChore {
  id: number;
  chore_name: string;
  description?: string;
  assigned_to_username?: string;
  completed: boolean;
}

export interface QuickSearchShoppingItem {
  id: number;
  item_name: string;
  notes?: string;
  completed: boolean;
}

export interface QuickSearchUser {
  id: number;
  name: string;
  email: string;
}

export interface QuickSearchResponse {
  torrents: QuickSearchTorrent[];
  medias: QuickSearchMedia[];
  recipes: QuickSearchRecipe[];
  chores: QuickSearchChore[];
  shopping: QuickSearchShoppingItem[];
  users: QuickSearchUser[];
}
