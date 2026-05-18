import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { ScrutinyIntegration } from "@hously/shared/types";

export function useScrutinyIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.scrutiny(),
    queryFn: () =>
      fetcher<{ integration: ScrutinyIntegration }>(
        INTEGRATION_ENDPOINTS.SCRUTINY,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
