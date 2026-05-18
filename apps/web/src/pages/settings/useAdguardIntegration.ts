import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { AdguardIntegration } from "@hously/shared/types";

export function useAdguardIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.adguard(),
    queryFn: () =>
      fetcher<{ integration: AdguardIntegration }>(
        INTEGRATION_ENDPOINTS.ADGUARD,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
