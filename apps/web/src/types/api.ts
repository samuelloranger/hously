import type {
  User,
  ShoppingItem,
  Chore,
  DashboardStats,
  Activity,
  JellyfinLatestItem,
  DashboardUpcomingItem,
  QbittorrentDashboardSummary,
  QbittorrentDashboardTorrent,
  CustomEvent,
  Recipe,
  RecipeIngredient,
  MealPlan,
} from './entities';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface ShoppingItemsResponse {
  items: ShoppingItem[];
}

export interface ChoresResponse {
  chores: Chore[];
  users: User[];
}

export interface DashboardStatsResponse {
  stats: DashboardStats;
  activities: Activity[];
}

export interface DashboardJellyfinLatestResponse {
  enabled: boolean;
  items: JellyfinLatestItem[];
}

export interface DashboardUpcomingResponse {
  enabled: boolean;
  radarr_enabled: boolean;
  sonarr_enabled: boolean;
  items: DashboardUpcomingItem[];
}

export interface DashboardUpcomingStatusResponse {
  exists: boolean;
  service: 'radarr' | 'sonarr';
}

export interface DashboardQbittorrentStatusResponse {
  enabled: boolean;
  connected: boolean;
  updated_at: string;
  poll_interval_seconds: number;
  summary: QbittorrentDashboardSummary;
  torrents: QbittorrentDashboardTorrent[];
  error?: string;
}

export interface UserResponse {
  user: User | null;
}

export interface UsersResponse {
  users: User[];
}

export interface CreateShoppingItemRequest {
  item_name: string;
  notes?: string | null;
}

export interface CreateChoreRequest {
  chore_name: string;
  assigned_to?: number | null;
  description?: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string;
  image_path?: string | null;
  subscription_info?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
}

export interface UpdateChoreRequest {
  chore_name?: string;
  assigned_to?: number | null;
  description?: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string;
  image_path?: string | null;
  remove_image?: boolean;
  subscription_info?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
}

export interface CreateReminderRequest {
  chore_id: number;
  reminder_datetime: string;
  subscription_info: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface CalendarEventBase {
  id: string;
  date: string;
  title: string;
  description: string | null;
}

export interface CalendarEventChoreMetadata {
  type: 'chore';
  metadata: {
    chore_id?: number;
    reminder_datetime?: string;
    recurrence_type?: 'daily_interval' | 'weekly' | null;
    recurrence_interval_days?: number | null;
    recurrence_weekday?: number | null;
    assigned_to?: number | null;
  };
}

export interface CalendarEventCustomEventMetadata {
  type: 'custom_event';
  metadata: {
    custom_event_id?: number;
    type?: 'custom_event';
    start_datetime?: string;
    end_datetime?: string;
    all_day?: boolean;
    color?: string;
    recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
    recurrence_interval_days?: number | null;
  };
}

export type CalendarEvent = CalendarEventBase & (CalendarEventChoreMetadata | CalendarEventCustomEventMetadata);

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export interface CustomEventsResponse {
  events: CustomEvent[];
}

export interface CreateCustomEventRequest {
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  color?: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
}

export interface UpdateCustomEventRequest {
  title?: string;
  description?: string | null;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  color?: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
}

// Recipes
export interface RecipesResponse {
  recipes: Recipe[];
}

export interface RecipeDetailResponse {
  recipe: Recipe;
}

export interface CreateRecipeRequest {
  name: string;
  description?: string | null;
  instructions: string;
  category?: string | null;
  servings: number;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  image_path?: string | null;
  ingredients: Omit<RecipeIngredient, 'id'>[];
}

export interface UpdateRecipeRequest {
  name?: string;
  description?: string | null;
  instructions?: string;
  category?: string | null;
  servings?: number;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  image_path?: string | null;
  remove_image?: boolean;
  ingredients?: Omit<RecipeIngredient, 'id'>[];
}

// Meal Plans
export interface MealPlansResponse {
  meal_plans: MealPlan[];
}

export interface CreateMealPlanRequest {
  recipe_id: number;
  planned_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string | null;
}

export interface UpdateMealPlanRequest {
  recipe_id?: number;
  planned_date?: string;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string | null;
}
