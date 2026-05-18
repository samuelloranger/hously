import { useQuery } from "@tanstack/react-query";
import { HABIT_ENDPOINTS } from "@/lib/endpoints";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import type { HabitsResponse } from "@hously/shared/types";

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
