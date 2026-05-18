import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { HomeAssistantIntegrationUpdateResponse } from "@hously/shared/types";

export function useUpdateHomeAssistantIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      base_url: string;
      access_token: string;
      enabled_entity_ids: string[];
      enabled: boolean;
    }) =>
      fetcher<HomeAssistantIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.HOME_ASSISTANT,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.homeAssistant(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.homeAssistantWidget(),
      });
    },
  });
}
