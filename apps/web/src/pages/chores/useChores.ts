import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { CHORES_ENDPOINTS } from "@/lib/endpoints";
import type { ChoresResponse } from "@hously/shared/types";

export function useChores() {
  const fetcher = useFetcher();

  return useQuery({
    queryKey: queryKeys.chores.list(),
    queryFn: () => fetcher<ChoresResponse>(CHORES_ENDPOINTS.LIST),
  });
}
