import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetcher } from "@/lib/api/context";
import { queryKeys } from "@/lib/queryKeys";
import { INTEGRATION_ENDPOINTS } from "@/lib/endpoints";
import type { UptimekumaIntegrationUpdateResponse } from "@hously/shared/types";

export function useUpdateUptimekumaIntegration() {
  const fetcher = useFetcher();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      website_url: string;
      api_key?: string;
      enabled: boolean;
    }) =>
      fetcher<UptimekumaIntegrationUpdateResponse>(
        INTEGRATION_ENDPOINTS.UPTIMEKUMA,
        {
          method: "PUT",
          body: data,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.uptimekuma(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.uptimekumaMonitors(),
      });
    },
  });
}
