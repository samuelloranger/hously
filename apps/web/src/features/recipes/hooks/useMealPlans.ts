import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../lib/queryKeys";
import { mealPlansApi } from "../api";

export function useMealPlans(start_date?: string, end_date?: string) {
  return useQuery({
    queryKey: queryKeys.mealPlans.list(start_date, end_date),
    queryFn: () => mealPlansApi.getMealPlans(start_date, end_date),
  });
}
