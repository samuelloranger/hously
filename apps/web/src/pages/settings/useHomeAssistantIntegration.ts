import { useQuery } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { HomeAssistantIntegration } from "@hously/shared/types";

export function useHomeAssistantIntegration() {
  const fetcher = useFetcher();
  return useQuery({
    queryKey: queryKeys.integrations.homeAssistant(),
    queryFn: () =>
      fetcher<{ integration: HomeAssistantIntegration }>(
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT,
      ),
    refetchOnMount: "always",
    staleTime: 0,
  });
}
