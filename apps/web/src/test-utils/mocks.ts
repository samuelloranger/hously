import type {
  User,
  ShoppingItem,
  Chore,
  Activity,
  DashboardStats,
} from "@hously/shared/types";
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
  habits_streak: 5,
};

export const mockActivity: Activity = {
  description: "testuser added shopping item: Milk",
  time: "2 hours ago",
  icon: "🛒",
  type: "shopping_added",
};

export const mockIntegrationUpdatedActivity: Activity = {
  type: "integration_updated",
  plugin_type: "c411",
  completed_at: "2024-01-01T00:00:00Z",
};

export const mockCronEndedActivity: Activity = {
  type: "cron_job_ended",
  job_id: "fetchC411Stats",
  job_name: "Fetch C411 stats",
  success: true,
  duration_ms: 1500,
  completed_at: "2024-01-01T00:00:00Z",
};

export const mockCronSkippedActivity: Activity = {
  type: "cron_job_skipped",
  job_id: "fetchC411Stats",
  job_name: "Fetch C411 stats",
  reason: "already_running",
  completed_at: "2024-01-01T00:00:00Z",
};

export const mockAppUpdatedActivity: Activity = {
  type: "app_updated",
  from_version: "1.0.0",
  to_version: "1.0.1",
  completed_at: "2024-01-01T00:00:00Z",
};

export const mockEventCreatedActivity: Activity = {
  type: "event_created",
  event_id: 1,
  event_title: "Dentist",
  completed_at: "2024-01-01T00:00:00Z",
};

export const mockShoppingItemCompletedActivity: Activity = {
  type: "shopping_item_completed",
  shopping_item_id: 1,
  item_name: "Milk",
  completed_at: "2024-01-01T00:00:00Z",
};
