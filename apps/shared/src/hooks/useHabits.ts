import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HABIT_ENDPOINTS } from '../endpoints/habits';
import { useFetcher } from './context';
import { queryKeys } from '../queryKeys';
import type { CreateHabitRequest, HabitHistoryResponse, HabitsResponse, UpdateHabitRequest } from '../types/habits';

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
      fetcher(HABIT_ENDPOINTS.COMPLETE(id), {
        method: 'POST',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      if (previousHabits) {
        queryClient.setQueryData<HabitsResponse>(queryKeys.habits.list(), {
          ...previousHabits,
          habits: previousHabits.habits.map((habit) => {
            if (habit.id === id) {
              return {
                ...habit,
                today_completions: Math.min(habit.today_completions + 1, habit.times_per_day),
              };
            }
            return habit;
          }),
        });
      }

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
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
      fetcher(HABIT_ENDPOINTS.UNCOMPLETE(id), {
        method: 'DELETE',
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits.list() });

      const previousHabits = queryClient.getQueryData<HabitsResponse>(queryKeys.habits.list());

      if (previousHabits) {
        queryClient.setQueryData<HabitsResponse>(queryKeys.habits.list(), {
          ...previousHabits,
          habits: previousHabits.habits.map((habit) => {
            if (habit.id === id) {
              return {
                ...habit,
                today_completions: Math.max(habit.today_completions - 1, 0),
              };
            }
            return habit;
          }),
        });
      }

      return { previousHabits };
    },
    onError: (_err, _id, context) => {
      if (context?.previousHabits) {
        queryClient.setQueryData(queryKeys.habits.list(), context.previousHabits);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.habits.all });
    },
  });
};