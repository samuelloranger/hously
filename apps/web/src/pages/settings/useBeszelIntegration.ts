import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { BeszelIntegration } from "@hously/shared/types";

export function useBeszelIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.beszel(),
    queryFn: () =>
      fetcher<{ integration: BeszelIntegration }>(INTEGRATION_ENDPOINTS.BESZEL),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
