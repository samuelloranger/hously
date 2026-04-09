import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@hously/shared/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type {
  CreateHabitRequest,
  HabitsResponse,
  HabitStatusResponse,
  UpdateHabitRequest,
} from "@hously/shared/types";
const updateHabitStatus = (
  previousHabits: HabitsResponse | undefined,
  id: number,
  updater: (
    habit: HabitsResponse["habits"][number],
  ) => HabitsResponse["habits"][number],
) => {
  if (!previousHabits) return previousHabits;

  return {
    ...previousHabits,
    habits: previousHabits.habits.map((habit) =>
      habit.id === id ? updater(habit) : habit,
    ),
  };
};

const syncHabitStatus = (
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

export const useHabits = (date?: string) => {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: [...queryKeys.habits.list(), date] as const,
    queryFn: () => {
      let url = HABIT_ENDPOINTS.LIST;
      if (date) url += `?date=${date}`;
      return fetcher<HabitsResponse>(url);
    },
  });
};

export const useCompleteHabitForDate = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      fetcher<HabitStatusResponse>(HABIT_ENDPOINTS.COMPLETE(id), {
        method: "POST",
        body: { date },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};

export const useUncompleteHabitForDate = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      fetcher<HabitStatusResponse>(
        `${HABIT_ENDPOINTS.UNCOMPLETE(id)}?date=${date}`,
        {
          method: "DELETE",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};

export const useCreateHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHabitRequest) =>
      fetcher(HABIT_ENDPOINTS.CREATE, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};

export const useUpdateHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateHabitRequest }) =>
      fetcher(HABIT_ENDPOINTS.UPDATE(id), {
        method: "PUT",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};

export const useDeleteHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher(HABIT_ENDPOINTS.DELETE(id), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};

export const useCompleteHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<HabitStatusResponse>(HABIT_ENDPOINTS.COMPLETE(id), {
        method: "POST",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(
        queryKeys.habits.list(),
      );

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => {
          const pendingIdx = habit.schedule_statuses.findIndex(
            (s) => s.status === "pending",
          );
          return {
            ...habit,
            today_completions:
              habit.today_completions + (habit.today_remaining > 0 ? 1 : 0),
            today_remaining: Math.max(habit.today_remaining - 1, 0),
            schedule_statuses:
              pendingIdx >= 0
                ? habit.schedule_statuses.map((s, i) =>
                    i === pendingIdx ? { ...s, status: "done" as const } : s,
                  )
                : habit.schedule_statuses,
          };
        }),
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

export const useUncompleteHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<HabitStatusResponse>(HABIT_ENDPOINTS.UNCOMPLETE(id), {
        method: "DELETE",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(
        queryKeys.habits.list(),
      );

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => {
          let doneIdx = -1;
          for (let i = habit.schedule_statuses.length - 1; i >= 0; i--) {
            if (habit.schedule_statuses[i].status === "done") {
              doneIdx = i;
              break;
            }
          }
          return {
            ...habit,
            today_completions: Math.max(habit.today_completions - 1, 0),
            today_remaining: Math.min(
              habit.today_remaining + 1,
              habit.times_per_day,
            ),
            schedule_statuses:
              doneIdx >= 0
                ? habit.schedule_statuses.map((s, i) =>
                    i === doneIdx ? { ...s, status: "pending" as const } : s,
                  )
                : habit.schedule_statuses,
          };
        }),
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

export const useSkipHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<HabitStatusResponse>(HABIT_ENDPOINTS.SKIP(id), {
        method: "POST",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(
        queryKeys.habits.list(),
      );

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => {
          const pendingIdx = habit.schedule_statuses.findIndex(
            (s) => s.status === "pending",
          );
          return {
            ...habit,
            today_skips:
              habit.today_skips + (habit.today_remaining > 0 ? 1 : 0),
            today_remaining: Math.max(habit.today_remaining - 1, 0),
            schedule_statuses:
              pendingIdx >= 0
                ? habit.schedule_statuses.map((s, i) =>
                    i === pendingIdx ? { ...s, status: "skipped" as const } : s,
                  )
                : habit.schedule_statuses,
          };
        }),
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

export const useUnskipHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetcher<HabitStatusResponse>(HABIT_ENDPOINTS.UNSKIP(id), {
        method: "DELETE",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(
        queryKeys.habits.list(),
      );

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => {
          let skippedIdx = -1;
          for (let i = habit.schedule_statuses.length - 1; i >= 0; i--) {
            if (habit.schedule_statuses[i].status === "skipped") {
              skippedIdx = i;
              break;
            }
          }
          return {
            ...habit,
            today_skips: Math.max(habit.today_skips - 1, 0),
            today_remaining: Math.min(
              habit.today_remaining + 1,
              habit.times_per_day,
            ),
            schedule_statuses:
              skippedIdx >= 0
                ? habit.schedule_statuses.map((s, i) =>
                    i === skippedIdx ? { ...s, status: "pending" as const } : s,
                  )
                : habit.schedule_statuses,
          };
        }),
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
