import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import {
  useHabitStatusMutation,
  replaceFirstStatus,
} from "@/pages/habits/_habitStatus";

export const useSkipHabit = () =>
  useHabitStatusMutation({
    endpoint: HABIT_ENDPOINTS.SKIP,
    method: "POST",
    applyOptimistic: (habit) => ({
      ...habit,
      today_skips: habit.today_skips + (habit.today_remaining > 0 ? 1 : 0),
      today_remaining: Math.max(habit.today_remaining - 1, 0),
      schedule_statuses: replaceFirstStatus(
        habit.schedule_statuses,
        "pending",
        "skipped",
      ),
    }),
  });
