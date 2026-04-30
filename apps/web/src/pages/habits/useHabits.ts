import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type {
  CreateHabitRequest,
  HabitsResponse,
  HabitStatusResponse,
  UpdateHabitRequest,
} from "@hously/shared/types";

type Habit = HabitsResponse["habits"][number];
type ScheduleStatus = Habit["schedule_statuses"][number]["status"];

const updateHabitStatus = (
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

const replaceFirstStatus = (
  statuses: Habit["schedule_statuses"],
  match: ScheduleStatus,
  replacement: ScheduleStatus,
) => {
  const idx = statuses.findIndex((s) => s.status === match);
  return idx >= 0
    ? statuses.map((s, i) => (i === idx ? { ...s, status: replacement } : s))
    : statuses;
};

const replaceLastStatus = (
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

const useHabitStatusMutation = (config: {
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
