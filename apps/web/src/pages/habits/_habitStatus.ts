import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type { HabitsResponse, HabitStatusResponse } from "@hously/shared/types";

type Habit = HabitsResponse["habits"][number];
type ScheduleStatus = Habit["schedule_statuses"][number]["status"];

export const updateHabitStatus = (
  previousHabits: HabitsResponse | undefined,
  id: number,
  updater: (habit: Habit) => Habit,
) => {
  if (!previousHabits) return previousHabits;

  return {
    ...previousHabits,
    habits: previousHabits.habits.map((habit) =>
      habit.id === id ? updater(habit) : habit,
    ),
  };
};

export const syncHabitStatus = (
  previousHabits: HabitsResponse | undefined,
  id: number,
  response: HabitStatusResponse,
) =>
  updateHabitStatus(previousHabits, id, (habit) => ({
    ...habit,
    today_completions: response.completions,
    today_skips: response.skipped,
    today_remaining: response.remaining,
  }));

export const replaceFirstStatus = (
  statuses: Habit["schedule_statuses"],
  match: ScheduleStatus,
  replacement: ScheduleStatus,
) => {
  const idx = statuses.findIndex((s) => s.status === match);
  return idx >= 0
    ? statuses.map((s, i) => (i === idx ? { ...s, status: replacement } : s))
    : statuses;
};

export const replaceLastStatus = (
  statuses: Habit["schedule_statuses"],
  match: ScheduleStatus,
  replacement: ScheduleStatus,
) => {
  for (let i = statuses.length - 1; i >= 0; i--) {
    if (statuses[i].status === match) {
      return statuses.map((s, j) =>
        j === i ? { ...s, status: replacement } : s,
      );
    }
  }
  return statuses;
};

export const useHabitStatusMutation = (config: {
  endpoint: (id: number) => string;
  method: "POST" | "DELETE";
  applyOptimistic: (habit: Habit) => Habit;
}) => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<HabitStatusResponse>(config.endpoint(id), {
        method: config.method,
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(
        queryKeys.habits.list(),
      );

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, config.applyOptimistic),
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(
          queryKeys.habits.list(),
          context.previousHabits,
        );
      }
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        (current) => syncHabitStatus(current, id, response),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
