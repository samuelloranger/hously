import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { UptimekumaIntegration } from "@hously/shared/types";

export function useUptimekumaIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.uptimekuma(),
    queryFn: () =>
      fetcher<{ integration: UptimekumaIntegration }>(
        INTEGRATION_ENDPOINTS.UPTIMEKUMA,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
