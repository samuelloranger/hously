import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useHabitStatusMutation, replaceFirstStatus } from "./_habitStatus";

export const useCompleteHabit = () =>
  useHabitStatusMutation({
    endpoint: HABIT_ENDPOINTS.COMPLETE,
    method: "POST",
    applyOptimistic: (habit) => ({
      ...habit,
      today_completions:
        habit.today_completions + (habit.today_remaining > 0 ? 1 : 0),
      today_remaining: Math.max(habit.today_remaining - 1, 0),
      schedule_statuses: replaceFirstStatus(
        habit.schedule_statuses,
        "pending",
        "done",
      ),
    }),
  });
