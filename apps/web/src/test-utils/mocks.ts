import type {
  User,
  ShoppingItem,
  Chore,
  Activity,
  DashboardStats,
} from "../types";

export const mockUser: User = {
  id: 1,
  email: "test@example.com",
  first_name: "Test",
  last_name: "User",
  is_admin: false,
  last_login: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  last_activity: null,
};

export const mockShoppingItem: ShoppingItem = {
  id: 1,
  position: 1,
  item_name: "Milk",
  notes: null,
  completed: false,
  added_by: 1,
  completed_by: null,
  created_at: "2024-01-01T00:00:00Z",
  completed_at: null,
  added_by_username: "testuser",
};

export const mockChore: Chore = {
  id: 1,
  position: 1,
  chore_name: "Vacuum living room",
  description: null,
  assigned_to: null,
  completed: false,
  added_by: 1,
  completed_by: null,
  created_at: "2024-01-01T00:00:00Z",
  completed_at: null,
  added_by_username: "testuser",
};

export const mockDashboardStats: DashboardStats = {
  shopping_count: 5,
  events_today: 10,
  chores_count: 3,
  monthly_total: 500.0,
};

export const mockActivity: Activity = {
  description: "testuser added shopping item: Milk",
  time: "2 hours ago",
  icon: "🛒",
  type: "shopping_added",
};
