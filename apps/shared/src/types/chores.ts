export interface Chore {
  id: number;
  position: number;
  chore_name: string;
  description: string | null;
  assigned_to: number | null;
  completed: boolean;
  added_by: number;
  completed_by: number | null;
  created_at: string | null;
  completed_at: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string | null;
  reminder_active?: boolean | null;
  image_path?: string | null;
  added_by_username?: string | null;
  assigned_to_username?: string | null;
  completed_by_username?: string | null;
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
  recurrence_original_created_at?: string | null;
  recurrence_parent_id?: number | null;
}

export interface ChoreUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface ChoresResponse {
  chores: Chore[];
  users: ChoreUser[];
}

export interface ToggleChoreRequest {
  emotion?: string | null;
}

export interface ToggleChoreResponse {
  success: boolean;
  completed: boolean;
}

export interface CreateChoreRequest {
  chore_name: string;
  assigned_to?: number | null;
  description?: string | null;
  reminder_enabled?: boolean;
  reminder_datetime?: string | null;
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
  reminder_datetime?: string | null;
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

export interface ChoreMutationResponse {
  success: boolean;
  id?: number;
  message: string;
}

export interface ClearCompletedChoresResponse {
  success: boolean;
  message: string;
  count: number;
}

export interface ReorderChoresRequest {
  chore_ids: number[];
}

export interface UploadChoreImageResponse {
  success: boolean;
  data: {
    image_path: string;
  };
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
