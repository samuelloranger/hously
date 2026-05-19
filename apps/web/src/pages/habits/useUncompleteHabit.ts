import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import {
  useHabitStatusMutation,
  replaceLastStatus,
} from "@/pages/habits/_habitStatus";

export const useUncompleteHabit = () =>
  useHabitStatusMutation({
    endpoint: HABIT_ENDPOINTS.UNCOMPLETE,
    method: "DELETE",
    applyOptimistic: (habit) => ({
      ...habit,
      today_completions: Math.max(habit.today_completions - 1, 0),
      today_remaining: Math.min(habit.today_remaining + 1, habit.times_per_day),
      schedule_statuses: replaceLastStatus(
        habit.schedule_statuses,
        "done",
        "pending",
      ),
    }),
  });
