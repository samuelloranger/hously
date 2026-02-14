export interface User {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  last_login: string | null;
  created_at: string;
  last_activity: string | null;
}

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
  added_by_username?: string;
  completed_by_username?: string;
}

export interface Chore {
  id: number;
  position: number;
  chore_name: string;
  description: string | null;
  assigned_to: number | null;
  completed: boolean;
  added_by: number;
  completed_by: number | null;
  created_at: string;
  completed_at: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string | null;
  reminder_active?: boolean | null;
  image_path?: string | null;
  added_by_username?: string;
  assigned_to_username?: string;
  completed_by_username?: string;
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
  recurrence_original_created_at?: string | null;
  recurrence_parent_id?: number | null;
}

export interface Reminder {
  id: number;
  chore_id: number;
  reminder_datetime: string;
  user_id: number;
  subscription_info: string | object;
  active: boolean;
  last_notification_sent: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body: string;
  type: 'reminder' | 'external' | 'app-update' | 'service_monitor';
  read: boolean;
  read_at: string | null;
  url: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface DashboardStats {
  events_today: number;
  shopping_count: number;
  chores_count: number;
  monthly_total: number;
}

export interface JellyfinLatestItem {
  id: string;
  title: string;
  subtitle: string | null;
  item_url: string | null;
  banner_url: string | null;
  poster_url: string | null;
  item_type: string | null;
  year: number | null;
  added_at: string | null;
}

export interface DashboardUpcomingItem {
  id: string;
  title: string;
  media_type: 'movie' | 'tv';
  release_date: string | null;
  poster_url: string | null;
  tmdb_url: string;
  providers: DashboardUpcomingProvider[];
}

export interface DashboardUpcomingProvider {
  id: number;
  name: string;
  logo_url: string;
}

export interface QbittorrentDashboardSummary {
  downloading_count: number;
  stalled_count: number;
  seeding_count: number;
  paused_count: number;
  completed_count: number;
  total_count: number;
  download_speed: number;
  upload_speed: number;
  downloaded_bytes: number;
  uploaded_bytes: number;
}

export interface QbittorrentDashboardTorrent {
  id: string;
  name: string;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds: number | null;
  size_bytes: number;
  state: string;
  seeds: number;
  peers: number;
}

export interface Activity {
  description: string;
  time: string;
  icon: string;
  type: 'shopping_added' | 'shopping_completed' | 'chore_added' | 'chore_completed';
}

export interface CustomEvent {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  color: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
  recurrence_original_created_at?: string | null;
  created_at: string;
}

export interface RecipeIngredient {
  id?: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  position: number;
}

export interface Recipe {
  id: number;
  name: string;
  description: string | null;
  instructions: string;
  category: string | null;
  servings: number;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  image_path: string | null;
  is_favorite: number;
  added_by: number;
  created_at: string;
  updated_at: string;
  added_by_username?: string;
  ingredient_count?: number;
  ingredients?: RecipeIngredient[];
}

export interface MealPlan {
  id: number;
  recipe_id: number;
  planned_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes: string | null;
  added_by: number;
  created_at: string;
  recipe_name?: string;
  recipe_image_path?: string | null;
  added_by_username?: string;
}
