import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HABIT_ENDPOINTS } from '../endpoints/habits';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import type {
  CreateHabitRequest,
  HabitHistoryResponse,
  HabitsResponse,
  HabitStatusResponse,
  UpdateHabitRequest,
} from '../types/habits';

const updateHabitStatus = (
  previousHabits: HabitsResponse | undefined,
  id: number,
  updater: (habit: HabitsResponse['habits'][number]) => HabitsResponse['habits'][number]
) => {
  if (!previousHabits) return previousHabits;

  return {
    ...previousHabits,
    habits: previousHabits.habits.map((habit) => (habit.id === id ? updater(habit) : habit)),
  };
};

const syncHabitStatus = (
  previousHabits: HabitsResponse | undefined,
  id: number,
  response: HabitStatusResponse
) => updateHabitStatus(previousHabits, id, (habit) => ({
  ...habit,
  today_completions: response.completions,
  today_skips: response.skipped,
  today_remaining: response.remaining,
}));

export const useHabits = () => {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.habits.list(),
    queryFn: () => fetcher<HabitsResponse>(HABIT_ENDPOINTS.LIST),
  });
};

export const useHabitHistory = (id: number, days?: number) => {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.habits.history(id),
    queryFn: () => {
      let url = HABIT_ENDPOINTS.HISTORY(id);
      if (days) {
        url += `?days=${days}`;
      }
      return fetcher<HabitHistoryResponse>(url);
    },
    enabled: !!id,
  });
};

export const useCreateHabit = () => {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHabitRequest) =>
      fetcher(HABIT_ENDPOINTS.CREATE, {
        method: 'POST',
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
        method: 'PUT',
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
        method: 'DELETE',
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
        method: 'POST',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => ({
          ...habit,
          today_completions: habit.today_completions + (habit.today_remaining > 0 ? 1 : 0),
          today_remaining: Math.max(habit.today_remaining - 1, 0),
        }))
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        (current) => syncHabitStatus(current, id, response)
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
        method: 'DELETE',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => ({
          ...habit,
          today_completions: Math.max(habit.today_completions - 1, 0),
          today_remaining: Math.min(habit.today_remaining + 1, habit.times_per_day),
        }))
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        (current) => syncHabitStatus(current, id, response)
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
        method: 'POST',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => ({
          ...habit,
          today_skips: habit.today_skips + (habit.today_remaining > 0 ? 1 : 0),
          today_remaining: Math.max(habit.today_remaining - 1, 0),
        }))
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        (current) => syncHabitStatus(current, id, response)
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
        method: 'DELETE',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        updateHabitStatus(previousHabits, id, (habit) => ({
          ...habit,
          today_skips: Math.max(habit.today_skips - 1, 0),
          today_remaining: Math.min(habit.today_remaining + 1, habit.times_per_day),
        }))
      );

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
    },
    onSuccess: (response, id) => {
      queryClient.setQueryData<HabitsResponse>(
        queryKeys.habits.list(),
        (current) => syncHabitStatus(current, id, response)
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};
