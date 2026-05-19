import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import {
  useHabitStatusMutation,
  replaceLastStatus,
} from "@/pages/habits/_habitStatus";

export const useUnskipHabit = () =>
  useHabitStatusMutation({
    endpoint: HABIT_ENDPOINTS.UNSKIP,
    method: "DELETE",
    applyOptimistic: (habit) => ({
      ...habit,
      today_skips: Math.max(habit.today_skips - 1, 0),
      today_remaining: Math.min(habit.today_remaining + 1, habit.times_per_day),
      schedule_statuses: replaceLastStatus(
        habit.schedule_statuses,
        "skipped",
        "pending",
      ),
    }),
  });
