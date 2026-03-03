export interface ScheduleStatus {
  time: string;
  status: 'done' | 'skipped' | 'pending';
}

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
  today_skips: number;
  today_remaining: number;
  current_streak: number;
  schedule_statuses: ScheduleStatus[];
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
  status: 'done' | 'skipped';
}

export interface CreateHabitRequest {
  name: string;
  emoji: string;
  description?: string;
  schedules: string[]; // Array of "HH:mm" strings
}

export interface UpdateHabitRequest {
  name?: string;
  emoji?: string;
  description?: string;
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
    skipped: number;
    target: number;
    accounted: number;
    completed: boolean; // completions >= target
  }[];
}

export interface HabitStatusResponse {
  completions: number;
  skipped: number;
  remaining: number;
  accounted: number;
}
