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
  type: string; // "movie" | "show"
  year: number | null;
  status: string; // "wanted" | "downloading" | "downloaded" | "skipped"
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

export interface QuickSearchBoardTask {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee_name?: string;
}

export interface QuickSearchResponse {
  torrents: QuickSearchTorrent[];
  medias: QuickSearchMedia[];
  chores: QuickSearchChore[];
  shopping: QuickSearchShoppingItem[];
  users: QuickSearchUser[];
  board_tasks: QuickSearchBoardTask[];
}
