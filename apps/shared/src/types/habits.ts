export interface Habit {
  id: number;
  user_id: number;
  name: string;
  emoji: string;
  description: string | null;
  times_per_day: number;
  active: boolean;
  created_at: string;
  updated_at: string | null;
  schedules: HabitScheduleTime[];
  today_completions: number;
  current_streak: number;
}

export interface HabitScheduleTime {
  id: number;
  time: string; // "HH:mm"
}

export interface HabitCompletion {
  id: number;
  habit_id: number;
  date: string;
  completed_at: string;
}

export interface CreateHabitRequest {
  name: string;
  emoji: string;
  description?: string;
  times_per_day: number;
  schedules: string[]; // Array of "HH:mm" strings
}

export interface UpdateHabitRequest {
  name?: string;
  emoji?: string;
  description?: string;
  times_per_day?: number;
  active?: boolean;
  schedules?: string[]; // Replace all schedules
}

export interface HabitsResponse {
  habits: Habit[];
}

export interface HabitHistoryResponse {
  history: {
    date: string;
    completions: number;
    target: number;
    completed: boolean; // completions >= target
  }[];
}